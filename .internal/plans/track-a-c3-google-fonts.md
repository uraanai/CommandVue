# Track A · Phase C3 — Google Fonts: Dynamic Runtime Loading

> **Plan status:** execution-ready. Branch off `develop` → PR to `develop`.
> **Spec:** §3B.3, §5, §6.3, §7.1, §8 of `.internal/specs/track-a-theme-studio-comprehensive.md`.
> **Authority order:** where this plan and a phase-design draft disagree, the **CANONICAL INTEGRATION** decisions win, and within those the _sequencing / test-strategy_ resolutions (the later, cross-phase ones) win over the standalone C3 design. The most load-bearing inversions of the original C3 design are spelled out in §0.

---

## Goal

Let a Theme Studio author pick **any Google Font** and have it (a) load at runtime via a de-duplicated `<link>` into the top realm, (b) mirror into every dockview pop-out window, (c) drive `--font-family-body` / `--font-family-sans`, (d) persist losslessly in the theme record and the portable export JSON as a structured `fontSpec`, and (e) degrade gracefully offline (catalog still lists families; non-curated families fall back to the system stack; curated families render from self-hosted woff2; **no FOUT-to-broken / tofu**). All under a hard security boundary: charset-allowlisted family names, only `fonts.googleapis.com` (stylesheet) / `fonts.gstatic.com` (woff2) origins, documented CSP.

**C3 is body/sans only.** The heading role (`--font-family-heading`) is owned by **C2** (Typography), not C3 — see §0.1. C3 ships `fontSpec` (additive, owns it end-to-end), the loader, the pop-out mirror, the catalog, the curated offline faces, and the `FontPicker` UI for the **primary (body+sans) role**.

## Architecture

- **Data model (additive, no version bumps):** new optional `fontSpec?: FontSpec` on `GenerationInputV2`. `fontFamily?: string` is retained as the legacy/back-compat field. The engine derives the `--font-family-sans` / `--font-family-body` value from `fontSpec` when present, else from `fontFamily` verbatim (byte-identity for pre-C3 themes). `fontSpec` is **google-only** in C3 — the quick-stack `<Select>` keeps writing the legacy `fontFamily` string and never routes through `composeStack`, so existing themes' font token values do not churn (§0.4).
- **Loader (`useFontLoader`):** turns a `FontSpec` into a loaded webfont — de-dup `<link>` injection, charset-allowlisted family names, origin lock, weight-clamping inside the single URL constructor `buildFontHref`, offline branch via a **hardcoded** `CURATED_OFFLINE_FAMILIES` set (the catalog JSON is never on the boot path), and a glyph-ready "loaded" signal via the **CSS Font Loading API** (`document.fonts.load(...)`), with the `<link>` `onload`/8s-timeout as the stylesheet-present signal.
- **Pop-out mirror (`usePopoutThemeSync` extension):** a set-based `registeredFontHrefs` registry + `injectFontLinkIntoWindow` + `mirrorFontLinkToAllPopouts`; `registerPopoutWindow` backfills. The existing `syncWindow` (attrs + inline `--*` style) is untouched — it mirrors the _token values_; the new path mirrors the _faces_. Curated-offline faces are mirrored into pop-outs too (§0.5).
- **Boot/apply hook:** a single fire-and-forget `void ensureFontSpecLoaded(...)` inside `applyTheme` in `apply.ts` — the one choke point every committed-theme path (boot, `setTheme`, workspace bind, commit) funnels through. Guarded `kind === "generated" && fontSpec`. Not wired per-store-action; not on `cancelPreview`/`commitPreview` re-asserts.
- **Catalog:** a static, bundled, no-API-key `google-catalog.json` snapshot (~1000 families: name + category + variants + `offline`). Lazily `import()`-ed on first `FontPicker` open. No runtime call to the Google Fonts API.
- **Curated offline:** ~8 self-hosted woff2 families + a `local-fonts.css` `@font-face` sheet imported into `main.css`, so the recommended families render with zero network.
- **UI:** a `FontPicker.vue` built on **Volt `Select`** (filterable, grouped by category, status line) — the hand-rolled `ui/Select` masks `filter`/`optionGroup` and cannot host it (§0.6). Mounts into the existing Generate-tab "Typography" sub-section today; into the Typography tab if C2/C6 have landed.

## Tech / locked stack touched

