# Track A — C5: Effects — elevation scale + glow / blur sliders

> **Branch:** `feat/c5-effects` → PR to `develop` (GitFlow: branch off `develop`, PR to `develop`, stop and wait for maintainer merge).
> **Spec authority:** `.internal/specs/track-a-theme-studio-comprehensive.md` §3D, §6.5 (phase 5).
> **Binding overrides:** the four CANONICAL INTEGRATION sections (data-model evolution, phase sequencing, open-decision resolution, cross-phase test/guard strategy). Where this plan and a phase-local idea conflict, the integration sections win and are folded in below.
> This doc is the execution sequence + every BLOCKER/MAJOR gap-hunt finding folded into a task. Execution-ready by a fresh engineer with zero prior context.

---

## Goal

Ship the **Effects** tab of the Theme Studio: three high-level depth knobs (elevation **depth**, accent **glow** strength, panel **blur** radius) plus a live elevation-ramp preview, backed by a new additive `effects?` generation input and two new token families (`--shadow-1…5` elevation ramp, `--dockpanel-glass-blur` radius). The depth knob derives a coherent 5-step shadow ramp; the per-token override path (C1 Tokens tab) remains the escape hatch. All new tokens are foreground-class (box-shadow / filter) so they survive the `dockview.css` float-transparency override.

The phase rides the **shipped** live-preview engine (`previewThemeTokens`), pop-out mirror (`usePopoutThemeSync`), and authoring composable end-to-end — it introduces **zero** new runtime plumbing. It adds **zero** version bumps: `THEME_SCHEMA_VERSION` stays `2`, `ENGINE_VERSION` stays `1`, `DB_VERSION` stays `3`, no migration code.

## Architecture

- **Generator input → conditional emit.** `effects?: EffectsSpec` is an additive-optional field on `GenerationInputV2`. `generate.ts` emits `--shadow-1…5`, `--dockpanel-glass-blur`, and re-points `--color-interactive-glow` **only inside `if (input.effects)`** — mirroring the shipped `if (input.fontFamily)` / `if (hasStatusOverride)` blocks. Absent `effects` → zero new keys → byte-identical output for every existing theme.
- **Static `tokens.css` defaults.** `--shadow-1…5` and `--dockpanel-glass-blur` get static `color-mix` / `var()` defaults so built-ins and effects-less themes render a coherent ramp with no engine emission.
- **Glow is a live `color-mix`, never a baked literal.** The glow re-point preserves the live `var(--color-interactive)` reference (`color-mix(in oklch, var(--color-interactive) N%, transparent)`) so accent recolor still propagates (folds the 3× gap-hunt BLOCKER). `--shadow-accent-glow`'s `3px` spread math is **not** touched.
- **Shipped consumers wired to the ramp.** C5 points `--dialog-shadow` at `var(--shadow-4)` and `--dockpanel-bg`'s drop shadow region (via a `dockview.css` rule) at `var(--shadow-2)` so the depth knob has an **observable** effect outside the Effects tab (folds the "dead token" BLOCKER — Stage-1 float-elevation has a real consumer).
- **Pure deriver module.** `effects.ts` holds the ramp math as **pure string composition** (no culori import, no `generate.ts` import → no circular edge) so the generator and the in-tab preview share one implementation.
- **Lazy-null authoring ref.** `useThemeAuthoring.effects` starts `null`; the EffectsTab binds through computed getter/setter proxies (`get → ?? DEFAULT`, `set → materialize`). A theme opened-but-untouched emits no `effects` key (byte-identity preserved). Seeding guards `base.kind === "generated"`.
- **Tab container.** C5 mounts an `EffectsTab` into the **existing** C6 Studio tab shell. Per the canonical sequencing (master-plan §B.2/§B.3) **C6 is a HARD predecessor of C5** (C6 is Wave 1, C5 is Wave 3): C6 ships the `<Tabs scrollable>` shell + `STUDIO_L1_TABS` (the locked `effects` tab id) + the `overrides` seam. C5 mounts into them and **never** builds a shell of its own — the "if C6 hasn't merged, introduce a minimal shell" fallback is DELETED (master-plan §B.7/§B.10). If the C6 shell is absent, C5 STOPS and escalates (T0 gate, mirroring C2 T0 / C4 T0).

## Tech / dependencies

- Vue 3 + Vite + TS(strict), PrimeVue 4 unstyled + **Volt** (`src/volt/Slider.vue`, `src/volt/InputNumber.vue` — both verified present) + Tailwind v4, Pinia, idb, culori (OKLCH).
- Library-first / PrimeVue-first: range → Volt `Slider`, numeric → Volt `InputNumber` (never raw `<input type=range>` / `<input type=number>`). `@tanstack/vue-table` is the only non-PrimeVue UI exception (not used here).
- **Shipped engine prerequisites (in code):** rides shipped A2a-1 (live preview), A2a-2 (`ThemeStudioPanel.vue`), `usePopoutThemeSync`. Verified on the working branch: `previewThemeTokens`, the `generationResult → applyToApp` watcher, `oklch()`/`css()` gamut helpers, `toGenInput` conditional-assign, `if (input.fontFamily)` / `if (hasStatusOverride)` additive emit.
- **Hard predecessor: C6 (Wave 1, before C5 Wave 3).** C6 owns the `ThemeStudioPanel.vue` tab shell (`<Tabs scrollable>` + `STUDIO_L1_TABS` with the locked `effects` id) and the `useThemeAuthoring.overrides` seam. C5 (Wave 3) mounts its `EffectsTab` body into that shell and **must not** build a shell of its own — the minimal-shell fallback is DELETED (master-plan §B.7/§B.10). If the C6 shell is absent, C5 STOPS and escalates (T0).
- **Hard predecessor: C1 (`tokenManifest.ts`, Wave 2).** The §B.5 no-C1 fallback is forbidden — C1 is a hard Wave-2 gate. C5 appends its `"effects"` manifest section/rows; the optional advanced per-token grid in `EffectsTab` reads the manifest. If `tokenManifest.ts` is absent, C5 STOPS and escalates (T0).
- **C4 is a downstream consumer of `--dockpanel-glass-blur`** and lands AFTER C5 (sequencing override): C5 **owns** `--dockpanel-glass-blur`; C4 must consume `var(--dockpanel-glass-blur, 8px)` and must NOT re-declare it.

---

## File Structure

### New files

