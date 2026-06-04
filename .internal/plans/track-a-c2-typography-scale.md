# Track A — C2 — Typography: Font Roles + Type-Scale Generator Input

> **Branch:** `feat/c2-typography` → PR to `develop`.
> **Authoritative design:** `.internal/specs/track-a-theme-studio-comprehensive.md` §3B.1–2, §4, §5, §6.2.
> **Binding integration authority (this doc obeys verbatim, supersedes the standalone C2 design where they differ):**
>
> - _Unified data-model & portability evolution_ (no version bumps; additive field set; conditional-assign discipline).
> - _Phase sequencing & shippable slices_ (**C6 ships the tab shell first**; C2 is a body-fill into an existing tab; the `overrides` seam is **owned by C6**; `--font-family-heading` is **owned by C2**; token-count guard rule).
> - _Open-decisions resolution_ (D4 hybrid type scale; **emit `--text-*--line-height` companions**; default `baseSize 16 / ratio 1.2` + "Match current"; D-WRITER single-writer model; D-SEED lazy-null materialize; D-ENGINE no `ENGINE_VERSION` bump; D-TOK-C2 ownership + real heading consumer).
> - _Cross-phase test/CI/doc-sync strategy_ (5 drift guards; 6-file doc-sync; `ResizeObserver` stub; 2-stage verification template).
>
> Where the original standalone C2 design proposed a parallel `overrides` ref, a `fonts?` engine field, or a self-built Tabs shell, **those are removed** per the integration sections and the gap-hunt. This doc is the reconciled, execution-ready plan.

---

## Goal

Make **typography** the next fully-themeable, live-previewable surface in the Theme Studio (§3B.1–2):

1. **Font-family roles** — surface `--font-family-body`, `--font-family-sans`, `--font-family-mono`, and a **new** `--font-family-heading` as first-class settable tokens. C2 **owns** `--font-family-heading` (token + default + allowlist + a real `h1..h6` consumer + emission seam + doc).
2. **Type-scale generator input** — add `GenerationInputV2.typeScale?: { baseSize; ratio }`. When present, the engine derives the whole `--text-*` ramp (`--text-xs … --text-4xl`, 8 tokens) **and their `--text-*--line-height` companions** (8 more) from a modular scale (`baseSize × ratio^step`). These keys exist as fixed primitives in `tokens.css` today; C2 makes them _generated_ additively (the fixed `tokens.css` values remain cascade fallbacks; the engine emits them only when `typeScale` is present). **No `ENGINE_VERSION` / `THEME_SCHEMA_VERSION` bump.**
3. **Per-step / per-role manual override path** — each `--text-*` step and each font-family role is editable individually as a sparse `overrides` entry, layered over the generated/fixed base via the **C6-owned `useThemeAuthoring.overrides` ref** and the single merged-push live-apply writer.
4. **A unit-tested `deriveTypeScale` runtime** — a pure, isolated module computing the ramp + line-heights; unit-tested without UI or the engine.

## Architecture