Vue 3 + Vite + TS(strict) · PrimeVue 4 unstyled + **Volt** (install `Select`) + Tailwind v4 · Dockview-vue 6 (pop-outs) · Pinia (theme store) · idb (no schema change) · `fuzzysort` (picker search, already in stack) · Zod (portable schema) · `@vueuse/core` (`useDebounceFn`). No culori needed (the loader formats strings; the engine's existing OKLCH path is untouched).

## Dependencies / prerequisites (all shipped)

- A2a live-preview engine — `previewThemeTokens`, `applyTokenOverrides`, `APP_ROOT`, draft session (`apply.ts` confirmed at HEAD).
- `usePopoutThemeSync` (Track B Phase 6a) — `registerPopoutWindow` / `unregisterPopoutWindow` / `syncWindow` / `__resetForTests` confirmed.
- `ThemeStudioPanel.vue` + `useThemeAuthoring.ts` — shipped.
- Scrollable `ui/Tabs` (#143) — available; **C3 does not need it** (no new top-level tab).

**NOT prerequisites:** C1 (`tokenManifest.ts`), C2 (`typeScale`, `--font-family-heading`), C4, C5, C6. C3 is self-contained — it introduces `fontSpec` itself. Verified at HEAD `81548db`: no `fontSpec`/`typeScale`/`tokenManifest.ts`/`useFontLoader.ts`/`--font-family-heading`.

---

## 0. Binding decisions folded in from the integration sections (read first — these override the standalone C3 design)

These reshape the original C3 design. Every task below already conforms; this section is the rationale so a fresh engineer does not "restore" the superseded design.

### 0.1 `--font-family-heading` is OWNED BY C2, not C3 — C3 is body-only

The standalone C3 design added `--font-family-heading` (its only new token family) plus a heading `FontPicker`. The cross-phase **sequencing** and **test-strategy** resolutions reassign that token to C2 (Typography) and scope C3 to the **primary body/sans role only**. Therefore C3:

- does **not** add `--font-family-heading` to `tokens.css` / `knownTokens.ts` / `generate.ts` / the LLM doc / any guard;
- does **not** trigger the token doc-sync (the 6-file rule) — it adds **no** new token family;
- `FontSpec` still carries an optional `heading` sub-shape (so the field is forward-compatible and round-trips), but C3's `generate.ts` emit and `FontPicker` UI **ignore** `fontSpec.heading` (no `--font-family-heading` emit, no heading picker). When C2 lands and owns the token, C2's emit reads `fontSpec.heading` if present.

This eliminates the dead-token and double-ownership gaps. C3 is purely additive plumbing + body-font runtime.

### 0.2 No version bumps; byte-identity preserved

`THEME_SCHEMA_VERSION` stays `2`, `ENGINE_VERSION` stays `1`, `DB_VERSION` stays `3`. No migration code (`migrate.ts` untouched). `fontSpec` is an additive optional field on `base.input` (which v2 already versions) and rides inside the existing `custom-themes` blob — no new object store, no idb upgrade. A fontless / `fontFamily`-only theme resolves byte-identical to pre-C3.

### 0.3 The committed-theme font-load hook lives in `apply.ts`, not in store actions

Confirmed `apply.ts:applyTheme(theme)` is the single DOM write-path every committed selection funnels through (boot, `setTheme`, workspace bind, commit). The hook is a fire-and-forget side-effect there — covering boot/workspace/commit in one place — **not** five separate store call sites, and **not** the low-level engine. Use the **hardcoded** `CURATED_OFFLINE_FAMILIES` set for the offline check so `loadFontCatalog()` never enters the boot path.

### 0.4 `fontSpec` is google-only in C3; the quick-stack `<Select>` stays on legacy `fontFamily`

The quick-stack curated `<Select>` (today writing `a.fontFamily.value`) is **not** converted to a `source:"stack"` fontSpec. Converting it would re-route an existing stored stack string through `composeStack` (re-quoting, fallback re-join) and silently change the emitted `--font-family-*` token value for re-edited themes without an `ENGINE_VERSION` bump (a §3i violation surface). Rule: `fontSpec` present ⇒ a Google font (`source:"google"`); absent ⇒ the legacy `fontFamily` string drives body/sans. `composeStack`'s quoting+fallback logic runs **only** for `source:"google"`.

### 0.5 Curated-offline faces must reach pop-outs

`local-fonts.css` is imported into the **opener** bundle only, so a curated `@font-face` is not present in a pop-out document by default. Therefore, **when online**, `ensureFontLoaded` does NOT skip injection for curated families — it injects a stylesheet `<link>` (the css2 link, OR a `<link rel=stylesheet href="<local-fonts.css URL>">` for the curated set) into both the opener `<head>` and every pop-out `<head>` via the registry. The "return `loaded` without injecting" branch applies **only when `navigator.onLine === false`** for a curated family (the opener already has the face from its bundle; pop-outs are an accepted, documented offline degradation).

### 0.6 `FontPicker` is built on Volt `Select`, not `ui/Select`

`src/components/ui/Select.vue` is the deliberately API-masked hand-rolled primitive — props are `{ modelValue, options, placeholder, disabled, showClear }`, it hardcodes `option-label`/`option-value` and exposes **no** `filter` / `optionGroup*` / option templating. The filterable, category-grouped picker cannot be built on it. **Install Volt `Select`** via `npx volt-vue add Select` → `src/volt/Select.vue` (ADR-0002 "general-purpose → Volt"), and verify it passes `pnpm check:single-source` (tokenize any raw colors Volt ships). Fetch the PrimeVue `Select` `filter`+`optionGroup` PT surface via Context7 before wiring.

### 0.7 "Loaded" means glyphs-ready, via the CSS Font Loading API

`link.onload` fires when the **stylesheet** is parsed, not when the woff2 glyphs are ready. For an accurate `"loaded"` status use `document.fonts.load("1em '<family>'")` (returns a promise that resolves when the face is usable). Keep the `<link>` `onload`/8s-timeout only as the "stylesheet present / hung CDN" signal. jsdom lacks `document.fonts` → the unit spec stubs it.

### 0.8 Weight-clamping happens inside `buildFontHref` (the single URL constructor)

`buildFontHref(family, weights)` is the only place a css2 URL is built. It clamps `weights` to the catalog `variants` (passed in by the caller after the catalog lookup) — defaulting to `[400]` when the intersection is empty — sorts ascending, encodes spaces as `+`, and only ever prefixes `https://fonts.googleapis.com`. A hand-edited import with an off-catalog weight can never produce a 400-ing URL.

### 0.9 Both generation-input build paths must carry `fontSpec`

`useThemeAuthoring` has **two** build paths: the inline object inside the `generationResult` computed (live preview) AND `buildGenerationInput()` (save). The C3 standalone design patched only the latter, so the picker would not preview. Both must include `fontSpec` (§Task 9), or live preview diverges from save.

### 0.10 IA seam: mount into the existing Typography sub-section

C3 does **not** introduce the `<Tabs>` shell or a new top-level tab (that is C6). It adds the `FontPicker` into the **existing** un-tabbed Generate-controls "Typography" sub-section, beside today's `<Select v-model="a.fontFamily.value">`. If, at execution time, the tab shell already exists (`grep ThemeStudioPanel.vue` for `activeTab`/`<Tabs`), mount the picker into the Typography tab body instead — the component is identical, only the mount point differs.

---

## File Structure

### New files

| Path                                                | Responsibility (one line)                                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/composables/useFontLoader.ts`                  | De-dup `<link>` injector + active-font registry + family-name/origin security boundary; turns a `FontSpec` into a loaded webfont (glyph-ready via Font Loading API). |
| `src/modules/themes/fontCatalog.ts`                 | Typed lazy loader + helpers over the bundled JSON snapshot (parse, index by family, curated subset, fuzzysort search).                                               |
| `src/assets/fonts/google-catalog.json`              | Bundled, offline, no-API-key snapshot of the Google family list (`{ version, generatedAt, families[] }`).                                                            |
| `scripts/build-google-catalog.mjs`                  | One-off generator for the snapshot (committed, NOT wired into CI).                                                                                                   |
| `src/assets/fonts/local-fonts.css`                  | `@font-face` declarations (`font-display: swap`) for the curated offline families (self-hosted woff2).                                                               |
| `src/assets/fonts/woff2/*.woff2`                    | The curated offline woff2 files (~8 families × {400,600,700}).                                                                                                       |
| `src/components/panels/theme-studio/FontPicker.vue` | The Studio font-picker control (Volt `Select` filterable/grouped + weights chips + status line); emits a `FontSpec`; presentation only.                              |
| `src/volt/Select.vue`                               | Volt-installed filterable PrimeVue `Select` wrapper (via `npx volt-vue add Select`); tokenized to pass single-source.                                                |
| `tests/unit/composables/useFontLoader.spec.ts`      | Loader unit spec (de-dup, allowlist reject, origin lock, weight clamp, offline branches, pop-out inject, glyph-ready stub).                                          |
| `tests/unit/themes/fontCatalog.spec.ts`             | Catalog integrity + curated↔`@font-face` drift guard + search.                                                                                                       |
| `tests/unit/themes/fontSpec-portability.spec.ts`    | `fontSpec` round-trips export→import; engine derives body/sans; legacy `fontFamily`-only byte-identity.                                                              |

### Modified files

| Path                                         | Change (one line)                                                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/theme.ts`                         | Add `FontSource`, `FontSpec`; add `fontSpec?: FontSpec` to `GenerationInputV2` (after `statusOverrides`).                                                            |
| `src/modules/themes/generate.ts`             | Add `fontSpec?` to `ThemeGenerationInput`; replace the `if (input.fontFamily)` body-emit with a `fontSpec`-preferring derivation (`composeStack`/`fontFamilyValue`). |
| `src/modules/themes/resolve.ts`              | One conditional-assign line in `toGenInput`: `if (input.fontSpec !== undefined) out.fontSpec = input.fontSpec;`.                                                     |
| `src/modules/themes/portableSchema.ts`       | Add `FontSpecSchema` (+ field sub-schemas); add `fontSpec: FontSpecSchema.optional()` to `GenerationInputV2Schema` (plain `z.object`, strip unknowns).               |
| `src/composables/usePopoutThemeSync.ts`      | Add `registeredFontHrefs` set + `injectFontLinkIntoWindow` + `mirrorFontLinkToAllPopouts`; backfill in `registerPopoutWindow`; clear in `__resetForTests`.           |
| `src/composables/useThemeAuthoring.ts`       | Add `fontSpec` ref; seed (generated-only) / reset / **both** build paths; return it.                                                                                 |
| `src/components/panels/ThemeStudioPanel.vue` | Import + mount `FontPicker` in the Typography sub-section; `fontSpec` watcher → `ensureFontSpecLoaded` before token push.                                            |
| `src/modules/themes/apply.ts`                | Fire-and-forget `void ensureFontSpecLoaded(theme.base.input.fontSpec)` in `applyTheme` (guarded `kind === "generated" && fontSpec`).                                 |
| `src/assets/styles/main.css`                 | One `@import "./fonts/local-fonts.css";` in the contiguous import block (before any non-import rule).                                                                |
| `cspell.json`                                | Add `src/assets/fonts/google-catalog.json` to `ignorePaths` (generated data file).                                                                                   |
| `dictionaries/project.txt`                   | Add curated-family novel words used in `local-fonts.css` / prose.                                                                                                    |
| `docs/deployment.md`                         | CSP additions (the two Google origins) + opt-in prose.                                                                                                               |
| `docs/theming.md`                            | "Fonts (Google + system)" subsection: `fontSpec` shape, offline catalog, CSP link, security model.                                                                   |

No `tokens.css`, `knownTokens.ts`, `migrate.ts`, `db.ts`, `theme-schema-for-llms.md`, or its guard test change — C3 adds **no** token family (heading is C2).

---

## Data-model delta (the complete, exact shape)

### `src/types/theme.ts` — add above `GenerationInputV2`

```typescript
/** Provenance of a font-family choice (Track A C3). */
export type FontSource = "google" | "system" | "stack";

/**
 * A structured font choice (Track A C3). Persisted on a generated theme's
 * `base.input` and carried in the portable export JSON so a re-import re-loads
 * the same Google font. Lossless superset of the legacy `fontFamily` string.
 *
 * In C3 `fontSpec` is GOOGLE-ONLY: it is set only when the author picks a Google
 * family. The curated quick-stack `<Select>` keeps writing the legacy
 * `fontFamily` string (see plan §0.4). The optional `heading` sub-shape is
 * carried for forward-compat + round-trip but is NOT consumed by C3's engine
 * emit or UI — `--font-family-heading` is owned by C2 (Typography).
 */
export interface FontSpec {
  /** Catalog display name (e.g. "Inter", "IBM Plex Sans"). Charset-allowlisted. */
  family: string;
  source: FontSource;
  /** Upright weights to request from Google. Empty/omitted → loader requests 400. */
  weights?: number[];
  /** Fallback stack appended after `family` (e.g. "system-ui, sans-serif"). */
  fallback?: string;
  /** Forward-compat heading role (consumed by C2, not C3). */
  heading?: { family: string; source: FontSource; weights?: number[]; fallback?: string };
}
```

Then in `GenerationInputV2`, **after** `statusOverrides?` (keep existing field order; append only):

```typescript
  /** Per-family status overrides (A1b live hue lever). */
  statusOverrides?: StatusOverrides;
  /**
   * Structured font choice (C3). When present it is the source of truth; the
   * engine derives `fontFamily` from `fontSpec` so the legacy token-emit path
   * stays identical. `fontFamily` is retained for back-compat (pre-C3 themes and
   * the System/quick-stack picks that never needed a fontSpec).
   */
  fontSpec?: FontSpec;
```

**No `THEME_SCHEMA_VERSION` / `ENGINE_VERSION` / `DB_VERSION` change.**

---

## Ordered tasks

> Branch: `git checkout develop && git pull origin develop && git checkout -b feat/c3-google-fonts`.
> Per-task: ends with `pnpm type-check` green for touched files. Whole-PR gauntlet (Task 13): `pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build`.

### Task 0 — Recon + branch

Confirm at HEAD: `git ls-files src/modules/themes/tokenManifest.ts src/composables/useFontLoader.ts` (expect both empty), `git grep -l "fontSpec\|typeScale" -- src tests` (expect none). Grep `ThemeStudioPanel.vue` for `activeTab`/`<Tabs` to decide the FontPicker mount point (§0.10): if absent → Generate-tab Typography sub-section; if present → Typography tab body. Create the feature branch off freshly-pulled `develop`.

**Acceptance:** on `feat/c3-google-fonts`; recon noted in the PR body (which IA seam was used).

### Task 1 — Types

Edit `src/types/theme.ts`: add `FontSource`, `FontSpec` (verbatim above); append `fontSpec?: FontSpec` to `GenerationInputV2` after `statusOverrides?`.

**Acceptance:** `pnpm type-check` green; `THEME_SCHEMA_VERSION === 2`, `ENGINE_VERSION === 1` unchanged (grep `src/types/theme.ts`).

### Task 2 — Portable schema

Edit `src/modules/themes/portableSchema.ts`. Add above `GenerationInputV2Schema`:

```typescript
const FontFamilyNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 \-]*$/, "Invalid font family name");
const FontWeightsSchema = z.array(z.number().int().min(1).max(1000)).max(18).optional();
const FontFallbackSchema = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9 ,'_-]*$/, "Invalid font fallback stack")
  .optional();

