# Theme generation algorithm

The runtime theme generator (`src/modules/themes/generate.ts`) turns 3–4 high-level inputs into a complete semantic token set. It's the engine behind the in-app theme authoring system (Prompt 4). This page documents how it works so the output is reviewable and the math is maintainable.

## Overview

Inspired by [Linear's redesigned-UI approach](https://linear.app/) to theming: rather than letting users hand-edit 50 colors, the user picks a handful of high-level inputs and a perceptually-uniform algorithm derives the rest. This produces themes that are:

- **Accessible by construction** — text and border lightness are _solved_ to hit a target WCAG contrast ratio, not eyeballed.
- **Visually coherent** — every surface, text, and border step is a single mathematical relationship in OKLCH.
- **Fast to author** — 4 inputs instead of 50.

All math runs in **OKLCH** (via [culori](https://culorijs.org) — see [ADR 0003](./decisions/0003-theme-generation-color-library.md)) because OKLCH lightness is perceptually uniform: equal `L` steps look equally spaced regardless of hue.

## Inputs

```ts
interface ThemeGenerationInput {
  baseColor: string; // any CSS color → drives surface hue + tint
  accentColor: string; // any CSS color → drives the interactive scale
  contrast: number; // 30–100 → steeper text/surface contrast
  mode: "light" | "dark";
  density: "compact" | "comfortable" | "spacious";
  fontFamily?: string; // optional; overrides --font-family-sans/-body
  name: string; // metadata (does not affect token math)
  description?: string;
}
```

The result is `{ tokens, contrastReport }`: the token map to persist/apply, plus a report the customizer UI (Phase E) surfaces to the user.

## What it emits — and what it doesn't

The engine emits **~50 color tokens**: the full semantic layer (surfaces, text, borders, the interactive scale, status colors, focus ring), the backwards-compat aliases (`--color-surface`, `--color-foreground`, …), and the color-bearing component overrides (datatable / menubar / statusbar / dockpanel / dialog / tooltip).

It deliberately does **not** emit:

- **`--density-*` tokens** — density is applied via the `data-density` attribute (see `apply.ts` and the `[data-density]` blocks in `tokens.css`). The theme carries a `density` field; emitting the tokens here would override the cascade and break density switching.
- **Sizing / radius / font-size component tokens** — those cascade from the density layer and the themeable primitives.

## Per-scale algorithm

### Surfaces (elevation)

Surfaces stay near-neutral, carrying only a whisper of the base hue's chroma (clamped low). Elevation changes lightness:

- **Light mode:** elevation gets _brighter_ — `base` (off-white, clamped 0.93–0.98) → `raised` (+0.02) → `overlay` (+0.035, capped at 1.0); `sunken` is `base − 0.04`.
- **Dark mode:** elevation gets _lighter_ — `base` (deep gray, clamped 0.14–0.20, never pure black) → `raised` (+0.03) → `overlay` (+0.05); `sunken` is `base − 0.02`.

> **Note — deviation from the prompt text.** The Prompt 4 brief's prose described light-mode surfaces getting _darker_ with elevation while also putting `overlay` at the lightest value (`L = 1.0`) — internally contradictory, and the opposite of the six shipped built-ins (`compact-light` uses `surface-base = slate-50`, `surface-raised = #ffffff`). The engine follows the **built-in-matching, internally-coherent** model above (elevation → brighter in light, lighter in dark). Flagged here for the Phase B review gate.

### Text (contrast-driven)

The `contrast` input (30–100) maps to a target WCAG ratio:

```
targetRatio = 4.5 + ((contrast − 30) / 70) × (12 − 4.5)   // 4.5:1 … 12:1
```

`text-primary` lightness is found by **binary search**: the `L` that makes a near-neutral text color hit `targetRatio` against the worst-case surface it sits on (darkest of base/raised/overlay in light mode; lightest in dark mode — this guarantees the AA target on _every_ surface, not just `base`). Dimmer steps use lower targets:

- `secondary` → `targetRatio × 0.75`
- `tertiary` → `targetRatio × 0.6`
- `disabled` → `max(targetRatio × 0.45, 1.9)`

`text-inverse` is a near-neutral light value in light mode / dark value in dark mode, for use on inverted surfaces (tooltips).

### Borders

Three steps, solved against `surface-base` for target contrasts: `subtle` ≈ 1.5:1, `default` ≈ 3:1, `strong` ≈ 4.5:1. Chroma is slightly elevated over text so borders read against the surface.

> The `default` border targets **3:1** to satisfy the contrast report (and WCAG 1.4.11 non-text contrast). This makes generated default borders more prominent than the built-ins' hairline borders — a deliberate, reviewable trade-off called out at the Phase B gate.

### Interactive (from accent)

- `interactive` takes the accent's hue, chroma clamped to a legible range (0.08–0.20), and a lightness _derived_ to keep white button text legible: the accent is darkened (down to a floor of 0.42) until `on-interactive` white clears 4.5:1.
- `hover` / `active` shift lightness toward "more visible" (darker in light mode, lighter in dark) by 0.07 / 0.13.
- `subtle` is a pale (light) / deep (dark) low-chroma tint of the accent, for selected-row / hover backgrounds.
- `on-interactive` is white when it clears AA on the accent; otherwise a _solved_ dark text (e.g. for yellow/amber accents, which read better dark anyway). The white- and black-contrast curves cross at ~4.58:1, so a valid ≥4.5 text color always exists.
- `focus-ring` reuses the interactive color.

### Status colors

Fixed semantic hue families (OKLCH degrees): `success ≈ 145`, `warning ≈ 75`, `danger ≈ 27`, `info ≈ 250`. Lightness and chroma are mode-tuned constants; each status also gets a `-subtle` variant (pale in light, deep in dark) for badge backgrounds. Chroma is gamut-mapped, so e.g. amber's chroma is reduced to what sRGB can display.

### Component tokens

Derived from the semantic layer so the theme is self-contained and matches the built-ins' deliberate choices — e.g. `--datatable-header-bg = surface-raised`, `--menubar-item-hover-bg = interactive-subtle`, `--tooltip-bg = text-primary` (inverse surface), `--dialog-backdrop` = translucent dark.

## Contrast verification

`wcagContrast` computes actual ratios for the critical pairs. The `contrastReport` surfaces three headline numbers (`textOnSurface`, `textOnRaised`, `onInteractive`) and a `failures[]` array for any pair below its required ratio:

| Pair                          | Required |
| ----------------------------- | -------- |
| text-primary / surface-base   | 4.5:1    |
| text-primary / surface-raised | 4.5:1    |
| on-interactive / interactive  | 4.5:1    |
| border-default / surface-base | 3:1      |
| focus-ring / surface-base     | 3:1      |

A correctly generated theme has `failures: []`. A small float slack (0.02) prevents a 4.50 target tripping on 4.499.

## Gamut mapping

Every color is built through a helper that:

1. `clampChroma(color, 'oklch', 'rgb')` — reduce chroma (preserving hue + lightness) toward the sRGB gamut.
2. A strict `inGamut('rgb')` tightening loop — `clampChroma` only gets "roughly" in gamut (jnd tolerance), so chroma is nudged down until strictly displayable.
3. Chroma is **floored** (never rounded up) when formatting to `oklch(...)`, so the printed value can't drift back out.

This guarantees every emitted token renders correctly on an sRGB display.

## Paired variants

`generatePairedVariant(theme)` regenerates a generated theme's opposite-mode counterpart from the same `generation` inputs (base / accent / contrast), with the mode flipped and density carried over. This is what lets the Light/Dark/Auto toggle bridge a user-authored theme without losing its aesthetic.

## Extending the vocabulary

The generator emits a deliberately small, curated set (~50 tokens). When the application grows new controls, the design is that **most additions require zero changes to `generate.ts`** — the three-layer architecture's cascade does the work. The decision tree:

### 95% case — new control consumes existing semantic tokens

A new `TitleBox` using `bg-surface-raised text-text-primary border-border-default` (or the equivalent `--color-*` references in CSS) themes correctly under every built-in _and_ every generated theme automatically. Zero token work. The semantic vocabulary in `tokens.css` is the API for the whole app — reach for it first. The cheat sheet is in [`.agent/skills/commandvue-theming-system/SKILL.md`](../.agent/skills/commandvue-theming-system/SKILL.md).

### 4% case — new control needs its own themeable component token

Sometimes you want a named handle so a control can be tuned independently (`--titlebox-header-bg`, `--titlebox-border`). Two-step recipe — **no algorithm changes**:

1. **`src/assets/styles/tokens.css`** — define the new component token referencing a semantic token so it inherits via the cascade:

   ```css
   :root {
     --titlebox-header-bg: var(--color-surface-raised);
     --titlebox-border: var(--color-border-default);
   }
   ```

2. **`src/modules/themes/knownTokens.ts`** — add the names to `COMPONENT_TOKEN_NAMES` so `themeRepo`'s invariants and the import validator accept them as legal overrides in custom-theme JSON.

The new token reads its value from a semantic token the generator already controls; under any generated theme it inherits correctly. Custom themes that _want_ to deviate can override `--titlebox-header-bg` explicitly in their JSON, and the import path now accepts it. `THEME_SCHEMA_VERSION` stays at `1` — adding tokens is backward-compatible. Old themes that don't override the new token simply fall back to the cascade.

### 1% case — generator should compute a non-trivial derived value

Rare: when the new token needs a value the cascade can't naturally express (the way `--dialog-backdrop` today is `oklch(0.15 0 H / 0.45)` — a translucent dark no semantic alone produces). Four steps:

1. Define the default in `tokens.css` (as above).
2. Add to `COMPONENT_TOKEN_NAMES` in `knownTokens.ts`.
3. Emit a derived value in `generate.ts`'s `tokens` object:

   ```ts
   "--titlebox-header-bg": css(interactiveSubtle),
   ```

4. Adjust the token-count assertion in `generate.spec.ts` (currently `>= 50 && <= 60`).

### Adding a new SEMANTIC token

If the gap is genuinely about _vocabulary_ — a meaning the existing semantic layer can't express — extend semantics, not components. The full path:

- `tokens.css` — root + dark override + density overrides if relevant.
- `knownTokens.ts` — `SEMANTIC_TOKEN_NAMES`.
- `generate.ts` — emit a derived value via the surface / text / interactive / status scale it logically belongs to.
- `docs/design-tokens.md` and `docs/theme-schema-for-llms.md` (Phase G) — so LLM-generated themes know about the new token.
- `THEME_SCHEMA_VERSION` stays `1` (additive).

New semantic tokens are a governed surface — they belong on the cheat sheet in the theming agent skill and the LLM schema doc, so every consumer learns about them.

### Why this design over "generate all ~200 tokens"

The constraint that makes the Linear-style approach work is **3–4 inputs → ~50 tokens is small enough to stay coherent**. If the generator emitted every component token directly, every new control becomes "now re-tune the algorithm." The cascade is what lets the system stay small and still cover everything. The curated component overrides the generator _does_ emit (`--datatable-header-bg`, `--menubar-bg`, `--tooltip-bg`, `--dialog-backdrop`, …) exist only where the built-ins deliberately deviate from cascade defaults.

## Beyond colors: other themeable dimensions

The current engine generates only color tokens. The same three-layer architecture (primitive → semantic → component, cascade-driven) handles every other design dimension a theme might tune. This section documents the broader landscape and the recommended extension path for each pillar — so future agents and designers know what's in scope, what's not, and how to extend without breaking the small-surface-coherent constraint that makes the algorithm work.

### Typography — the next likely extension

`generateTheme()` accepts a single `fontFamily?: string` today and emits two tokens (`--font-family-sans` + `--font-family-body`). That covers "set one font everywhere" but doesn't address "menubar wants Inter, critical alerts want IBM Plex Display, telemetry wants tabular mono."

The clean extension is **role-based semantic fonts** — the same pattern as semantic colors. Four roles cover essentially every dashboard need:

| Semantic role           | Used by                                   | Why separate it                                |
| ----------------------- | ----------------------------------------- | ---------------------------------------------- |
| `--font-family-body`    | reading text, panel content               | the default                                    |
| `--font-family-ui`      | menubar, statusbar, buttons, tabs         | chrome often wants a tighter stack than body   |
| `--font-family-display` | critical alerts, page titles, "eye-catch" | the "look here right now" font                 |
| `--font-family-mono`    | code, tabular numbers, telemetry columns  | digit alignment is operational, not decorative |

Component tokens default to a role via the cascade — identical to the color pattern:

```css
:root {
  --menubar-font: var(--font-family-ui);
  --statusbar-font: var(--font-family-ui);
  --datatable-numeric-font: var(--font-family-mono);
  --dialog-title-font: var(--font-family-display);
  --alert-critical-font: var(--font-family-display);
}
```

The `generateTheme()` input grows from one string to an optional fonts object — backward-compatible, since the old `fontFamily` keeps working as a shortcut for "all roles same":

```ts
interface ThemeGenerationInput {
  // existing fields...
  fonts?: {
    body?: string; // reading text
    ui?: string; // chrome, controls, menus
    display?: string; // critical, eye-catching, titles
    mono?: string; // code, tabular numbers
  };
}
```

The generator emits the four role tokens; unspecified roles fall back to `body`, `body` falls back to the current default. **No algorithm changes** — pure additive emission. Custom theme JSON can override any role independently.

Font _family_ is only one part of the typography pillar. A mature theme system also tokenizes:

| Typography sub-dimension | Why it matters in ops dashboards                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Font weights             | Need a separate "critical alert" weight distinct from regular bold                                                         |
| Font sizes (type scale)  | A real scale, not ad-hoc — `--text-display-lg/md`, `--text-body`, `--text-caption`. CommandVue has this partly via density |
| Line heights             | Tight for UI chrome, normal for body, loose for reading panels                                                             |
| Letter spacing           | Slightly tighter for UI labels; wider for small-caps status labels                                                         |
| Numeric features         | `font-feature-settings: 'tnum'` for tabular numbers in telemetry                                                           |
| Text transforms          | Tokenize whether status labels are uppercase / sentence-case                                                               |

All additive — add when the design needs them.

### The full taxonomy of themeable design dimensions

Where each pillar stands in CommandVue today:

| Pillar                     | Sub-dimensions                                                          | CommandVue today                                                                 |
| -------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Color**                  | surfaces, text, borders, interactive, status, focus, aliases            | ✅ full                                                                          |
| **Typography**             | font families, weights, sizes, line-heights, tracking, numeric features | ⚠️ partial (1 family input, sizes via density)                                   |
| **Spacing**                | base scale, semantic spacing, component padding                         | ✅ semantic + density                                                            |
| **Shape**                  | border radii, border widths, corner styles                              | ⚠️ radii only (themeable primitive)                                              |
| **Elevation**              | shadow scale, focus ring style, backdrop blur                           | ⚠️ focus-ring + shadow scale, no blur                                            |
| **Motion**                 | durations, easings, reduced-motion handling                             | ❌ not tokenized — currently inline in components                                |
| **Effects**                | selection bg, caret color, outline styles, glow                         | ⚠️ caret + selection rely on browser defaults                                    |
| **Iconography**            | default icon size, stroke width (Lucide supports 1 / 1.5 / 2 px)        | ⚠️ size via density; stroke not themed                                           |
| **Density**                | compact / comfortable / spacious                                        | ✅ full (`data-density` attribute)                                               |
| **Data-viz palette**       | chart palette, map style, symbology overrides                           | ❌ separate concern today (ECharts theme, milsymbol, MapLibre — not unified)     |
| **Accessibility variants** | high-contrast mode, color-blind-safe palettes                           | ⚠️ contrast input drives WCAG ratios; no high-contrast or CVD-safe palette today |

### Three pillars worth prioritizing for operational dashboards

1. **Motion tokens.** Ops dashboards have a genuine "reduce my distraction" need — animations fine on a marketing site become disorienting in command-and-control. Tokens like `--motion-critical: 0ms` (no animation for alerts) vs `--motion-normal: 200ms` belong in the theme so themes can tune them per-context. The Phase E customizer could expose a single "Motion intensity" slider that drives the whole motion scale.

2. **Data-viz palette unification.** Today the chart palette (ECharts), map style (MapLibre), and symbology (milsymbol) live separately from the `--color-*` tokens. For a unified theming experience these should derive from or coordinate with the theme's hue/accent — e.g. a generated theme's accent could seed an ECharts categorical palette. Worth a dedicated phase.

3. **Accessibility variants.** "High-contrast" and "color-blind-safe" are mode-like rather than tokens — but the generator could output them from the same inputs by pinning `contrast` to 100 and shifting status hues to CVD-safe families (e.g. blue/orange instead of green/red).

### How to decide what to add next

The principle that makes the color generator work — small coherent vocabulary, cascade does the heavy lifting — applies to every pillar. Decision criteria for any new dimension:

1. **Does the existing vocabulary cover it?** (Button height = density, not a new token.) If yes, stop.
2. **Is it 1–4 _roles_ (small surface) or 50+ knobs (big surface)?** Small surface → semantic tokens the generator emits. Big surface → primitive scales that components reach for directly.
3. **Does it have a meaningful "generation" derivation?** Color does (lightness math). Motion doesn't — it's a discrete enumeration the generator just emits.

When in doubt, add it as a primitive scale in `tokens.css` first and have components reach for it. Promoting to a generator input is a later, larger decision.

## Limitations

- Single accent only — no secondary/tertiary accent hues.
- Status hue families are fixed (no custom semantic hues).
- No gradient or image tokens.
- `fontFamily` is the only typography lever; weights/sizes come from primitives + density.
- The generated default border is more prominent than the built-ins' hairlines (see note above).

## Reference

- Engine: `src/modules/themes/generate.ts`
- Tests: `tests/unit/themes/generate.spec.ts`
- Inspect samples: `pnpm theme:demo` → `.verification-screenshots/feat-theme-generation-engine/sample-output.json`
- Library decision: [ADR 0003](./decisions/0003-theme-generation-color-library.md)
- Token vocabulary: [`docs/design-tokens.md`](./design-tokens.md), [`docs/themes.md`](./themes.md)