- **Engine (pure, additive):** `src/modules/themes/typeScale.ts` maps `TypeScaleInput → Record<string,string>` of 16 keys (8 sizes + 8 line-heights). `generate.ts` calls it **only inside `if (input.typeScale)`** — additive-emit pattern identical to the existing `if (input.fontFamily)` (`generate.ts:467`) and `if (hasStatusOverride)` (`generate.ts:478`) blocks. Absent field → zero new keys → byte-identical output for every pre-C2 theme → `ENGINE_VERSION` stays `1`.
- **Data model (one additive optional field):** `GenerationInputV2.typeScale?` rides inside `{ kind: "generated"; input }`. Forwarded by `toGenInput` and `buildGenerationInput` with **conditional-assign** (never spread `undefined`) so an unset `typeScale` serializes identically to a pre-C2 theme → same `resolve()` memo key (`${ENGINE_VERSION}:${JSON.stringify(base.input)}`, `resolve.ts:69`) → cache hit → no drift.
- **Live preview (reuse the shipped overlay + the C6 single-writer):** the type-scale control (a generation input) drives `generationResult` → the panel's `watch(a.generationResult, applyToApp)` → `themeStore.previewThemeTokens(merged, density)` where `merged = { ...generationResult.tokens, ...a.overrides.value }`. Per-step / per-role edits mutate `a.overrides` → the same merged wholesale push. `usePopoutThemeSync`'s `MutationObserver` mirrors all `--*` props (incl. `--text-*`, `--text-*--line-height`, `--font-family-*`) to every pop-out for free.
- **Why `--text-*` live-recolors with zero rebuild (load-bearing, Context7-verified `/tailwindlabs/tailwindcss.com`):** `--text-*` (`tokens.css:235–242`) and `--font-family-*` (`tokens.css:226–229`) live inside the single **plain `@theme {}`** block (`tokens.css:40–`, not `@theme inline`). Plain `@theme` generates `.text-sm { font-size: var(--text-sm); … }`, so an inline override of `--text-sm` on `APP_ROOT` live-resizes every `text-sm` consumer with no Vite reload. **C2 must not move these tokens out of `@theme` and must not switch the block to `@theme inline`** — either breaks the mechanism.
- **UI (library-first, body-fill into C6's tab):** a **Typography** tab body mounted into the C6-owned `<Tabs scrollable>` shell via the single-default-slot `v-if="activeTab === 'typography'"` contract. Controls are existing primitives only: `ui/Select`, `volt/InputNumber`, `volt/Checkbox`, `ui/IconButton`. No new UI primitive.

## Tech

Vue 3 + Vite + TS (strict), PrimeVue 4 unstyled + Volt + Tailwind v4, Pinia, idb, `es-toolkit` (`clamp`, `debounce`), Vitest + @vue/test-utils, Playwright MCP for Stage-1 verification.

## Dependencies & ordering (per _Phase sequencing_)

- **Hard predecessor: C6** (IA shell + `studioTabs.ts` + `useThemeAuthoring.overrides` seam + merged single-writer apply rule + `[data-density="comfortable"]` block + `Tabs.vue` `panelsClass` prop). C2 mounts its body into C6's `typography` placeholder and **consumes** `a.overrides` / `a.setOverride` / `a.clearOverride`. **C2 does not introduce a Tabs shell, an `activeTab` ref, or a second override store.**
- **Hard predecessor: C1** (Tokens) — creates `src/modules/themes/tokenManifest.ts` + its set-equality drift guard (G5). C2 appends its `"typography"` section rows to the manifest in this PR. The "ship a fallback manifest if C1 hasn't landed" path is **forbidden** (C1 is a hard Wave-2 gate; C2 is Wave 3).
- **Soft / none with C3, C5, C4** — C3 (Fonts) layers font _loading_ onto C2's role rows later and populates `--font-family-heading` via `fontSpec.heading`; C2 ships the token + a real `h1..h6` consumer + curated-stack role rows (no network). C2's `typeScale` is disjoint from C5's `effects` and C4's chrome.
- **Task 0 gate (mandatory):** at branch time, confirm C6 and C1 are on `develop` (`git ls-files` + grep `ThemeStudioPanel.vue` for `activeTab`/`<Tabs`; confirm `src/modules/themes/tokenManifest.ts` and `src/components/panels/theme-studio/studioTabs.ts` exist). If either predecessor is absent, **stop and escalate** — do not introduce a second shell or a fallback manifest.

---

## File Structure

### New files

| File                                                   | Responsibility                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/themes/typeScale.ts`                      | Pure deriver: `TypeScaleInput → Record<string,string>` of 8 `--text-*` sizes + 8 `--text-*--line-height` companions. Exports `TYPE_SCALE_STEPS`, `TYPE_SCALE_BOUNDS`, `DEFAULT_TYPE_SCALE`, `FIXED_RAMP_FALLBACK`, `deriveTypeScale`. No engine/DOM/Vue imports. |
| `tests/unit/themes/typeScale.spec.ts`                  | Deriver unit spec: 16 keys, monotonic sizes, base==baseSize/16 rem, line-height pairing, determinism, every key `isKnownToken`. (No clamp test — the deriver does not clamp; out-of-range rejection is a Zod/portable concern, see T9.)                          |
| `src/components/panels/theme-studio/TypographyTab.vue` | The Typography tab body (font-role rows + type-scale control + ramp readout + per-step grid + preview heading sample). Mounted by `ThemeStudioPanel.vue` under `v-if="activeTab === 'typography'"`. Token-pure (no raw colors).                                  |

### Modified files

| File                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types/theme.ts`                                 | Add `TypeScaleInput` interface; add `typeScale?: TypeScaleInput` to `GenerationInputV2` (after `statusOverrides`, per the canonical field order). No version-constant change.                                                                                                                                                                                                                                                                    |
| `src/modules/themes/generate.ts`                     | Add `typeScale?: TypeScaleInput` to `ThemeGenerationInput`; import `deriveTypeScale`; add the additive `if (input.typeScale)` emission block; carry `typeScale` (conditional spread) into `generatePairedVariant`. **No `fonts?` engine field** (removed per gap-hunt — see Task 5 note).                                                                                                                                                        |
| `src/modules/themes/resolve.ts`                      | `toGenInput` conditional-forwards `typeScale`; update the memo-key doc comment to name `typeScale`.                                                                                                                                                                                                                                                                                                                                              |
| `src/modules/themes/knownTokens.ts`                  | Add `--font-family-heading` to `THEMEABLE_PRIMITIVE_TOKEN_NAMES`; add new `TYPE_SCALE_TOKEN_NAMES` (8 sizes) and `TYPE_SCALE_LINE_HEIGHT_TOKEN_NAMES` (8 companions); spread both into `ALL_KNOWN_TOKEN_NAMES`; add a no-duplicate-names guard assertion source if not already present from C1.                                                                                                                                                  |
| `src/assets/styles/tokens.css`                       | Add `--font-family-heading: var(--font-family-display);` in the `@theme` Typography section; add the 8 `--text-*--line-height` companion primitives (with today's effective Tailwind line-heights as fixed fallbacks). Add a base-layer `h1..h6 { font-family: var(--font-family-heading); }` consumer.                                                                                                                                          |
| `src/modules/themes/portableSchema.ts`               | Add `typeScale` to `GenerationInputV2Schema` (plain `z.object`, **bounds == deriver range; out-of-range REJECTED, not clamped** — see Task 8).                                                                                                                                                                                                                                                                                                   |
| `src/composables/useThemeAuthoring.ts`               | Add `typeScale: Ref<TypeScaleInput \| null>` (lazy-null), a `typeScaleEnabled` computed, and getter/setter computed proxies for `baseSize`/`ratio`; include `typeScale` in `generationResult` and `buildGenerationInput` (conditional-assign); seed from `base.input.typeScale` in `seedFromTheme` (generated base only); clear to `null` in `reset()`; expose `TYPE_SCALE_BOUNDS`, `FONT_ROLE_OPTIONS`, and a `matchCurrentTypeScale()` helper. |
| `src/components/panels/ThemeStudioPanel.vue`         | Replace the C6 `StudioTabPlaceholder` for `typography` with `<TypographyTab … />`; move the existing single "Font family" `Select` (currently in Generate controls) into the Typography tab's Body/Sans role row.                                                                                                                                                                                                                                |
| `src/modules/themes/curated-swatches.ts`             | Extend `CURATED_FONTS` with system-safe heading/mono stacks (a serif heading stack; a mono stack) for the role dropdowns. No structural change.                                                                                                                                                                                                                                                                                                  |
| `src/modules/themes/tokenManifest.ts`                | Append `"typography"`-section rows for `--font-family-heading` (kind `font-stack`), the 8 `--text-*` (kind `length`), and the 8 `--text-*--line-height` (kind `length`).                                                                                                                                                                                                                                                                         |
| `docs/theme-schema-for-llms.md`                      | Extend the Typography section to mention `--font-family-body/-heading` and the `--text-*` ramp + line-height companions.                                                                                                                                                                                                                                                                                                                         |
| `docs/theme-generation-algorithm.md`                 | Add a "Type scale" subsection (`baseSize × ratio^step`, line-height pairing).                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/design-tokens.md`                              | Document `--font-family-heading` (new) + note `--text-*` (+ companions) are now themeable/generated.                                                                                                                                                                                                                                                                                                                                             |
| `tests/unit/docs/theme-schema-for-llms.spec.ts`      | Add a typography-token mention assertion (drift guard).                                                                                                                                                                                                                                                                                                                                                                                          |
| `tests/unit/themes/generate.spec.ts`                 | Keep the minimal-input `[70,85]` bound untouched; add dedicated type-scale present/absent + paired-symmetry + exact-delta count tests.                                                                                                                                                                                                                                                                                                           |
| `tests/unit/themes/resolve.spec.ts`                  | `toGenInput` forwards/omits `typeScale`; memo-identity for absent vs conditional; override-wins.                                                                                                                                                                                                                                                                                                                                                 |
| `tests/unit/themes/engine-stability.spec.ts`         | No-`typeScale` re-resolves byte-identical; with-`typeScale` re-resolves byte-identical.                                                                                                                                                                                                                                                                                                                                                          |
| `tests/unit/themes/portable.spec.ts`                 | `typeScale` round-trip + out-of-range rejection.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tests/unit/composables/useThemeAuthoring.spec.ts`   | `typeScale` build/seed/reset/lazy-materialize; both build paths include it.                                                                                                                                                                                                                                                                                                                                                                      |
| `dictionaries/project.txt` / `dictionaries/tech.txt` | Add CSpell-flagged terms (`modular`, ratio names) if flagged.                                                                                                                                                                                                                                                                                                                                                                                    |

---

## Ordered tasks

> Branch: `git checkout develop && git pull origin develop && git checkout -b feat/c2-typography`.
> Run Task 0 (predecessor gate) before any edit. Commit in coherent chunks; the 6-file doc-sync change (tokens.css + knownTokens + generate + LLM doc + manifest + guard test) lands together.

### T0 — Predecessor gate (no edits)

Confirm C6 + C1 merged. Concretely:

- `src/components/panels/theme-studio/studioTabs.ts` exists and exports `STUDIO_L1_TABS` containing a `typography` entry; `ThemeStudioPanel.vue` already renders `<Tabs scrollable v-model="activeTab" :tabs="STUDIO_L1_TABS">` with `StudioTabPlaceholder` for `typography`.
- `src/composables/useThemeAuthoring.ts` exports `overrides: Ref<Record<string,string>>`, `setOverride`, `clearOverride`, `clearAllOverrides`, and `previewTokens` (the merged computed).
- `src/modules/themes/tokenManifest.ts` + `tests/unit/themes/tokenManifest.spec.ts` exist.
- `src/components/ui/Tabs.vue` exposes `scrollable` and a single default panel slot; `panelsClass` prop present (C6).
- `tests/setup.ts` registers a global `ResizeObserver` stub (C6).

**Acceptance:** all four artifacts present. If any missing → stop, do not proceed, escalate (per _Phase sequencing_ §0.1 / §0.3). Read `useThemeAuthoring.ts` and `Tabs.vue` in full before coding so the exact `overrides` API and slot contract are confirmed, not assumed.

---

### T1 — Type + bounds + deriver (with line-height companions)

**Files:** `src/types/theme.ts`, `src/modules/themes/typeScale.ts` (NEW).

**`src/types/theme.ts`** — add `TypeScaleInput` directly above `GenerationInputV2`, and the optional field after `statusOverrides` (canonical order):

```ts
/** Inputs to the modular type-scale deriver (Track A C2). */
export interface TypeScaleInput {
  /** Base font size in px for the `--text-base` step. Range 10–24 (out-of-range rejected by Zod, not clamped). */
  baseSize: number;
  /** Modular ratio (e.g. 1.2 = minor third). Range 1.0–1.333 (out-of-range rejected by Zod, not clamped). */
  ratio: number;
}
```

```ts
// in GenerationInputV2, after `statusOverrides?: StatusOverrides;`:
/**
 * Modular type-scale generator input (Track A C2). When present the engine
 * derives the `--text-xs … --text-4xl` ramp AND their `--text-*--line-height`
 * companions via baseSize × ratio^step; when absent the fixed tokens.css ramp
 * is the cascade fallback (additive — §3i). Per-step tweaks live in `overrides`.
 */
typeScale?: TypeScaleInput;
```

**`src/modules/themes/typeScale.ts`** — pure deriver:

```ts
import type { TypeScaleInput } from "@/types/theme";
import { isKnownToken } from "./knownTokens";

/** Step offsets relative to `--text-base` (exponent on the ratio). base = 0. */
export const TYPE_SCALE_STEPS = [
  { token: "--text-xs", lh: "--text-xs--line-height", step: -2 },
  { token: "--text-sm", lh: "--text-sm--line-height", step: -1 },
  { token: "--text-base", lh: "--text-base--line-height", step: 0 },
  { token: "--text-lg", lh: "--text-lg--line-height", step: 1 },
  { token: "--text-xl", lh: "--text-xl--line-height", step: 2 },
  { token: "--text-2xl", lh: "--text-2xl--line-height", step: 3 },
  { token: "--text-3xl", lh: "--text-3xl--line-height", step: 4 },
  { token: "--text-4xl", lh: "--text-4xl--line-height", step: 5 },
] as const;

/** Bounds — surfaced by the Studio controls and enforced by Zod (the single
 *  enforcement point: out-of-range is REJECTED at import/persist, never clamped,
 *  so the persisted value always equals the rendered value). Ratio max is capped
 *  at 1.333 (perfect fourth) so derived line-heights stay legible (D4). */
export const TYPE_SCALE_BOUNDS = {
  baseSize: { min: 10, max: 24, default: 16, step: 0.5 },
  ratio: { min: 1.0, max: 1.333, default: 1.2, step: 0.01 },
} as const;

export const DEFAULT_TYPE_SCALE: TypeScaleInput = {
  baseSize: TYPE_SCALE_BOUNDS.baseSize.default,
  ratio: TYPE_SCALE_BOUNDS.ratio.default,
};

/** Today's fixed tokens.css ramp (rem) — used by the "Match current" seed so
 *  enabling the scale is visually neutral until the user moves a slider. */
export const FIXED_RAMP_FALLBACK: Record<string, string> = {
  "--text-xs": "0.75rem",
  "--text-sm": "0.875rem",
  "--text-base": "1rem",
  "--text-lg": "1.125rem",
  "--text-xl": "1.25rem",
  "--text-2xl": "1.5rem",
  "--text-3xl": "1.875rem",
  "--text-4xl": "2.25rem",
};

/** Line-height multiplier per derived size (unitless). Larger text gets tighter
 *  leading; small text gets generous leading. Keeps lines from clipping at high
 *  ratios — the size+leading grow together (resolves the C2 line-height MAJOR). */
function leadingFor(remSize: number): number {
  if (remSize >= 1.5) return 1.15;
  if (remSize >= 1.125) return 1.25;
  return 1.5;
}

/**
 * Derive the `--text-*` ramp + `--text-*--line-height` companions from a modular
 * scale. Each size is `baseSize × ratio^step` px → rem (÷16), rounded to 4 dp,
 * emitted as `"<n>rem"`. Each companion is a unitless number string. Pure +
 * deterministic. Does NOT clamp: out-of-range values are rejected upstream by Zod
 * (Zod range == TYPE_SCALE_BOUNDS) at the import/persist boundary, so the deriver
 * only ever sees in-range input and the persisted value always equals what renders.
 */
export function deriveTypeScale(input: TypeScaleInput): Record<string, string> {
  const { baseSize, ratio } = input;
  const out: Record<string, string> = {};
  for (const { token, lh, step } of TYPE_SCALE_STEPS) {
    const rem = Math.round(((baseSize * Math.pow(ratio, step)) / 16) * 1e4) / 1e4;
    out[token] = `${rem}rem`;
    out[lh] = String(leadingFor(rem));
  }
  return out;
}

/** Dev-only sanity: every emitted key must be allowlisted. */
export function deriveTypeScaleKnownTokenCheck(): boolean {
  return TYPE_SCALE_STEPS.every((s) => isKnownToken(s.token) && isKnownToken(s.lh));
}
```

**Acceptance:** `pnpm type-check` clean; a quick node import of `deriveTypeScale({baseSize:18,ratio:1.25})` returns `--text-base: "1.125rem"` and `--text-base--line-height: "1.25"`, and `--text-lg: "1.4063rem"`. Sizes strictly increase xs→4xl.

---

### T2 — Deriver unit spec

**File:** `tests/unit/themes/typeScale.spec.ts` (NEW).

Assertions:

- `deriveTypeScale(DEFAULT_TYPE_SCALE)` returns 16 keys (8 sizes + 8 line-heights); each size is `"<n>rem"`, each companion is a bare numeric string.
- Monotonic sizes: parse the rem numbers, assert `xs < sm < base < lg < xl < 2xl < 3xl < 4xl`.
- `--text-base` for `{baseSize:16, ratio:r}` equals `1rem` for any `r`.
- `{baseSize:18, ratio:1.25}` → `--text-base` = `1.125rem`, `--text-lg` = `1.4063rem`.
- Line-height pairing: every `--text-*` has a matching `--text-*--line-height`; large steps get tighter leading than small steps.
- No clamping: the deriver does not clamp — it computes faithfully from whatever in-range input it is given (out-of-range rejection is enforced by Zod at import/persist, covered in T9 portable, not here). The deriver-bounds guarantee comes from the Studio control `min`/`max` + Zod, so the deriver only ever receives in-range input.
- Determinism: two identical calls are deep-equal.
- `deriveTypeScaleKnownTokenCheck()` is `true` (every emitted key `isKnownToken`).

**Acceptance:** `pnpm test typeScale` green.

---

### T3 — Allowlist additions + no-duplicate guard

**File:** `src/modules/themes/knownTokens.ts`.

- Add `"--font-family-heading"` to `THEMEABLE_PRIMITIVE_TOKEN_NAMES` right after `"--font-family-mono"`.
- Add two arrays:

```ts
/** Type-scale size primitives (Track A C2). Length-valued (rem). */
export const TYPE_SCALE_TOKEN_NAMES = [
  "--text-xs",
  "--text-sm",
  "--text-base",
  "--text-lg",
  "--text-xl",
  "--text-2xl",
  "--text-3xl",
  "--text-4xl",
] as const;

/** Type-scale line-height companions (Track A C2). Unitless number values. */
export const TYPE_SCALE_LINE_HEIGHT_TOKEN_NAMES = [
  "--text-xs--line-height",
  "--text-sm--line-height",
  "--text-base--line-height",
  "--text-lg--line-height",
  "--text-xl--line-height",
  "--text-2xl--line-height",
  "--text-3xl--line-height",
  "--text-4xl--line-height",
] as const;
```

- Spread both into `ALL_KNOWN_TOKEN_NAMES` (after `THEMEABLE_PRIMITIVE_TOKEN_NAMES`).
- Ensure the cross-array **no-duplicate-names** guard exists (added by C1 or here): a `knownTokens.spec.ts` assertion that no name appears in more than one `*_TOKEN_NAMES` array. This prevents the `--font-family-heading` double-declaration footgun (C2 owns it; C3 must not re-add it).

**Acceptance:** quick node check — `isKnownToken("--text-xs")`, `isKnownToken("--text-xs--line-height")`, and `isKnownToken("--font-family-heading")` are all `true`; `pnpm type-check` clean; the no-duplicate guard passes.

---

### T4 — tokens.css: heading default, line-height primitives, real `h1..h6` consumer

**File:** `src/assets/styles/tokens.css`.

(a) Inside the `@theme {}` Typography section, immediately after `--font-family-display` (`tokens.css:229`):

```css
/* Heading role (Track A C2). Defaults to the display alias so existing
   * built-ins render headings in the sans face until a theme sets it. */
--font-family-heading: var(--font-family-display);
```

> **Note on `--font-family-display`:** `--font-family-display` is an existing NON-allowlisted internal alias (it resolves to `--font-family-sans`); C2 references it only as the `--font-family-heading` cascade DEFAULT and does NOT allowlist or emit it. The C1 manifest therefore does not list it — this is intentional, not a missing allowlist entry.

(b) Immediately after the `--text-*` ramp (`tokens.css:235–242`), add the 8 line-height companion primitives with today's effective Tailwind line-heights as fixed fallbacks (so a no-`typeScale` theme is byte-identical to current rendering):

```css
/* Type-scale line-height companions (Track A C2). Fixed fallbacks match the
   * default Tailwind v4 per-step leading; the engine overrides these only when
   * `typeScale` is set, keeping headings from clipping as sizes grow. */
--text-xs--line-height: 1.5;
--text-sm--line-height: 1.5;
--text-base--line-height: 1.5;
--text-lg--line-height: 1.5;
--text-xl--line-height: 1.375;
--text-2xl--line-height: 1.25;
--text-3xl--line-height: 1.2;
--text-4xl--line-height: 1.1;
```

(c) The `--text-*` ramp **stays in place inside plain `@theme`** — do not move it, do not switch to `@theme inline`.

(d) Add a real consumer so `--font-family-heading` is live end-to-end (not preview-only). In the base layer (outside `@theme`, e.g. alongside existing base resets):

```css
@layer base {
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: var(--font-family-heading);
  }
}
```

**Note:** this adds no new token _names_ beyond those allowlisted in T3, so it does not trigger an extra doc-sync surface beyond the 6 files already in scope. No dark-mode override block (font sizes/families don't vary by mode).

**Acceptance:** grep confirms `--font-family-heading` and all 8 `--text-*--line-height` lines inside the `@theme` block; the `h1..h6` rule present in a base layer; `pnpm build` succeeds; `pnpm dev` renders an `<h1>` in the display/sans face by default.

---

### T5 — Engine emission (additive, gated)

**File:** `src/modules/themes/generate.ts`.

Add to `ThemeGenerationInput`:

```ts
/** Modular type-scale input (Track A C2). Emits the ramp + line-heights only when set. */
typeScale?: TypeScaleInput;
```

Import: `import { deriveTypeScale } from "./typeScale";` and `import type { TypeScaleInput } from "@/types/theme";` (or via the existing types import).

Add the additive block at the bottom of `generateTheme`, after the `if (input.fontFamily)` block (`generate.ts:467`) and the `if (hasStatusOverride)` block (`generate.ts:478`):

```ts
// Type scale (Track A C2). When `typeScale` is set, derive the 8-step `--text-*`
// ramp + their `--text-*--line-height` companions (deriver lives in typeScale.ts,
// unit-tested in isolation). Emitted ONLY when present — absent → the fixed
// tokens.css ramp/leading is the cascade fallback and output is byte-identical to
// pre-C2 (§3i additive contract). No ENGINE_VERSION bump.
if (input.typeScale) {
  Object.assign(tokens, deriveTypeScale(input.typeScale));
}
```

**Paired-variant symmetry** — in `generatePairedVariant` (`generate.ts:535`), carry `typeScale` into the flipped `generateTheme({...})` call with conditional spread so both variants emit the same `--text-*` key set (`generate.spec` asserts key-set equality for pairs):

```ts
...(input.typeScale !== undefined ? { typeScale: input.typeScale } : {}),
```

> **Removed per gap-hunt + integration:** the original standalone design's `fonts?: { body; sans; mono; heading }` engine field is **dropped from C2**. It would be dead code (the C2 UI drives font roles through `overrides`, never `base.input.fonts`) and would create a paired-variant asymmetry (overrides don't propagate to the paired variant). Font roles in C2 are: Body/Sans via the **legacy `fontFamily`** input (emits `-sans` + `-body`, already in the engine), Mono/Heading via **`overrides`**. The structured `fontSpec.fonts` path is C3's addition; C3 wires the engine field when it actually populates it.

**Acceptance:** `generateTheme({...,typeScale:{baseSize:16,ratio:1.2}})` includes all 8 `--text-*` + 8 `--text-*--line-height`; without `typeScale` includes none. A paired theme with `typeScale` emits the same `--text-*` key set in both variants.

---

### T6 — Resolve forwarding (memo hygiene)

**File:** `src/modules/themes/resolve.ts`.

In `toGenInput`, conditional-forward (never spread `undefined`):

```ts
if (input.typeScale !== undefined) out.typeScale = input.typeScale;
```

Update the memo-key doc comment to note `typeScale` is included in `JSON.stringify(base.input)` and that an absent `typeScale` serializes identically to a pre-C2 theme (same key → cache hit → no recompute).

**Acceptance:** `resolve.spec` memo-identity + override-wins tests pass (T13).

---

### T7 — Doc-sync (LLM doc + guard + algorithm + token reference)

**Files:** `docs/theme-schema-for-llms.md`, `tests/unit/docs/theme-schema-for-llms.spec.ts`, `docs/theme-generation-algorithm.md`, `docs/design-tokens.md`.

(a) `docs/theme-schema-for-llms.md` — extend the Typography section:

```md
**Typography (optional):** `--font-family-body`, `--font-family-sans`,
`--font-family-mono`, `--font-family-heading`. Font sizes — the type scale —
are `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`,
`--text-2xl`, `--text-3xl`, `--text-4xl` (length values like `0.875rem`), each
with a `--text-*--line-height` companion (unitless). Set them to override
individual steps, or let the in-app generator derive the whole ramp from a base
size + ratio.
```

Keep the first JSON example envelope at `schemaVersion: 1` (the guard hard-asserts `=== 1`); do **not** add `--text-*` to the example `tokens` object — the prose mention is sufficient for the doc→allowlist guard, and every mentioned name is allowlisted in T3 in the same PR.

(b) `tests/unit/docs/theme-schema-for-llms.spec.ts` — add a drift assertion:

```ts
it("documents the type-scale + font-role typography tokens", () => {
  for (const t of [
    "--font-family-heading",
    "--text-xs",
    "--text-base",
    "--text-4xl",
    "--text-4xl--line-height",
  ]) {
    expect(doc.includes(t), `doc should mention ${t}`).toBe(true);
  }
});
```

(c) `docs/theme-generation-algorithm.md` — add a "Type scale" subsection: `size(step) = baseSize × ratio^step`, rem conversion (÷16), line-height pairing (tighter leading as size grows), default `baseSize 16 / ratio 1.2`, ratio capped at 1.333.

(d) `docs/design-tokens.md` — document `--font-family-heading` (new role, defaults to `var(--font-family-display)`, consumed by `h1..h6`); note `--text-*` and `--text-*--line-height` are now themeable/generated via `typeScale`.

**Acceptance:** `pnpm test theme-schema-for-llms` green (balanced fences, all mentioned tokens known, new assertion passes); `pnpm docs:build` clean.

---

### T8 — Portable schema (bounds aligned to deriver)

**File:** `src/modules/themes/portableSchema.ts`.

Add to `GenerationInputV2Schema` (after the `statusOverrides` line), plain `z.object` (strip unknowns — forward-compat, **not `.strict()`**), **bounds == the deriver range** so a persisted value never renders differently from what it stores. Zod is the single enforcement point: out-of-range is **rejected**, never clamped (resolves the MINOR silent-clamp discrepancy — the deriver itself does no clamping):

```ts
typeScale: z
  .object({
    baseSize: z.number().min(10).max(24),
    ratio: z.number().min(1).max(1.333),
  })
  .optional(),
```

> **Decision (locked):** Zod range == deriver range. An out-of-range import is **rejected with a clear error** rather than silently clamped (the persisted value would otherwise display ≠ its render). Do not widen Zod past the deriver bounds.

Do **not** touch `PortableThemeSchema.schemaVersion` (`z.literal(THEME_SCHEMA_VERSION)` = `z.literal(2)`) or `ThemeBaseSchema`'s discriminant.

**Acceptance:** import of a `typeScale` v2 file validates; `baseSize: 30` or `ratio: 1.6` is rejected with a clear message (T9).

---

### T9 — Portable round-trip spec

**File:** `tests/unit/themes/portable.spec.ts`.

- Round-trip: create/export a generated theme with `typeScale` → `exportThemeToJson` → `importThemeFromJson` → imported `base.input.typeScale` deep-equals; resolved `--text-base` matches `deriveTypeScale(...)["--text-base"]`.
- Out-of-range `typeScale` (e.g. `baseSize: 30`) → rejected with a clear error.
- A v1 file (no `typeScale`) and a pre-C2 v2 file (no `typeScale`) import unaffected (no `--text-*` emitted).

**Acceptance:** `pnpm test portable` green.

---

### T10 — Authoring composable wiring (lazy-null materialize, single-writer)

**File:** `src/composables/useThemeAuthoring.ts`.

- Add `const typeScale = ref<TypeScaleInput | null>(null);` (lazy — a theme opened-but-not-touched introduces no `base.input.typeScale`, preserving byte-identity per D-SEED/D-LAZY).
- `const typeScaleEnabled = computed(() => typeScale.value !== null);`
- Getter/setter computed proxies (never bind `v-model` to `typeScale.value.baseSize` on a null ref):

```ts
const baseSize = computed({
  get: () => typeScale.value?.baseSize ?? TYPE_SCALE_BOUNDS.baseSize.default,
  set: (v) => {
    typeScale.value = { ...(typeScale.value ?? DEFAULT_TYPE_SCALE), baseSize: v };
  },
});
const ratio = computed({
  get: () => typeScale.value?.ratio ?? TYPE_SCALE_BOUNDS.ratio.default,
  set: (v) => {
    typeScale.value = { ...(typeScale.value ?? DEFAULT_TYPE_SCALE), ratio: v };
  },
});
function enableTypeScale() {
  if (!typeScale.value) typeScale.value = { ...DEFAULT_TYPE_SCALE };
}
function disableTypeScale() {
  typeScale.value = null;
}
/** "Match current": seed overrides from the fixed ramp so enabling the scale is
 *  visually neutral until a slider moves (resolves the default-shift surprise). */
function matchCurrentTypeScale() {
  enableTypeScale();
  for (const [k, v] of Object.entries(FIXED_RAMP_FALLBACK)) setOverride(k, v);
}
```

- **`generationResult` computed** and **`buildGenerationInput()`** both conditional-assign `typeScale` when enabled (both build paths — the inline computed object and `buildGenerationInput` — or live preview diverges from save):

```ts
if (typeScale.value) input.typeScale = typeScale.value;
```

- **`seedFromTheme`** — seed from generated base only: `typeScale.value = t.base.kind === "generated" ? (t.base.input.typeScale ?? null) : null;`. Never access `.input` on a static base. Font-role and per-step overrides seed through the existing `overrides` seed path (already C6-owned).
- **`reset()`** — `typeScale.value = null;` (plus the existing `overrides` clear).
- **Expose** in the return object: `typeScale`, `typeScaleEnabled`, `baseSize`, `ratio`, `enableTypeScale`, `disableTypeScale`, `matchCurrentTypeScale`, `TYPE_SCALE_BOUNDS`, `FONT_ROLE_OPTIONS`.
- **`FONT_ROLE_OPTIONS`** — derive the curated-stack option list from `CURATED_FONTS` (+ the new serif/mono stacks); used by the role `Select`s.

> **Live-apply (consumes C6's single-writer, no second writer):** the panel already pushes the merged set `{ ...generationResult.tokens, ...overrides.value }` via `previewThemeTokens`. Because `typeScale` is a generation input, changing `baseSize`/`ratio` recomputes `generationResult` → existing `watch(a.generationResult, applyToApp)` re-fires. Per-step / per-role edits mutate `a.overrides` via `setOverride`/`clearOverride` → C6's `watch(a.overrides, applyToApp, { deep: true })` (debounced) re-fires the **same merged push**. C2 **does not** call `setPreviewToken`/`resetPreviewToken` from the Typography tab.

**Acceptance:** `useThemeAuthoring.spec` new tests green; `pnpm type-check` clean.

---

### T11 — Engine-stability re-assert

**File:** `tests/unit/themes/engine-stability.spec.ts`.

- A v1→v2 migrated theme (no `typeScale`) re-resolves byte-identical to a captured pre-C2 fixture (additive-absent proof).
- A generated theme **with** `typeScale` re-resolves byte-identical across two resolves (additive keys are stable; no `ENGINE_VERSION` bump).
- Assert `ENGINE_VERSION === 1` and `THEME_SCHEMA_VERSION === 2` unchanged.

**Acceptance:** `pnpm test engine-stability` green.

---

### T12 — Typography tab body

**Files:** `src/components/panels/theme-studio/TypographyTab.vue` (NEW), `src/components/panels/ThemeStudioPanel.vue`, `src/modules/themes/curated-swatches.ts`.

**`TypographyTab.vue`** — receives the `useThemeAuthoring` instance (`a`) and `themeStore` via props or injection (match the pattern C6/C1 established for tab bodies). Sections:

**Section A — Font roles** (3 rows; `label + ui/Select`):

| Role row    | Token written                               | Control                                                   | Source of truth                                                          |
| ----------- | ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Body / Sans | `--font-family-sans` + `--font-family-body` | `ui/Select` (`FONT_ROLE_OPTIONS`) bound to `a.fontFamily` | generation input `fontFamily` (engine-emitted)                           |
| Mono        | `--font-family-mono`                        | `ui/Select`                                               | `a.overrides["--font-family-mono"]` via `setOverride`/`clearOverride`    |
| Heading     | `--font-family-heading`                     | `ui/Select`                                               | `a.overrides["--font-family-heading"]` via `setOverride`/`clearOverride` |

Role `Select`s offer **curated stacks only** (no free-text) — no font injection vector in C2 (web-font loading is C3). The existing single "Font family" `Select` from the Generate tab moves here as the Body/Sans row (avoids two font controls). Each Mono/Heading row has a reset `IconButton` (Lucide `RotateCcw`) → `clearOverride(token)`.

> **Heading write-path (unambiguous):** the heading role is set exclusively via `a.overrides["--font-family-heading"]` (the Typography-tab `Select` calling `setOverride`/`clearOverride`). The `fontSpec.heading` field is a C3 type-field for forward-compat only and is **NOT** the write path in C1–C6 — it is not wired to the engine, the overrides ref, or this control in these phases.

**Section B — Type scale** (generation input):

- `volt/Checkbox` "Generate type scale from base size + ratio" → `enableTypeScale()` / `disableTypeScale()` (default **off**). A one-line warning: "Enabling regenerates all text sizes from the formula." A **"Match current"** button → `matchCurrentTypeScale()` (neutral start).
- When on: `volt/InputNumber` **Base size** (px, `min 10 / max 24 / step 0.5`, `v-model="a.baseSize"`) and `volt/InputNumber` **Ratio** (`min 1.0 / max 1.333 / step 0.01`, `v-model="a.ratio"`), with an inline legend naming common ratios (1.125 major-second, 1.2 minor-third, 1.25 major-third, 1.333 perfect-fourth).
- A read-only **ramp readout** computed via `deriveTypeScale({ baseSize: a.baseSize, ratio: a.ratio })` directly in the component (cheap, pure), showing each `--text-*` value (e.g. `xs 0.69rem · sm 0.83rem · base 1rem · …`).

**Section C — Per-step overrides** (manual path):

- 8 rows (`xs … 4xl`): `label + volt/InputNumber` (rem) + reset `IconButton`.
- Each `InputNumber` shows the _effective_ value (override if present, else generated/fixed, read via `getComputedStyle(APP_ROOT).getPropertyValue("--text-lg").trim()` for seeding — **computed value, not the sparse map**, per D-SEED §0.4) and writes `a.setOverride("--text-lg", "<n>rem")` on change. The handler flips the `interacted` gate so a blank-panel first-edit previews. Reset → `a.clearOverride("--text-lg")`. Numeric-with-unit input → cannot inject arbitrary CSS (security boundary respected without extra sanitization; the `rem` suffix is appended by the component, not typed).

**Section D — Preview sample** — render a heading sample line styled `font-family: var(--font-family-heading)` plus a body line and a mono line inside the tab so all three roles + the scale are observable (the app-wide `h1..h6` consumer from T4 also reflects the heading role).

**`ThemeStudioPanel.vue`** — replace the `typography` placeholder branch in the single `<Tabs>` default slot:

```vue
<TypographyTab v-else-if="activeTab === 'typography'" :authoring="a" :theme-store="themeStore" />
```

Move the Generate-tab "Font family" `Select` out (it now lives in TypographyTab's Body/Sans row).

**`curated-swatches.ts`** — extend `CURATED_FONTS` with a serif heading stack (e.g. `"Georgia, 'Times New Roman', serif"`) and a mono stack if not already present. No structural change.

**Acceptance:** Typography tab renders all four sections; toggling the scale / editing steps / changing roles updates the live preview (smoke via `pnpm dev`); the per-token grid never calls `setPreviewToken`.

---

### T13 — generate.spec + resolve.spec additions

**Files:** `tests/unit/themes/generate.spec.ts`, `tests/unit/themes/resolve.spec.ts`.

`generate.spec.ts`:

- **Leave** the existing minimal-input `[70,85]` count test untouched (`generate.spec.ts:38–39`); add a comment that this fixture sets no `fontFamily`/`typeScale`/`statusOverrides`.
- With `typeScale: {baseSize:16, ratio:1.2}`: output contains all 8 `--text-*` + 8 `--text-*--line-height`; values equal `deriveTypeScale(...)`; assert **exact delta** `baseCount + 16` (not a loose `≤95`).
- Without `typeScale`: output contains **no** `--text-*` / `--text-*--line-height` key (mirrors the `fontFamily`-absent test).
- `generatePairedVariant` of a `typeScale` theme emits the same `--text-*` key set in the flipped variant (symmetry).
- Every emitted `--text-*` and companion is `isKnownToken()`.

`resolve.spec.ts`:

- `toGenInput` forwards `typeScale` when present; `"typeScale" in out === false` when absent.
- A generated base with `typeScale` resolves to a cache including the ramp; an `overrides["--text-lg"]` beats the derived value (override-wins).
- Memo identity: an input omitting `typeScale` and one passing `typeScale: undefined` through the conditional-assign produce the **same** memo key.

**Acceptance:** `pnpm test generate resolve` green; base `[70,85]` test unchanged.

---

### T14 — useThemeAuthoring spec

**File:** `tests/unit/composables/useThemeAuthoring.spec.ts`.

- `buildGenerationInput` includes `typeScale` when enabled; omits it when `typeScale.value === null`.
- `generationResult` includes `--text-*` when scale enabled.
- `seedFromTheme` of a `typeScale` theme sets `typeScale.value` from `base.input.typeScale`; a static base sets it to `null`.
- `enableTypeScale` materializes `DEFAULT_TYPE_SCALE`; `baseSize`/`ratio` setters materialize on first set without throwing on a null ref.
- `matchCurrentTypeScale` enables the scale and seeds the 8 `FIXED_RAMP_FALLBACK` overrides.
- `reset()` clears `typeScale` to `null` and `overrides` to `{}`.
- A blank cold mount does not push preview (the `interacted` gate); requires the `ResizeObserver` stub from `tests/setup.ts` (T0).

**Acceptance:** `pnpm test useThemeAuthoring` green.

---

### T15 — tokenManifest typography rows

**File:** `src/modules/themes/tokenManifest.ts`.

Append `"typography"`-section entries: `--font-family-heading` (kind `font-stack`), the 8 `--text-*` (kind `length`), the 8 `--text-*--line-height` (kind `length`). The C1 set-equality guard (`tokenManifest.spec.ts`) now requires every newly-allowlisted name to have a manifest entry — this lands in the same PR.

**Acceptance:** `pnpm test tokenManifest` green (set-equality holds with the 17 new names).

---

### T16 — Lint / spell / single-source

**Files:** `dictionaries/project.txt` / `dictionaries/tech.txt` as needed.

Add any CSpell-flagged new strings (`modular`, ratio names). `TypographyTab.vue` lives under `src/components/panels/**` → not scanned by `check:single-source`, but keep it token-pure (utilities + `var()`, no hex/`oklch(` literals) — state this in the PR.

**Acceptance:** `pnpm lint && pnpm check:single-source && pnpm spell` clean.

---

### T17 — Full static gauntlet

**Acceptance:** `pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build && pnpm docs:build` all green.

---

### T18 — Context7 re-confirm (only if uncertain mid-build)

If `@theme` plain-vs-inline behavior, `volt/InputNumber` props, or `ui/Tabs` single-slot behavior is uncertain during implementation, re-query Context7 (`/tailwindlabs/tailwindcss.com`, `/websites/primevue`) before committing.

**Acceptance:** any uncertainty resolved against current docs, not training data.

---

### T19 — 2-stage verification + PR

Run the verification protocol (below), embed the Stage-1 table + Stage-2 checklist + the SO-3 answers in the PR body, then:

```bash
git push -u origin feat/c2-typography
gh pr create --base develop \
  --title "feat(theming): typography — font roles + type-scale generator input (Phase C2)" \
  --body "<summary + Stage-1 table + Stage-2 checklist + SO-3 answers>"
```

Stop; wait for maintainer merge. Do not auto-merge.

---

## Data-model delta

- **`GenerationInputV2`** gains one additive optional field `typeScale?: TypeScaleInput` (after `statusOverrides`, canonical order). One new exported interface `TypeScaleInput { baseSize; ratio }`.
- **`Theme` / `ThemeBase` / `PortableTheme`** — no structural change. Per-step `--text-*` and per-role font overrides ride the existing `Theme.overrides`. `typeScale` rides `base.input`; it serializes verbatim through `exportThemeToJson` and validates on import via the new `GenerationInputV2Schema.typeScale`.
- **Version constants** — `THEME_SCHEMA_VERSION` stays `2`, `ENGINE_VERSION` stays `1`, `DB_VERSION` stays `3`. **No migration code.** A pre-C2 theme (v1-migrated or pre-C2 v2 generated) has no `typeScale` key → engine emits no `--text-*` → resolved cache byte-identical → `migrate.spec` / `engine-stability.spec` invariants hold unchanged.
- **New themeable tokens (17):** `--font-family-heading` + 8 `--text-*` + 8 `--text-*--line-height`. All gated additively (emitted only when `typeScale` / role set); the `tokens.css` fixed values remain cascade fallbacks.

## Doc-sync checklist (the 6-file rule, one PR)

Adding the type-scale token family touches all of these atomically:

1. `src/assets/styles/tokens.css` — `--font-family-heading` default + 8 `--text-*--line-height` primitives + `h1..h6` consumer (T4).
2. `src/modules/themes/knownTokens.ts` — `--font-family-heading` into `THEMEABLE_PRIMITIVE_TOKEN_NAMES`; `TYPE_SCALE_TOKEN_NAMES` + `TYPE_SCALE_LINE_HEIGHT_TOKEN_NAMES` into `ALL_KNOWN_TOKEN_NAMES` (T3).
3. `src/modules/themes/generate.ts` — additive `if (input.typeScale)` emission + paired-variant carry (T5).
4. `docs/theme-schema-for-llms.md` — Typography section prose (T7).
5. `tests/unit/docs/theme-schema-for-llms.spec.ts` + `src/modules/themes/tokenManifest.ts` — guard assertion + manifest rows (T7, T15).

Plus the persisted-shape companions: `src/types/theme.ts` (field), `src/modules/themes/resolve.ts` (`toGenInput`), `src/modules/themes/portableSchema.ts` (schema), `src/composables/useThemeAuthoring.ts` (both build paths + seed + reset), and `docs/theme-generation-algorithm.md` + `docs/design-tokens.md` (human references).

## Verification protocol — 2 stages

### Stage 0 (probe)

Probe `mcp__plugin_playwright_playwright__*`. If absent, `ToolSearch query: "playwright browser"`. If still unavailable, fall back to a manual smoke checklist, state so in the PR, embed **no** Stage-1 table. Screenshots → `.verification-screenshots/feat/c2-typography/<checkpoint>.png` (gitignored).

### Stage 1 — Playwright automated assertions (binary; drive `pnpm dev`)

| id    | Assertion                                                                                                                                                                | How                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| C2-1  | Studio opens; L1 strip shows the locked 5 tabs incl. **Typography**, single-row (no wrap)                                                                                | snapshot + `getComputedStyle` flex-wrap on the tablist                                    |
| C2-2  | Switching to Typography shows 3 font-role rows + type-scale control + 8-step grid + preview sample                                                                       | snapshot                                                                                  |
| C2-3  | Enable "Generate type scale", set baseSize=18 → `APP_ROOT` inline style gains `--text-base: 1.125rem` and the 7 other `--text-*` + 8 `--text-*--line-height`             | `browser_evaluate`: `document.documentElement.style.getPropertyValue('--text-base')` etc. |
| C2-4  | Drag ratio to 1.3 → `--text-4xl` grows; a `text-4xl` sample's computed font-size increases; heading does not clip its line box                                           | computed font-size + line-box height before/after; screenshot                             |
| C2-5  | Set the **Heading** role → `--font-family-heading` set on `APP_ROOT`; a real app `<h1>` (not just the preview) changes face                                              | `getPropertyValue('--font-family-heading')` + computed `font-family` of an `<h1>`         |
| C2-6  | Per-step override: set `--text-lg` to `2rem` in the grid → root inline `--text-lg: 2rem`; reset clears it (no orphaned key)                                              | evaluate before/after reset                                                               |
| C2-7  | **Disable** the type scale after enabling → all `--text-*` / `--text-*--line-height` are removed from `APP_ROOT` inline style (inverse of C2-3; proves no additive leak) | evaluate the props are gone                                                               |
| C2-8  | Pop a panel out → the pop-out root mirrors `--text-base` + `--font-family-heading`                                                                                       | evaluate in the pop-out tab                                                               |
| C2-9  | Save → reopen picker → re-apply → `base.input.typeScale` persisted (resolved `--text-base` matches); per-step + role overrides persisted in `theme.overrides`            | IDB read via evaluate or re-apply + computed style                                        |
| C2-10 | Console error count = 0; warning count baseline (no NaN/font-decode warnings)                                                                                            | `browser_console_messages`                                                                |
| C2-11 | Density unaffected: switch density compact↔spacious with a type scale active → control chrome resizes via the `--density-font-size: var(--text-*)` chain, no breakage    | computed pixel value on a real control                                                    |

Embed the actual result table (id · description · result · screenshot · console-error/warning counts · PASS/FAIL) in the PR. Do not open the PR until all green.

### Stage 2 — Human design checklist (3–7 items, closes the PR)

- [ ] Type-scale readout reads naturally; ratios (1.2 / 1.25 / 1.333) produce a balanced ramp, not cramped or ballooned, and headings don't clip at the high end (line-height companions doing their job).
- [ ] Font-role rows are clearly labelled (Body/Sans vs Heading vs Mono); the Heading role visibly affects a real app heading.
- [ ] The Typography tab's density/spacing feels consistent with the Generate tab (no jarring control-size mismatch).
- [ ] Per-step override grid + reset reads as "advanced/optional", not the primary path; "Match current" makes enabling the scale feel non-destructive.
- [ ] Preview communicates the type change immediately and legibly at both light and dark.

"Scrutinize for this phase": whether the heading role is discoverable; whether the default ratio (1.2) looks right against the existing Inter body; whether enabling the scale with "Match current" is truly visually neutral; whether high-ratio headings clip (if they do, tighten `leadingFor`).

## Risks

1. **Memo poisoning (absent vs `undefined` `typeScale`).** Mitigated by conditional-assign everywhere (`toGenInput`, `buildGenerationInput`, paired-variant spread). Pinned by the resolve memo-identity test (T13) and the engine-stability byte-identity test (T11).
2. **Additive-leak on disable / reset.** `applyTokenOverrides` is additive; disabling the scale or clearing an override could strand `--text-*` keys on `APP_ROOT`. Mitigated by C6's clear-then-apply merged push and assertion C2-7. C2 relies on C6's single-writer — confirm at T0 that C6's `previewThemeTokens` strips removed keys; if not, escalate (this is C6's contract, not C2's to re-implement).
3. **Paired-variant key-set asymmetry.** Mitigated by carrying `typeScale` into `generatePairedVariant` with conditional spread; pinned by the paired-symmetry test (T13). Font roles are NOT carried into the paired variant (they're `overrides`, generated from `base.input` only) — this is documented behavior; if symmetric heading across a pair is later wanted, it becomes a C3 `fontSpec` concern, not a C2 `overrides` one.
4. **Token-count guard rot.** Mitigated by keeping the minimal-input `[70,85]` test untouched and adding a dedicated exact-delta (`+16`) test for the scaled case (T13). No global-ceiling widening.
5. **Line-height defaults clipping at high ratio.** Mitigated by capping the ratio at 1.333 and emitting paired line-heights that tighten as size grows. Stage-1 C2-4 + Stage-2 checklist verify no clipping.
6. **`--font-family-heading` dead-token risk.** Mitigated by the real `h1..h6` consumer in T4 and Stage-1 C2-5 asserting a real `<h1>` (not just the preview) changes.
7. **Studio chrome growing when "Live across app" + large `--text-sm`.** The `--density-font-size: var(--text-sm)` chain means a large scale grows control chrome. This is correct cascade behavior; the editor-chrome pinning is C6's §3E concern (Option 3 — editor pinned `comfortable`). C2 accepts the interaction; flag in the PR as deferred to C6 if the editor feels uncomfortably large.

## Open questions

The integration sections lock every prior open decision. The only items that require maintainer **sign-off before this phase's token-family PR merges** (per the open-decisions §SO-3) are:

- **SO-3a — default ratio / base:** confirm `baseSize 16 / ratio 1.2`. (Recommended; locked as the default here.)
- **SO-3b — line-height companions vs ratio cap:** this plan ships **both** (emit companions **and** cap ratio at 1.333). Confirm shipping the companions (the binding default) rather than cap-only. If cap-only is preferred, drop the 8 companion tokens (and their allowlist/doc/manifest rows) and document the no-line-height limitation.

No other decision is open: type-scale default-**off**, font roles via `overrides` (Mono/Heading) + legacy `fontFamily` (Body/Sans), `--font-family-heading` owned by C2 with a real `h1..h6` consumer, rem units, Zod==deriver bounds, no `fonts?` engine field, C6-owned `overrides` seam + single-writer, C6-owned Tabs shell, no version bumps — all locked by the canonical integration sections and reflected above.