/** C3 — structured font choice. Plain z.object (strip unknown keys), NOT .strict(),
 *  for forward-compat with future additive sub-fields. */
const FontSpecSchema = z.object({
  family: FontFamilyNameSchema,
  source: z.enum(["google", "system", "stack"]),
  weights: FontWeightsSchema,
  fallback: FontFallbackSchema,
  heading: z
    .object({
      family: FontFamilyNameSchema,
      source: z.enum(["google", "system", "stack"]),
      weights: FontWeightsSchema,
      fallback: FontFallbackSchema,
    })
    .optional(),
});
```

Then inside `GenerationInputV2Schema`, after the `fontFamily` line:

```typescript
  fontSpec: FontSpecSchema.optional(),
```

Note: the `fallback` regex deliberately excludes `<`, `(`, `)`, `:`, `;`, `/` — so a composed `--font-family-*` value built only from a Zod-validated `family` + `fallback` can never form a CSS-injection sequence (this is the security rationale for the engine doing no re-validation of the composed string). Do **not** touch `PortableThemeSchema.schemaVersion` (`z.literal(2)`) or `ThemeBaseSchema`.

**Acceptance:** inline-validate a good `fontSpec` parses and a bad family (`"Inter');@import"`) rejects; `pnpm test tests/unit/themes/portable.spec.ts` green.

### Task 3 — Engine derivation

Edit `src/modules/themes/generate.ts`.

1. Add `fontSpec?: FontSpec;` to `ThemeGenerationInput` (next to `fontFamily?`). Import `FontSpec` from `@/types/theme`.
2. Add three module-private pure helpers near the top:

```typescript
/** "'Family Name', <fallback>" — quotes multi-word families, appends fallback.
 *  Inputs are already Zod-/allowlist-validated (no injection possible). */
