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
