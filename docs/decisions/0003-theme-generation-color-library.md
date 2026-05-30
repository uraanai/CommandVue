# 0003. Color library for runtime theme generation

- **Status:** Accepted
- **Date:** 2026-05-27 (proposed); 2026-05-27 (accepted)
- **Deciders:** Project maintainer
- **Decision gate:** This ADR is the gate for Prompt 4 Phase B (the theme generation engine). It selects the color-math dependency the engine is built on.

## Context

Prompt 4 adds a Linear-style theme authoring system: the user supplies 3–4 high-level inputs (base color, accent color, contrast level, plus mode/density) and the app algorithmically derives the full ~50-token semantic set. Doing this well requires a color library that:

- Operates in **OKLCH / Oklab** so lightness steps are perceptually uniform (surface elevations and text steps look evenly spaced regardless of hue).
- Computes **WCAG contrast ratios** so accessibility is calculated, not eyeballed.
- Performs **gamut mapping** (reduce chroma until a color is displayable in sRGB) so generated colors never fall outside what the screen can render.
- Is **ESM-native and tree-shakeable** — we import a handful of functions, not a monolith.

The candidates considered:

| Library        | OKLCH   | WCAG    | Gamut map | Notes                                                                                          |
| -------------- | ------- | ------- | --------- | ---------------------------------------------------------------------------------------------- |
| **culori**     | ✅      | ✅      | ✅        | ~8M weekly downloads; used by Tailwind v4 and Radix for color generation; ESM, tree-shakeable. |
| `@texel/color` | ✅      | partial | ✅        | 3–68× faster gamut mapping, leaner footprint, but smaller surface and fewer batteries.         |
| `colorizr`     | ✅      | ✅      | partial   | Nice WCAG/APCA helpers, TypeScript-first, but less battle-tested for generation pipelines.     |
| `chroma-js`    | partial | ✅      | ✅        | Mature but Lab/LCH-centric, not OKLCH-first; larger and less modern.                           |

## Decision

**Accepted: `culori`.**

- ESM-native, modern, stable API; the exact functions the engine needs are first-class: `converter('oklch')`, `wcagContrast`, `formatCss`, `inGamut`, `clampChroma`.
- Proven fitness: Tailwind v4 and Radix both use culori for their color systems.
- Tree-shakeable — we import only `clampChroma`, `converter`, `formatCss`, `inGamut`, `wcagContrast`.
- culori 4.x ships no bundled types, so `@types/culori` is added as a dev dependency.

## Consequences

- Bundle adds ~30–50 KB before tree-shaking; the engine's import set is small, so the shipped cost is lower. The generation engine is only pulled in when the (future Phase E) customizer dialog is opened, so it doesn't weigh on first paint.
- `clampChroma` uses a "roughly in gamut" (jnd) tolerance and can leave a color a hair outside the strict `inGamut('rgb')` boundary; the engine tightens chroma with an explicit `inGamut` step and floors chroma when formatting, so every emitted token is strictly displayable.
- **Migration path:** if bundle size becomes critical post-launch, `@texel/color` is the target — same OKLCH support, leaner, much faster gamut mapping. The engine isolates all culori calls behind small helpers (`oklch()`, `css()`, `solveForContrast()`), so a swap touches one file.

## References

- Linear's redesigned-UI blog post on LCH-based theme generation (the inspiration for the constrained-input model).
- culori documentation — <https://culorijs.org/api/>
- `docs/theme-generation-algorithm.md` — the per-scale algorithm this library powers.