function composeStack(family: string, fallback?: string): string {
  const quoted = /\s/.test(family) ? `'${family}'` : family;
  const fb = (fallback ?? "system-ui, sans-serif").trim();
  return fb ? `${quoted}, ${fb}` : quoted;
}
/** Body/sans CSS value: fontSpec (google-only in C3) wins; else the legacy
 *  fontFamily string VERBATIM (byte-identity for pre-C3 themes). */
function fontFamilyValue(input: ThemeGenerationInput): string | undefined {
  if (input.fontSpec) return composeStack(input.fontSpec.family, input.fontSpec.fallback);
  return input.fontFamily || undefined;
}
```

3. Replace the existing emit block (confirmed at `generate.ts:466-469`):

```typescript
if (input.fontFamily) {
  tokens["--font-family-sans"] = input.fontFamily;
  tokens["--font-family-body"] = input.fontFamily;
}
```

with:

```typescript
// --- Font roles (C3) — body/sans only; heading is C2-owned. -----------------
// Emitting nothing when neither fontSpec nor fontFamily is set keeps output
// byte-identical to pre-C3 for fontless themes (§3c). Verbatim passthrough of
// a legacy fontFamily string preserves byte-identity for pre-C3 themes (§3i).
const bodyStack = fontFamilyValue(input);
if (bodyStack) {
  tokens["--font-family-sans"] = bodyStack;
  tokens["--font-family-body"] = bodyStack;
}
```

**Do NOT emit `--font-family-heading`** (C2 owns it). `fontSpec.heading` is ignored here.

Edit `src/modules/themes/resolve.ts` — in `toGenInput`, after the `fontFamily` conditional-assign line:

```typescript
if (input.fontSpec !== undefined) out.fontSpec = input.fontSpec;
```

**Acceptance:** a `fontFamily`-only theme emits identical `--font-family-sans`/`-body` as pre-C3 (byte-identity); a `fontSpec` theme emits the composed stack; no `--font-family-heading` key ever appears. `pnpm test tests/unit/themes/generate.spec.ts tests/unit/themes/resolve.spec.ts` green. The existing `generate.spec.ts` token-count bound `[≥70, ≤85]` is **unchanged** (C3 adds no new unconditional keys; the `fontSpec` body emit replaces the same two keys the `fontFamily` path emitted).

### Task 4 — Bundled catalog + `fontCatalog.ts`

1. `scripts/build-google-catalog.mjs` — a one-off Node script that writes `src/assets/fonts/google-catalog.json`. Commit it; do NOT wire into CI/`package.json` scripts. (It may be a static hand-curated snapshot; no network at build time.)
2. `src/assets/fonts/google-catalog.json` — shape `{ "version": 1, "generatedAt": "2026-06-05", "families": FontCatalogEntry[] }` where
   `FontCatalogEntry = { family: string; category: "sans-serif"|"serif"|"display"|"handwriting"|"monospace"; variants: number[]; offline?: boolean }`.
   Mark exactly the curated families (§Task 5) `"offline": true`. `fontCatalog.ts` trims family names on load; `FontFamilyNameSchema` forbids leading space.
3. `src/modules/themes/fontCatalog.ts`:

```typescript
export interface FontCatalogEntry {
  family: string;
  category: "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
  variants: number[];
  offline?: boolean;
}
export interface FontCatalog {
  version: number;
  generatedAt: string;
  families: FontCatalogEntry[];
}