| Path                                                | One-line responsibility                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/themes/effects.ts`                     | Pure, culori-free deriver: `deriveElevationRamp(depth)` (5 `--shadow-N` strings), `deriveGlow(alpha)` (live-`color-mix` glow string), `EFFECTS_DEFAULTS`, local `clampNum`. Imports `EffectsSpec` type only; never imports `generate.ts`.                                                                                                                        |
| `src/components/panels/theme-studio/EffectsTab.vue` | The Effects tab body: depth / glow / blur sliders (Volt `Slider` + `InputNumber`) bound via computed proxies, a 5-card live elevation-ramp strip + glow chip (`box-shadow: var(--shadow-N)` / `var(--shadow-accent-glow)`, zero literals), optional advanced raw-shadow rows when C1's manifest exists. Reads the `useThemeAuthoring` instance passed as a prop. |
| `tests/unit/themes/effects.spec.ts`                 | Unit-tests the deriver (ramp monotonicity, `depth=0 → none`, defaults, no circular import).                                                                                                                                                                                                                                                                      |

### Modified files

| Path                                               | One-line change                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/theme.ts`                               | Add `EffectsSpec` interface; append `effects?: EffectsSpec` to `GenerationInputV2` (after `statusOverrides`). No constant changes.                                                                                                                                                                                                |
| `src/modules/themes/generate.ts`                   | Add `effects?` to `ThemeGenerationInput`; import deriver; add the `if (fx)` conditional emit block (ramp + live-`color-mix` glow + `--dockpanel-glass-blur`) at the assembly tail.                                                                                                                                                |
| `src/modules/themes/resolve.ts`                    | One line in `toGenInput`: `if (input.effects !== undefined) out.effects = input.effects;`.                                                                                                                                                                                                                                        |
| `src/modules/themes/portableSchema.ts`             | Add `EffectsSpecSchema` (plain `z.object`, strip-unknowns) + `effects: EffectsSpecSchema.optional()` to `GenerationInputV2Schema`.                                                                                                                                                                                                |
| `src/modules/themes/knownTokens.ts`                | Append `--shadow-1…5` to `SEMANTIC_TOKEN_NAMES` and `--dockpanel-glass-blur` to `COMPONENT_TOKEN_NAMES`; add a no-duplicate-names guard reference (test in T-tests).                                                                                                                                                              |
| `src/modules/themes/tokenManifest.ts`              | Append the `"effects"` section rows (`--shadow-1…5` kind `shadow`, `--dockpanel-glass-blur` kind `length`); C1's set-equality drift guard (`tokenManifest.spec.ts`) requires every newly-allowlisted name to have a manifest entry — without it the guard fails. The 6th doc-sync file.                                           |
| `src/assets/styles/tokens.css`                     | Add `--shadow-1…5` + `--dockpanel-glass-blur` defaults in the A1c semantic block (after `--shadow-accent-glow`, ~line 413); re-point `--dialog-shadow` at `var(--shadow-4)`.                                                                                                                                                      |
| `src/assets/styles/dockview.css`                   | Add a rule giving docked panels a `box-shadow: var(--shadow-2)` so the depth knob visibly moves real chrome (one observable consumer). **Scope it to non-`[data-cv-appearance]` groups** so it does not double-apply with C4's per-variant `box-shadow` on a `raised`/`glass` group (see Fix-E coordination note in T3).          |
| `docs/theme-schema-for-llms.md`                    | Add the "Effects / elevation" paragraph to the Depth & accent section (~line 122).                                                                                                                                                                                                                                                |
| `src/composables/useThemeAuthoring.ts`             | Add `effects` ref (null-init); wire into BOTH build paths (the inline `generationResult` object AND `buildGenerationInput`); seed in `seedFromTheme`/`genInputOf` guarded on `base.kind === "generated"`; clear in `reset`; export `effects`.                                                                                     |
| `src/components/panels/ThemeStudioPanel.vue`       | Introduce/extend the Studio tab shell; wrap existing controls in the Generate branch; render `EffectsTab` in the Effects branch. Preview/Splitter wiring unchanged.                                                                                                                                                               |
| `tests/unit/themes/generate.spec.ts`               | Add: no-effects emits no `--shadow-1` (separate from the global `[70,85]` count); per-input deltas — depth-only +5 (`--shadow-1..5`), depth+blur +6 (adds `--dockpanel-glass-blur`), glow +0 (re-points an existing key); depth=0 → `none`; glow keeps `var(--color-interactive)`; spread unchanged; emitted keys `isKnownToken`. |
| `tests/unit/themes/engine-stability.spec.ts`       | Add: a no-`effects` fixture re-resolves byte-identical (pins the glow re-point inside the `if`).                                                                                                                                                                                                                                  |
| `tests/unit/themes/portable.spec.ts`               | Add: `effects` round-trips; `GenerationInputV2Schema` strips an unknown effects sub-key (forward-compat); an injected `--shadow-3` override value is rejected by `TokenValueSchema`.                                                                                                                                              |
| `tests/unit/themes/resolve.spec.ts`                | Add: `toGenInput` forwards `effects` when present, omits the key when absent (memo-key stability).                                                                                                                                                                                                                                |
| `tests/unit/composables/useThemeAuthoring.spec.ts` | Add: `effects` starts `null`; first interaction materializes; both build paths include it post-touch; `seedFromTheme` of a generated theme with `effects` seeds; static base → `null`; `reset` → `null`.                                                                                                                          |
| `dictionaries/project.txt`                         | Add any CSpell-flagged terms surfaced by the doc/SFC (verify; "oklch" already present).                                                                                                                                                                                                                                           |

**No change** to: `apply.ts`, `migrate.ts`, `db.ts`, `themeRepo.ts`, `stores/theme.ts`, `usePopoutThemeSync.ts`, `main.css`. Pop-out mirroring of the new `--*` props is automatic (the observer copies ALL `--*` properties).

---

## Ordered tasks

> One PR. Tasks T3–T7 are the doc-sync family and **must** land in the same commit/PR or the LLM-doc guard fails CI. Each task: exact file(s), concrete change, acceptance check.

### T0 — Branch + IA/manifest presence gate (C6 + C1 shipped?)

