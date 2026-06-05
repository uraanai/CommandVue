# Track A — Theme Studio v2 (Phases C1–C6) — MASTER PLAN

> **Status:** Binding master plan. This document is the single authority that ties together CommandVue's dynamic
> Theme Studio expansion (phases C1–C6). Where any individual per-phase design conflicts with this document, **this
> document wins** and the phase writer amends their design before branching.
>
> **Scope:** Six additive phases that grow the Theme Studio from a generate-and-pick surface into a full dynamic theming
> studio — per-token editing, modular typography, runtime web fonts, dockview panel chrome, depth/effects, and a locked
> information architecture.
>
> **Authority chain:** The four CANONICAL RESOLUTION sections embedded below (`§A` data-model, `§B` sequencing, `§C`
> open-decisions, `§D` testing/CI/doc-sync) are reproduced verbatim from the integration architect's rulings. They are
> binding. The six per-phase design docs implement them.

**Per-phase design docs (the six leaves of this plan):**

- [`track-a-c1-tokens-tab.md`](./track-a-c1-tokens-tab.md) — Tokens tab (per-token editor + `tokenManifest.ts`)
- [`track-a-c2-typography-scale.md`](./track-a-c2-typography-scale.md) — Typography (font roles + modular type scale)
- [`track-a-c3-google-fonts.md`](./track-a-c3-google-fonts.md) — Google Fonts (runtime loading + pop-out mirror)
- [`track-a-c4-panels-chrome.md`](./track-a-c4-panels-chrome.md) — Panels & Chrome (dockview chrome + `panel-appearance` preset)
- [`track-a-c5-effects.md`](./track-a-c5-effects.md) — Effects (elevation ramp + glow/blur)
- [`track-a-c6-studio-ia-density.md`](./track-a-c6-studio-ia-density.md) — Studio IA + density resolution + scrollable tabs

---

## 0. Overview — what Track A builds, and the two control layers

CommandVue ships a deterministic OKLCH theme engine (`generateTheme`), a three-layer token system (primitive → semantic →
component), an idb-backed theme repository, a portable JSON import/export round-trip, and a live-preview engine that paints
the running app (and pop-out windows) as the user authors. The Theme Studio panel is the authoring surface. Track A turns
that panel into a complete dynamic studio without breaking a single byte of any existing built-in or user theme.

### The guiding principle — "everything painted is a token"

Every visual property the app renders resolves through a CSS custom property that lives in `tokens.css` and is enumerated
in the `knownTokens.ts` allowlist. Nothing is painted from a hardcoded color, radius, shadow, or font literal in a UI
primitive. This is enforced mechanically by the single-source CI guard (`scripts/check-single-source.mjs`, scans
`src/volt/**` + `src/components/ui/**`) and the knownTokens allowlist (the security boundary at the import/persist
boundary). Track A's entire job is to make **more** of that token vocabulary reachable from the Studio — without ever
introducing a paint path that bypasses a token.

### The two control layers

The Studio exposes two distinct, complementary ways to drive the token set. Every phase fits into exactly one of them:

| Layer                 | What it is                                                                                                                                                                                                                                | How it writes                                                                                                            | Phases                                                                                                                      | Persists as                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Generate**          | A small set of high-level knobs (base/accent color, contrast, mode, density, font, type scale, effects) that drive the deterministic OKLCH engine to emit ~73+ tokens wholesale.                                                          | The user moves a knob → `generationResult` recomputes → the engine emits the full token set.                             | C2 (`typeScale`), C3 (`fontSpec`), C5 (`effects`) extend the generation **input**; the Generate tab itself is pre-existing. | `Theme.base.input` (a `GenerationInputV2`)     |
| **Tokens / per-area** | Per-token hand-editing — a sparse override that layers on top of the generated base with CSS-cascade semantics (override wins). Surfaced as a searchable manifest (C1) and as per-area editors inside the Typography/Panels/Effects tabs. | The user edits one token → it writes into a single sparse `overrides` map → the merged set is re-pushed to the live app. | C1 (the Tokens tab + manifest), plus per-token rows inside C2/C4/C5 tabs.                                                   | `Theme.overrides` (a sparse `ThemeTokens` map) |

**The cascade contract that unifies them:** the live preview and the on-save resolve both compute
`{ ...generationResult.tokens, ...overrides }` — generator base first, sparse overrides on top. There is exactly **one**
override map (`useThemeAuthoring.overrides`), introduced once (by C6), and exactly **one** live-apply writer (a merged
wholesale `previewThemeTokens` push). C4's dockview chrome geometry is a special case: it is **overrides-only** (no
generation input), emitted unconditionally as `var()`-chain literals equal to their `tokens.css` defaults.

C6 (IA shell) and C1 (Tokens tab) are the load-bearing foundation: C6 ships the tab container + the `overrides` seam + the
density split; C1 ships the per-token editor + the `tokenManifest.ts` that C2/C4/C5 annotate. C2/C3/C5 each add one optional
field to the generation input. C4 adds the dockview chrome family + a `panel-appearance` preset. C6 is data-model-inert.

---

## §A. CANONICAL RESOLUTION — Unified Data-Model & Portability Evolution Across C1–C6

> **Authority.** This section is binding. Where any individual phase design (C1–C6) conflicts with it, **this section
> wins** and the phase writer follows it verbatim. It resolves every per-phase data-model delta into one additive
> evolution of `GenerationInputV2` / `Theme` / `PortableTheme`, fixes the exact field set and field order, fixes when
> `THEME_SCHEMA_VERSION` vs `ENGINE_VERSION` bump (answer: **never, across all of C1–C6**), fixes the migration story,
> the portable round-trip, and how built-in/existing themes stay byte-stable.

All facts below are verified against the live tree on `develop`: `THEME_SCHEMA_VERSION = 2`, `ENGINE_VERSION = 1`
(`src/types/theme.ts:22,32`); `toGenInput` conditional-assign (`resolve.ts:47-59`); additive emit gated by
`if (input.fontFamily)` and `if (hasStatusOverride)` (`generate.ts:467-497`); `GenerationInputV2Schema` + `ThemeBaseSchema`
(`portableSchema.ts:86-102`); the LLM-doc guard is **doc→allowlist** and its example envelope is `schemaVersion: 1`
(`theme-schema-for-llms.spec.ts:60`).

### A.1. The two version constants — when (if ever) they bump

**`THEME_SCHEMA_VERSION` stays `2` for the entirety of C1–C6. `ENGINE_VERSION` stays `1` for the entirety of C1–C6. No
phase bumps either. No phase bumps `DB_VERSION` (stays `3`).** This is a hard constraint, not a default.

#### A.1.1 `THEME_SCHEMA_VERSION` — the rule the writers apply

`THEME_SCHEMA_VERSION` bumps **only** when the persisted/portable record _shape_ changes incompatibly — i.e. an existing
field changes type, becomes mandatory, or the `ThemeBase`/`Theme`/`PortableTheme` discriminant restructures. **Adding a new
OPTIONAL field to `GenerationInputV2` does NOT bump it.** Every C1–C6 data-model delta is an additive optional field on
`GenerationInputV2.base.input` (or a sparse `overrides` entry, which has no shape change at all). Therefore:

- C1 (Tokens) → no new input field → no bump.
- C2 (`typeScale?`) → additive optional → no bump.
- C3 (`fontSpec?`) → additive optional → no bump.
- C4 (Panels & Chrome) → **no new input field** (geometry tokens are `overrides`-only, see §A.2.4) → no bump.
- C5 (`effects?`) → additive optional → no bump.
- C6 (IA/density/tabs) → no data-model touch at all → no bump.

`PortableThemeSchema.schemaVersion` stays `z.literal(THEME_SCHEMA_VERSION)` = `z.literal(2)` (`portableSchema.ts:128`). Do
**not** change it. An older client importing a newer file with an unknown additive field strips that field via Zod's
default object-strip (the schema is plain `z.object`, not `.strict()` / not `.passthrough()`); the theme renders from its
embedded `tokens` cache. A newer client importing an older file sees the field absent → engine emits nothing new →
byte-identical. This is the forward/backward-compat posture; every writer preserves it.

#### A.1.2 `ENGINE_VERSION` — the rule the writers apply

`ENGINE_VERSION` bumps **only** when the derivation math of an **already-emitted** token key changes for an input that an
existing theme already has. **Adding new emitted keys is additive and never bumps it.** The §3i engine-stability contract
is enforced by `tests/unit/themes/engine-stability.spec.ts` (re-resolve byte-identical) and the `resolve()` memo key
`${ENGINE_VERSION}:${JSON.stringify(base.input)}` (`resolve.ts:69`).

Every C2/C3/C5 emission MUST follow the existing additive-emit pattern at `generate.ts:467` (`if (input.fontFamily) {...}`)
and `:478` (`if (hasStatusOverride) {...}`): **emit the new keys ONLY inside an `if (input.<newField>)` guard.** When the
field is absent, zero new keys are emitted and the output for every pre-existing theme is byte-identical. This is what keeps
`ENGINE_VERSION` at `1`.

**The two BLOCKER-class traps the gap-hunts surfaced, resolved here as binding rules:**

- **C3 glow / C5 glow MUST NOT re-emit an existing key as a baked OKLCH literal.** The C5 design's `css(oklch(...))`
  re-point of `--color-interactive-glow` was flagged in three independent gap-hunts. **Rule:** when C5's `effects.glowAlpha`
  re-points `--color-interactive-glow`, it MUST emit a `color-mix(in oklch, var(--color-interactive) <pct>%, transparent)`
  string that preserves the live `var(--color-interactive)` reference — never a baked color. This keeps accent-recolor
  propagation intact (knownTokens gotcha G4/G8) and, because the re-point happens **only inside `if (input.effects)`**, no
  effects-less theme's `--color-interactive-glow` math changes → `ENGINE_VERSION` stays `1`.
- **C5 MUST NOT change `--shadow-accent-glow`'s spread math.** Re-emitting `--shadow-accent-glow` with a variable spread is
  a derivation-math change to an existing key. **Rule:** C5's glow slider re-points only the _color_
  (`--color-interactive-glow` via `color-mix`); the `--shadow-accent-glow` spread stays the fixed `tokens.css`/engine value.
  If a variable spread is genuinely wanted, it is a **new** token in a later phase, not a mutation of the existing one.
- **Engine-stability pin (mandatory in C2, C3, C5 PRs):** each of these phases adds an `engine-stability.spec.ts` assertion
  that `generateTheme(<fixed input with NO new field>)` is byte-identical to a captured pre-phase fixture. This CI-pins that
  the new conditional emit never leaks into the unconditional path.

### A.2. The FINAL additive field set — implement VERBATIM

This is the complete, ordered, canonical shape of `GenerationInputV2` after **all** of C1–C6 land. Writers add **only their
phase's field**, in the position shown, never reordering existing fields (reordering changes `JSON.stringify` and pollutes
the `resolve()` memo — see §A.3).

#### A.2.1 `src/types/theme.ts` — `GenerationInputV2` final shape

Fields appear in this exact order. Existing fields (`schemaVersion` … `statusOverrides`) are unchanged and stay first. New
optional fields are appended **after `statusOverrides`**, in phase order **C2 → C3 → C5**. (C1, C4, C6 add no field here.)

```typescript
export interface GenerationInputV2 {
  schemaVersion: 2;
  baseColor: string;
  accentColor: string;
  contrast: number;
  mode: ThemeMode;
  density: ThemeDensity;
  fontFamily?: string; // EXISTING — legacy single stack; retained for back-compat
  statusHues?: StatusHues; // EXISTING — forward-compat, not consumed by engine
  statusOverrides?: StatusOverrides; // EXISTING — A1b live hue lever
  // ── Additive optional fields (Track A C2/C3/C5). Each is OMITTED when unset
  //    (§3i "keep the input honest"); each gates a conditional engine emit. ──
  typeScale?: TypeScaleInput; // C2 — modular type-scale ramp
  fontSpec?: FontSpec; // C3 — structured Google/system/stack font choice
  effects?: EffectsSpec; // C5 — depth/glow/blur
}
```

#### A.2.2 The three new input interfaces — exact, canonical definitions

Writers use these verbatim. Place each interface **directly above** `GenerationInputV2` in `src/types/theme.ts`, in
C2 → C3 → C5 order.