/** Lazily import()+parse the bundled JSON (code-split out of the main chunk). Cached. */
export function loadFontCatalog(): Promise<FontCatalog>;
/** Indexed lookup by exact family name. */
export function getCatalogEntry(family: string): Promise<FontCatalogEntry | undefined>;
/** The curated offline-ready subset (entry.offline === true). */
export function curatedOfflineFamilies(): Promise<FontCatalogEntry[]>;
/** fuzzysort prefix/fuzzy search over family names (for the picker). */
export function searchFamilies(query: string, limit?: number): Promise<FontCatalogEntry[]>;
/** Hermetic-test seam. */
export function __clearCatalogCacheForTests(): void;
```

Use `fuzzysort` for `searchFamilies`. The catalog JSON is `import()`-ed **inside** these functions (never a top-level import in `fontCatalog.ts` consumers), so it code-splits and never lands in the boot path. 4. Add `src/assets/fonts/google-catalog.json` to `cspell.json` `ignorePaths`. Add any novel family-name words used in `local-fonts.css`/prose to `dictionaries/project.txt`.

**Acceptance:** `pnpm test tests/unit/themes/fontCatalog.spec.ts` green; `pnpm spell` green; the catalog chunk does not appear in the entry chunk (`pnpm build` — confirm `google-catalog` is a separate emitted chunk).

### Task 5 — Curated offline woff2 + `local-fonts.css`

Curated set (**LOCKED**, pending SO-1 bundle-size confirmation): **8 families × {400, 600, 700}** — `Roboto`, `Open Sans`, `Lato`, `Montserrat`, `Source Sans 3`, `IBM Plex Sans` (sans); `Merriweather`, `Lora` (serif). **Inter is NOT self-hosted** — it is already served by `@fontsource-variable/inter`; the catalog's Inter entry (`offline: true`) points at that existing face and `local-fonts.css` MUST NOT redeclare Inter (avoids a duplicate-Inter face / double-download).

1. Add the woff2 files under `src/assets/fonts/woff2/`.
2. `src/assets/fonts/local-fonts.css` — one `@font-face` block per family×weight, `font-display: swap`, `src: url("./woff2/<file>.woff2") format("woff2")`. `@font-face` is inert until used, so the unconditional import does not eagerly download.
3. `src/assets/styles/main.css` — add `@import "./fonts/local-fonts.css";` in the **contiguous `@import` block at the top**, before any `@theme`/`:root`/selector rule (CSS requires all `@import`s to precede other rules; a misplaced one is dropped by Lightning CSS). Place it after the existing `tokens.css` import but still within the import group.

**Acceptance:** `fontCatalog.spec.ts` curated↔`@font-face` drift guard passes (every `offline:true` family except Inter has a matching `@font-face`; Inter has none); `pnpm build` green and the built CSS references the fingerprinted woff2 names (grep the built CSS output for `.woff2`).

### Task 6 — `usePopoutThemeSync` font-mirror extension

Edit `src/composables/usePopoutThemeSync.ts`. Add module-level + helpers (dedup by a stable `data-cv-font-key="<family>"` attribute — family is charset-allowlisted, so it is selector-safe with no escaping; do NOT build a selector from the raw href, do NOT rely on `CSS.escape`):

```typescript
/** C3 — font <link> hrefs registered by useFontLoader, mirrored into pop-outs. */
export const registeredFontHrefs = new Set<string>();

/** Inject one font stylesheet into a pop-out's <head> if absent. Origin-safe:
 *  callers only ever pass hrefs/local-sheet URLs built by useFontLoader. */
export function injectFontLinkIntoWindow(win: Window, href: string, key: string): void {
  if (win.closed) return;
  try {
    const doc = win.document;
    if (doc.head.querySelector(`link[data-cv-font-key="${key}"]`)) return;
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.cvFontKey = key;
    doc.head.appendChild(link);
  } catch {
    // window torn down mid-inject — register-time backfill covers it
  }
}

/** C3 — called by useFontLoader when a new font href is registered. */
export function mirrorFontLinkToAllPopouts(href: string, key: string): void {
  registeredFontHrefs.add(`${key} ${href}`);
  for (const win of [...popoutWindows]) injectFontLinkIntoWindow(win, href, key);
}
```

Extend `registerPopoutWindow` to backfill (after `syncWindow(win)`):

```typescript
for (const entry of registeredFontHrefs) {
  const [key, href] = entry.split(" ");
  injectFontLinkIntoWindow(win, href, key);
}
```

Extend `__resetForTests` to also `registeredFontHrefs.clear();`. **Do not touch `syncWindow`** — it keeps mirroring the inline `--*` token values (including the `--font-family-*` value) exactly as today. The new path mirrors the _faces_.

**Acceptance:** `pnpm test tests/unit/composables/usePopoutThemeSync.spec.ts` green (new mirror + backfill cases, using a second `document.implementation.createHTMLDocument()` wrapped in a `{ document, closed: false }` Window stub).

### Task 7 — `useFontLoader` composable

Create `src/composables/useFontLoader.ts`.

```typescript
import { mirrorFontLinkToAllPopouts } from "@/composables/usePopoutThemeSync";
import type { FontSpec } from "@/types/theme";

/** Origin the loader will ever inject a css2 stylesheet from. Hard lock. */
const ALLOWED_STYLE_ORIGIN = "https://fonts.googleapis.com";
/** Charset allowlist (mirrors FontFamilyNameSchema). */
export const FAMILY_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]*$/;

/** Hardcoded curated set — keeps the catalog JSON off the boot/apply path (§0.3).
 *  MUST equal the offline:true families in google-catalog.json (drift-guarded). */
export const CURATED_OFFLINE_FAMILIES: ReadonlySet<string> = new Set([
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Source Sans 3",
  "IBM Plex Sans",
  "Merriweather",
  "Lora",
]);

export type FontLoadStatus = "idle" | "loading" | "loaded" | "error" | "offline-fallback";
export interface FontLoadResult {
  status: FontLoadStatus;
  href: string | null;
}

/** Build the canonical css2 href. Clamps `weights` to `variants` (default [400]),
 *  sorts ascending, spaces→'+'. Returns null for non-google sources. Throws on a
 *  disallowed family name (defense in depth). Synchronous — caller passes variants. */
