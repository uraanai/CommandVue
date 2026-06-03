# 0004. Theme single source of truth — custom `--color-*` tokens, not PrimeVue's native preset

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Project maintainer
- **Relates to:** ADR [0002](./0002-volt-vs-handrolled-wrappers.md) (unstyled PrimeVue + Volt) and [0003](./0003-theme-generation-color-library.md) (OKLCH theme generation).

## Context

CommandVue's goal for theming is that a user can recolor **everything** — surfaces, buttons, borders, status/toast colors — from the theme UI, with **no code or CSS edits**, and have the result land uniformly across the app, its modals, its floating panels, and every pop-out window.

That requires deciding what the single source of color truth is. Two facts framed the decision:

1. **CommandVue already owns a token namespace.** Colors are authored as `--color-*` (and the `--p-*` PrimeUI bridge variables) by an OKLCH, WCAG-aware generator (ADR 0003), persisted as themes, and applied as inline custom properties on `<html>`. Tailwind utilities and component styles both resolve to these variables.
2. **PrimeVue 4 ships its own design-token theming** (a primitive/semantic/component preset system, `definePreset`/`usePreset`, a visual Theme Designer). CommandVue, however, runs PrimeVue in **unstyled mode** and consumes components via **Volt + `:pt`** (ADR 0002) — it does not use a PrimeVue styled preset.

A real defect made the question urgent: a "surface seam" where modals/menus painted on a different (slate) scale than the themed app body. Investigation found the generator and the known-token allowlist were targeting `--color-p-surface-*`, a variable **nothing read**; the value Volt actually resolves is the single-`p` `--p-surface-*` ramp, which no theme path wrote. The app body recolored; Volt surfaces did not.

The strategic choice was whether to fix this within the existing namespace, or to adopt PrimeVue's native preset as the source.

## Decision

**Accepted: the custom `--color-*` namespace is the single source of truth; PrimeVue/Volt is a mechanically-derived consumer of it.** Concretely, the live `--p-surface-*` ramp is bridged to the authored ramp (`--p-surface-N: var(--color-p-surface-N)` in `main.css`), and `--p-primary-*` is bridged to the semantic interactive tokens. A theme writes one namespace; every surface — app and PrimeVue — follows.

This matches what mature component-library theming systems do (MUI, Ant Design, Chakra, Mantine): each owns its token graph and forbids raw color literals downstream; none subordinates its source of truth to a UI dependency.

### Rejected: adopt PrimeVue 4's native styled preset as the source

On the verified grounds:

1. **It is mutually exclusive with unstyled mode.** Per PrimeVue's own docs, in unstyled mode the design-token CSS variables and their rule-sets are not emitted. Adopting the preset means abandoning unstyled + Volt + `:pt` — a re-platform of the entire UI-primitive layer and a reversal of ADR 0002. (`@primeuix/themes` is not even a dependency; the app registers PrimeVue with `unstyled: true` and no preset.)
2. **It would not actually be the single source.** The app body, the dockview/float surfaces, the named surface ladder, status/toast, the palette accents, and the icon-tone plan all live outside any PrimeVue preset — so it would trade one seam for another.
3. **It discards the generator.** CommandVue's OKLCH, contrast-solving generator (ADR 0003) — the thing that lets a non-technical user pick any base/accent and still get legible output — has no equivalent in a vendor preset's fixed ramps.

## Consequences

- **The bridge is load-bearing.** `main.css` must keep `--p-surface-*`/`--p-primary-*` pointed at the `--color-*` source. The `--color-p-surface-*` ramp is a fixed light→dark scale Volt indexes per mode (it must not flip with `data-theme`), and it is intentionally exempt from the float-transparency block so Volt modals stay opaque inside floating panels.
- **Enforced in CI.** `scripts/check-single-source.mjs` (run as `pnpm check:single-source` in the quality gate) fails the build when a raw color literal — a hex, an `rgb()/oklch()` literal, or a Tailwind palette utility like `bg-slate-500` — appears in the UI-primitive layer (`src/volt/**`, `src/components/ui/**`). This is what makes "no code edits, ever" durable: the seam cannot silently regrow.
- **Documented exemptions.** The color-**picker** widgets and their swatch data (`ColorPicker.vue`, `ColorSwatchPicker.vue`, `colors.ts`) are exempt — a color input legitimately deals in raw color values. A small, phase-tagged allowlist covers the status/severity and invalid-state palette literals still present in a few Volt components; those are replaced with `--color-status-*` tokens in the status/toast-unlock phase, at which point the allowlist entries are removed.
- **Scope.** The guard covers the UI-primitive layer, where token-only styling is absolute. Data-visualization colors inside panels (chart series, map symbology) are a separate concern and out of scope.