```typescript
// ── C2 ──────────────────────────────────────────────────────────────────────
/** Modular type-scale generator input (Track A C2). When present, the engine
 *  derives the full `--text-xs … --text-4xl` ramp via baseSize × ratio^step.
 *  When absent, the fixed tokens.css ramp is the cascade fallback (additive). */
export interface TypeScaleInput {
  /** Base font size in px for `--text-base`. Range 10–24; out-of-range REJECTED at the import boundary (not clamped). */
  baseSize: number;
  /** Modular ratio (e.g. 1.2 = minor third). Range 1.0–1.333; out-of-range REJECTED at the import boundary (not clamped). */
  ratio: number;
}

// ── C3 ──────────────────────────────────────────────────────────────────────
export type FontSource = "google" | "system" | "stack";

/** Structured font choice (Track A C3). Lossless superset of `fontFamily`.
 *  Persisted on `base.input`; round-trips so a re-import re-loads the same font. */
export interface FontSpec {
  /** Catalog display name (google) or leading family (stack/system).
   *  Charset-allowlisted at the import boundary (see §A.5). */
  family: string;
  source: FontSource;
  /** Upright weights to request from Google. Empty/omitted → default 400. */
  weights?: number[];
  /** Fallback stack appended after `family`. Defaults to the category fallback. */
  fallback?: string;
  /** Optional independent heading family. FORWARD-COMPAT structure only — NOT wired in C1–C6:
   *  C3 is body-only and does not emit this; the heading is set via C2's
   *  `overrides[--font-family-heading]` Select. A future phase may consume it to drive
   *  `--font-family-heading` from generation input. */
  heading?: { family: string; source: FontSource; weights?: number[]; fallback?: string };
}

// ── C5 ──────────────────────────────────────────────────────────────────────
/** Effects / depth inputs (Track A C5). All optional; OMITTED when unset. */
export interface EffectsSpec {
  /** 0–100. Depth of the `--shadow-1..5` ramp. 0 = flat, 50 = neutral default. */
  depth?: number;
  /** 0–1. Alpha of the accent glow (re-points `--color-interactive-glow`). */
  glowAlpha?: number;
  /** 0–24 (px). Radius for `--dockpanel-glass-blur` (consumed by C4 glass). */
  blurRadius?: number;
}
```

#### A.2.3 `Theme` / `ThemeBase` / `PortableTheme` — NO structural change in any phase

- **`Theme`** — unchanged across C1–C6. All per-token hand-edits (C1 Tokens tab, C2 per-step `--text-*`, C2/C3 font-role
  overrides, C4 chrome geometry) land in the **existing** `Theme.overrides: ThemeTokens` (sparse map, `theme.ts:181`). No new
  `Theme` field.
- **`ThemeBase`** — unchanged discriminated union. `typeScale?` / `fontSpec?` / `effects?` ride **inside**
  `{ kind: "generated"; input: GenerationInputV2 }`. Static bases (built-ins, imports) never carry them.
- **`PortableTheme`** — unchanged envelope. New input fields travel inside `theme.base.input` (already serialized verbatim
  by `exportThemeToJson`).

#### A.2.4 C4 owns NO `GenerationInputV2` field — binding decision

The C4 design floated a `chrome?: { panelRadius?, panelBorderWidth? }` generation input as an option; the gap-hunt and this
resolution **reject it**. **C4 adds zero fields to `GenerationInputV2`.** C4's dockview-chrome geometry tokens
(`--dockpanel-radius`, `--dockpanel-border-width`, `--dockpanel-shadow`, `--dockpanel-gap`, `--dockpanel-tab-font-size`,
`--dockpanel-tab-font-weight`, `--dockpanel-tab-active-indicator`) are emitted **unconditionally** as `var()`-chain literals
equal to their `tokens.css` defaults (engine-stability-safe per §3i because the emitted value equals the cascade default),
and are user-customized only via sparse `overrides`. This keeps C4's data-model delta at **zero new persisted input fields**
and avoids a second source of truth for chrome.

### A.3. The memo-key / "keep the input honest" discipline — binding for all phases

The `resolve()` memo key is `${ENGINE_VERSION}:${JSON.stringify(base.input)}` (`resolve.ts:69`). An **absent** key and an
explicit `undefined` value serialize identically under `JSON.stringify` only if the key is never assigned. The §3i rule
(already applied to `fontFamily`/`statusOverrides`) is mandatory for every new field:

1. **`toGenInput` (`resolve.ts`)** forwards each new field with conditional-assign, never a spread of `undefined`:

   ```typescript
   if (input.typeScale !== undefined) out.typeScale = input.typeScale; // C2
   if (input.fontSpec !== undefined) out.fontSpec = input.fontSpec; // C3
   if (input.effects !== undefined) out.effects = input.effects; // C5
   ```

   (C1/C4/C6 add nothing here.)

2. **`useThemeAuthoring.buildGenerationInput()`** assigns each new field **only when truthy**, never as an explicit
   `undefined`:

   ```typescript
   if (typeScale.value) input.typeScale = typeScale.value; // C2
   if (fontSpec.value) input.fontSpec = fontSpec.value; // C3
   if (effects.value) input.effects = effects.value; // C5
   ```

3. **Lazy materialization (C2/C5 binding rule).** The authoring ref for a field that defaults to "neutral" (C2 `typeScale`,
   C5 `effects`) starts as `null`, NOT as a defaults object. The Studio slider binds through a `computed` getter/setter that
   reads `ref.value?.field ?? DEFAULT` on get and materializes `{ ...DEFAULTS, [field]: v }` on first set. This preserves
   byte-identity for a theme the user opens-but-never-touches (no field is introduced into `base.input`, so its
   `JSON.stringify` and resolved tokens are unchanged). The C5 design's `ref<EffectsSpec>(null)` +
   `v-model="a.effects.value.depth"` contradiction is resolved in favor of the computed-proxy pattern.

4. **No field reordering, ever.** New fields append after `statusOverrides` in the §A.2.1 order. Reordering existing fields
   changes the serialized string and silently invalidates every cached base — forbidden.

### A.4. Migration of themes persisted before each phase — ZERO migration code

**No phase writes any migration code in `migrate.ts`. `migrateThemeV1ToV2` is untouched across C1–C6. The idb v3 upgrade
(`db.ts`) is untouched; `DB_VERSION` stays `3` and the `db.spec.ts:35` `expect(db.version).toBe(3)` assertion stays green.**
The mechanism, identical for every phase:

- A v1 record migrated to v2 has no `typeScale`/`fontSpec`/`effects` key → the field stays absent (not `undefined`-valued) →
  engine emits no new keys → resolved `tokens` cache is byte-identical to pre-phase → the `migrate.spec.ts` pixel-identical
  contract holds with no edit.
- A v2 generated theme created before phase N has no field-N key → same absent-key path → identical resolve → no recolor.
- A v2 generated theme **re-resolved after** phase N (e.g. on its next apply) recomputes through the new engine, but because
  the field is absent the new conditional emit blocks never run → byte-identical. New emitted keys only appear when the
  **user opts into** the new field via the Studio.
- The in-memory `resolve()` memo is per-session; after a deploy the worker reloads with an empty memo and the first resolve
  recomputes under the new engine — still byte-identical for effects-less/scale-less/fontSpec-less themes. **No persisted
  `theme.tokens` cache rewrite at boot.** Missing chrome/effects/scale keys inherit their `tokens.css` `:root`/`@theme`
  defaults, which equal what the engine would emit.

**Two phase-specific migration nuances, resolved:**

- **C4 chrome keys are emitted unconditionally** (§A.2.4), so a pre-C4 generated theme _gains_ `--dockpanel-radius` etc. on
  next resolve. Because each is emitted as the exact `var()`-chain literal that `tokens.css` already defaults to, the resolved
  cascade is byte-identical whether the key is in the cache or inherited → the engine-stability "additive key adoption"
  assertion covers this with no migration code.
- **C2 `--text-*` and C3 `--font-family-heading`** are net-new themeable tokens that did not exist in the allowlist before
  their phase. A theme authored elsewhere (or a newer-fork export) carrying a `--text-*` / `--font-family-heading`
  **override** was rejected by `TokenNameSchema` before the phase and is accepted after — correct forward-compat. The reverse
  (a C2/C3 theme imported into a pre-phase build) strips the unknown `overrides` key via the same allowlist gate and renders
  from the embedded `tokens` cache — graceful, lossy-by-design, no throw.

### A.5. Portable round-trip — exact `portableSchema.ts` additions