export function buildFontHref(
  family: string,
  weights: number[] | undefined,
  variants: number[],
): string | null;

/** Ensure a Google webfont's GLYPHS are ready (document.fonts.load) into the top
 *  realm and registered for pop-out mirroring. Idempotent + de-duplicated by key.
 *  source "system"/"stack" → no-op { status:"idle", href:null }. */
export function ensureFontLoaded(spec: FontSpec): Promise<FontLoadResult>;

/** Load the body family (and, forward-compat, heading if present — C3 callers
 *  only set body). */
export function ensureFontSpecLoaded(spec: FontSpec): Promise<void>;

/** Curated-offline check via the hardcoded set (no catalog access). */
export function familyIsOfflineReady(family: string): boolean;
/** Injected hrefs (tests + pop-out backfill). */
export function activeFontHrefs(): readonly string[];
/** Test seam: remove injected <link>s + clear registry. */
export function __resetFontLoaderForTests(): void;
```

Internal mechanics:

- A module-level `Map<string, Promise<FontLoadResult>>` keyed by a stable `key = family` de-dups concurrent calls and caches the resolved result.
- `ensureFontLoaded(spec)`: charset-check `spec.family` against `FAMILY_NAME_RE` (fail → `{status:"error",href:null}`). Look up catalog `variants` via `getCatalogEntry` (online path only). Build the href via `buildFontHref`. Inject `<link rel="stylesheet" crossOrigin="anonymous" data-cv-font-key="<family>">` into `document.head` guarded by `link[data-cv-font-key="<family>"]` (idempotent across reloads). Call `mirrorFontLinkToAllPopouts(href, family)`. Resolve via `document.fonts.load("1em '<family>'")` (glyph-ready) wrapped so `<link>.onerror` or an 8000ms timeout resolves `{status:"error"}`.
- **Offline branch:** `navigator.onLine === false` + `familyIsOfflineReady(family)` → `{status:"loaded", href:null}` (opener already has the face from its bundle; pop-outs are an accepted offline degradation). `navigator.onLine === false` + NOT curated → `{status:"offline-fallback", href:null}`, inject nothing (the composed token value's fallback stack renders system text).
- **Online + curated:** still inject (so pop-outs get the face — §0.5). For a curated family inject the css2 `<link>` (simplest, glyph-ready via Font Loading API once online); offline curated relies on `local-fonts.css`.
- `buildFontHref` is the ONLY place a css2 URL is built; weight-clamp lives here (§0.8). Family is `encodeURIComponent`-free — spaces → `'+'` via `.replace(/ /g, "+")`; the charset guard forbids any other URL-special char, so no further escaping is needed (avoids double-encoding the `+`). Format: `https://fonts.googleapis.com/css2?family=<Family+Name>:wght@<w1>;<w2>&display=swap` (weights ascending, deduped).

**Context7 gate (mandatory before writing `buildFontHref`):** fetch the current Google Fonts `css2` API format (Context7 `/websites/...` or official docs) and pin the exact serialization — ascending weights, `+` for spaces, `&display=swap`. Add a golden-URL unit assertion.

**Acceptance:** `pnpm test tests/unit/composables/useFontLoader.spec.ts` green — golden URL, charset reject, de-dup (one `<link>`), weight clamp (off-catalog weight → `:wght@400`), offline-curated/offline-non-curated branches, pop-out inject, glyph-ready resolution (stubbed `document.fonts`), `__resetFontLoaderForTests`.

### Task 8 — Apply-path + authoring wiring

1. `src/modules/themes/apply.ts` — in `applyTheme(theme)`, after the identity attributes are set, add a guarded fire-and-forget:

```typescript
// C3 — committed-theme font load. Single choke point for boot/setTheme/workspace
// bind/commit. Fire-and-forget; the --font-family-* token value is already in
// theme.tokens so text paints in the fallback immediately and the webfont swaps
// in when ready (swap). Curated-offline check uses the hardcoded set, so the
// catalog JSON never enters the boot path.
if (theme.base?.kind === "generated" && theme.base.input.fontSpec) {
  void import("@/composables/useFontLoader").then((m) =>
    m.ensureFontSpecLoaded(
      theme.base.kind === "generated" ? theme.base.input.fontSpec! : (undefined as never),
    ),
  );
}
```

