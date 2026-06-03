#!/usr/bin/env node
/**
 * Single-source-of-truth guard (Track A — ADR-0003).
 *
 * CommandVue's theme system has ONE authored source of color truth: the
 * `--color-*` / `--p-*` CSS-variable namespace, emitted by the theme generator
 * and overridable from the theme UI. Every UI surface must paint from those
 * tokens so a theme recolors the whole app with no code edits. The way that
 * guarantee rots is a contributor hardcoding a raw color (a hex, an
 * `rgb()/oklch()` literal, or a Tailwind PALETTE utility like `bg-slate-500`)
 * into a component — it then ignores the theme forever.
 *
 * This script fails the build when a raw color literal appears in the
 * UI-PRIMITIVE layer — the Volt-vendored components (`src/volt/**`) and the
 * hand-rolled wrappers (`src/components/ui/**`). Those files must reference theme
 * tokens only (`bg-surface-0`, `text-[var(--color-...)]`, …), never a primitive.
 *
 * Scope note: this intentionally guards the primitive layer, where the
 * token-only discipline is absolute. Data-visualization colors inside panels
 * (chart series, map symbology) are a separate concern and out of scope here.
 *
 * Allowlist: a small, explicit set of known exceptions, each tagged with the
 * phase that removes it. Anything NOT on the allowlist is a hard failure. Stale
 * allowlist entries (that no longer match anything) are reported so they get
 * pruned when the owning phase lands.
 *
 * Run: `pnpm check:single-source` (wired into CI's quality gate).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

/** Directories whose `.vue` / `.ts` files must use theme tokens only. */
const SCAN_DIRS = ["src/volt", "src/components/ui"];

/**
 * Files exempt from the scan. The color-PICKER widgets and their swatch data
 * legitimately deal in raw color VALUES — that is their entire purpose (letting
 * a user choose a color). They are color inputs, not themed surfaces, so the
 * "tokens only" rule does not apply to them.
 */
const EXCLUDE_FILES = new Set([
  "src/components/ui/colors.ts",
  "src/components/ui/ColorPicker.vue",
  "src/components/ui/ColorSwatchPicker.vue",
]);

/** The Tailwind primitive color ramps that must never be used directly. */
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

/** Color-property utility prefixes that take a color (e.g. `bg-`, `text-`). */
const COLOR_PROP =
  "bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration|divide|placeholder|caret|accent|ring-offset";

const RULES = [
  {
    id: "palette-utility",
    // e.g. `bg-slate-500`, `dark:p-invalid:border-red-300`, `text-green-700`
    re: new RegExp(`(?:^|[\\s:])(?:${COLOR_PROP})-(?:${PALETTE})-\\d{2,3}\\b`, "g"),
    msg: "raw Tailwind palette color — use a theme token (e.g. surface-*/--color-*)",
  },
  {
    id: "hex-literal",
    re: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    msg: "hex color literal — use a theme token",
  },
  {
    id: "color-function-literal",
    // A raw color function. `color-mix(in oklch, …)` is fine (its space keyword
    // is not followed by `(`); a literal `oklch(…)` / `rgb(…)` is flagged.
    re: /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/g,
    msg: "raw color function — use a theme token (var(--color-*))",
  },
];

/**
 * Known, intentional exceptions. A flagged line is allowed only if an entry
 * matches its file AND its text. KEEP THIS SMALL and tagged with the phase that
 * removes it.
 */
const ALLOWLIST = [
  {
    file: "src/volt/Tag.vue",
    line: /p-(?:success|info|warn|danger):/,
    reason: "severity palette → `--color-status-*` tokens (Track A A1b)",
  },
  {
    file: "src/volt/Checkbox.vue",
    line: /p-invalid:/,
    reason: "invalid-state red → `--color-status-danger` (Track A A1b)",
  },
  {
    file: "src/volt/InputText.vue",
    line: /p-invalid:/,
    reason: "invalid-state red → `--color-status-danger` (Track A A1b)",
  },
  {
    file: "src/volt/Textarea.vue",
    line: /p-invalid:/,
    reason: "invalid-state red → `--color-status-danger` (Track A A1b)",
  },
];

/** Recursively collect `.vue` / `.ts` files under a directory. */
function collect(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // dir doesn't exist yet — skip
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(vue|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function isAllowed(relFile, lineText) {
  const norm = relFile.split(sep).join("/");
  return ALLOWLIST.some((a) => a.file === norm && a.line.test(lineText));
}

const files = SCAN_DIRS.map((d) => join(ROOT, d)).flatMap((d) => collect(d, []));
const violations = [];
const allowlistHits = new Set();

for (const file of files) {
  const rel = relative(ROOT, file);
  const norm = rel.split(sep).join("/");
  if (EXCLUDE_FILES.has(norm)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((text, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text)) !== null) {
        const matched = m[0].trim();
        if (isAllowed(rel, text)) {
          ALLOWLIST.forEach((a, idx) => {
            if (a.file === norm && a.line.test(text)) allowlistHits.add(idx);
          });
          continue;
        }
        violations.push({ rel, line: i + 1, rule: rule.id, matched, msg: rule.msg });
      }
    }
  });
}

const staleAllowlist = ALLOWLIST.map((a, idx) => ({ a, idx })).filter(
  ({ idx }) => !allowlistHits.has(idx),
);

if (staleAllowlist.length > 0) {
  console.warn("⚠ Stale single-source allowlist entries (no longer matched — remove them):");
  for (const { a } of staleAllowlist) console.warn(`   - ${a.file}: ${a.reason}`);
  console.warn("");
}

if (violations.length > 0) {
  console.error(
    `✖ single-source guard: ${violations.length} raw color literal(s) in the UI-primitive layer.\n` +
      `  These must paint from theme tokens so a theme recolors them (ADR-0003).\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  [${v.rule}]  "${v.matched}"\n      → ${v.msg}`);
  }
  console.error(
    `\n  If a literal is genuinely unavoidable, add a tagged entry to ALLOWLIST in\n` +
      `  scripts/check-single-source.mjs (and explain why in the PR).`,
  );
  process.exit(1);
}

console.log(
  `✓ single-source guard: ${files.length} UI-primitive files clean ` +
    `(${ALLOWLIST.length} allowlisted exception${ALLOWLIST.length === 1 ? "" : "s"}, pending A1b).`,
);