Each phase adds its field to `GenerationInputV2Schema` (`portableSchema.ts:86-96`) as `.optional()`, in the §A.2.1 order,
**after** the existing `statusOverrides` line. **No phase touches `PortableThemeSchema.schemaVersion` (`z.literal(2)`) or
`ThemeBaseSchema`'s discriminant.** Posture rule: use plain `z.object(...)` (strip unknown keys) for the new sub-schemas —
**NOT `.strict()`** — so a future additive sub-field from a newer fork is stripped gracefully rather than hard-rejected
(matches the existing `GenerationInputV2Schema` posture; resolves the C5 design's erroneous `.strict()` choice).

```typescript
// C2 — after the statusOverrides line in GenerationInputV2Schema:
typeScale: z.object({
  baseSize: z.number().min(10).max(24),     // engine range; out-of-range REJECTED at import (not clamped)
  ratio:    z.number().min(1).max(1.333),   // engine range; out-of-range REJECTED at import (not clamped)
}).optional(),

// C3:
fontSpec: z.object({
  family:   z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9 \-]*$/),
  source:   z.enum(["google", "system", "stack"]),
  weights:  z.array(z.number().int().min(1).max(1000)).max(18).optional(),
  fallback: z.string().max(200).regex(/^[A-Za-z0-9 ,'_-]*$/).optional(),
  heading:  z.object({
    family:   z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9 \-]*$/),
    source:   z.enum(["google", "system", "stack"]),
    weights:  z.array(z.number().int().min(1).max(1000)).max(18).optional(),
    fallback: z.string().max(200).regex(/^[A-Za-z0-9 ,'_-]*$/).optional(),
  }).optional(),
}).optional(),

// C5:
effects: z.object({
  depth:      z.number().min(0).max(100).optional(),
  glowAlpha:  z.number().min(0).max(1).optional(),
  blurRadius: z.number().min(0).max(24).optional(),
}).optional(),
```

**Round-trip contract (every phase):** export embeds `base.input.<field>` verbatim (`exportThemeToJson` is pure, no change);
import validates via the new sub-schema; the importer re-derives the `tokens` cache via `themeRepo.create` → `resolve()`,
reproducing the same ramp/glow/blur deterministically for the same engine. Each phase adds a `portable.spec.ts` assertion:
export a theme with the field → import → `base.input.<field>` deep-equals AND a representative resolved token matches.

**Validation-boundary note (C2 typeScale range, resolved):** C2's Zod range equals the engine range exactly —
`baseSize` 10–24, `ratio` 1.0–1.333 (`z.number().min(1).max(1.333)`). An out-of-range `typeScale` import is **REJECTED**
at the import boundary (it fails `GenerationInputV2Schema` validation), **not** clamped on resolve. There is no "wider Zod
than engine" gap and nothing clamps a persisted value — a faithfully-round-tripped `base.input.typeScale` is always within
range by construction. Per-token `--text-*` override **values** are additionally bounded by `TokenValueSchema` (≤500 chars,
injection-filtered) since they land in `overrides`.

### A.6. How built-in & pre-existing themes stay byte-stable — the four guarantees every phase preserves

1. **Built-ins are `static` bases.** They carry no `base.input`, so `typeScale`/`fontSpec`/`effects` can never appear on
   them; their frozen `tokens` are returned directly by `resolveBaseTokens` (`resolve.ts:68`). No phase changes a built-in's
   bytes.
2. **Additive-emit gate.** Every new emitted key (C2 `--text-*`, C3 `--font-family-heading`, C5
   `--shadow-1..5`/`--dockpanel-glass-blur`) is gated behind `if (input.<field>)`. Absent field → zero new keys →
   byte-identical. (C4 chrome keys are unconditional but equal their `tokens.css` defaults, so the resolved cascade is
   byte-identical.)
3. **No existing-key math change.** No phase mutates the derivation of an already-emitted key for an existing input (C5 glow
   uses `color-mix(... var(--color-interactive) ...)`, never a baked literal; `--shadow-accent-glow` spread is untouched).
   `ENGINE_VERSION` stays `1`.
4. **Default-off for opt-in fields.** C2 `typeScale` and C5 `effects` default to **off / `null`** in the authoring UI (lazy
   materialization, §A.3.3). A new generated theme created without touching those tabs has no field in `base.input` →
   identical to a pre-phase theme. This is mandatory, not advisory.

### A.7. The doc-sync 6-file rule — which phases fire it, and the guard contract

Adding a **new token family** fires the doc-sync rule in ONE PR: `tokens.css` + `knownTokens.ts` + `generate.ts` +
`docs/theme-schema-for-llms.md` + the LLM-doc guard test (`tests/unit/docs/theme-schema-for-llms.spec.ts`) + the
tokenManifest spec (`tests/unit/themes/tokenManifest.spec.ts` ↔ `tokenManifest.ts`). The 6th file (the tokenManifest spec)
**only exists post-C1** — for any token-adding phase that lands after C1 (all of them, per §B.3 sequencing) the rule is
6-file; were a token family ever added before C1 it would be 5-file. The same label ("6-file") is used in §D.2. Binding
determination per phase:

| Phase  | Fires 6-file doc-sync? | New allowlist names (exact array placement)                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | **No**                 | None. Surfaces existing tokens only. `tokenManifest.ts` is new but is annotation over `knownTokens.ts`; its drift guard asserts `keys(manifest) === new Set(ALL_KNOWN_TOKEN_NAMES)`.                                                                                                                                                                                                                                                               |
| **C2** | **Yes**                | `--font-family-heading` → `THEMEABLE_PRIMITIVE_TOKEN_NAMES` (alongside `--font-family-sans`/`-mono`); `--text-xs … --text-4xl` (8) → new `TYPE_SCALE_TOKEN_NAMES` array spread into `ALL_KNOWN_TOKEN_NAMES`.                                                                                                                                                                                                                                       |
| **C3** | **Yes**                | `--font-family-heading` → `THEMEABLE_PRIMITIVE_TOKEN_NAMES`. **Ownership rule:** `--font-family-heading` is owned by **whichever of C2/C3 lands first**; the second phase MUST NOT re-declare it (add a `knownTokens` no-duplicate guard test). If C3 lands before C2, C3 adds it; C2 then skips it.                                                                                                                                               |
| **C4** | **Yes**                | 7 `--dockpanel-*` chrome tokens → `COMPONENT_TOKEN_NAMES` (the §A.2.4 set: radius, border-width, shadow, gap, tab-font-size, tab-font-weight, tab-active-indicator). `--dockpanel-glass-blur` is the canonical glass-blur name (NOT `--panel-blur`) — owned by **C5** (see C5 row), NOT counted in C4's 7; C4 consumes it via `var(--dockpanel-glass-blur, 8px)`. The `--dv-panel-*` wiring vars in `dockview.css` are NOT allowlisted (internal). |
| **C5** | **Yes**                | `--shadow-1 … --shadow-5` (5) → `SEMANTIC_TOKEN_NAMES`; `--dockpanel-glass-blur` → `COMPONENT_TOKEN_NAMES` (C5 owns this single token; placed in `COMPONENT_TOKEN_NAMES` for family consistency, default `8px`, consumed by C4). The C5↔C4 `--panel-blur` naming collision is resolved by renaming to `--dockpanel-glass-blur` and assigning sole ownership to C5; C4 references it order-independently.                                           |
| **C6** | **No**                 | None. Pure UI/composable; zero token, schema, engine, or persistence change.                                                                                                                                                                                                                                                                                                                                                                       |

**Guard contract every phase relies on (verified):** `theme-schema-for-llms.spec.ts` asserts (a) balanced fences, (b)
**every `--token` mentioned in the doc is in the allowlist** (doc→allowlist, NOT allowlist→doc — so a token added to
`knownTokens.ts` without a doc mention does not fail), (c) 5 core tokens present, (d) the first `json` example envelope
parses with **`schemaVersion: 1`** and only-known token keys. **Binding rule:** C2/C3/C4/C5 add their new token names to
`knownTokens.ts` in the **same PR** as any doc mention, and **leave the example envelope at `schemaVersion: 1`** — do NOT add
new tokens to the example, do NOT bump the example to 2 (the importer up-casts v1 envelopes; assertion (d) hard-checks
`=== 1`). A prose mention of the new token family in the doc body is sufficient and required.

### A.8. Cross-phase ordering & independence — the binding contract

- **No phase has a hard data-model dependency on another.** Each new field is an independent additive optional. Phases may
  land in any order; the canonical §A.2.1 field-append order is the _target_ shape, and a writer adds only its own field
  wherever its phase lands in the merge sequence.
- **C1's `tokenManifest.ts` is a soft dependency** for the polished per-token editors in C2/C4/C5's Studio tabs. If C1 has
  landed, those phases add manifest rows for their new tokens
  (`section: "Typography" | "Panels & Chrome" | "Effects"`). If C1 has not landed, those phases ship bespoke controls and skip
  the manifest. Neither blocks the data-model work. (See §B.5 — the no-C1 fallback is **forbidden** by the sequencing
  resolution, because C1 is a hard predecessor; this paragraph is the data-model-layer statement of independence, the
  sequencing layer is stricter.)
- **C6 is data-model-inert** and may land before or after any of C1–C5; it touches only `ThemeStudioPanel.vue` IA, the
  density-scope wrapper, and the responsive Splitter.
- **`--font-family-heading` (C2↔C3) and `--dockpanel-glass-blur` (C4↔C5)** are the only two cross-phase token-ownership
  collisions; both are resolved by single-owner assignment + a no-duplicate `knownTokens` guard test (§A.7). The owning phase
  declares; the consuming phase references with a `var(..., <fallback>)` so order does not matter.

### A.9. Canonical writer checklist (per phase)

A writer adding a `GenerationInputV2` field does **all** of, and **only** of:

1. Add the interface (verbatim from §A.2.2) above `GenerationInputV2` in `src/types/theme.ts`; append the optional field
   after `statusOverrides` in the §A.2.1 order. **No version-constant change.**
2. Add `<field>?` to `ThemeGenerationInput` in `generate.ts`; emit new keys **only inside `if (input.<field>)`**; preserve
   all existing-key math; add the engine-stability byte-identity pin.
3. Add the conditional-forward line to `toGenInput` (`resolve.ts`).
4. Add the `.optional()` sub-schema to `GenerationInputV2Schema` (`portableSchema.ts`), plain `z.object` (strip), per §A.5.
5. Add the authoring ref (lazy-`null`) + computed-proxy binding + `buildGenerationInput` conditional-assign + `seedFromTheme`
   (guard `base.kind === "generated"`) + `reset` clears to `null`, in `useThemeAuthoring.ts`.
6. If introducing token names: the 6-file doc-sync (§A.7 / §D.2), same PR; leave the LLM-doc example at `schemaVersion: 1`.
7. Add `portable.spec.ts` round-trip + `engine-stability.spec.ts` byte-identity + (if new tokens) `knownTokens`
   no-duplicate assertions.

**Nothing in C1–C6 bumps `THEME_SCHEMA_VERSION`, `ENGINE_VERSION`, or `DB_VERSION`. Nothing writes migration code. Built-ins
and pre-existing themes stay byte-stable by construction.**

**Relevant absolute paths for writers:** `src\types\theme.ts` (interfaces + constants), `src\modules\themes\resolve.ts`
(`toGenInput`), `src\modules\themes\generate.ts` (additive emit), `src\modules\themes\portableSchema.ts`
(`GenerationInputV2Schema`), `src\modules\themes\knownTokens.ts` (allowlist arrays),
`tests\unit\docs\theme-schema-for-llms.spec.ts` (doc guard, example stays `schemaVersion: 1`),
`src\modules\themes\migrate.ts` (untouched), `src\modules\storage\db.ts` (`DB_VERSION` stays 3, untouched).

---

## §B. CANONICAL RESOLUTION — Phase Sequencing, Dependencies & Shippable Slices (C1–C6)

This section is binding. Where a per-phase design conflicts with what follows, **this section wins** and the phase design
must be amended before execution. All six phase plan-writers must read this verbatim before branching.

### B.1. Ground truth (verified against HEAD)

`develop` HEAD is the scrollable-Tabs commit (#143). **None of C1–C6 have landed.** The following do **not** exist in the
tree and must not be assumed by any phase: `src/modules/themes/tokenManifest.ts`, `GenerationInputV2.typeScale`,
`GenerationInputV2.fontSpec`, `GenerationInputV2.effects`, `GenerationInputV2.chrome`, `useFontLoader.ts`,
`--font-family-heading`, `--text-*` in `knownTokens.ts`, `--shadow-1..5`, `--dockpanel-glass-blur`, `dockApi.ts`, any Studio
`activeTab`/`<Tabs>` wrapper.

The following **do** exist and are consumed (not built) by these phases: scrollable `ui/Tabs`
(`scrollable`/`scrollbar`/`scrollbarColor`), `volt/InputNumber.vue`, `volt/Slider.vue`, the live-preview engine
(`previewThemeTokens`/`setPreviewToken`/`resetPreviewToken`/`cancelPreview`/`endPreview`/`applyTokenOverrides`/`APP_ROOT`),
`usePopoutThemeSync`, the preset runtime, the panel-instance registry.

### B.2. The dependency DAG (canonical)

```
                       ┌─────────────────────────────────────────────┐
                       │  shipped foundation (#143):                  │
                       │  live-preview engine · usePopoutThemeSync ·  │
                       │  scrollable ui/Tabs · ThemeStudioPanel ·     │
                       │  useThemeAuthoring · preset runtime          │
                       └───────────────┬─────────────────────────────┘
                                       │
                 ┌─────────────────────┴───────────────────────┐
                 │                                              │
            ┌────▼────┐                                    (independent of
            │   C6    │  IA shell + tabContainer +          the IA shell:
            │  FIRST  │  overrides seam + density            data-model only)
            └────┬────┘  resolution + scrollable adoption
                 │
   ┌─────────────┼───────────────┬──────────────┬───────────────┐
   │             │               │              │               │
┌──▼──┐       ┌──▼──┐         ┌──▼──┐        ┌──▼──┐         ┌──▼──┐
│ C1  │       │ C2  │         │ C5  │        │ C4  │         │ C3  │
│Tokens│      │Type │         │Effects│      │Panels│       │Fonts│
└──┬──┘       └──┬──┘         └──┬──┘        └──┬──┘         └─────┘
   │             │               │              │
   │             │          (C5 owns ──────────►│ C4 consumes
   │             │           --dockpanel-glass-blur,  --dockpanel-glass-blur,
   │             │           --shadow-1..5)           --shadow-1..5)
   │             │                               │
   └─────────────┴──────────► tokenManifest.ts ◄─┘
        (C1 creates it; C2/C4/C5 append their rows + their
         section to the manifest in their own PR)
```

**Edges (hard ⇒ blocking; soft ⇒ ordering preference only):**

| Edge                      | Type     | Reason                                                                                                                                                             |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| foundation → C6           | hard     | C6 is the IA shell; needs scrollable Tabs (shipped).                                                                                                               |
| **C6 → C1**               | **hard** | C1's Tokens tab body mounts into the C6 tab container; C1 consumes the `useThemeAuthoring.overrides` seam that **C6 introduces** (§B.4).                           |
| **C6 → C2**               | **hard** | C2's Typography tab body mounts into the C6 container; C2 reuses the same `overrides` seam.                                                                        |
| **C6 → C5**               | **hard** | C5's Effects tab mounts into the C6 container.                                                                                                                     |
| **C6 → C4**               | **hard** | C4's Panels & Chrome tab mounts into the C6 container.                                                                                                             |
| C6 → C3                   | soft     | C3 mounts its FontPicker into the Typography tab if C2/C6 have landed; otherwise into the existing Generate "Typography" sub-section. C3 is **not** blocked by C6. |
| **C1 → {C2, C4, C5}**     | **hard** | Each of C2/C4/C5 appends manifest rows + a section to `tokenManifest.ts`. The file must exist first. (See §B.5 for the no-C1 fallback that is now **forbidden**.)  |
| **C5 → C4**               | **hard** | C4 consumes `--dockpanel-glass-blur` and `--shadow-1..5`, which **C5 owns** (§B.6).                                                                                |
| C2 → C3                   | soft     | C3 layers font loading onto C2's `fontSpec`/role rows. If C3 lands first it introduces `fontSpec` itself (additive). Either order compiles.                        |
| C2 ⟂ C5 ⟂ C4 (data-model) | none     | All three add disjoint additive optional fields to `GenerationInputV2`; no data-model ordering constraint between them.                                            |

**This inverts the spec's "C6 last" sequencing.** The spec sequenced C6 last to "lock a populated IA." We override that:
**C6 ships first with placeholder tab bodies.** Rationale: every other phase touches exactly one tab body instead of
restructuring the panel, the `overrides` seam lands once, and the density/responsive decisions are made before any tab body
depends on them. This is the lower-risk ordering and it is **mandatory**.

### B.3. Canonical build order

**Wave 0 (already merged):** foundation (#143).

**Wave 1 — C6 (IA shell). Ships alone. Blocking gate for Wave 2.**
PR title: `feat(theming): Studio IA lock + density resolution + scrollable-tabs adoption (Phase C6)`.

**Wave 2 — C1 (Tokens) + C3 (Fonts), in parallel.**

- C1 depends only on C6. It creates `tokenManifest.ts`.
- C3 depends on neither C1 nor C6 (it mounts into the Generate-tab Typography sub-section that exists today, or the
  Typography tab if C2 has landed). C3 may run concurrently with C1. **C3 must not touch `tokenManifest.ts`** (it is
  conditional in C3's design — make it unconditional: skip it; the one heading-token manifest row is C2's job, see §B.6).

**Wave 3 — C2 (Typography) + C5 (Effects), in parallel.** Both depend on C1 (manifest) and C6 (tab container). They are
mutually independent (disjoint tokens, disjoint `GenerationInputV2` fields).

**Wave 4 — C4 (Panels & Chrome). Last.** Depends on C1 (manifest), C6 (tab container), **and C5** (consumes `--dockpanel-glass-blur`

- `--shadow-1..5`).

```
Wave 1:  C6
Wave 2:  C1 ‖ C3
Wave 3:  C2 ‖ C5
Wave 4:  C4
```

Each wave ends with a merge to `develop` before the next wave branches. Within a wave, parallel PRs branch from the same
post-previous-wave `develop`. **Stop-and-wait after each PR merge** per GitFlow rules — no chaining.

### B.4. CONFLICT RESOLUTION — the `overrides` seam (C6 owns it; C1/C2/C5 consume it)

Three phases (C1 §5.1, C2 §6.4, C5) each independently propose adding a sparse-override ref to `useThemeAuthoring`. This
**must be a single seam, introduced once, in C6.** Binding contract:

- **C6 adds to `useThemeAuthoring.ts`** (and returns from its public surface):
  - `const overrides = ref<Record<string, string>>({})` — the canonical sparse per-token override map. Exact name:
    **`overrides`** (not `tokenOverrides`, not `perTokenDraft`).
  - `function setOverride(token: string, value: string): void`
  - `function clearOverride(token: string): void`
  - `function clearAllOverrides(): void`
  - Seed `overrides.value = themeToEdit.value?.base.kind === "generated" ? { ...(themeToEdit.value.base.input ? theme.overrides : {}) } : { ...(theme.overrides ?? {}) }` in `seedFromTheme`; clear to `{}` in `reset()`.
  - In `save()` and `updateExisting()`: pass `overrides: overrides.value` to `themeRepo.create`/`update`. Paired variant
    gets `overrides: {}`.
  - `validate()` runs `isKnownToken(key)` + `TokenValueSchema.safeParse(value).success` over every entry of
    `overrides.value` and sets `saveError` on the first violation — **mandatory, not "defensive."**
- **C6 changes `ThemeStudioPanel.vue`** `previewStyle` to the merged set:
  `computed(() => ({ ...(a.generationResult.value?.tokens ?? {}), ...a.overrides.value }))`.
- **C6 defines the single live-apply rule** (this resolves the "two-writer" BLOCKER raised against C1, C2, and C5
  identically):
  - The **generator path** (Generate-tab inputs + any `GenerationInputV2` field — including C2 `typeScale`, C5 `effects`)
    drives a debounced wholesale push: `watch(a.generationResult, ...) → previewThemeTokens({ ...generationResult.tokens, ...a.overrides.value }, density)`.
    Override-wins, re-asserted on every generator run.
  - The **per-token path** (Tokens-tab edits, C1) calls `a.setOverride(token, value)` then a debounced
    `previewThemeTokens({ ...a.generationResult.value?.tokens ?? {}, ...a.overrides.value }, density)` — **the same merged
    wholesale push, never bare `setPreviewToken`.** Reset calls `a.clearOverride(token)` then the same merged push.
  - **`setPreviewToken`/`resetPreviewToken` are NOT used by any Studio tab.** They remain in the store for non-Studio
    callers only. This eliminates the additive-leak BLOCKER (a removed override key is dropped because the wholesale
    `previewThemeTokens` replaces the draft, and `previewThemeTokens` already strips keys absent from the new set).
  - **C6 must add to the store** a no-flash wholesale replace if `previewThemeTokens`' current additive
    `applyTokenOverrides` leaves stale keys: before re-applying, call `clearTokenOverrides(APP_ROOT)` then
    `applyTokenOverrides(merged, APP_ROOT)` inside `previewThemeTokens`. C6 verifies (Playwright) that enabling then
    disabling a token-emitting input removes the key from the root.

C1/C2/C5 **consume** `a.overrides` / `a.setOverride` / `a.clearOverride` and the merged-push rule. They **must not**
re-declare the ref or invent a second apply path.

### B.5. CONFLICT RESOLUTION — `tokenManifest.ts` ownership and the forbidden fallback

- **C1 creates `src/modules/themes/tokenManifest.ts`** and the drift guard `tests/unit/themes/tokenManifest.spec.ts`
  (set-equality with `ALL_KNOWN_TOKEN_NAMES`). C1 owns the `TokenKind` union, the `TOKEN_SECTIONS` list, and the
  section→Studio-tab mapping.
- **C2, C4, C5 each append their manifest rows in their own PR**, in the same PR that adds their tokens to `knownTokens.ts`
  (the manifest set-equality guard forces this — it is the second tripwire alongside the LLM-doc guard). Their sections:
  - C2 → `"typography"` (font roles `kind: "font-stack"`, `--text-*` `kind: "length"`).
  - C5 → `"effects"` (`--shadow-1..5` `kind: "shadow"`, `--dockpanel-glass-blur` `kind: "length"`).
  - C4 → `"panels"` (the `--dockpanel-*` chrome rows).
- **The "ship a self-contained fallback manifest if C1 hasn't landed" path proposed in C4 §10 and C5 §3.6 is FORBIDDEN.**
  Because C1 is now a hard Wave-2 gate before C2/C4/C5 (Wave 3/4), the manifest always exists. No `panelChromeManifest.ts`, no
  inline minimal slice. This removes the throwaway-editor risk the C4 review flagged.
- **C3 does not touch the manifest.** Its `--font-family-heading` manifest row is added by **C2** (C2 owns
  `--font-family-heading`; see §B.6).

### B.6. CONFLICT RESOLUTION — token-family ownership (eliminates double-declaration)

The reviews surfaced three collision risks. Binding ownership table — a token family is declared in `knownTokens.ts` +
`tokens.css` + emitted in `generate.ts` + documented by **exactly one** phase:

| Token family                                                   | **Owner** | Consumers                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--font-family-heading`                                        | **C2**    | C4 (may style panel titles)                            | C2 adds the token, the entry, the `tokens.css` default `var(--font-family-display)`, the manifest row, the LLM-doc line, **and the heading Select** that writes `overrides[--font-family-heading]` (the only wired heading path in C1–C6). **C3 does NOT write the heading** — `fontSpec.heading` is forward-compat-only structure, not wired in C1–C6; C3 is body-only. **C3 must NOT add `--font-family-heading`** — if C3 lands before C2 (soft edge), C3 ships `fontSpec` without the heading role and C2 adds heading later. Resolve C3's Q3 to: **token + body picker only in C3; heading picker deferred to C2.** |
| `--text-xs … --text-4xl`                                       | **C2**    | —                                                      | C2 promotes them into `TYPE_SCALE_TOKEN_NAMES`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `--shadow-1 … --shadow-5`                                      | **C5**    | C4 (`.dv-appearance-raised` reads `var(--shadow-3/4)`) | C5 owns; C4 references with no fallback (C5 is a hard predecessor).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `--panel-blur` (renamed)                                       | **C5**    | C4 (`.dv-appearance-glass`)                            | **Renamed to `--dockpanel-glass-blur`** for component-family consistency (C5 review MINOR). C5 places it in `COMPONENT_TOKEN_NAMES`, default `8px`. C4 consumes via `var(--dockpanel-glass-blur, 8px)`. **C4 must NOT declare it.**                                                                                                                                                                                                                                                                                                                                                                                      |
| `--dockpanel-radius / -border-width / -shadow / -gap / -tab-*` | **C4**    | —                                                      | C4 owns the dockview chrome family.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Cross-phase guard:** a `knownTokens.spec.ts` assertion that **no token name appears in more than one of the four
`*_TOKEN_NAMES` arrays** (dedup guard). C1 adds this guard when it first touches the manifest tooling.

### B.7. CONFLICT RESOLUTION — the Studio tab container (C6 builds it; nobody else)

Every phase that "adds a tab" (C1, C2, C4, C5) must use the container **C6 ships**. Binding:

- **C6 creates** in `ThemeStudioPanel.vue`: `const activeTab = ref<string>("generate")`, `STUDIO_L1_TABS` (the locked 5-tab
  list, in `src/components/panels/theme-studio/studioTabs.ts`), and the `<Tabs scrollable v-model="activeTab"
:tabs="STUDIO_L1_TABS">` wrapper inside the left `SplitterPanel`. The Common band, `Splitter`, preview pane, and footer
  stay **outside** the tabs.
- **The Tabs slot contract is a single default slot gated by `v-if`** (the reviews confirmed `ui/Tabs` has one default
  panel slot scoped `{ active }`, NOT per-tab named panel slots). C6's template is
  `<template #default="{ active }"><div v-if="active === 'generate'">…</div><StudioTabPlaceholder v-else-if="active === 'tokens'" …/>…</template>`.
  C1/C2/C4/C5 each replace their `StudioTabPlaceholder` branch with their real body — they do not change the container, the
  slot shape, or `studioTabs.ts`.
- **C6 must add the `panelsClass` passthrough to `ui/Tabs.vue`** (the C6 review BLOCKER): the tab-body container needs
  `flex min-h-0 flex-1 flex-col` and the active `PvTabPanel` needs `min-h-0 flex-1` for the body to bound-scroll. This is the
  **one** sanctioned `ui/Tabs.vue` change in the whole track; it lands in C6's PR. C6's "do not modify Tabs.vue" guard-rail is
  amended to permit exactly this additive prop. Also export the `Tab` interface from `Tabs.vue` so `studioTabs.ts` imports it
  (one-line, non-breaking).
- **`studioTabs.ts` is LOCKED.** Tab ids/order: `generate, tokens, typography, panels, effects`. C1/C2/C4/C5 must not
  reorder or rename. A drift-guard spec (`studioTabs.spec.ts`, in C6) asserts the exact 5 ids in order.
- **`px-3` placement (stuck-next-chevron footgun):** horizontal padding goes on the **tab-body wrapper** and the placeholder
  component, **never** on the `Tabs` root or the TabList `content` viewport.
- **`activeTab` typing:** `ref<string>("generate")` (the wrapper emits `string`); compare against literal ids in `v-if`. Do
  not type it `Ref<StudioL1TabId>`.

### B.8. CONFLICT RESOLUTION — density resolution (§3E), owned by C6, binding on all

- **C6 implements §3E option (3):** the editor controls pane is pinned to a fixed density; only the preview pane reflects the
  authored density.
- **C6 must FIRST verify** (the C6 review BLOCKER) whether `tokens.css` has a literal `[data-density="comfortable"]`
  selector block. If comfortable is only the bare `@theme` default with no selector, the `<div data-density="comfortable">`
  wrapper is inert. **Resolution:** C6 adds an explicit `[data-density="comfortable"] { … }` block to `tokens.css`
  re-declaring all 9 `--density-*` values, AND confirms the `[data-density="compact|spacious"]` blocks are bare attribute
  selectors (specificity 0-1-0), not `html[...]`-qualified. This is the one sanctioned `tokens.css` density edit; it is
  **not** a new token family (no `knownTokens.ts`/doc-sync trigger).
- No other phase touches density scoping.

### B.9. Per-PR shippable slice (what each PR delivers)

| PR     | Ships (user-visible + structural)                                                                                                                                                                                                                                                                                                                             | Net files                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C6** | 5-tab IA shell (Generate live, 4 placeholders); scrollable L1 strip; `panelsClass` on `ui/Tabs`; the `overrides` seam + merged single-writer apply rule in `useThemeAuthoring`/store; §3E density split (`[data-density="comfortable"]` block + wrapper); responsive Splitter (horizontal↔vertical); scrollable-tabs reuse-contract doc + Track-B cross-link. | 1 prod changed (panel) + 2 prod added (`StudioTabPlaceholder`, `studioTabs.ts`) + `ui/Tabs.vue` (+prop) + `tokens.css` (comfortable block) + `useThemeAuthoring.ts` + store + 2–3 specs + 2 docs. **No new token family.** |
| **C1** | Tokens tab (per-token editor over `tokenManifest`); `tokenManifest.ts` + drift guard; dedup guard for `knownTokens`. Consumes the C6 `overrides` seam. **OKLCH-aware color control** (not bare `ColorSwatchPicker` — resolve C1's BLOCKER). Computed-value seeding via `getComputedStyle(APP_ROOT)` for non-generator tokens.                                 | `tokenManifest.ts` (new), color-field control, `TokensTabEditor.vue`, specs. **No new token family.**                                                                                                                      |
| **C3** | Google-font runtime loading; `fontSpec` (additive, owns it); `useFontLoader`; pop-out `<link>` mirror + curated-offline face availability in pop-outs; CSP docs. Body picker only.                                                                                                                                                                            | `useFontLoader.ts`, `fontCatalog.ts`, catalog JSON, woff2, `FontPicker.vue`, `usePopoutThemeSync` extension. **No new token family** (uses existing font tokens; heading is C2).                                           |
| **C2** | Typography tab (font roles incl. heading + type scale + per-step grid); `typeScale` + `--text-*` + `--font-family-heading` (owns all three); LLM-doc + manifest typography section. Line-height companions resolved (see §B.10).                                                                                                                              | `typeScale.ts`, token family (6-file doc-sync), manifest rows, tab body.                                                                                                                                                   |
| **C5** | Effects tab (depth/glow/blur sliders + ramp preview); `--shadow-1..5` + `--dockpanel-glass-blur` (owns both); `effects` input. Glow re-point as live `color-mix` (resolve BLOCKER).                                                                                                                                                                           | `effects.ts`, token family (6-file doc-sync), manifest "effects" section, tab body.                                                                                                                                        |
| **C4** | Panels & Chrome tab (dockview chrome token editors + per-panel `panel-appearance` preset assignment); `--dockpanel-*` chrome family; `panel-appearance` preset + `dockApi.ts`. Consumes `--shadow-1..5` + `--dockpanel-glass-blur`.                                                                                                                           | `panelAppearance.ts`, `dockApi.ts`, editor, dockview.css variants, token family, manifest "panels" section.                                                                                                                |

**Sub-PR splits permitted within a phase** (each still one logical unit, each green CI):

- **C3** may split into **(3a)** data-model + engine + `--font-family-heading`-free `fontSpec` + schema + tests (no UI),
  then **(3b)** `useFontLoader` + pop-out mirror + `FontPicker` + catalog/woff2 + CSP docs. 3a is pure additive plumbing; 3b
  is the runtime+UI. This de-risks the largest phase.
- **C4** may split into **(4a)** the `panel-appearance` preset + `dockApi.ts` + `.dv-appearance-*` classes + chrome token
  family (the assignment vehicle, no Studio tab), then **(4b)** the Panels & Chrome Studio tab (token editors region (a) +
  assignment region (b)). 4a is independently shippable and testable via the Apply-Preset dialog; 4b adds the Studio surface.
- **C1** may split into **(1a)** `tokenManifest.ts` + drift guard + dedup guard + the OKLCH color control (foundation), then
  **(1b)** `TokensTabEditor.vue` + panel wiring. 1a unblocks C2/C4/C5's manifest rows earlier.

No other phase should split; C6, C2, C5 are cohesive single PRs.

### B.10. Cross-phase couplings the per-phase designs MISSED or under-specified

1. **The `overrides` seam is triple-invented (C1, C2, C5).** Resolved in §B.4 — C6 owns it, one ref named `overrides`, one
   merged-push apply rule. **All three phase designs must delete their independent `tokenOverrides`/`overrides` ref
   proposals and consume C6's.**
2. **The Studio tab container is double-invented (C1 and C6 both add `activeTab`+`<Tabs>`; C5/C4 assume it exists).**
   Resolved in §B.7 — C6 builds it; C1's "introduce Tabs wrapper" step is deleted (C1 only fills a body). C5's "if C6 hasn't
   merged, introduce the container" branch is deleted (C6 is a hard predecessor).
3. **`--panel-blur` is double-owned (C4 and C5).** Resolved in §B.6 — C5 owns it, renamed `--dockpanel-glass-blur`; C4
   consumes with fallback and must not declare it. **Both designs must be amended.**
4. **`--font-family-heading` is double-owned (C2 and C3).** Resolved in §B.6 — C2 owns it; C3 ships body-only. **C3's Q3 is
   answered: heading deferred to C2.**
5. **`--shadow-1..5` consumer-before-producer risk.** C4 consumes them; the spec sequenced C4 before C5. Resolved in
   §B.2/§B.3 — **C5 is a hard predecessor of C4** (Wave 3 before Wave 4), so the tokens always exist when C4 references them.
   The spec's C4→C5 order is overridden.
6. **`tokenManifest.ts` fallback would create throwaway editors (C4, C5).** Resolved in §B.5 — fallback forbidden; C1 is a
   hard gate.
7. **Token-count `generate.spec.ts` bound interacts with 4 phases, but only one touches the minimal-input count.**
   **Binding rule:** the existing minimal-input count test keeps a **tight** bound (`[70,85]`) and is **never** fed an
   effects/typeScale/font input. Because C2/C5/C3 emit **only inside `if(input.X)` guards**, they do **not** change the
   minimal-input count — each instead adds a **dedicated** with-feature count test asserting `base + exact-delta`
   (C2 +8 sizes +8 line-heights; C5 depth-only +5 / depth+blur +6 / glow +0; C3 +1 conditional, all over the live baseline
   at merge time, never a hard-coded total). **C4 is the sole exception:** its chrome emit is **unconditional** (§A.2.4), so
   C4 ALONE increments the exact minimal-input expectation by **+7** (still inside `[70,85]`). **No phase widens the global
   ceiling to "leave headroom."** C1 (when it touches test tooling) adds a comment in `generate.spec.ts` naming this rule.
8. **Engine byte-identity is asserted independently by C2/C5/C4** but the proof obligation is identical: any re-point of an
   existing emitted key (C5 glow, C2 font derivation, C4 chrome) must stay inside its `if (input.X)` gate and emit `var()`
   references not baked literals where the original was a reference. **Binding:** each phase adds the byte-identical-no-feature
   fixture to `engine-stability.spec.ts`; `ENGINE_VERSION` stays `1` across the entire track.
9. **Line-height companions (C2).** Promoting `--text-*` to a size scale without `--text-*--line-height` produces clipped
   headings at high ratios. **Binding decision:** C2 **emits `--text-*--line-height` companion tokens** alongside each
   `--text-*` size when `typeScale` is present (the companions go through full doc-sync as part of the type-scale family) AND
   caps the ratio max at `1.333`. `--text-*--line-height` is part of C2's single token family.
10. **Pop-out face availability for curated-offline fonts (C3).** The `local-fonts.css` `@import` lives only in the opener
    bundle; curated-offline faces won't render in pop-outs. **Binding:** C3's curated-offline branch must register the local
    face source into the pop-out injection registry (same mechanism as Google `<link>`s) so pop-outs resolve curated faces.
    This is a hard correctness requirement for C3's pop-out mirror, not optional.

### B.11. Decisions locked for plan-writers (answers to the phases' open questions)

- **IA-first ordering:** YES — C6 first, placeholders, inverting the spec. (C6 Q1.)
- **Placeholder tabs:** navigable stubs, not disabled. (C6 Q2.)
- **`overrides` ref name:** `overrides`, on `useThemeAuthoring`, introduced by C6. (C1/C2/C5.)
- **Single live-apply writer:** merged `previewThemeTokens` wholesale push for both generator and per-token paths;
  `setPreviewToken` unused by Studio. (C1/C2/C5 BLOCKERs.)
- **`--panel-blur` → `--dockpanel-glass-blur`, owned by C5.** (C4/C5.)
- **`--font-family-heading` owned by C2; C3 body-only.** (C2/C3.)
- **C4 after C5; C4 references `--shadow-*`/glass-blur with no self-declaration.** (C4/C5.)
- **`tokenManifest.ts` fallback forbidden; C1 hard-gates C2/C4/C5.** (C4/C5.)
- **Density: C6 adds `[data-density="comfortable"]` block + verifies bare-selector specificity before relying on the
  wrapper.** (C6 BLOCKER.)
- **`ui/Tabs` single default slot + `panelsClass` prop added in C6; C1/C2/C4/C5 fill bodies via `v-if`.** (C6/C1 BLOCKERs.)
- **C1 color control is OKLCH-aware, not bare `ColorSwatchPicker`; seeds from computed values.** (C1 BLOCKERs.)
- **C5 glow re-point uses live `color-mix(in oklch, var(--color-interactive) …)`, not a baked OKLCH literal;
  `--shadow-accent-glow` spread math is NOT mutated (alpha-only via the color).** (C5 BLOCKERs.)
- **Token-count guard: tight exact deltas, no global-ceiling widening.** (cross-phase.)
- **`ENGINE_VERSION` stays `1` for the entire track.** (cross-phase.)

Plan-writers: amend your phase design to conform to the above before branching. Any deviation requires a new resolution from
the integration architect.

---

## §C. RESOLVED OPEN-DECISIONS TABLE

This consolidates the integration architect's full resolution of Spec §7 named decisions plus the cross-cutting rulings
forced by the gap-hunt. Each row: the **ruling** (recommendation), the **rationale**, and **blocks-execution?**. "DEFAULT"
= proceed with no human gate. "BLOCKS" = the named phase cannot branch until the artifact is in place (in-phase work, no
external sign-off). "SIGN-OFF" = a human taste/cost call is required before that phase branches.

### C.1. Spec §7 named open decisions

| #      | Decision                                  | Ruling (recommendation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Rationale                                                                                                                        | Blocks-execution?                                                                       |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **D1** | Google Fonts offline-vs-network           | **Curated-offline-first, network opt-in.** 8 families × {400,600,700} self-hosted woff2 (`Roboto, Open Sans, Lato, Montserrat, Source Sans 3, IBM Plex Sans, Merriweather, Lora`); Inter reused from `@fontsource-variable/inter` (NOT re-hosted); full Google catalog is a static JSON snapshot; non-curated families load over network gated on `navigator.onLine` + documented CSP opt-in. Catalog never in boot path (`useFontLoader` keeps a hardcoded `CURATED_OFFLINE_FAMILIES` Set; JSON is `import()`-ed lazily). Curated-offline faces are injected into pop-outs (the offline-no-inject branch applies only when `navigator.onLine === false`). | Least-privilege + offline-resilient by default (ops dashboards run air-gapped); network is the 4%-case escape hatch.             | DEFAULT (set locked here). The ~1.5 MB bundle-budget acceptance is **SIGN-OFF (SO-1)**. |
| **D2** | Panel-appearance: theme+preset vs simpler | **Keep two-layer model.** Theme defines what each variant looks like (tokens); a `panel-appearance` preset assigns which panel gets which variant. Three corrections binding: (1) DOM target via `data-cv-appearance` attribute on `group.element` + `[data-cv-appearance="raised"]` selectors (not a bare `.dv-groupview` class); (2) on-load `DockLayout onReady` sweep is the **primary** apply path for the 9/10 unaudited panel types (rAF + element-exists guard); (3) glass frosts the frame only — MUST NOT re-zero `--color-surface-*` on grid groups.                                                                                            | The preset system already gives per-panel/per-workspace assignment + cascade + persistence for free; reinventing is wasted work. | DEFAULT. Glass-on-grid UX call + active-tab-indicator token are **SIGN-OFF (SO-2)**.    |
| **D3** | Glass / blur ship-vs-defer                | **Ship.** Blur token (`--dockpanel-glass-blur`) + elevation ramp owned by C5; `.dv-appearance-glass` consumer lands in C4. Gated behind `@supports (backdrop-filter)` with bordered fallback + `@media (forced-colors: active)` opaque reset. WebGL-canvas-not-blurred limitation documented, not treated as a defect.                                                                                                                                                                                                                                                                                                                                     | Depth/filter machinery belongs in the Effects phase; C4 is the natural consumer.                                                 | DEFAULT. Glass-on-grid allow-vs-no-op is **SIGN-OFF (SO-2)**.                           |
| **D4** | Type-scale: ratio-vs-manual               | **Hybrid.** One `typeScale?: { baseSize, ratio }` generation input drives the whole `--text-*` ramp; per-step `--text-*` override via the C1 Tokens-tab sparse layer. Starts disabled (lazy-materialized). **Emit `--text-*--line-height` companions** (a clipping bug otherwise) and cap ratio ≤ 1.333. Default `baseSize: 16`, `ratio: 1.2`; Typography tab surfaces a regenerate warning + a "Match current" affordance.                                                                                                                                                                                                                                | Ratio knob = 95%-case good-defaults-fast; per-step = the change-anything escape.                                                 | DEFAULT. Default ratio + companions-vs-cap is **SIGN-OFF (SO-3)**.                      |
| **D5** | Studio chrome density: option 1/2/3       | **Option 3** — editor controls pane pinned to a fixed `comfortable` density; only the preview pane (and live-app surfaces) reflect authored density. C6 MUST first verify a literal `[data-density="comfortable"]` selector block exists in `tokens.css`; if not, **add it** (re-declaring all 9 `--density-*` values, bare-selector specificity 0-1-0). Density-split Playwright assertion checks a real consumed token's computed **pixel** value (`--density-control-height`), not an inherited custom-property string.                                                                                                                                 | An editor whose own controls reflow as you author density is disorienting (the reported bug).                                    | DEFAULT (once the comfortable block is confirmed/added — in-phase for C6).              |
| **D6** | Track / IA naming                         | **Lock the 5 L1 tab ids + labels** (`generate/Generate, tokens/Tokens, typography/Typography, panels/Panels & Chrome, effects/Effects`) in `studioTabs.ts` + drift guard; **lock the `tokenManifest.section` taxonomy** (C1 owns it; later phases append rows; `set(manifest) === set(ALL_KNOWN_TOKEN_NAMES)` exact-equality guard). Common band + Splitter + preview pane stay outside the tabs; `activeTab` is component-local, not persisted.                                                                                                                                                                                                           | Locking the IA gives C1/C2/C4/C5 stable single-tab mount points.                                                                 | DEFAULT. The IA-first-vs-IA-last sequencing is **SIGN-OFF (SO-4)**.                     |

### C.2. Cross-cutting rulings forced by the gap-hunt (resolve BLOCKER-class conflicts between phase designs)

| Key            | Ruling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Rationale                                                                                           | Blocks-execution?                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D-TABS**     | `ui/Tabs.vue` exposes ONE default panel slot rendered for the active tab; `tab-${id}` are **label** slots. All tab bodies go in the single default slot, branch on `activeTab`. The only sanctioned `Tabs.vue` edit is an additive `panelsClass?` prop (+ export the `Tab` interface) for bound-scroll, landed in C6. `px-3` on the tab-body wrapper, never the TabList content. `activeTab` typed `ref<string>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed contract (line 202 = single panel slot scoped `{ active }`); prevents a double tab-shell. | BLOCKS the landing phase's tab-body work until the slot contract is honored (in-phase).                                                                                        |
| **D-WRITER**   | One writer per concern. Generator inputs → single `watch(generationResult)` → `previewThemeTokens({ ...generationResult.tokens, ...overrides }, density)`. Per-token edits → write `overrides` → debounced (~50–150 ms) merged re-push. `setPreviewToken`/`resetPreviewToken` NOT used by any Studio tab. Reset/disable-family must strip orphaned keys (`endPreview()` then re-push the merged generator-only set).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Eliminates the dual-write race + the additive-leak BLOCKER raised against C1/C2/C5.                 | BLOCKS C1/C2/C5 live-apply until they consume the single merged-push path.                                                                                                     |
| **D-SEED**     | New optional generation inputs are seeded `t.base.kind === "generated" ? t.base.input.X : null` (never `.input` on a static base). Lazy materialization: ref starts `null`, materialized on first user interaction; controls bind through a computed getter/setter proxy (never `v-model` on `ref.value.knob` directly). `buildGenerationInput`/`toGenInput` forward with conditional-assign.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Preserves byte-identity for opened-but-untouched themes + avoids the null `v-model` throw.          | BLOCKS C2/C3/C5 authoring wiring (in-phase).                                                                                                                                   |
| **D-ENGINE**   | No `ENGINE_VERSION` / `THEME_SCHEMA_VERSION` bump. Additive conditional emit only; no existing-key math change. C5 glow re-point uses `color-mix(in oklch, var(--color-interactive) N%, transparent)` (not a baked literal); `--shadow-accent-glow` spread unchanged. `effects.ts` is pure string composition (no culori, no `generate.ts` import). Each phase pins a no-feature byte-identical fixture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Keeps every pre-existing theme byte-stable; keeps the memo cache valid.                             | BLOCKS any phase tempted to change existing-key math (must escalate first).                                                                                                    |
| **D-TOK**      | Token ownership + 6-file doc-sync per §A.7/§B.6/§D.2. Every new token gets a real CSS consumer in the **same PR** (`--font-family-heading` → `h1..h6` base rule; `--shadow-*` → wire `--dialog-shadow`/dropdown shadows to `var(--shadow-2/4)`; `--dockpanel-tab-active-indicator` → an active-tab indicator rule, or it is dropped). A token nothing consumes is a defect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | A dead allowlisted token is a CI-green-but-useless artifact.                                        | BLOCKS the owning phase's token PR until the consumer rule ships. Active-tab-indicator ship-vs-drop is **SIGN-OFF (SO-2)** only if the dockview-6 selector can't be confirmed. |
| **D-FONT-POP** | Pop-out font mirroring via a **set-based registry** in `usePopoutThemeSync` (`registeredFontHrefs: Set<string>`, dedup by `data-cv-font-key="<family>"`, `mirrorFontLinkToAllPopouts`, `registerPopoutWindow` backfill). css2 URL format Context7/doc-pinned before `buildFontHref`; weight-clamping inside `buildFontHref`. `FontPicker` built on **Volt `Select`** (hand-rolled `ui/Select` masks `filter`/`optionGroup`); Volt Select must pass `check:single-source`.                                                                                                                                                                                                                                                                                                                                                                                                                  | A second DOM observer is fragile; the explicit registry is testable and surgical.                   | BLOCKS C3 pop-out correctness (in-phase).                                                                                                                                      |
| **D-COUNT**    | `generate.spec.ts` keeps a `[70,85]` bound that runs ONLY against minimal input. **Only C4 changes the minimal-input count** — its chrome emit is **unconditional** (+7, §A.2.4), so C4 ALONE bumps the exact minimal-input expectation by +7 (still within `[70,85]`). C2/C5 land earlier and emit **only inside `if(input.X)` guards**, so they do NOT change the minimal-input count at all; each instead adds a **dedicated with-feature assertion measuring a DELTA over the live baseline at its merge time** (C5 depth-only +5 / depth+blur +6, glow +0 — re-points an existing key; C2 +8 sizes +8 line-heights), never a hard-coded total. The `[70,85]` framing and the "exact number" framing reconcile: the bound is a tight range tripwire, and the exact minimal-input value inside it is an exact expectation that **only C4 increments** (+7). No global-ceiling widening. | Widening weakens the guard; conditional emits never touch minimal input.                            | DEFAULT (per-phase test discipline).                                                                                                                                           |
| **D-LAZY**     | Opening any theme + switching tabs without editing emits **zero** new `base.input` fields and pushes **zero** new tokens; the first push is on a real edit (the `interacted` gate is preserved and flipped inside per-tab edit handlers).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | The byte-identity global invariant.                                                                 | DEFAULT (global invariant; each phase asserts it).                                                                                                                             |

### C.3. Items requiring maintainer SIGN-OFF before their phase branches

Everything above is a DEFAULT the plan proceeds on. The following four are the **only** taste/cost calls a human must
confirm. Each blocks **only its own phase's branch**, not the whole program.

> **✅ SIGNED OFF (2026-06-05, maintainer) — all four resolved per the recommendations. See "C.3.1 Resolutions" below; no SO item is outstanding.**

| ID       | What needs sign-off                                                                                                                                                                                                                                                                                                                               | Blocks                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **SO-1** | **C3 bundle budget.** Approve the curated offline woff2 set (8 families × {400,600,700}, Inter reused from Fontsource) and the resulting ~1.5 MB build delta — or trim it.                                                                                                                                                                        | C3 Task-6 (woff2 commit), not C3 scaffolding.                         |
| **SO-2** | **C4 glass + active-tab.** (a) Confirm `.dv-appearance-glass` is **allowed on grid groups** (frame-frost only) vs **no-op on grid, floats only**. (b) Confirm `--dockpanel-tab-active-indicator` **ships with an active-tab CSS rule** vs is **dropped** (only if the dockview-6 active-tab selector can't be confirmed via Context7/Playwright). | C4 CSS finalization.                                                  |
| **SO-3** | **C2 type scale.** Confirm default `ratio: 1.2` / `baseSize: 16`, and confirm **emit `--text-*--line-height` companions** (the binding default) vs cap-the-ratio-only.                                                                                                                                                                            | C2 token-family PR.                                                   |
| **SO-4** | **IA sequencing.** Confirm **C6 ships the IA shell first** (placeholders for C1/C2/C4/C5), inverting the spec's "C6 last." If rejected, C1 introduces the Tabs wrapper and C6 stays last.                                                                                                                                                         | The C6-vs-C1 ordering decision; does not block any token/engine work. |

All four are small, well-scoped confirmations. No other decision requires sign-off — plan writers proceed on every DEFAULT
verbatim.

### C.3.1 Resolutions (signed off 2026-06-05)

| ID       | Resolution (BINDING)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SO-1** | **APPROVED.** Ship the curated offline woff2 set (8 families × {400,600,700}, Inter reused from Fontsource; ~1.5 MB build delta) **plus opt-in network for the full Google catalog**. Offline-first per spec §7.1. C3 proceeds as designed.                                                                                                                                                                                                                                                                                                                                            |
| **SO-2** | **(a) Glass = floats-only first.** `.dv-appearance-glass` is a **no-op on grid (docked) groups**; `backdrop-filter` blur applies only to floating groups (perf — no blur over the Cesium/MapLibre map). A future perf-budgeted PR may extend it to docked groups. **(b) Drop the active-tab indicator UNLESS** the dockview-6 active-tab selector is confirmed via Context7 + Playwright during C4; if unconfirmed, `--dockpanel-tab-active-indicator` and its CSS rule are dropped (D-TOK: no dead token). The C4 author makes this call during the CSS task with a one-line PR note. |
| **SO-3** | **APPROVED.** Default `ratio: 1.2` (minor third) / `baseSize: 16`. **Emit the `--text-*--line-height` companions** (the binding default) so the modular ramp ships paired line-heights and never clips. C2 proceeds with line-height companions, not cap-only.                                                                                                                                                                                                                                                                                                                         |
| **SO-4** | **APPROVED.** **C6 ships the IA shell first** (Wave 1), with placeholder tab bodies for C1/C2/C4/C5. The spec's "C6 last" is inverted. C1's Tabs-wrapper-introduction ("World B") stays deleted; all later phases mount into the C6 shell and hard-gate on its presence.                                                                                                                                                                                                                                                                                                               |

---

## §D. CROSS-PHASE TESTING / CI-GUARD / DOC-SYNC / 2-STAGE-VERIFICATION STRATEGY

> Binding strategy for all testing, CI guards, documentation synchronization, and per-phase verification across the six
> phases. Where a phase design conflicts with this, **this section wins**. The §B/§C conflict resolutions are the authority
> for IA/writer/ownership; this section is the authority for the _test and verification surface_.

### D.1. The drift-guard tripwire system

Five independent guards form the security + correctness boundary. Every phase keeps all five green; a phase that adds a
token family touches the exact files each guard reads, in one PR.

| Guard                                            | File(s)                                                                           | Asserts                                                                                                                                                        | Fires when                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **G1 — knownTokens allowlist**                   | `src/modules/themes/knownTokens.ts` (`isKnownToken`)                              | Import/persist boundary rejects any token name not in `ALL_KNOWN_TOKEN_NAMES`                                                                                  | An emitted/overridden/documented token isn't allowlisted        |
| **G2 — LLM-schema doc**                          | `tests/unit/docs/theme-schema-for-llms.spec.ts` ↔ `docs/theme-schema-for-llms.md` | Balanced fences; every `--token` in the doc passes `isKnownToken`; 5 core tokens present; first JSON envelope (`schemaVersion: 1`) parses with only-known keys | Doc mentions a token not in G1                                  |
| **G3 — engine-stability**                        | `tests/unit/themes/engine-stability.spec.ts`                                      | Additive keys only; existing-key math unchanged at `ENGINE_VERSION = 1`; no-new-input fixture re-resolves byte-identical                                       | An existing key's derivation changes without a version bump     |
| **G4 — single-source**                           | `scripts/check-single-source.mjs` (`pnpm check:single-source`)                    | No raw hex / `oklch(`/`rgb(`/palette-utilities in `src/volt/**` + `src/components/ui/**`                                                                       | A new UI primitive hardcodes a color                            |
| **G5 — tokenManifest drift** _(exists after C1)_ | `tests/unit/themes/tokenManifest.spec.ts` ↔ `src/modules/themes/tokenManifest.ts` | `Object.keys(TOKEN_MANIFEST)` set-equals `ALL_KNOWN_TOKEN_NAMES`; valid kinds/sections; `contrastAgainst` resolves to a color-kind known token                 | A token is added to G1 without a manifest entry (or vice versa) |

**Binding rules:**

- **G2 scope:** doc→allowlist (one-directional). Adding a token to G1 without documenting it does NOT fail G2, but the
  doc-sync rule still requires it. Studio-IA prose token mentions go in `docs/theming.md` (unguarded), never in
  `docs/theme-schema-for-llms.md` unless the token is allowlisted.
- **G4 exemptions:** `color-mix(in oklch, …)` is NOT flagged (no `oklch(` literal) — all phases use it freely for derived
  tints. `src/components/panels/**`, `src/composables/**`, `dockview.css`, `tokens.css`, `local-fonts.css` are NOT scanned.
  Per-token editor SFCs (`TokensTabEditor.vue`, `FontPicker.vue`, `EffectsTab.vue`, `PanelsChromeTab.vue`) live under
  `panels/` → unscanned, but stay token-pure by hand-review (state in the PR). The Volt `Select` install for C3 **must** pass
  `check:single-source` — verify before committing.
- **G5 becomes mandatory for every post-C1 token-adding phase.** C2/C4/C5 append their entries in the same PR. C1's
  drift guard is **computed set-equality with NO numeric literal** —
  `expect(new Set(Object.keys(TOKEN_MANIFEST))).toEqual(new Set(ALL_KNOWN_TOKEN_NAMES))`, where `ALL_KNOWN_TOKEN_NAMES` is
  generated from the four arrays (SEMANTIC=65, COMPONENT=36, DENSITY=9, THEMEABLE_PRIMITIVE=28 = **138** today). Because the
  guard compares the two computed sets, the count can drift as later phases add tokens without ever touching the assertion —
  never hand-type or hard-code a count.

### D.2. The 6-file doc-sync rule (binding, one PR)

Adding or making-themeable a token family touches ALL of these **atomically in one PR**:

1. `src/assets/styles/tokens.css` — default value(s), as `var()`/`color-mix` chains (dark mode + recolor carry with no
   dark-override block).
2. `src/modules/themes/knownTokens.ts` — add name(s) to the correct array (`SEMANTIC_*` for semantic roles incl.
   `--shadow-*`, `--font-family-heading`; `COMPONENT_*` for `--dockpanel-*` incl. `--dockpanel-glass-blur`;
   `THEMEABLE_PRIMITIVE_*` / `TYPE_SCALE_*` for `--text-*`).
3. `src/modules/themes/generate.ts` — emission (conditional/additive per §A.1.2 for new generator inputs; unconditional
   `var()`-equal-to-default for pure geometry like C4 chrome tokens).
4. `docs/theme-schema-for-llms.md` — mention the token(s) in the right section. Example envelope stays `schemaVersion: 1`.
5. `tests/unit/themes/tokenManifest.spec.ts` + `src/modules/themes/tokenManifest.ts` — manifest entry (G5; once C1 exists).
6. `tests/unit/themes/generate.spec.ts` — dedicated with-feature token-count delta + per-key value assertions (see §D.3.4).

Plus, when the persisted input shape changes (new optional `GenerationInputV2` field): `src/types/theme.ts` (`+ field?`),
`src/modules/themes/resolve.ts` (`toGenInput` conditional-forward), `src/modules/themes/portableSchema.ts` (`.optional()`
plain `z.object` strip), `src/composables/useThemeAuthoring.ts` (`buildGenerationInput` + the `generationResult` computed +
`seedFromTheme` + `reset`). **Both** generation-input build paths — the inline object in the `generationResult` computed AND
`buildGenerationInput()` — must include the new field, or live preview diverges from save.

C6 adds no token family and no input field → does NOT trigger doc-sync. C6's one-line scope test: if a change touches a
`--token`, a `*_TOKEN_NAMES` array, `generate.ts`, or a persisted shape, it is out of phase.

### D.3. New unit specs per phase

Vitest, jsdom, `globals: false` (always `import { describe, expect, it } from "vitest"`). Mirror `src/` under `tests/unit/`.

**D.3.0 Shared harness requirements (binding):**

- **`ResizeObserver` stub is mandatory in `tests/setup.ts`** (currently empty) — any spec that mounts `ThemeStudioPanel`
  triggers `useElementSize` (C6 responsive Splitter) → jsdom throws without it.
- **Pinia:** real Pinia + `resetForStoreTest()` in `beforeEach` for store-touching specs. Do NOT mix `createTestingPinia`
  with the store helpers.
- **Resolve memo:** `__clearResolveCacheForTests()` in `beforeEach` for any spec exercising `resolve()`/`generationResult`.
- **Pop-out sync flush:** double-flush `await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))` before reading
  pop-out mirror state.
- **Cold-mount no-push:** every panel-mounting spec asserts a blank cold mount does NOT call `previewThemeTokens`.

| Phase  | Specs added/extended (highlights)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | `tokenManifest.spec.ts` (creates G5, set-equality, valid kinds/sections, `contrastAgainst` → color-kind not self, dedup guard); `useThemeAuthoring.spec.ts` (overrides CRUD, merge-order override-wins, seed generated-vs-static, save passes overrides, parity vs `resolve()` for a **non-generator** token, `TokenValueSchema` rejects >500/injection); `themeStudioTabs.spec.ts` (tab strip, switch preserves Generate values, preview marker on all tabs).                                                                                                                                                                                                                                                                                                 |
| **C2** | `typeScale.spec.ts` (8 `--text-*` monotonic, `--text-base` == `baseSize/16` rem, in-range determinism, all `isKnownToken`); `generate.spec.ts` (+8 sizes +8 line-heights exact delta, no-typeScale byte-identical, paired symmetry); `portable.spec.ts` (round-trip, out-of-range typeScale REJECTED at import — not clamped); `engine-stability.spec.ts` (no-typeScale byte-identical); `useThemeAuthoring.spec.ts` (lazy-null materialize, both build paths).                                                                                                                                                                                                                                                                                                |
| **C3** | `useFontLoader.spec.ts` (`buildFontHref` golden URL, charset-reject, de-dup, offline-curated→loaded-no-network, offline-non-curated→fallback, CSS Font Loading API signal); `usePopoutThemeSync.spec.ts` (mirror + backfill + curated faces reach pop-outs + `CSS.escape === undefined` tolerance); `fontSpec-portability.spec.ts` (round-trip incl. heading, legacy `fontFamily` byte-identical, heading emitted only when set); `fontCatalog.spec.ts` (catalog parses, curated↔`local-fonts.css` drift guard, JSON in CSpell `ignorePaths`); boot hook spec (`applyTheme` of a fontSpec theme triggers loader exactly once; fontless → zero).                                                                                                                |
| **C4** | `panelAppearance.spec.ts` (`applyToPanel` adds right class/attr via mocked DockviewApi + jsdom element; variant swap removes prior; `removeFromPanel` strips all; no-op when API null; invalid → flat); `registry.spec.ts` (`panel-appearance` registered, `applicableTo` == registered panel-type id set, derived from `ALL_BUILTIN_PANEL_TYPE_IDS`); `generate.spec.ts` (7 chrome keys present, separate chrome-present count, no widening of `[70,85]`); DOM-target probe (Playwright) before selectors; on-load sweep spec.                                                                                                                                                                                                                                |
| **C5** | `effects.spec.ts` (`deriveElevationRamp(50)`→5 non-none, `(0)`→all none, `(100)`≈2× depth-50 offsets, `EFFECTS_DEFAULTS` exact, no `effects.ts → generate.ts` import edge); `generate.spec.ts` (per-input delta: depth-only → **+5** (`--shadow-1..5`); depth+blur → **+6** (adds `--dockpanel-glass-blur`); glow re-points an **existing** key (`--color-interactive-glow`) so it adds **0** to the count. no-effects zero `--shadow-*`, depth=0→none, glow keeps `var(--color-interactive)` ref, `--shadow-accent-glow` spread unchanged); `engine-stability.spec.ts` (no-effects byte-identical); `portable.spec.ts` (round-trip, strip-unknown); `themePreview.spec.ts` (glow change → `cancelPreview` → `--color-interactive-glow` returns to committed). |
| **C6** | `studioTabs.spec.ts` (5 unique ids in locked order, non-empty labels; `// LOCKED by C6` comment); `themeStudioTabs.spec.ts` (5 tabs render, default `generate`, each placeholder renders `StudioTabPlaceholder`, preview marker on all 5, controls-pane wrapper carries `data-density="comfortable"`); pre-build `tokens.css` `[data-density="comfortable"]` verification; Splitter reactivity verified via Context7 (key the Splitter on `layout` flip if needed).                                                                                                                                                                                                                                                                                            |

### D.4. The 2-stage verification template (every phase doc embeds this VERBATIM)

Every phase ends with two stages, in order. Stage 1 must be fully green before the PR opens.

**Stage 0 (probe, always first):** Probe `mcp__plugin_playwright_playwright__*`. If absent, run `ToolSearch` with
`query: "playwright browser"`. If still unavailable, fall back to a manual smoke-test checklist, state this explicitly in the
PR, and embed NO Stage-1 results table (never embed "expected pass").

**Static gauntlet (runs before Stage 1, every phase):**
`pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build` — all green. Run
`pnpm docs:build` for any phase touching `docs/`. New CSpell terms → `dictionaries/{tech,project}.txt` (never `cspell.json`),
except the C3 Google-fonts catalog JSON which is added to CSpell `ignorePaths` (a generated data file).

**Stage 1 — Playwright automated (binary).** Drive `pnpm dev`, open the Theme Studio panel, exercise the phase's surface.
Screenshots → `.verification-screenshots/<branch-name>/<checkpoint-name>.png` (gitignored). PR references by relative path.
Embed a structured Markdown table: **assertion id · description · result · screenshot · PASS/FAIL**, plus a console-**error**
count, console-**warning** count, and a one-line PASS/FAIL summary. The table reflects the actual run — never "expected."

Required cross-phase assertions for EVERY Studio-touching phase:

- **V-1** Tab strip renders the locked tabs (5, or 2 during the earliest phase) in order; single-row, no wrap.
- **V-2** The live-preview pane DOM persists across all tab switches (preview lives outside `<Tabs>`).
- **V-3** Switching L1 tabs does NOT recolor the live app (preview re-pushes on input change, not tab change).
- **V-4** Editing the phase's primary control live-updates `getComputedStyle(APP_ROOT)` for the relevant token(s).
- **V-5** A reset (per-token or reset-all) reverts the inline prop on `APP_ROOT` (no orphaned keys — §B.4/D-WRITER).
- **V-6** Pop-out mirroring: pop a panel out, apply the phase's change, assert the child realm reflects it.
- **V-7** Save → reopen the saved theme → the phase's edits re-seed (round-trip).
- **V-8** Console-error count == 0; warning count recorded (no NaN/decode/parse regressions).
- **V-A5 (when density is in scope)** Editor chrome stays comfortable while the preview pane reflects authored density,
  asserted on a component-layer consumer's computed pixel value.

**C4 windowing mandate (binding):** because C4 is dockview-windowing-adjacent, runtime click-through is **mandatory and
non-skippable** — click through every panel type that can carry an appearance variant, in both docked and popped-out states,
including glass-over-map and `forced-colors` (via `page.emulateMedia({ forcedColors: 'active' })`; if unavailable, downgrade
to a CSS-rule-presence assertion and flag it). A green static gauntlet does NOT satisfy C4.

**Stage 2 — Human design checklist (3–7 items, closes the PR description).** Subjective checkboxes (typography balance,
color harmony, density feel, hover polish) + a 2–3 sentence "scrutinize for this phase" callout naming the riskiest judgment
call (e.g. C1: per-row reset vs control crowding; C2: default-ratio ramp + line-height; C4: glass legibility over a bright
map + raised-shadow read in dark; C5: depth-50 visual-identity to today + neutral elevation ink in dark; C6: density-split
legibility + stack threshold).

### D.5. Per-phase touch-list summary (guards + specs + verification)

| Phase  | Token family?                                                          | Input field?      | New guards/specs                                                                          | G5 manifest                    | 2-stage notes                                                                            |
| ------ | ---------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| **C1** | No (annotates existing)                                                | No                | `tokenManifest.spec` (creates G5), `useThemeAuthoring` overrides/parity, dedup guard      | **Creates** `tokenManifest.ts` | Full Studio V-1..V-8; computed-value seeding                                             |
| **C2** | `--text-*` + `--text-*--line-height` + `--font-family-heading`         | `typeScale?`      | `typeScale.spec`, generate/portable/engine-stability/authoring extends                    | append Typography              | line-height companions; both build paths; SO-3                                           |
| **C3** | none new (heading is C2; uses existing font tokens)                    | `fontSpec?`       | `useFontLoader.spec`, `fontSpec-portability.spec`, `fontCatalog.spec`, popout-sync extend | none (no token family)         | boot hook in `apply.ts`; Volt FontPicker; CSP doc; SO-1                                  |
| **C4** | `--dockpanel-*` chrome + consume `--dockpanel-glass-blur`/`--shadow-*` | none (token-only) | `panelAppearance.spec`, registry extend                                                   | append Panels&Chrome           | **mandatory windowing click-through**; DOM-target probe; on-load sweep; SO-2             |
| **C5** | `--shadow-1..5`, `--dockpanel-glass-blur` (owns)                       | `effects?`        | `effects.spec`, generate/portable/engine-stability/themePreview extends                   | append Effects                 | glow `var()` preservation; lazy-null knobs                                               |
| **C6** | No                                                                     | No                | `studioTabs.spec` (IA lock), `themeStudioTabs.spec`                                       | none                           | `[data-density="comfortable"]` pre-check; Splitter reactivity; ResizeObserver stub; SO-4 |

**GitFlow for every phase:** branch off `develop` → PR to `develop`, Conventional Commit title `feat(theming): … (Phase Cx)`,
Stage-1 table + Stage-2 checklist + chosen open-question answers in the body, Claude Code attribution trailer, stop and wait
for maintainer merge. Never auto-merge; never commit to `develop`/`main`.

---

## §E. ONE-SCREEN CAPABILITY MATRIX — capability × token-family × Studio-tab × runtime

| Capability (user can…)                      | Owner phase                | Token family (owner)                                        | Generation input                                                                    | Override path                                                 | Studio tab                                  | Runtime apply path                                                                                                 |
| ------------------------------------------- | -------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Edit any single allowlisted token by hand   | C1                         | (all existing — manifest annotates)                         | —                                                                                   | `overrides[name]`                                             | Tokens                                      | merged `previewThemeTokens` → on save `themeRepo.update({overrides})`                                              |
| Tune base/accent/contrast/mode/density      | (pre-existing)             | semantic + accent + p-surface                               | `baseColor/accentColor/contrast/mode/density`                                       | —                                                             | Generate                                    | `watch(generationResult)` → merged push; `data-density` attribute                                                  |
| Set a modular type scale (size ramp)        | C2                         | `--text-xs…4xl` + `--text-*--line-height` (C2)              | `typeScale?` (lazy-null)                                                            | per-step `--text-*` via Tokens tab                            | Typography                                  | conditional emit inside `if(input.typeScale)`; `h1..h6` consume `--font-family-heading`                            |
| Pick a heading font role                    | C2                         | `--font-family-heading` (C2)                                | — (`fontSpec.heading` is forward-compat only; not wired in C1–C6 — C3 is body-only) | `overrides[--font-family-heading]` (C2 Typography tab Select) | Typography                                  | `@layer base h1..h6 { font-family: var(--font-family-heading) }`                                                   |
| Load + apply a Google / system / stack font | C3                         | (existing `--font-family-*`)                                | `fontSpec?`                                                                         | —                                                             | Typography (Generate fallback pre-C2)       | `useFontLoader` injects `<link>` into opener + pop-outs; CSS Font Loading API ready-signal; `applyTheme` boot hook |
| Set dockview panel chrome geometry          | C4                         | `--dockpanel-radius/-border-width/-shadow/-gap/-tab-*` (C4) | none (unconditional `var()` literals)                                               | `overrides[--dockpanel-*]`                                    | Panels & Chrome                             | `dockview.css` wires `--dv-*` ← `--dockpanel-*`                                                                    |
| Assign a per-panel appearance variant       | C4                         | (consumes `--shadow-*` + `--dockpanel-glass-blur`)          | none (preset config, not theme input)                                               | —                                                             | Panels & Chrome                             | `panel-appearance` preset → `data-cv-appearance` attr on `group.element`; `onReady` sweep                          |
| Frost a panel (glass)                       | C4 (consumer) / C5 (token) | `--dockpanel-glass-blur` (C5)                               | `effects.blurRadius`                                                                | —                                                             | Effects (slider) + Panels & Chrome (assign) | `.dv-appearance-glass` backdrop-filter, `@supports`-gated                                                          |
| Set depth / elevation ramp                  | C5                         | `--shadow-1…5` (C5)                                         | `effects.depth?` (lazy-null)                                                        | per-step shadow via Tokens tab                                | Effects                                     | conditional emit; wired to `--dialog-shadow`/dropdown shadows                                                      |
| Set accent glow strength                    | C5                         | re-points `--color-interactive-glow`                        | `effects.glowAlpha?`                                                                | —                                                             | Effects                                     | `color-mix(in oklch, var(--color-interactive) N%, transparent)` inside `if(input.effects)`                         |
| Navigate the 5-tab Studio IA                | C6                         | none                                                        | none                                                                                | none                                                          | (the shell)                                 | `<Tabs scrollable v-model="activeTab">`, single default slot                                                       |
| Author density without the editor reflowing | C6                         | none (uses `--density-*`)                                   | (`density` input)                                                                   | none                                                          | (Studio chrome)                             | `[data-density="comfortable"]` wrapper on controls pane; preview pane = authored density                           |

**Reading the matrix:** the **Generation** control layer (§0) = the "Generation input" column populated; the **Tokens/per-area**
layer = the "Override path" column populated. The two collapse into one merged push at runtime. C4 chrome geometry is
override-only (no generation input) by §A.2.4. C6 is inert across token/input/override (data-model-inert).

---

## §F. NON-GOALS / GUARDRAILS (Spec §8, carried forward — binding)

These are out of scope for the **entire** Track A program. A phase that reaches for one of these has drifted and must stop.

- **No version-constant bumps.** `THEME_SCHEMA_VERSION` stays `2`, `ENGINE_VERSION` stays `1`, `DB_VERSION` stays `3` across
  all of C1–C6. Any phase that believes it needs a bump escalates to the maintainer before coding (§A.1, §C D-ENGINE).
- **No migration code.** `migrate.ts` (`migrateThemeV1ToV2`) and the idb v3 upgrade (`db.ts`) are untouched. Byte-stability
  is achieved by construction (additive-conditional emit), not by migrating records (§A.4).
- **No existing-key math change.** No phase mutates the derivation of an already-emitted token key for an input an existing
  theme already has. Re-points (C5 glow) preserve live `var()` references and stay inside `if(input.X)` gates (§A.6, §C
  D-ENGINE).
- **No second override store, no second live-apply writer, no second tab shell.** One `overrides` ref (C6-owned), one merged
  `previewThemeTokens` push, one `<Tabs>` container (C6-owned). `setPreviewToken`/`resetPreviewToken` are not used by any
  Studio tab (§B.4, §B.7, §C D-WRITER).
- **No token double-declaration.** `--font-family-heading` (C2-owned) and `--dockpanel-glass-blur` (C5-owned) have single
  owners; consumers reference with `var(..., fallback)`. A dedup guard enforces it (§B.6).
- **No `--text-*--line-height` companion deferral, no uncapped type-scale ratio.** C2 ships line-height companions and caps
  ratio ≤ 1.333 in the same single token family. No separate line-height phase (§B.10.9).
- **No `chrome?` generation input.** C4 chrome geometry is overrides-only; it adds zero `GenerationInputV2` fields (§A.2.4).
- **No catalog in the boot path (C3).** `useFontLoader` keeps a hardcoded `CURATED_OFFLINE_FAMILIES` Set; the full Google
  catalog JSON is `import()`-ed lazily on first FontPicker mount only (§C D1).
- **No Inter re-hosting (C3).** Inter is reused from `@fontsource-variable/inter`; `local-fonts.css` must not redeclare it
  (§C D1).
- **No raw color literals in `src/volt/**`or`src/components/ui/**`.** Enforced by `check:single-source`. `color-mix(in
oklch, …)` is allowed; raw `oklch(`/hex/`rgb(`/palette-utilities are not. Editor SFCs live under `panels/` (unscanned) but
  stay token-pure by hand-review (§D.1).
- **No dead tokens.** Every new allowlisted token gets a real CSS consumer in the same PR, or it is dropped (§C D-TOK).
- **No widening of the `generate.spec.ts` `[70,85]` minimal-input bound.** Each phase adds a dedicated exact-delta
  with-feature assertion instead (§B.10.7, §C D-COUNT).
- **No glass surface-token zeroing on grid groups.** Glass frosts the frame only; surface-token zeroing stays exclusive to
  `.dv-groupview-floating` (§C D2).
- **No `--dv-panel-*` / `--cv-float-*` in the allowlist.** Those are dockview-scoped wiring vars / runtime instance state,
  not design tokens (§A.7, survey G6).
- **No example-envelope churn in the LLM doc.** The first JSON example stays `schemaVersion: 1` with only-known token keys;
  the importer up-casts v1 (§A.7).
- **No new non-PrimeVue UI library, no raw `<button>/<input>/<select>/<textarea>`** outside the UI-primitive definitions.
  Library-first / PrimeVue-first holds; `@tanstack/vue-table` is the only sanctioned exception (tabular data only). C3's
  filterable FontPicker uses Volt `Select` (not the API-masked hand-rolled `ui/Select`).
- **This is a template.** No product-specific business logic. The curated font set, the eight built-in themes, and the
  example panels are generic defaults; downstream forks extend `applicableTo`, the catalog, and the manifest, never the
  template's domain.