(Dynamic `import()` of `useFontLoader` keeps `apply.ts`'s static import graph free of the loader; the loader still does no catalog import on the offline check.) Do NOT add this to `cancelPreview`/`commitPreview`.

2. `src/composables/useThemeAuthoring.ts`:
   - `const fontSpec = ref<FontSpec | null>(null);`
   - `reset()` / blank defaults: `fontSpec.value = null;`
   - `seedFromTheme(t)`: `fontSpec.value = t.base.kind === "generated" ? (t.base.input.fontSpec ?? null) : null;` (never read `.input` on a static base). Keep the existing `fontFamily` seed.
   - **Both** build paths (§0.9): in the `generationResult` computed's inline input object add `fontSpec: fontSpec.value ?? undefined`; in `buildGenerationInput()` add `if (fontSpec.value) input.fontSpec = fontSpec.value;` (before/after the existing `fontFamily` assign; keep `fontFamily` for back-compat). Never spread `undefined`.
   - Return `fontSpec` from the composable surface.

**Acceptance:** `pnpm test tests/unit/composables/useThemeAuthoring.spec.ts tests/unit/themes/apply.spec.ts` green (new cases: `fontSpec` flows into both build paths; `seedFromTheme` restores it; `reset()` nulls it; `applyTheme` of a `fontSpec` theme triggers the loader exactly once and a fontless theme triggers zero).

### Task 9 — Volt `Select` install + `FontPicker.vue`

1. `npx volt-vue add Select` → `src/volt/Select.vue`. Run `pnpm check:single-source`; if Volt's file ships raw hex/`oklch(`, tokenize to project tokens. **Fetch the PrimeVue `Select` `filter`+`optionGroup` PT surface via Context7 first** (`/websites/primevue`, query "Select filter optionGroup passthrough").
2. `src/components/panels/theme-studio/FontPicker.vue`:

```typescript
interface Props {
  modelValue: FontSpec | null; // null = inherit the curated default / legacy stack
  // C3 is body-only; no `role` prop.
}
// emits: "update:modelValue": [FontSpec | null]
```

- Volt `Select` (`filter`, grouped by `category`, `optionGroupLabel`/`optionGroupChildren`). Debounce `searchFamilies` (~120ms, `useDebounceFn`); show the Volt `Select` `loading` state while the catalog `import()` resolves on first open. Cap results (`limit`).
- A weights control: a row of existing `Checkbox` chips (binary) from the chosen family's `variants`, default `[400, 600, 700] ∩ variants`. (Avoid `MultiSelect` — no wrapper exists; do not assume one.) Disabled/hidden for non-google.
- A status line bound to the live `FontLoadResult`: "Offline-ready" (curated) · "Loads from Google when online" · "Needs network — using system fallback" (offline + non-curated) · "Loading…" · "Loaded" · "Couldn't load — using fallback". Use `text-status-warning` / `text-faint` tokens only (no raw colors — the file is under `panels/`, unscanned, but stays token-pure by hand-review).
- Picking a family debounced-calls `ensureFontLoaded` for live preview and emits a `FontSpec { family, source:"google", weights, fallback:"system-ui, sans-serif" }`. The picker does **not** persist.

**Acceptance:** `pnpm lint && pnpm check:single-source && pnpm type-check` green; `src/volt/Select.vue` passes single-source.

### Task 10 — Panel mount + live preview

Edit `src/components/panels/ThemeStudioPanel.vue`:

- Import `FontPicker` and `ensureFontSpecLoaded`.
- In the Typography sub-section (today the `<Select v-model="a.fontFamily.value" :options="a.FONT_OPTIONS" />`), add `<FontPicker v-model="a.fontSpec.value" />` **beside** the quick-stack `<Select>` (keep both — quick stacks write `fontFamily`, picker writes `fontSpec`; §0.4).
- Add a watcher: `watch(() => a.fontSpec.value, (spec) => { if (spec) void ensureFontSpecLoaded(spec); })` so the `<link>` is in flight before the regenerated `--font-family-*` token flips (swap covers the gap). The existing `watch(generationResult) → previewThemeTokens(result.tokens, density)` (confirmed `ThemeStudioPanel.vue:61-62`) is unchanged; the font load is an additional side-effect keyed on `fontSpec`.

**Acceptance:** `pnpm dev` — pick a Google font in the picker → preview body text computed `font-family` starts with the chosen family; the quick-stack `<Select>` still works.

### Task 11 — Portability + drift specs

- `tests/unit/themes/fontSpec-portability.spec.ts`: a generated theme with `base.input.fontSpec` exports and re-imports `fontSpec` intact (deep-equal); `generateTheme` with `fontSpec` emits the composed `--font-family-sans`/`-body`; `generateTheme` with only legacy `fontFamily` emits identical body/sans as pre-C3 and **no** `--font-family-heading`; Zod rejects a bad `fontSpec.family` and an out-of-bounds weight.
- Extend `tests/unit/themes/engine-stability.spec.ts`: a `fontFamily`-only fixture re-resolves byte-identical (pins no `ENGINE_VERSION` bump needed).
- Extend `tests/unit/themes/portable.spec.ts`: `fontSpec` survives the full export→import + source-force-to-imported round-trip.
- `fontCatalog.spec.ts` (Task 4): assert `CURATED_OFFLINE_FAMILIES` (from `useFontLoader`) set-equals the `offline:true` families in the catalog JSON (the hardcoded-set ↔ catalog drift guard), and that curated families minus Inter each have a `local-fonts.css` `@font-face`.

**Acceptance:** `pnpm test` green across the themes + composables suites.

### Task 12 — Docs

- `docs/deployment.md` — extend the nginx CSP example:
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;` and `font-src 'self' data: https://fonts.gstatic.com;`. Prose: curated offline families render with no external origin; to allow the full catalog at runtime, add `fonts.googleapis.com` to `style-src` (css2 stylesheet) and `fonts.gstatic.com` to `font-src` (woff2 files); with CSP locked to `'self'` the picker still lists every family but non-curated ones fall back to the system stack. One sentence: the mechanism is `<link rel=stylesheet>` (governed by `style-src`/`font-src`), never `fetch()`/`FontFace`, so `connect-src` stays untouched.
- `docs/theming.md` — "Fonts (Google + system)" subsection: `fontSpec` shape, the offline catalog + curated set, the CSP requirement link, the security model (charset allowlist at Zod + `buildFontHref`, origin lock). No new VitePress sidebar entry (editing existing pages).

**Acceptance:** `pnpm spell` green; `pnpm docs:build` green.

### Task 13 — Full gauntlet + Stage 1 Playwright

Run `pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build`. Then the §Stage-1 Playwright assertions; capture screenshots to `.verification-screenshots/feat/c3-google-fonts/`; build the Stage-1 result table.

**Acceptance:** all green; Stage-1 table all PASS; console-error count 0.

### Task 14 — PR

`gh pr create --base develop --title "feat(theming): Google Fonts dynamic runtime loading (Track A C3)"` with the Stage-1 result table + Stage-2 checklist + the SO-1 bundle-size answer. **Stop; wait for maintainer merge.** Do not auto-merge.

**Acceptance:** PR open against `develop`, CI green, Stage-1 embedded, Stage-2 + open questions present.

---

## Doc-sync — token doc-sync does NOT fire (no new token family)

**(a) Token doc-sync — does NOT apply.** C3 adds **no new token family** (heading is C2-owned, §0.1), so the token doc-sync rule (`tokens.css` + `knownTokens.ts` + `generate.ts` + `docs/theme-schema-for-llms.md` + its guard test) **does NOT fire** for this PR.

**(b) Font-feature doc updates — DO apply.** C3 instead ships a new runtime font feature, so it touches these doc/config surfaces atomically with the code:

1. **`README.md` Stack table** — no change (no new dependency; `fuzzysort` already listed). Volt `Select` is an install of an already-locked tool (PrimeVue/Volt), not a new dependency.
2. **`docs/deployment.md`** — CSP origins + opt-in prose (Task 12). ✅ required.
3. **`docs/theming.md`** — Fonts subsection (Task 12). ✅ required.
4. **`cspell.json` / `dictionaries/project.txt`** — catalog JSON ignore-path + curated-family words (Task 4). ✅ required.
5. **`.env.example` / `docs/.vitepress/config.ts`** — no change (no new env var, no new docs page). ✅ confirmed N/A.

(If, contrary to §0.1, the maintainer reassigns `--font-family-heading` to C3, the full 6-file token doc-sync re-activates — including the `tokenManifest.ts` row — and the heading picker + `--font-family-heading` emit + `h1..h6` consumer rule must be added in the same PR. The default plan is heading-in-C2.)

---

## 2-stage verification

### Stage 0 — tool probe

Probe `mcp__plugin_playwright_playwright__*`. If absent, run `ToolSearch` with `query: "playwright browser"`. If still unavailable, fall back to a manual smoke checklist, state this in the PR, and embed NO Stage-1 results table.

### Stage 1 — Playwright automated assertions (binary)

Screenshots → `.verification-screenshots/feat/c3-google-fonts/<checkpoint>.png`. Drive `pnpm dev`, open the Theme Studio panel.

| id  | assertion                                                                                                                                                                                                                                    | checkpoint               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| A1  | Studio open → Typography section shows the FontPicker beside the quick-stack Select.                                                                                                                                                         | `studio-typography-open` |
| A2  | Pick "Roboto" (curated) → a `link[data-cv-font-key]` for `fonts.googleapis.com/css2?family=Roboto` exists in `document.head` (online), OR preview computed `font-family` contains "Roboto" (offline-curated).                                | `roboto-loaded`          |
| A3  | Preview-pane body text computed `font-family` starts with the chosen family within 8s.                                                                                                                                                       | `preview-font-applied`   |
| A4  | Pick a non-curated family while online → status line shows "Loads from Google…", computed `font-family` updates; `--font-family-sans`/`-body` set on `APP_ROOT`.                                                                             | `noncurated-online`      |
| A5  | Open a dockview pop-out, then pick a new Google font → the pop-out window's `<head>` gains the same `link[data-cv-font-key]` and its computed body font updates.                                                                             | `popout-font-mirrored`   |
| A6  | Simulate offline (`browser_evaluate` set `navigator.onLine = false`, block the origin) + pick a non-curated family → status "Needs network — using system fallback", preview falls back to the system stack (NOT tofu), zero console errors. | `offline-fallback`       |
| A7  | Pick a curated family while offline → renders correctly from the self-hosted face (computed `font-family` contains the family), no network `<link>`.                                                                                         | `offline-curated`        |
| A8  | Save the theme with a Google font → reload the page → theme re-applies and the font `<link>` is re-injected (assert `link[data-cv-font-key]` present + computed font).                                                                       | `persist-reload`         |
| A9  | Built-in theme selected → body/sans render unchanged (no `--font-family-*` override from C3 on a fontless theme).                                                                                                                            | `builtin-no-regression`  |
| A10 | Console error count === 0; warning count recorded across the run.                                                                                                                                                                            | summary                  |

Embed the result table (assertion id · description · result · screenshot · PASS/FAIL) + console-error count, console-warning count, PASS/FAIL summary — actual run results, never "expected."

### Stage 2 — Human design checklist (3–7 items, closes the PR)

1. Font-name legibility in the picker list (names readable in the UI font; the selected family renders in its own face once loaded).
2. Status-line copy clarity — is the offline-ready vs needs-network vs loading vs error distinction obvious at a glance?
3. No layout-shift jank when the webfont swaps in (the `swap` reflow is acceptable, not janky) — including the one-time boot reflow for a saved non-curated Google-font theme.
4. The two font controls (quick-stack `Select` + `FontPicker`) read as one coherent "font" area, not two competing ones.
5. Weight-chip density feels right within the Typography section.

**Scrutinize callout:** _The failure mode we must never ship is broken/tofu text. Verify the system stack always wins when the webfont can't load (CSP-blocked, CDN-hung, offline-non-curated), and that curated families render offline. Watch the boot swap reflow for a saved non-curated font — it is accepted, but confirm it never flashes broken glyphs._

---

## Risks

- **R1 — `document.fonts` absence in jsdom.** Mitigated: the loader spec stubs `document.fonts.load`. Runtime browsers all support it. Low.
- **R2 — Volt `Select` ships raw colors and trips single-source.** Mitigated: Task 9 runs `check:single-source` immediately after install and tokenizes if needed. Low–medium.
- **R3 — css2 URL format drift.** Mitigated: Context7 gate before `buildFontHref` + frozen golden-URL test. Low.
- **R4 — Boot reflow for saved non-curated Google fonts.** Accepted + documented (Stage-2 #3). The token value paints in fallback immediately (cache), the face swaps in. Not a defect. (No `preconnect`/`preload` in C3 — keep deterministic; can add later.) Low.
- **R5 — Bundle size of ~8 curated woff2 families (~1.2–1.8 MB) + ~80–150 KB catalog JSON.** The JSON is code-split off the boot path; the woff2 are lazy-`@font-face`. The repo/build delta is the cost. Gated by SO-1. Medium (size only, not correctness).
- **R6 — Pop-out torn down mid-inject.** Mitigated: `try/catch` + `win.closed` short-circuit + register-time backfill. Low.
- **R7 — Heading ownership reverts to C3 mid-flight.** If the maintainer overrides §0.1, the 6-file token doc-sync + heading UI must be added. Tracked as the conditional in the doc-sync checklist. Low (decision is locked to C2).

## Open questions

- **SO-1 (bundle budget) — needs maintainer sign-off before Task 5 commits woff2.** Approve the curated set (8 families × {400,600,700}, Inter reused from `@fontsource-variable/inter`) and the ~1.2–1.8 MB build delta, or trim to 6 families / 2 weights. This is the single biggest size lever and blocks only Task 5/6, not the scaffolding (Tasks 0–4, 7–8).
- **Heading role (resolved, noted for traceability):** owned by C2 per §0.1; C3 ships `fontSpec.heading` in the type for forward-compat but no heading emit/UI. Confirm only if the maintainer wants to reverse the cross-phase assignment.
- **CSP default posture (resolved):** ship the nginx example `'self'`-locked by default and document the opt-in (least-privilege; curated offline still works). Confirm only if the maintainer prefers pre-opened Google origins out of the box.