**File(s):** none (git + inspection).
**Change:** Branch from `develop` (C6 ships in Wave 1 and C1 in Wave 2, both before C5's Wave 3 — they MUST already be on `develop`):

```bash
git checkout develop && git pull origin develop
git checkout -b feat/c5-effects
```

Then **hard-gate on the C6 shell + C1 manifest** (mirror C2 T0 / C4 T0 — no throwaway shell, per canonical sequencing §B.5/§B.7). Confirm:

- `src/components/panels/ThemeStudioPanel.vue` imports `<Tabs>` and `STUDIO_L1_TABS` from `src/components/panels/theme-studio/studioTabs.ts`, and `STUDIO_L1_TABS` contains `{ id: "effects", label: "Effects" }` (the locked tab id C5 fills).
- `useThemeAuthoring` exports the `overrides` seam (`overrides`, `setOverride`, `clearOverride`) — `a.overrides` is a `Ref<Record<string, string>>`.
- `src/modules/themes/tokenManifest.ts` exists (C1) with its `TOKEN_SECTIONS` taxonomy, so C5 can append the `"effects"` section/rows.

**Acceptance:** `git branch --show-current` == `feat/c5-effects`; `STUDIO_L1_TABS` contains the `effects` tab id; `a.overrides` is a `Ref<Record<string,string>>`; `tokenManifest.ts` exists. **If any of these is absent, STOP and escalate** — C6 and/or C1 have not landed and C5 cannot proceed (no minimal/throwaway shell, no fallback manifest; C6 and C1 are hard predecessors per master-plan §B.2/§B.3).

### T1 — Types: `EffectsSpec` + `GenerationInputV2.effects`

**File:** `src/types/theme.ts`.
**Change:** Add the interface directly above `GenerationInputV2`, and the optional field after `statusOverrides` (canonical field order — never reorder existing fields):

```typescript
/**
 * Effects / depth inputs (Track A C5). All optional; OMITTED when unset to keep
 * the input honest (§3i) and the resolve memo key stable. Drives the elevation
 * ramp, accent-glow strength, and panel blur radius. Absent → the engine emits
 * NO effects tokens and tokens.css static defaults apply (byte-identical output).
 */
export interface EffectsSpec {
  /** 0–100. Depth of the --shadow-1..5 elevation ramp. 0 = flat (no shadow),
   *  50 = neutral default (~ tokens.css baseline), 100 = dramatic. */
  depth?: number;
  /** 0–1. Alpha of --color-interactive-glow (re-points the glow color only). */
  glowAlpha?: number;
  /** 0–24 (px). Radius for --dockpanel-glass-blur (consumed by C4 glass panels). */
  blurRadius?: number;
}
```

In `GenerationInputV2`, after the `statusOverrides?: StatusOverrides;` line:

```typescript
  /** Depth / glow / blur effects inputs (C5). Additive, optional. */
  effects?: EffectsSpec;
```

**Do not** change `THEME_SCHEMA_VERSION` (stays `2`) or `ENGINE_VERSION` (stays `1`).
**Acceptance:** `pnpm type-check` clean; `git grep "THEME_SCHEMA_VERSION = 2"` and `"ENGINE_VERSION = 1"` still match.

### T2 — Pure deriver `effects.ts`

**File (new):** `src/modules/themes/effects.ts`.
**Change:** Pure string composition. **No culori import, no `generate.ts` import** (kills the circular edge). The ramp ink derives from `--color-text-primary` via `color-mix` so dark mode auto-inverts (mode-adaptive, matches the A1c posture); the glow stays a live `color-mix` against `--color-interactive`.

```typescript
import type { EffectsSpec } from "@/types/theme";

/** Neutral baseline matching the tokens.css static defaults (depth-50 ramp,
 *  32% glow alpha, 8px blur). Single source for slider initial values AND the
 *  generator's ?? fallbacks — no magic numbers duplicated across two sites. */
export const EFFECTS_DEFAULTS: Required<EffectsSpec> = {
  depth: 50,
  glowAlpha: 0.32,
  blurRadius: 8,
};

const clampNum = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Per-step ramp shape: y-offset, blur, spread, ink-alpha (%). Scaled by depth. */
const RAMP_SCALE = [
  { y: 1, b: 2, s: 0, a: 8 },
  { y: 2, b: 4, s: -1, a: 10 },
  { y: 4, b: 8, s: -2, a: 12 },
  { y: 8, b: 16, s: -4, a: 14 },
  { y: 16, b: 32, s: -8, a: 18 },
] as const;

type ShadowKey = "--shadow-1" | "--shadow-2" | "--shadow-3" | "--shadow-4" | "--shadow-5";

/** Derive the 5-step elevation ramp from the depth knob. 0 → all "none"
 *  (flat); 50 → ~tokens.css neutral baseline; 100 → ~2× the neutral offsets.
 *  Ink derives from --color-text-primary so dark themes get a subtle light
 *  elevation (mode-adaptive, no dark-override block needed). */
export function deriveElevationRamp(depth: number): Record<ShadowKey, string> {
  const d = clampNum(depth, 0, 100) / 50; // 0..2, 1 = neutral
  const ink = (basePct: number): string => {
    const pct = Math.round(basePct * d * 100) / 100;
    return `color-mix(in oklch, var(--color-text-primary) ${pct}%, transparent)`;
  };
  const out = {} as Record<ShadowKey, string>;
  RAMP_SCALE.forEach((step, i) => {
    const key = `--shadow-${i + 1}` as ShadowKey;
    if (d === 0) {
      out[key] = "none";
      return;
    }
    const yy = Math.round(step.y * d);
    const bb = Math.round(step.b * d);
    out[key] = `0 ${yy}px ${bb}px ${step.s}px ${ink(step.a)}`;
  });
  return out;
}

/** Re-point --color-interactive-glow at the chosen alpha while PRESERVING the
 *  live var(--color-interactive) reference so accent recolor still propagates.
 *  Never a baked oklch() literal (folds the gap-hunt BLOCKER). */
export function deriveGlow(alpha: number): string {
  const pct = Math.round(clampNum(alpha, 0, 1) * 100);
  return `color-mix(in oklch, var(--color-interactive) ${pct}%, transparent)`;
}

/** Clamp + format the blur radius literal. */
export function deriveBlur(px: number): string {
  return `${clampNum(px, 0, 24)}px`;
}
```

**Acceptance:** `pnpm type-check` clean; in a node/vitest scratch, `deriveElevationRamp(50)["--shadow-1"]` is a non-`none` `0 …px …px …` string; `deriveElevationRamp(0)["--shadow-3"] === "none"`; `deriveGlow(0.6) === "color-mix(in oklch, var(--color-interactive) 60%, transparent)"`.

### T3 — tokens.css defaults + one shipped consumer

**File:** `src/assets/styles/tokens.css`.
**Change:** After `--shadow-accent-glow: 0 0 0 3px var(--color-interactive-glow);` (line 413), inside the A1c "Depth & accent" block, add the static defaults. These mirror `deriveElevationRamp(50)` so effects-less themes match the depth-50 generated ramp exactly:

```css
/* Elevation scale (Track A C5) — a neutral, themeable depth ramp. Ink derives
   * from --color-text-primary so a dark theme's elevation auto-inverts toward a
   * subtle light glow (mode-adaptive, like the A1b/A1c chains — no dark block).
   * The generator re-emits these from effects.depth; absent → these defaults
   * apply (byte-identical). Foreground-class (box-shadow) → survive the
   * float-transparency override. */
--shadow-1: 0 1px 2px 0 color-mix(in oklch, var(--color-text-primary) 8%, transparent);
--shadow-2: 0 2px 4px -1px color-mix(in oklch, var(--color-text-primary) 10%, transparent);
--shadow-3: 0 4px 8px -2px color-mix(in oklch, var(--color-text-primary) 12%, transparent);
--shadow-4: 0 8px 16px -4px color-mix(in oklch, var(--color-text-primary) 14%, transparent);
--shadow-5: 0 16px 32px -8px color-mix(in oklch, var(--color-text-primary) 18%, transparent);

/* Panel blur radius (Track A C5) — owned by C5; consumed by C4 glass panels
   * via var(--dockpanel-glass-blur, 8px). Mode-independent. */
--dockpanel-glass-blur: 8px;
```

Then re-point the existing dialog shadow so depth has an observable consumer. Find the `--dialog-shadow` default in `tokens.css` and change its value to `var(--shadow-4)` (keep the token name; this is a value change to a `var()` chain, NOT a new token — no knownTokens/doc-sync trigger, and it equals a coherent elevation so no visual regression for effects-less themes since the default `--shadow-4` matches today's neutral). If `--dialog-shadow` has a hand-tuned value today, set it to `var(--shadow-4)`.

Separately, in `src/assets/styles/dockview.css`, add the blanket docked-panel consumer: a rule giving dock groups `box-shadow: var(--shadow-2)`.

> **C5↔C4 box-shadow coordination (Fix E).** C5's blanket dock-group rule (`box-shadow: var(--shadow-2)`) and C4's per-variant `box-shadow` (`.dockview-theme-commandvue .dv-groupview[data-cv-appearance="raised"]` reads `var(--dv-panel-shadow)`, `…="glass"`/`…="flat"` set their own) must NOT double-apply on a `raised`/`glass` group. **Scope C5's rule to non-`[data-cv-appearance]` groups** (e.g. `.dockview-theme-commandvue .dv-groupview:not([data-cv-appearance])`) so C4's more-specific attribute selectors take over once a variant is assigned — or rely on C4's higher specificity to override. Flag this for the **C4 windowing click-through** (C4 is Wave 4, lands after C5): verify a `raised` group shows exactly one box-shadow, not C5's + C4's stacked.

**Acceptance:** `pnpm build` compiles CSS; a Playwright/devtools probe resolves `--shadow-1` on `:root` to a `0 1px 2px …color-mix…` value and `--dockpanel-glass-blur` to `8px`.

### T4 — knownTokens allowlist

**File:** `src/modules/themes/knownTokens.ts`.
**Change (a):** Append the elevation ramp to `SEMANTIC_TOKEN_NAMES`, after `--shadow-accent-glow` (line 90):

```typescript
  // Elevation scale (Track A C5) — themeable neutral depth ramp, driven by the
  // effects.depth knob. tokens.css provides static defaults; generator re-emits.
  "--shadow-1",
  "--shadow-2",
  "--shadow-3",
  "--shadow-4",
  "--shadow-5",
```

**Change (b):** Append the blur token to `COMPONENT_TOKEN_NAMES` (NOT `SEMANTIC_TOKEN_NAMES`) — per master-plan §A.7/§B.6 the canonical name is `--dockpanel-glass-blur`, placed in the component family for consistency with the other `--dockpanel-*` chrome tokens, default `8px`, consumed by C4:

```typescript
  // Panel blur radius (Track A C5) — owned by C5; consumed by C4 glass panels.
  "--dockpanel-glass-blur",
```

These flow into `ALL_KNOWN_TOKEN_NAMES` automatically (the concat). C5 is first to need the cross-array dedup guard — add the assertion in T12 (a `knownTokens.spec.ts` case asserting no name appears in more than one of the four `*_TOKEN_NAMES` arrays), preventing the future C4 `--dockpanel-glass-blur` double-declaration.
**Change (c) — `tokenManifest.ts` (the 6th doc-sync file):** in the **same PR**, append the `"effects"` section rows to `src/modules/themes/tokenManifest.ts` (C1's file) — `--shadow-1…5` with `kind: "shadow"` and `--dockpanel-glass-blur` with `kind: "length"`. C1's set-equality drift guard (`tokenManifest.spec.ts`) requires every newly-allowlisted name to have a manifest entry, so this MUST land alongside change (a)/(b) or CI fails. This is the second tripwire (alongside the LLM-doc guard) and what makes C5 a 6-file (not 5-file) doc-sync phase.
**Acceptance:** `isKnownToken("--shadow-1")` and `isKnownToken("--dockpanel-glass-blur")` return `true` (quick test/node); `pnpm test tokenManifest` green (set-equality holds with the 6 new names).

### T5 — generate.ts conditional emit

**File:** `src/modules/themes/generate.ts`.
**Change (a):** Add `effects?` to `ThemeGenerationInput` (after `statusOverrides?`):

```typescript
  /** Depth / glow / blur effects inputs (C5). Absent → no effects tokens. */
  effects?: EffectsSpec;
```

Import the type and deriver at the top:

```typescript
import type {
  EffectsSpec,
  StatusFamily,
  StatusOverrides,
  Theme,
  ThemeDensity,
  ThemeMode,
} from "@/types/theme";
import { deriveBlur, deriveElevationRamp, deriveGlow } from "./effects";
```

**Change (b):** Append the conditional emit block **after** the `if (hasStatusOverride) {...}` block (~line 497) and before the contrast report:

```typescript
// --- Effects / depth ramp (C5). Emitted ONLY when input.effects is present —
// additive keys, no ENGINE_VERSION bump (§3i). Absent → tokens.css static
// defaults apply and output stays byte-identical for every existing theme. ----
const fx = input.effects;
if (fx) {
  if (fx.depth !== undefined) {
    Object.assign(tokens, deriveElevationRamp(fx.depth));
  }
  if (fx.glowAlpha !== undefined) {
    // Re-point the glow COLOR only, as a live color-mix against the accent —
    // preserves accent-recolor propagation. The --shadow-accent-glow SPREAD
    // (3px, in tokens.css) is intentionally NOT touched (no existing-key math
    // change → ENGINE_VERSION stays 1).
    tokens["--color-interactive-glow"] = deriveGlow(fx.glowAlpha);
  }
  if (fx.blurRadius !== undefined) {
    tokens["--dockpanel-glass-blur"] = deriveBlur(fx.blurRadius);
  }
}
```

**Notes for the executor:** Do **not** use `css(oklch(...))` for the glow — that baked-literal path was the gap-hunt BLOCKER. Do **not** re-emit `--shadow-accent-glow`. The `clamp` helper inside `generate.ts` (line 86) is for OKLCH math; the deriver uses its own `clampNum`, so no helper-arity assumption. Each sub-key is independently guarded so touching only one knob doesn't emit the others (honest input).
**Acceptance:** `generateTheme({...noEffects})` does not contain `--shadow-1`; `generateTheme({...effects:{depth:80}})` contains `--shadow-1…5` and not `--dockpanel-glass-blur`/glow re-point; `generateTheme({...effects:{glowAlpha:0.6}})["--color-interactive-glow"]` === `"color-mix(in oklch, var(--color-interactive) 60%, transparent)"`.

### T6 — LLM doc

**File:** `docs/theme-schema-for-llms.md`.
**Change:** After the composed-shadows sentence in the "Depth & accent" section (~line 122, ending "…are usually left to inherit."), append:

```markdown
**Effects / elevation (optional — the depth ramp; defaults to a neutral
`color-mix` ramp in `tokens.css`, so most themes omit them):** the five-step
elevation scale `--shadow-1`, `--shadow-2`, `--shadow-3`, `--shadow-4`,
`--shadow-5` (1 = subtle, 5 = dramatic), and the panel blur radius `--dockpanel-glass-blur`
(a length, e.g. `8px`, used by glass panels). These follow the `effects` depth /
glow / blur inputs on a generated theme; a static theme may override any of them
directly.
```

Leave the example JSON envelope at `schemaVersion: 1` and do **not** add effects keys to it (the guard hard-asserts `=== 1` and only-known example keys; the prose mention is sufficient and the §T4 allowlist makes the 6 names pass the doc→allowlist check).
**Acceptance:** `pnpm test tests/unit/docs/theme-schema-for-llms.spec.ts` green (balanced fences; every `--token` mentioned is `isKnownToken`).

### T7 — resolve.ts + portableSchema.ts

**File:** `src/modules/themes/resolve.ts`.
**Change:** In `toGenInput`, after the `statusOverrides` forward line (line 57):

```typescript
if (input.effects !== undefined) out.effects = input.effects;
```

**File:** `src/modules/themes/portableSchema.ts`.
**Change:** Add the sub-schema (plain `z.object` → strips unknowns for forward-compat; **NOT** `.strict()`), placed before `GenerationInputV2Schema`:

```typescript
/** Effects / depth inputs (Track A C5). Plain object → unknown future sub-keys
 *  are stripped (forward-compat), matching the GenerationInputV2Schema posture. */
const EffectsSpecSchema = z.object({
  depth: z.number().min(0).max(100).optional(),
  glowAlpha: z.number().min(0).max(1).optional(),
  blurRadius: z.number().min(0).max(24).optional(),
});
```

Add to `GenerationInputV2Schema`, after the `statusOverrides` line (line 95):

```typescript
  effects: EffectsSpecSchema.optional(),
```

**Acceptance:** `toGenInput` test passes both branches; `PortableThemeSchema` parses a theme whose `base.input.effects = { depth: 70 }`; parsing a theme with `effects.unknownKey` succeeds and drops the unknown key.

### T8 — Doc-sync gate (verify T3–T7 atomic)

**File(s):** none (verification).
**Change:** Run the doc-sync-adjacent specs together to prove the 6-file family is consistent (including the `tokenManifest.ts` set-equality tripwire):

```bash
pnpm test tests/unit/themes/generate.spec.ts tests/unit/themes/engine-stability.spec.ts tests/unit/themes/portable.spec.ts tests/unit/docs/theme-schema-for-llms.spec.ts tests/unit/themes/tokenManifest.spec.ts
```

(These will be extended in T12 but should already pass post-T3–T7 with the existing assertions.)
**Acceptance:** all five specs green together before any UI work begins.

### T9 — Authoring composable

**File:** `src/composables/useThemeAuthoring.ts`.
**Change (a) — ref + import:**

```typescript
import {
  deriveElevationRamp,
  deriveGlow,
  deriveBlur,
  EFFECTS_DEFAULTS,
} from "@/modules/themes/effects";
import type { EffectsSpec /* …existing… */ } from "@/types/theme";
```

Near the other inputs (after `fontFamily`):

```typescript
/** Effects / depth inputs (C5). null until the user first touches a knob, so
 *  an opened-but-untouched theme stays byte-identical (no `effects` key). */
const effects = ref<EffectsSpec | null>(null);
```

**Change (b) — both build paths.** This composable has TWO independent build sites (verified): the inline object inside `generationResult` (lines 182–197) and `buildGenerationInput()` (lines 236–248). BOTH must include `effects` or live preview diverges from save.

In the `generationResult` computed's `generateTheme({...})` call, add:

```typescript
        statusOverrides: statusOverrides.value,
        ...(effects.value ? { effects: effects.value } : {}),
```

In `buildGenerationInput`, after the `statusOverrides` assign:

```typescript
if (effects.value) input.effects = effects.value;
```

**Change (c) — `genInputOf` + seed.** Extend `genInputOf`'s return shape with `effects?: EffectsSpec` and populate it ONLY for the generated branch (the legacy `t.generation` branch predates C5 → `effects` stays absent):

```typescript
if (t.base?.kind === "generated") {
  const i = t.base.input;
  return {
    // …existing…
    effects: i.effects,
    paired: t.paired,
  };
}
```

In `seedFromTheme`, inside the `if (t && gen)` branch (after `applyStatusOverridesToSwatches`):

```typescript
effects.value = gen.effects ? { ...gen.effects } : null;
```

**Change (d) — reset + export.** In `reset()`: `effects.value = null;`. Add `effects` to the returned object (in the inputs group).
**Notes:** Keep `effects` lazy-null; the materialization happens in the EffectsTab's setter (T10), not here. Never access `t.base.input` on a static base — `genInputOf` already guards `t.base?.kind === "generated"`.
**Acceptance:** new `useThemeAuthoring.spec.ts` cases pass (T12); `pnpm type-check` clean.

### T10 — EffectsTab.vue

**File (new):** `src/components/panels/theme-studio/EffectsTab.vue`.
**Change:** Presentation-only; receives the `useThemeAuthoring` instance as a prop (`a`). Sliders bind through **computed proxies** that read `effects.value?.knob ?? EFFECTS_DEFAULTS.knob` and materialize `{ ...EFFECTS_DEFAULTS, [knob]: v }` on set (resolves the lazy-null / `v-model`-on-null trap). Debounce the model write at ~50ms (es-toolkit `debounce` or `@vueuse/core` `useDebounceFn`); cancel on unmount. The ramp strip binds `box-shadow: var(--shadow-N)` (live cascade — reflects Tokens-tab overrides too), the glow chip `box-shadow: var(--shadow-accent-glow)` — **zero color literals** (this SFC is under `panels/` so it is NOT scanned by the single-source guard, but stays token-pure by hand-review). An isolated "depth=X preview" may additionally call `deriveElevationRamp` for a what-if affordance, but the primary strip reads the live `var(--shadow-N)`.

Skeleton:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useDebounceFn } from "@vueuse/core";
import Slider from "@/volt/Slider.vue";
import InputNumber from "@/volt/InputNumber.vue";
import { EFFECTS_DEFAULTS } from "@/modules/themes/effects";
import type { useThemeAuthoring } from "@/composables/useThemeAuthoring";

const props = defineProps<{ a: ReturnType<typeof useThemeAuthoring> }>();

function knob<K extends "depth" | "glowAlpha" | "blurRadius">(k: K) {
  const commit = useDebounceFn((v: number) => {
    props.a.effects.value = { ...(props.a.effects.value ?? EFFECTS_DEFAULTS), [k]: v };
  }, 50);
  return computed<number>({
    get: () => props.a.effects.value?.[k] ?? EFFECTS_DEFAULTS[k],
    set: (v) => commit(v),
  });
}
const depth = knob("depth");
const glowAlpha = knob("glowAlpha");
const blurRadius = knob("blurRadius");
const rampSteps = [1, 2, 3, 4, 5];
</script>

<template>
  <div class="flex flex-col gap-4 p-3 text-sm">
    <!-- Depth -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-foreground font-medium">Elevation depth</span>
        <InputNumber v-model="depth" :min="0" :max="100" :step="1" class="w-20" />
      </div>
      <Slider v-model="depth" :min="0" :max="100" :step="1" />
      <span class="text-faint text-[10px]">0 = flat, 50 = neutral, 100 = dramatic.</span>
    </div>
    <!-- Glow -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-foreground font-medium">Accent glow strength</span>
        <InputNumber v-model="glowAlpha" :min="0" :max="1" :step="0.01" class="w-20" />
      </div>
      <Slider v-model="glowAlpha" :min="0" :max="1" :step="0.01" />
      <div
        class="h-6 w-12 rounded-md"
        :style="{
          boxShadow: 'var(--shadow-accent-glow)',
          backgroundColor: 'var(--color-interactive)',
        }"
        aria-hidden="true"
      />
    </div>
    <!-- Blur -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-foreground font-medium">Panel blur (glass)</span>
        <InputNumber v-model="blurRadius" :min="0" :max="24" :step="1" suffix=" px" class="w-20" />
      </div>
      <Slider v-model="blurRadius" :min="0" :max="24" :step="1" />
      <span class="text-faint text-[10px]">Used by glass panels (Panels &amp; Chrome).</span>
    </div>
    <!-- Live ramp strip -->
    <div class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-wider uppercase">Elevation ramp</span>
      <div class="flex items-end gap-3 px-1 py-3">
        <div
          v-for="n in rampSteps"
          :key="n"
          class="flex h-10 w-10 items-center justify-center rounded-md text-[10px]"
          :style="{
            backgroundColor: 'var(--color-surface-raised)',
            color: 'var(--color-text-secondary)',
            boxShadow: `var(--shadow-${n})`,
          }"
        >
          {{ n }}
        </div>
      </div>
    </div>
  </div>
</template>
```

Add a collapsible "Advanced — raw shadow values" disclosure with per-token rows routed through `a.overrides`/`a.setOverride` (the C6/C1 seam), reading the C5 `"effects"` rows from `tokenManifest.ts`. C1 is a hard predecessor (T0 gate), so the manifest is guaranteed present — there is no no-C1 fallback.
**Acceptance:** SFC renders; `pnpm lint` clean (no raw `<input>` / `<input type=range>`); `pnpm spell` clean over the file.

### T11 — ThemeStudioPanel tab wiring

**File:** `src/components/panels/ThemeStudioPanel.vue`.
**Change:** Mount the `EffectsTab` into the **existing C6 shell only**. C6 (hard predecessor, Wave 1) already shipped the `<Tabs scrollable v-model="activeTab" :tabs="STUDIO_L1_TABS">` wrapper inside the left `SplitterPanel`, the locked `STUDIO_L1_TABS` (in `src/components/panels/theme-studio/studioTabs.ts`, ids `generate, tokens, typography, panels, effects`), the single default slot scoped `{ active }`, and the `panelsClass` passthrough on `ui/Tabs.vue`. C5 does **not** create a shell, does **not** declare `STUDIO_L1_TABS`, does **not** touch `studioTabs.ts`, and does **not** edit `ui/Tabs.vue` (the T0 gate already failed-fast if any of these is missing).

C5's only edit here is to **replace the `effects` branch's `StudioTabPlaceholder`** in the existing single default slot with the real body:

```typescript
import EffectsTab from "@/components/panels/theme-studio/EffectsTab.vue";
```

```vue
<Tabs scrollable v-model="activeTab" :tabs="STUDIO_L1_TABS" :panels-class="…C6 default…">
  <template #default="{ active }">
    <!-- generate / tokens / typography / panels branches: UNCHANGED (owned by C6/C1/C2/C4) -->
    <div v-else-if="active === 'effects'" class="min-h-0 overflow-y-auto px-3">
      <EffectsTab :a="a" />
    </div>
  </template>
</Tabs>
```

The Common band, `Splitter`, preview pane (right `SplitterPanel`), and footer stay **outside** the tabs (unchanged, owned by C6). The preview/`generationResult` watcher is untouched — it already pushes the new tokens through `previewThemeTokens` because `generationResult` now reads `effects` (T9).
**Acceptance:** the Effects tab body renders inside the C6 shell (no new `<Tabs>` instance introduced by C5); switching tabs preserves Generate values (they live in `a.*` refs); moving the depth slider updates `:root` `--shadow-5` live (manual smoke). `git diff` shows no change to `studioTabs.ts` or `ui/Tabs.vue`.

### T12 — Unit tests

**Files:** as listed in File Structure. Vitest, jsdom, `import { describe, expect, it } from "vitest"` (the project uses `globals: false`).

- `tests/unit/themes/effects.spec.ts` (new): `deriveElevationRamp(50)` → 5 non-`none`; `(0)` → all `"none"`; `(100)` y-offsets ≈ 2× the depth-50 values (monotonic); `EFFECTS_DEFAULTS` deep-equals `{depth:50,glowAlpha:0.32,blurRadius:8}`; `deriveGlow(0.6)` contains `var(--color-interactive)` and `60%`; `deriveBlur(30) === "24px"` (clamped).
- `tests/unit/themes/generate.spec.ts` (extend): (a) no-`effects` input emits no `--shadow-1` — assert separately, do **not** widen the global `[70,85]` count bound at lines 38-39 and never feed an effects input through it; (b) `effects:{depth:80}` (no `glowAlpha`) emits exactly `--shadow-1…5` (+5 over baseline), no `--dockpanel-glass-blur`, **and leaves `--color-interactive-glow` ABSENT from the emitted map** (the existing key is untouched — sub-key isolation per master-plan §3i); (c) `effects:{glowAlpha:0.6}` sets `--color-interactive-glow` to the live-`color-mix` string, leaves `--shadow-accent-glow` absent from the emitted map (it stays a tokens.css default), **and emits NO `--shadow-*` key** (glow alone never touches the elevation ramp — the reciprocal sub-key isolation assertion); (d) `effects:{blurRadius:12}` → `--dockpanel-glass-blur:"12px"`; (e) `effects:{depth:0}` → `--shadow-1 === "none"`; (f) every emitted effects key passes `isKnownToken`.
  - **Per-input delta reconciliation (the master-plan "+6" vs C5 "+5"):** the emitted-key delta depends on **which sub-keys** the input carries, asserted per-input — **depth-only → +5** (`--shadow-1..5`); **depth+blur → +6** (adds `--dockpanel-glass-blur`); **glow re-points an existing key (`--color-interactive-glow`) so it adds 0** new keys. The master-plan's "+6" is the depth+blur case (full effects family with a blur radius); C5's "+5" is the depth-only case. Both are correct; assert each input shape against its own exact delta, never a single global figure.
- `tests/unit/themes/engine-stability.spec.ts` (extend): a generated theme with **no** `effects` re-resolves byte-identical post-C5 — capture `generateTheme({BASE,ACCENT,contrast,mode,density})` and assert it has no `--shadow-1` and deep-equals a fixture (pins the glow re-point inside the `if`).
- `tests/unit/themes/portable.spec.ts` (extend): export→import of `effects:{depth:70,glowAlpha:0.5,blurRadius:10}` preserves `base.input.effects` and re-resolves identical `--shadow-*`; `EffectsSpecSchema` strips an unknown sub-key; a `--shadow-3` override value `expression(alert(1))` is rejected by `TokenValueSchema`.
- `tests/unit/themes/resolve.spec.ts` (extend): `toGenInput` forwards `effects` when present and omits the key when absent (two inputs differing only in `effects` produce distinct `JSON.stringify(base.input)` memo keys; an absent-effects input serializes without the key).
- `tests/unit/composables/useThemeAuthoring.spec.ts` (extend): `effects` starts `null`; setting `effects.value = { ...EFFECTS_DEFAULTS, depth: 80 }` makes `buildGenerationInput()` include `effects` and the inline `generationResult` emit `--shadow-1…5`; `seedFromTheme` of a generated theme carrying `effects` populates the ref; `seedFromTheme` of a static base leaves `effects` `null`; `reset()` → `null`.
- `tests/unit/themes/knownTokens.spec.ts` (extend or add the dedup case): no token name appears in more than one of `SEMANTIC_TOKEN_NAMES` / `COMPONENT_TOKEN_NAMES` / `DENSITY_TOKEN_NAMES` / `THEMEABLE_PRIMITIVE_TOKEN_NAMES`.
  **Acceptance:** `pnpm test` fully green.

### T13 — Static gauntlet

**File(s):** none.
**Change:**

```bash
pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build && pnpm docs:build
```

`check:single-source` is not tripped — `color-mix` is exempt (no raw `oklch(`/hex), and `EffectsTab.vue` lives under `panels/` (unscanned). If `pnpm spell` flags a term, add it to `dictionaries/project.txt` (never `cspell.json`).
**Acceptance:** all green.

### T14 — Stage-1 Playwright verification

**File(s):** screenshots to `.verification-screenshots/feat/c5-effects/` (gitignored).
**Change:** Probe `mcp__plugin_playwright_playwright__*`; if absent, `ToolSearch "playwright browser"`; if still absent, fall back to a manual smoke checklist stated in the PR and embed no results table. Drive `pnpm dev`, open Theme Studio → Effects tab, run the assertions in the verification section below.
**Acceptance:** all C5-1…C5-8 PASS, 0 console errors; result table captured for the PR.

### T15 — PR

**File(s):** none (git/gh).
**Change:**

```bash
git push -u origin feat/c5-effects
gh pr create --base develop --title "feat(theming): effects tab — elevation scale + glow/blur sliders (Phase C5)" --body "<summary + Stage-1 table + Stage-2 checklist + open questions>"
```

Body includes: the Stage-1 result table, the Stage-2 human checklist, the open questions, and the **C4 hand-off note** (C5 owns `--dockpanel-glass-blur`; C4 must consume `var(--dockpanel-glass-blur, 8px)` and not re-declare it; the `--shadow-1…5` ramp is C5-owned and C4 references it). Stop; do not auto-merge.
**Acceptance:** PR open against `develop`, CI (quality + cspell) green, body complete, attribution trailer present.

---

## Data-model delta

- **New type:** `EffectsSpec { depth?: number; glowAlpha?: number; blurRadius?: number }` (`src/types/theme.ts`).
- **New field:** `GenerationInputV2.effects?: EffectsSpec` (additive optional, appended after `statusOverrides`).
- **New tokens (6):** `--shadow-1`, `--shadow-2`, `--shadow-3`, `--shadow-4`, `--shadow-5` in `SEMANTIC_TOKEN_NAMES`; `--dockpanel-glass-blur` in `COMPONENT_TOKEN_NAMES` (canonical glass-blur name, default `8px`, consumed by C4).
- **Re-pointed-when-effects-present (1):** `--color-interactive-glow` (live `color-mix`, only inside `if (input.effects?.glowAlpha)`).
- **Re-pointed value (1, not a new token):** `--dialog-shadow` → `var(--shadow-4)` in `tokens.css`.
- **Constants:** `THEME_SCHEMA_VERSION` stays `2`; `ENGINE_VERSION` stays `1`; `DB_VERSION` stays `3`. **No migration code** (`migrate.ts`, `db.ts` untouched). A migrated/effects-less theme emits no new keys → byte-identical resolve.
- **Portable round-trip:** `effects` rides `base.input`; `EffectsSpecSchema` (plain `z.object`, strips unknowns) validates on import; re-resolve re-derives the same ramp deterministically.

---

## Doc-sync checklist (the 6-file rule, ONE PR)

C5 adds a token family after C1 has shipped, so it is subject to the **6-file** rule — the 5 token-doc-sync files plus the `tokenManifest.ts` manifest rows (C1's set-equality drift guard fails without them).

| File                                                       | This PR's change                                                                                                                                                | Task      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `src/assets/styles/tokens.css`                             | `--shadow-1…5` + `--dockpanel-glass-blur` static defaults                                                                                                       | T3        |
| `src/modules/themes/knownTokens.ts`                        | 5 ramp names → `SEMANTIC_TOKEN_NAMES`; `--dockpanel-glass-blur` → `COMPONENT_TOKEN_NAMES`                                                                       | T4        |
| `src/modules/themes/generate.ts`                           | conditional `if (fx)` emit of ramp/glow/blur                                                                                                                    | T5        |
| `docs/theme-schema-for-llms.md`                            | "Effects / elevation" paragraph                                                                                                                                 | T6        |
| guard test `tests/unit/docs/theme-schema-for-llms.spec.ts` | passes unchanged (names known before doc mention); `generate.spec.ts` count assertions added                                                                    | T6/T8/T12 |
| `src/modules/themes/tokenManifest.ts`                      | append the `"effects"` section rows (`--shadow-1…5`, `--dockpanel-glass-blur`); C1's `tokenManifest.spec.ts` set-equality is the second tripwire requiring them | T4        |

(Plus the persisted-shape companions: `src/types/theme.ts`, `src/modules/themes/resolve.ts`, `src/modules/themes/portableSchema.ts`, `src/composables/useThemeAuthoring.ts` — T1/T7/T9.)

> **Canonical blur-token name — single atomic edit.** The glass-blur token is canonically **`--dockpanel-glass-blur`** (master-plan §A.7/§B.6), placed in **`COMPONENT_TOKEN_NAMES`** (NOT `SEMANTIC_TOKEN_NAMES`), default `8px`. The legacy `panel-blur` name is WRONG and must not appear anywhere in C5's output. This name lands as **one atomic edit across the doc-sync file set**: `tokens.css` default (T3), `knownTokens.ts` `COMPONENT_TOKEN_NAMES` append (T4), `generate.ts` `deriveBlur` emit target (T5), `docs/theme-schema-for-llms.md` line (T6), the data-model "New tokens" list, `EffectsSpec.blurRadius` comment (T1), and the C4 hand-off note (C4 consumes `var(--dockpanel-glass-blur, 8px)`). All seven references use the canonical name in the same PR — a partial rename fails the dedup/known-token guards.

---

## Two-stage verification

### Stage 1 — Playwright automated (binary; fully green before PR opens)

Screenshots → `.verification-screenshots/feat/c5-effects/<checkpoint>.png`. Drive: open Theme Studio → Effects tab. For pop-out reads, double-flush: `await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))`.

| id   | assertion                                                                                                                                                                      | checkpoint             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| C5-1 | Effects tab renders three sliders (depth / glow / blur) + a 5-card ramp strip + glow chip.                                                                                     | `effects-tab-open.png` |
| C5-2 | Moving **depth** to 100 changes `getComputedStyle(:root)['--shadow-5']` to a non-`none`, larger-offset value (read before/after).                                              | `depth-max.png`        |
| C5-3 | Setting **depth** to 0 sets `--shadow-1 … --shadow-5` to `none`.                                                                                                               | `depth-zero.png`       |
| C5-4 | Setting **glow** to 0.6 sets `--color-interactive-glow` to a value containing `var(--color-interactive)` and `60%`; `--shadow-accent-glow` spread unchanged (`3px`).           | `glow-strong.png`      |
| C5-5 | A **docked panel** (and a floated panel) shows an elevation shadow when depth>0 — assert `getComputedStyle(panelEl).boxShadow !== 'none'` (consumer wired in T3 dockview.css). | `panel-elevation.png`  |
| C5-6 | A **pop-out window** mirrors the new `--shadow-3` AND `--dockpanel-glass-blur` values (open pop-out, read its `<html>` style, assert both match the opener).                   | `popout-mirror.png`    |
| C5-7 | **Save** persists; reopening the saved theme re-seeds the sliders to the saved depth/glow/blur (round-trip).                                                                   | `save-reseed.png`      |
| C5-8 | Console-error count = 0; console-warning count baseline (no `color-mix` parse warnings, no NaN).                                                                               | —                      |

Result table (id · description · result · screenshot · console error/warning counts · PASS/FAIL) embedded in the PR.

### Stage 2 — Human design checklist (in the PR)

- [ ] The 5-step ramp reads as a coherent elevation language (each step clearly deeper, no muddy jumps) in both light and dark.
- [ ] At depth-50 the elevation is **visually identical to today** so existing themes don't shift (the load-bearing default).
- [ ] Glow at default (0.32) is a tasteful halo, not a neon ring; at max bold but not garish.
- [ ] Dark-mode elevation ink (derived from `--color-text-primary`) reads as intentional, not a weird light halo (resolve before merge — see open question 4).
- [ ] Depth=0 "flat" mode looks intentional, not broken.
- [ ] Slider labels + helper text legible at the Studio's density.
- [ ] The blur slider's "used by glass panels" affordance reads as forward-looking (C4 ships the consumer).

**Scrutinize this phase:** (1) depth-50 must land pixel-identical to today's neutral elevation; (2) the glow re-point must not bleed into themes that never touch the glow slider (it is gated inside `if (fx.glowAlpha !== undefined)`).

---

## Risks

- **Dark-mode ink as light halo.** `color-mix(... var(--color-text-primary) ...)` produces a _light_ shadow in dark mode. This is a real dark-UI technique but can read as emission. Mitigation: Stage-2 design check + open question 4 — resolve before committing the `color-mix(text-primary)` formula (changing it later is a token-default change). If rejected, floor the ink toward black: `color-mix(in oklch, black 50%, var(--color-text-primary))`.
- **`--dockpanel-glass-blur` cross-phase collision (C4).** C4 independently wanted a glass-blur token in `COMPONENT_TOKEN_NAMES`. Mitigation: C5 owns it (canonical name `--dockpanel-glass-blur` in `COMPONENT_TOKEN_NAMES`, default `8px`), the dedup guard (T12) fails CI on a double-declaration, and the PR body instructs C4 to consume `var(--dockpanel-glass-blur, 8px)` and not re-declare it.
- **Both build paths.** `generationResult` (inline object) and `buildGenerationInput` are separate sites; missing one makes live preview diverge from save. Mitigated by T9 wiring both + a `useThemeAuthoring` test asserting both.
- **High-frequency slider drag.** Each `previewThemeTokens` rewrites the root `style`; un-debounced 60fps drag = 60 full pushes/sec. Mitigated by the ~50ms debounce in the EffectsTab setter (T10).
- **Preview-pane vs ramp-strip parity.** The main preview pane (right `SplitterPanel`) doesn't render any `box-shadow: var(--shadow-N)` element today, so depth changes only show in the Effects strip + the live app. Acceptable (the strip is the demonstration); optionally add one elevated card to the preview sample. Flagged, not blocking.

---

## Open questions

1. **Glow slider scope.** Resolved per integration: the slider re-points **only** `--color-interactive-glow` (live `color-mix`); `--shadow-accent-glow`'s `3px` spread is untouched. Confirm this narrowing is acceptable (vs coupling color + spread). **Rec: color-only (binding).**
2. **Dark-mode elevation ink.** Derive from `--color-text-primary` (mode-adaptive, ships a light "shadow" in dark) vs floor toward black? **Rec: text-primary, but confirm at Stage-2 before the formula is locked** (token-default change cost later).
3. **Preview-pane elevation.** Add one `var(--shadow-N)`-shadowed card to the main preview sample so depth is visible outside the Effects strip, or leave the strip as the sole in-panel demonstration? **Rec: add one card (cheap, better feedback).**
4. **Depth=0 floor.** Allow a fully-flat theme (`--shadow-N: none`) or set a small non-zero minimum? **Rec: allow 0 — "flat" is a legitimate aesthetic.**
5. **C6 sequencing.** Resolved per master-plan §B.2/§B.3/§B.7/§B.10: **C6 is a HARD predecessor** (C6 Wave 1, C5 Wave 3). C5 mounts into the existing C6 shell only; the minimal-shell fallback is DELETED. If C6's shell is absent, C5 STOPS and escalates (T0). **No longer open — binding.**
