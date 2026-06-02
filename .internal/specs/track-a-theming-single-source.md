# Track A (Single-Source Edition) — One Theme to Rule Everything: Design & Execution Specification

> Status: Draft for maintainer review · Owner: Lead Architect (single-source lens) · Relationship: **not a rival design — a governance-and-completeness overlay on `.internal/specs/track-a-theming.md`.** Same architecture (Option C), same engine, same migration, same critical path; this edition _names_ the single-source doctrine, _enforces_ it in CI, and closes two verified completeness gaps. · Depends on: Track B (pop-out theme-mirroring, shipped) · Schema target: `THEME_SCHEMA_VERSION` 1 → 2 · DB target: `DB_VERSION` 2 → 3 (`src/modules/storage/db.ts`) · New ADR: `docs/decisions/0003-theme-single-source-of-truth.md`

---

## 0. Reading guide — what this edition adds, and what it adopts verbatim

This document is the companion spec (`track-a-theming.md`) **plus five additions and two corrections**. It deliberately does **not** re-derive the parts that are already correct.

**Adopted verbatim from the companion spec** (no change of substance — referenced, not re-litigated): the v2 data model (`base + overrides + mandatory cache`, §3a there), the `resolve()` materializer, the full migration strategy (§5 there: built-in load-time synthesis, diff-into-overrides, upcast-before-validate, downgrade-write tolerance, repo invariants), the anti-FOUC mandatory-cache boot contract (§3h there), the engine-stability additive-only contract (§3i there), the Theme Studio panel + `APP_ROOT` opener-root capture + no-flash commit ordering + rAF-coalesced observer (§3e there), the per-token editor + advisory WCAG (§3f there), and the A1a→A1a.5→A1b→A1c→A2a→A2b→A3 critical path.

**Net-new in this edition** (the genuine delta):

1. **The single-source doctrine, named and documented** (§3.0 + ADR-0003) — promotes the companion spec's _implicit_ Option-C arrangement to a written, ADR-recorded rule, and settles Option B (PrimeVue native preset) permanently with verified citations.
2. **The single-source CI guard** (§3.7) — the only mechanism in either spec that makes the seam **un-regrowable** by a future contributor. Specified **prototype-first**: build it, run it against `HEAD`, enumerate the real allowlist, _then_ decide hard-vs-warn. This is the companion spec's Open Decision 17 ("snapshot guard"), expanded into a literal-scan + unknown-`--*` scan.
3. **The `--cv-float-tint` / `--dv-*` re-chain folded into A1a** — closes a **verified** completeness gap: `--cv-float-tint` is `var(--color-slate-100/800)` (tokens.css:468/518) and `--dv-paneview-active-outline-color` is `var(--color-accent-500)` (dockview.css:52) — both are theme-blind _primitive_ refs, so custom themes don't recolor float glass or the active-panel outline today.
4. **The status quartet gains `-fg` + `-border` on-colors (M3/Chakra pairing) and a central CSS variant resolver (Mantine pattern)** — so a colored Tag/Badge/Toast is legible at _any_ hue from _one_ place, rather than assuming a neutral foreground.
5. **ADR-0003** to permanently settle Option C vs B.

Everything else below is the companion spec re-expressed through the single-source lens so the doctrine reads coherently end-to-end. Where this edition and the companion spec describe the same mechanism, they are byte-for-byte compatible; **the right end-state is one merged spec, not two.**

---

## 1. Overview

### The single-source goal

A CommandVue operator opens **"Create Theme"**, picks a base color, an accent, a contrast level, and (optionally) status hues, fonts, and richness knobs — and **every pixel of the app obeys**: the body, every panel, every Volt modal/menu/input/checkbox/slider/textarea/fieldset/tag, every toast, every status color, every border, every focus ring, in light **and** dark, **opaque inside floating panels**, and mirrored live to every pop-out monitor. They can then open **"Themes → Edit"** and change **any individual value** from a searchable per-token editor. **Zero code edits. Zero CSS edits. Now and forever** — enforced, not promised.

"Forever" is the operative word and the reason this edition exists. The companion spec correctly heals today's defects, but a guarantee that _holds against future contributors_ requires a structural property the companion spec stops short of naming and enforcing: **exactly one authored source of color truth, with every other namespace a mechanically-derived projection of it, and a CI gate that makes a second source un-mergeable.**

### The headline architectural decision (A/B/C — resolved)

Three options were evaluated against the **verified live code** (PrimeVue **4.2.5** registered `app.use(PrimeVue, { unstyled: true })` with **no** `theme.preset`; `@primeuix/themes` **not** a dependency — `package.json` resolves it to `undefined`; `tailwindcss-primeui@0.6.1` present; Volt consumes `:pt` Tailwind utilities that resolve through `tailwindcss-primeui`'s `@theme inline` down to `--p-surface-N` / `--p-primary-*`):

- **Option A — keep extending the custom `--color-*` token system, seam unhealed.** REJECTED. The generator writes `--color-p-surface-*` which `grep "var(--color-p-surface" src/` proves **nothing** reads (the only occurrences are the 12 definitions + a comment at tokens.css:172-186), while Volt resolves single-`p` `--p-surface-*` (hardcoded opaque OKLCH literals at `main.css:58-69`) which no theme path writes. "Everything themeable" is structurally false: the `surface-N`/`primary` utility usages across the Volt files stay frozen on slate. This _is_ the "very basic" the maintainer named.

- **Option B — adopt PrimeVue 4's native styled preset (`definePreset(Aura, …)` from `@primeuix/themes`, wired via `app.use(PrimeVue, { theme: { preset } })`) as the single source.** REJECTED. The decision rests on **two load-bearing grounds**, with two secondary considerations:
  - **(1) Mutual exclusivity with unstyled + Volt (decisive).** PrimeVue's own docs, verified via Context7 and a direct fetch of [primevue.org/theming/unstyled](https://primevue.org/theming/unstyled): _"In unstyled mode the css variables of the design tokens and the css rule sets that utilize them are not included."_ PrimeVue ships **two** styling modes — styled and unstyled — and they are mutually exclusive. A styled preset and unstyled+`:pt` cannot coexist. Option B therefore means abandoning unstyled + Volt + `:pt`, which is CLAUDE.md's locked stack and ADR-0002's governed foundation — a re-platform of all of `src/volt/*` and `src/components/ui/*`.
  - **(3) Loss of the AA generator (decisive).** Option B discards CommandVue's OKLCH gamut-safe, binary-search `solveForContrast` AA generator (`generate.ts:115-145`) — the genuine asset that lets a non-technical user pick _any_ base/accent and still get legible output. Aura's fixed primitive ramps do not solve for contrast against an arbitrary seed.
  - _(2, secondary) Own-surface coverage._ A styled preset _can_ emit arbitrary semantic tokens, and the app's CSS _could_ reference them — so this is not a hard blocker. But it would still not, out of the box, own CommandVue's _own_ surfaces (the app body, the dockview `--dv-*` / `--cv-float-tint` glass block, the named `--color-surface-{base,raised,overlay,sunken}` ladder, the bevel/glow/status families, the duotone `--icon-tone-*` plan); wiring all of those into a vendor preset recreates a two-source split _in the other direction_. A consideration, not the crux.
  - _(4, secondary) Template genericity._ It couples a generic forkable **template's** theme schema to one vendor's token shape. A consideration, not the crux.
  - **The conclusion stands on (1) and (3) alone.** (2) and (4) reinforce but do not carry it.

- **Option C — HYBRID: one CSS-variable namespace (`--color-*`) is the single authored source; PrimeVue/Volt is a _derived consumer_.** **ADOPTED.** This is what every mature system actually does (§2): MUI, Ant, Chakra, Mantine each _own_ their token graph and forbid downstream literals; none subordinates its source of truth to a UI dependency. CommandVue already owns `--color-*`, already has a seed→derive generator (`generateTheme` _is_ Ant's algorithm), and **already does Option C for the primary half** — `main.css:73-76` aliases `--p-primary-*` → `--color-interactive*`. Option C just finishes the surface half and then **locks the door behind it.**

This spec is Option C, **refined to make the single-source claim explicit and CI-enforceable.** It adopts the companion spec's load-bearing fix (its §3b surface derivation) and its v2 data model, and adds the five things in §0 that turn "healed today" into "single forever."

---

## 2. External grounding — how mature systems achieve single-source theming

Every system below converges on the same three-part shape: **(i)** a small set of authored _seeds_, **(ii)** a machine-derived set of _semantic roles_ with explicit **on-color pairing**, **(iii)** components that read **only roles, never literals** — so one edit fans out everywhere. The disagreements are only in mechanism. CommandVue already has (i) and (ii); its defect is purely that one consumer (Volt) reads a _parallel dead namespace_ instead of the roles.

**PrimeVue 4 (native).** Three token tiers — _primitive_ (palette, e.g. `blue.500`), _semantic_ (`primary.color`, contextual), _component_ (`button.background`, depends on semantic) — fed to CSS-variable placeholders by a `definePreset(Aura, …)` preset (from `@primeuix/themes`), with a `darkModeSelector` option and a visual Theme Designer ([primevue.org/theming/styled](https://primevue.org/theming/styled), [primevue.org/configuration](https://primevue.org/configuration)). **The decisive constraint for us:** this entire machinery is _omitted_ in unstyled mode — _"In unstyled mode the css variables of the design tokens and the css rule sets that utilize them are not included"_ ([primevue.org/theming/unstyled](https://primevue.org/theming/unstyled)). **What CommandVue adopts:** the _three-tier mental model_ (primitive → semantic → component), mapped onto our own namespace — seeds → `--color-*` semantic roles → `--datatable-*`/`--dv-*`/`--p-surface-N` component projections. **What it rejects:** the styled engine itself (mutual exclusivity + loss of the AA generator).

> **Correction vs the earlier draft (critique #minor-2).** PrimeVue 4 has **two** styling modes, styled and unstyled — _not_ three. "CSS variables" is _how styled mode works internally_ (a design-token architecture that emits CSS custom properties), not a separate third mode. This is harmless to the conclusion — in fact it _strengthens_ the mutual-exclusivity argument, since there is no middle "css-variable mode" to escape into — but the "three modes" phrasing was an unverified API claim and is corrected here.

**Material Design 3 (color roles).** The canonical articulation of **on-color pairing**: _"Roles starting with_ on _indicate a color for text or icons on top of its paired parent color"_; a dark surface is _"algorithmically paired with a light text label color so the UI automatically meets contrast requirements"_; and _"whenever possible, component tokens should point to a system or reference token, and not contain hardcoded values such as hex codes"_ ([m3.material.io/styles/color/roles](https://m3.material.io/styles/color/roles), [m3.material.io/foundations/design-tokens](https://m3.material.io/foundations/design-tokens)). **What CommandVue adopts:** make legibility _travel with the fill_ — every surface and every status fill ships with a generated on-color (`--color-on-interactive` already exists; add `--color-status-{s}-fg`). This is the model for the status quartet in §3.2.

**Ant Design (seed → map → alias).** Three-layer derivation: **Seed Token** (_"the origin of all design intent"_ — and _"after you have selected the brand color, we will automatically generate a complete color palette and assign it effective design semantics"_), **Map Token** (_"a gradient variable derived from Seed"_, via the theme algorithm), **Alias Token** (_"used to control the style of some common components in batches, which is basically a Map Token alias"_) ([ant.design/docs/react/customize-theme](https://ant.design/docs/react/customize-theme/)). **What CommandVue adopts:** this is _exactly_ CommandVue's existing model — `GenerationInputV2` = Seed, `generateTheme` = the algorithm producing Map (`--color-*` roles), the `--datatable-*`/`--dv-*` aliases = Alias. The lesson is that the seed→map relationship must be _the only_ source; CommandVue's defect is a dead parallel map (`--color-p-surface-*`).

**MUI (CSS vars + channel-alpha + colorSchemes).** One `createTheme({ cssVariables: true, colorSchemes: { light: true, dark: true } })` generates one variable set for both modes ([mui.com/material-ui/customization/css-theme-variables](https://mui.com/material-ui/customization/css-theme-variables/usage/)). For translucency it emits **channel tokens** — color-space channels without the alpha component — consumed as `rgba(var(--palette-primary-mainChannel) / 0.12)` ([mui.com/.../native-color](https://mui.com/material-ui/customization/css-theme-variables/native-color/)). **What CommandVue adopts:** one theme drives both modes (already true via `data-theme`), and the channel-alpha pattern for translucent tokens — our `--color-interactive-glow` (an alpha token derived from the accent) is exactly this; the guard asserts glow/bevel are `color-mix`/alpha chains, never literals.

**Chakra UI (semantic tokens + slot contract).** Semantic tokens _reference existing token values_ (`value` may be _"a reference to an existing token"_) and ship a consistent per-color **slot contract** — `solid`, `contrast`, `fg`, `muted`, `subtle`, `emphasized`, `focusRing` ([chakra-ui.com/docs/theming/semantic-tokens](https://chakra-ui.com/docs/theming/semantic-tokens), color-palette slot reference at [chakra-ui.com/docs/theming/colors](https://chakra-ui.com/docs/theming/colors)). Changing a referenced token updates every component that reads it. **What CommandVue adopts:** Chakra's _quartet contract per status family_ — `{ fill, subtle, fg, border }` — so a colored Tag/Badge carries its own legible foreground (`fg`/`contrast`) regardless of hue, instead of assuming a neutral.

**Mantine (single variant resolver).** `theme.variantColorResolver` is the documented function that _"determines which colors will be used in different variants in components like Alert, Avatar, Button, Badge, and ActionIcon"_, returning an object with `{ background, hover, color, border }` ([mantine.dev/theming/colors](https://mantine.dev/theming/colors/), [mantine.dev/styles/variants-sizes](https://mantine.dev/styles/variants-sizes/)). **What CommandVue adopts:** one resolver for severity → `{bg, fg, border}`, expressed as CSS `var()` chains keyed on **explicit `.p-success` / `[data-p-severity="…"]` selectors** (not framework variant utilities — see the hard verification gate in §3.6). Tag, Toast, and any future Badge read this one chain — never a per-component literal.

**shadcn / Tailwind (background/foreground convention).** Every color has both a `background` and a `foreground` variable — the base token controls the surface color and the `-foreground` token controls the text/icon color on that surface — mapped to utilities `bg-background`/`text-foreground`/`border-border`/`ring-ring` from a single CSS-variable source ([ui.shadcn.com/docs/theming](https://ui.shadcn.com/docs/theming)). **What CommandVue adopts:** the _naming discipline_ — every surface role has a paired foreground role, and Tailwind utilities resolve to those roles only. CommandVue already follows this (`--color-surface-*` + `--color-text-*`); the guard enforces that no utility ever inlines a palette literal (`green-100`) instead.

**Admin customizers (the no-code UX bar).** Vuexy and Materio ship built-in **Live Customizers** — preset color pickers, light/dark, layout/RTL toggles, applied at runtime ([pixinvent.com/vuexy](https://pixinvent.com/vuexy-bootstrap-html-admin-template/), Materio at [themeselection.com](https://themeselection.com/item/materio-vuetify-vuejs-admin-template/)). The bar they set: a dockable customizer that recolors the running app instantly, preset swatches plus free color pickers, and persistence. **What CommandVue adopts:** the Theme Studio (§6) meets this bar and exceeds it (pop-out-aware live recolor, per-token editor, advisory WCAG).

**Net adopted position:** CommandVue owns one namespace (`--color-*`), derives every other namespace from it (the Ant/MUI/Chakra/Mantine invariant), pairs every fill with an on-color (M3/Chakra), centralizes variants in one resolver (Mantine), and forbids downstream literals (all five) — now via CI, not convention. PrimeVue's three-tier _model_ is honored; its styled _engine_ is rejected for cause.

---

## 3. Target architecture — the single-source token/preset model

### 3.0 The one rule

> **There is exactly one authored source of color truth: the Tier-2 `--color-*` semantic roles (and the Tier-1 seeds that generate them). Every other color-bearing namespace — `--color-surface-*` (float-aware), `--p-surface-N`, `--p-primary-*`, `--dv-*`, `--cv-float-tint`, `--datatable-*`, every Volt `:pt` string, every `ui/*` wrapper — is a _projection_ of Tier-2 via `var()` chains. No projection may contain a literal color. No second authored namespace may exist.**

This rule is _named_, _documented_ (ADR-0003), and _enforced_ (the CI guard, §3.7).

### 3.1 The graph: one source → derived projections

```
TIER 1  SEEDS  (what a non-technical user edits in "Create Theme")
  baseColor · accentColor · contrast(30–100) · mode · density
  + fontFamily? · statusHues? · statusOverrides? · richness knobs (bevel depth, glow alpha)
  = GenerationInputV2          ← Ant "Seed Tokens" / Chakra "tokens"
        │  generateTheme()  (the AA-solving OKLCH algorithm — Ant's theme algorithm)
        ▼
TIER 2  SEMANTIC ROLES  (machine-derived, AA-solved — THE SINGLE SOURCE)   ← Ant "Map" / M3 "system tokens"
  surfaces · text · borders · interactive · status quartet · toast · focus
        │  pure var() chains (no literals, no math)
        ▼
TIER 3  COMPONENT PROJECTIONS  (derived consumers — NEVER authored)        ← Ant "Alias" / PrimeVue "component"
  --p-surface-N · --p-primary-* · --dv-* · --cv-float-tint ·
  --datatable-* · --dockpanel-* · --menubar-* · --dialog-* · --tooltip-* · --button-* ·
  every Volt :pt string · every ui/* wrapper · the central variant resolver
```

One resolver (`resolve.ts`) → one flat `tokens` Record → one write of inline `--*` on the **top-window root** (`APP_ROOT`, §6) → the existing `MutationObserver` (Track B) mirrors every `--*` to every pop-out. **A single edit to one Tier-2 role moves the app body, every Volt surface, every form control, every toast, and every pop-out together, in both modes, opaque inside floats.**

### 3.2 Tier-2 role set (the semantic vocabulary), with on-color pairing

Surfaces — **the source ladder is opaque and float-immune** (this is the rename the companion spec stops short of — it introduces `--color-surface-solid-*` as a "float patch" but does not document it as _the named source_ with two named projections):

| Role (authored source)          | Purpose                   | Projections that read it                                               |
| ------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `--color-surface-solid-base`    | app field / deep body     | `--p-surface-50`, `--cv-float-tint` (base tint)                        |
| `--color-surface-solid-raised`  | dialog/menu/card body     | `--p-surface-0` (light) / `-800` (dark), `--dialog-bg`, `--menubar-bg` |
| `--color-surface-solid-overlay` | popovers, hover, elevated | `--p-surface-100` / `-900`, hover rungs                                |
| `--color-surface-solid-sunken`  | wells, insets             | `--p-surface-950`, sunken rungs                                        |

> **Source vs projections (the legible contract).** `--color-surface-solid-*` is the **authored source**. `--color-surface-{base,raised,overlay,sunken}` (the existing _named_ ladder) is the **float-aware projection** — it is what `dockview.css:93-97` re-points to `transparent` inside `.dv-groupview-floating` so docked-panel `bg-surface*` shows the glass tint. `--p-surface-N` (0..950) is the **Volt projection**, pinned in `main.css` to the `-solid-*` source + foreground tokens so Volt surfaces stay opaque inside floats. Both ladders derive from the same OKLCH solve; only the source is authored.

Text / foreground (already float-untouched — safe to feed `--p-surface` mid-ramp text rungs): `--color-text-{primary,secondary,tertiary,disabled,inverse}`.

Borders: `--color-border-{subtle,default,strong}` + **new** `--color-border-accent` (default hue-nudged toward accent, for active panels → wires `--dv-paneview-active-outline-color`, which is `var(--color-accent-500)` today — a theme-blind primitive ref, re-chained here) + `--color-status-{s}-border`.

Interactive (accent triad, MUI channel-alpha for translucency): `--color-interactive` / `-hover` / `-active` / `-subtle` / `-dim`, the on-color `--color-on-interactive`, and the alpha token `--color-interactive-glow` (= `oklch(L C accentHue / 0.32–0.4)`).

**Status — the Chakra quartet per family** `{ success, warning, danger, info }`:

| Slot             | Token                       | Meaning                           | Generation                                                                                    |
| ---------------- | --------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| fill             | `--color-status-{s}`        | solid badge / stripe              | hue-first → L/C derived, gamut-safe, mode-adaptive                                            |
| subtle           | `--color-status-{s}-subtle` | tinted background                 | auto-derived from fill hue                                                                    |
| **fg (NEW)**     | `--color-status-{s}-fg`     | **on-color for the _solid_ fill** | solved like `on-interactive` (white-or-dark crossover) so a colored Tag is legible at any hue |
| **border (NEW)** | `--color-status-{s}-border` | quartet border                    | derived from fill                                                                             |

Status stays **generative** (hue-first, gamut-safe, mode-adaptive); explicit Tier-2 color is the escape valve (precedence `color > hue`).

> **Byte-identity scope (critique #minor-6, stated precisely to prevent misreading).** "Byte-identical when unset" applies to the **existing two keys** `--color-status-{s}` and `--color-status-{s}-subtle` only: with no override they emit exactly today's values. The **new** `-fg` and `-border` keys are _additive_ — they are emitted by the generator only when a status override is present, and otherwise come from the `tokens.css` `var()`-chain defaults (§3.6). "Status unchanged" therefore means "the two pre-existing status keys are unchanged," **not** "no new status keys exist." The two are not in tension: additive keys do not alter the pre-existing ones.

Status/toast contrast is **advisory only** — surfaced as WCAG chips in the editor, never added to `contrastReport.failures` (which stays text/border/focus/on-interactive only).

Toast: `--color-toast-{success,info,warning,danger}-{bg,fg}` + neutral `--color-toast-{bg,fg,border}` — **defaults defined in `tokens.css` as `var()` chains off the status quartet + surface roles**, so the 6 built-ins (static JSON, no generator path) inherit colored toasts for free.

Focus: `--color-focus-ring` + composed `--shadow-focus-ring` / `--shadow-accent-glow` (= `0 0 0 3px var(--color-interactive-glow)`).

Richness (A1c, all _foreground-class_ so they survive the float transparency override): `--color-surface-bevel-{light,dark}` + composed `--shadow-bevel-{raised,sunken}`.

### 3.3 How everything resolves from one source (no seam)

- **App body & cards** read `--color-surface-*` (float-aware projection).
- **Every Volt surface** (Dialog, Menu, Checkbox, InputText, Textarea, Slider, Fieldset, DataView, Tag, SecondaryButton) reads `--p-surface-N`, which `main.css` pins to the `-solid-*` source. _Critical mechanism:_ `tailwindcss-primeui` uses `@theme inline`, so `var(--p-surface-N)` is inlined at the Volt use site — the **only** runtime lever on a Volt surface is `--p-surface-N` (single `p`). You cannot fix it by editing `--color-surface-N`.
- **Form controls** are Volt components → covered by the above. Accent fills (`bg-primary`) already read `--p-primary-*` → `--color-interactive*` (the primary half of Option C, live today at `main.css:73-76`).
- **Toasts & severity tags** read the central variant resolver (§3.6) → `--color-status-*` / `-fg` / `-border`.
- **Dockview chrome** (`--dv-*`, `--cv-float-tint`) reads Tier-2 surface roles — _after the A1a re-chain_ (today `--cv-float-tint: var(--color-slate-100/800)` at tokens.css:468/518 and `--dv-paneview-active-outline-color: var(--color-accent-500)` at dockview.css:52 are **primitive** refs, theme-blind; re-chained to Tier-2 roles they follow custom themes).
- **Tailwind utilities** resolve to Tier-2 roles only (`bg-surface-base`, `text-text-primary`, `border-border-default`); the guard forbids `bg-green-100` & friends.

Light/dark: one theme drives both modes via `data-theme`; the generator emits both, the named ladder + `-solid-*` carry mode overrides in `tokens.css`. Density: cascades from `data-density` (unchanged) and is **excluded** from inline overrides (an inline `--*` would beat the attribute selector).

### 3.4 Data model v2 (adopted from the companion spec, unchanged in shape)

```ts
export const THEME_SCHEMA_VERSION = 2 as const;
export const ENGINE_VERSION = 1 as const; // bumps only when generateTheme MATH changes

export type ThemeBase =
  | { kind: "generated"; input: GenerationInputV2 } // re-derivable
  | { kind: "static"; tokens: ThemeTokens }; // frozen (built-ins, hand-authored imports)

export interface Theme {
  base: ThemeBase;
  overrides: ThemeTokens; // sparse: ONLY hand-edited tokens. {} for fresh-generated.
  tokens: ThemeTokens; // MANDATORY resolved cache (write-through, load-bearing for first paint)
  paired?: ThemeId;
  /* …id/name/source/mode/density/createdAt/updatedAt… */
}
```

`resolve(theme)`: `static` → `base.tokens`; `generated` → `generateTheme(base.input).tokens` (memoized, keyed `${ENGINE_VERSION}:${JSON.stringify(base.input)}`); then `{ ...base, ...overrides }` (override wins). The `tokens` cache is written through on every create/update and is the **only** thing the anti-FOUC inline script reads. Rationale, rejected alternatives, the engine-stability contract, and the mandatory-cache boot invariant are as in the companion spec §3a/§3h/§3i — **adopted verbatim, not re-derived here.**

### 3.5 On-color pairing as a first-class generated value

Following M3/Chakra: every fill role ships with its on-color in the **same** generation pass.

- Surfaces already pair with `--color-text-*` (the float-untouched foreground family).
- Interactive pairs with `--color-on-interactive` (exists).
- **Status fills now pair with `--color-status-{s}-fg`** (new) — solved with the existing `solveDarkText`/`onInteractive` crossover logic so a danger badge at hue 27 and an info badge at hue 250 are _both_ legible without assuming a neutral foreground.

### 3.6 The single variant resolver (Mantine's pattern, CSS form) — with a HARD verification gate

One place maps severity → `{bg, fg, border}`. Because Volt `:pt` strings are class strings (not JS), the resolver lives as `tokens.css` `var()` chains. **It is keyed on explicit selectors — `.p-success` / `.p-info` / `.p-warn` / `.p-danger` and `[data-p-severity="…"]` — NOT on `tailwindcss-primeui` `p-success:`-style Tailwind _variants_.** Context7 + WebSearch confirm `tailwindcss-primeui` "supports both styled and unstyled modes" and provides `bg-primary` / surface utilities, but **did not** confirm that the severity _variant selectors_ are emitted in unstyled mode. Therefore the resolver is written against the underlying class/attribute hooks PrimeVue applies to message/tag elements, which do not depend on the plugin emitting variants:

```css
/* tokens.css — the ONLY allowed source of severity colors */
.p-tag,
.p-message,
.p-toast-message {
  /* neutral default */
  --sev-bg: var(--color-toast-bg);
  --sev-fg: var(--color-toast-fg);
  --sev-border: var(--color-toast-border);
}
[data-p-severity="success"],
.p-tag-success,
.p-message-success {
  --sev-bg: var(--color-status-success-subtle);
  --sev-fg: var(--color-status-success-fg);
  --sev-border: var(--color-status-success-border);
}
[data-p-severity="info"],
.p-tag-info,
.p-message-info {
  --sev-bg: var(--color-status-info-subtle);
  --sev-fg: var(--color-status-info-fg);
  --sev-border: var(--color-status-info-border);
}
[data-p-severity="warn"],
.p-tag-warn,
.p-message-warn {
  --sev-bg: var(--color-status-warning-subtle);
  --sev-fg: var(--color-status-warning-fg);
  --sev-border: var(--color-status-warning-border);
}
[data-p-severity="danger"],
.p-tag-danger,
.p-message-danger {
  --sev-bg: var(--color-status-danger-subtle);
  --sev-fg: var(--color-status-danger-fg);
  --sev-border: var(--color-status-danger-border);
}
```

Tag, Toast, and any future Badge read `bg-[var(--sev-bg)] text-[var(--sev-fg)] border-[var(--sev-border)]` — **no per-component literals**. The CI guard treats this block as the _only_ sanctioned source of severity color.

> **HARD verification gate before A1b commits (critique #4, #5).** A1b does **not** merge until two facts are confirmed at runtime in the actual build (unstyled mode + the pop-out stylesheet copy), via Playwright-MCP `getComputedStyle`/DOM inspection:
>
> 1. **Which severity hook PrimeVue 4 actually applies** to `Tag` / `Toast` message elements — the `data-p-severity` attribute, a `.p-tag-{severity}` class, or both. The selector list above is written to match whichever PrimeVue emits; the gate confirms it before wiring. If PrimeVue applies _none_ of these in unstyled mode, the fallback is a `severity`-keyed `:pt` map authored per-component reading the same `--color-status-*` chain (still single-source — the literals never appear).
> 2. **The PrimeVue 4 Toast `message` PT severity surface** — the exact PT slot (`message` / `container` / `content`) and the value carried (the resolver attribute/class vs a `props.severity` the `:pt` function receives). Both this spec and the companion spec flagged this "Context7-verify"; this edition makes it a **commit gate**, not a note.

### 3.7 The single-source CI guard (the "forever" mechanism) — PROTOTYPE-FIRST

This is the headline net-new mechanism. **It ships prototype-first, not hard-gated-first** (critique #3): the false-positive surface of a color-literal regex is larger than a one-line "small, documented allowlist" admits, so the sequence is **build → run against `HEAD` → enumerate the real allowlist → only then choose hard-vs-warn.**

Two scans, run in CI on the primitive/wrapper/theme layer (`src/volt/**`, `src/components/ui/**`, `src/assets/styles/{tokens,main,dockview}.css`):

1. **No raw color literal.** Fail on hex (`#[0-9a-fA-F]{3,8}`), and on `rgb(`/`rgba(`/`hsl(`/`oklch(`/`lab(`/`color(` **whose value is not part of a `var()` chain**, plus Tailwind color-palette class names (`(bg|text|border|ring|fill|stroke|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}`).

   **Enumerated allowlist (the part the earlier draft hand-waved — built by running against `HEAD` first):**
   - `transparent`, `currentColor`, `inherit`, `none`.
   - `#ffffff` **only** at the documented `--p-surface-0` rung in `main.css` (and the matching `--color-surface-solid-base` light value if authored as a literal).
   - **`color-mix(in oklch, …)` and `color-mix(in srgb, …)`** — the `in oklch` / `in srgb` _color-space keyword_ contains the substring "oklch"/"srgb" but is **not** a color literal; the scan must match `oklch(`/`srgb(` only when _immediately followed by a number_, i.e. an actual color value, never the `in <space>` keyword. The `color-mix` chains at dockview.css:82-104 are legitimate Tier-3 projections and must pass.
   - **The generator's own OKLCH math inside `generate.ts`** — the generator _is_ the algorithm, not a consumer; the whole file is allowlisted from scan 1.
   - **The `:root` / `[data-theme="dark"]` default blocks in `tokens.css`** — these _are_ the Tier-2 + Tier-1 defaults; the OKLCH/hex values there are the authored source, allowlisted.
   - **Numeric, non-color values** — `--cv-float-alpha` and similar alpha/timing/length numerics (e.g. `calc(var(--cv-float-alpha, 1) * 100%)`) are not colors; the regex must not trip on bare numbers or `calc()`.
   - **Composed shadow tokens** — `box-shadow` values containing `rgba(0 0 0 / …)` for elevation are permitted **only** when the rgba is `0 0 0` / `255 255 255` (pure black/white elevation alpha), since elevation shadow is conventionally neutral-on-alpha, not a brand color. Brand-tinted shadows must route through `var(--color-interactive-glow)` etc.

2. **No unknown `--*`.** Fail on any `--*` custom property introduced in the scanned layer that is not in `ALL_KNOWN_TOKEN_NAMES` (or the resolver's `--sev-*` allowlist). This is the broadened, teeth-bearing successor to the companion spec's `tokenManifest` uniqueness test and its Open-Decision-17 snapshot guard — it stops a future contributor from minting a parallel namespace (the exact failure that created today's `--color-p-surface-*` ghost).

**Severity decision (deferred to prototype output, Open Decision 1):** the _intent_ is a **hard gate (red build)** for the primitive/wrapper/theme layer — this _is_ the guarantee — and **warn-level** elsewhere (panels legitimately use semantic utilities). But the hard-gate switch is flipped **only after** the `HEAD` run is clean against the enumerated allowlist above, so the first CI run is informative, not a spurious red. Modeled on the existing `no-restricted-imports` datatable rule but stricter for this layer. Wired into `.github/workflows/ci.yml` job `quality`. A companion **emitted-key snapshot test** (the companion spec's Open Decision 17) runs alongside: it snapshots every key `generateTheme` emits across a fixed input set, so an accidental _math_ change is a red CI rather than a silent recolor — complementing the literal/namespace scans.

### 3.8 Why this is genuinely single-source where Option B is not

| Surface                               | Option B (PrimeVue preset)                          | Option C (this spec)       |
| ------------------------------------- | --------------------------------------------------- | -------------------------- |
| Volt components                       | ✅ (but requires re-platform off unstyled)          | ✅ via `--p-surface-N` pin |
| App body / cards                      | ⚠️ preset _can_ emit tokens, but app must wire them | ✅ `--color-surface-*`     |
| Dockview / floats / `--cv-float-tint` | ❌ outside preset by default                        | ✅ Tier-3 `var()` chains   |
| Status / toast / variant resolver     | partial                                             | ✅ quartet + resolver      |
| Bevel / glow / `--icon-tone-*`        | ❌ outside preset                                   | ✅ Tier-2 roles            |
| AA contrast solving                   | ❌ Aura fixed ramps                                 | ✅ `solveForContrast`      |
| Unstyled + Volt + ADR-0002            | ❌ mutually exclusive (verified)                    | ✅ preserved               |

(The two ⚠️/❌ "own-surface" rows are the _secondary_ Option-B considerations from §1; the decisive rows are the last two — mutual exclusivity and AA solving.)

---

## 4. Migration from today

The path is the companion spec's §5, **adopted in full and unchanged**, with three single-source amendments folded in:

1. **Heal the seam (A1a).** Generator stops emitting dead `--color-p-surface-*`; emits the **named source** `--color-surface-solid-*` (opaque, same OKLCH solve as `-raised`/`-overlay`). `main.css:58-69` replaces the hardcoded `--p-surface-*` literals with a pinned rung→role table referencing the `-solid-*` source + foreground tokens (built from a full `grep "surface-\d" src/volt/*` audit first). **Re-chain `--cv-float-tint` (tokens.css:468/518) and `--dv-paneview-active-outline-color` (dockview.css:52) — and any other theme-blind `--dv-*` primitive ref — to Tier-2 roles in the same PR.** Heals all 6 built-ins for free; no theme-data change.

2. **Land v2 model (A1a.5).** `base + overrides + mandatory cache`, `THEME_SCHEMA_VERSION` 1→2, `DB_VERSION` 2→3, `resolve.ts`, and the full migration (diff-into-overrides so every existing theme renders pixel-identical; built-ins synthesized at load as `static`; imports upcast-before-validate; downgrade-write tolerance). **Adopted verbatim from the companion spec §5** — still fully required for sparse no-code editing and anti-FOUC; not re-specified here.

3. **What the single-source lens changes vs the companion spec's migration:** (a) `--color-surface-solid-*` is the _named source_, documented with its two projections, not a "float patch"; (b) the **CI guard prototype ships in A1a** (run against `HEAD`, allowlist enumerated), with the hard-gate switch flipped once clean; (c) `--cv-float-tint`/`--dv-*` re-chaining is folded into A1a so "every surface" is audited in one pass; (d) the status quartet gains `-fg`/`-border`, and the variant resolver is introduced in A1b behind the §3.6 hard gate.

4. **Why B was _not_ taken** (for the record, so it is not re-litigated): every `src/volt/*` and `src/components/ui/*` file would re-platform to PrimeVue styled mode, `@primeuix/themes` would be added, ADR-0002 would be reversed, and the AA generator retired. ADR-0003 records this so a future contributor cannot "just install `@primeuix/themes`."

---

## 5. Phased plan

Each sub-phase is one independently-shippable PR ending with CommandVue's **two-stage verification** (Stage 1 Playwright-MCP automated, binary pass/fail, screenshots to `.verification-screenshots/<branch>/`; Stage 2 human design review, 3–7 items). Token additions co-update `generate.ts` + `tokens.css` + `knownTokens.ts` + the LLM doc + its guard test in the **same PR** (CLAUDE.md doc-sync). Windowing changes (A2a) trigger the mandatory click-through. **The A1a→A3 critical path is identical to the companion spec; the single-source lens _adds_ enforcement, _renames_ the surface source, and _folds in_ the float-tint/`--dv-*` re-chain — it does not reorder.**

```
A1a ─► A1a.5 ─► A1b ─► A1c
 │       (keystone)
 ▼
A2a ─► A2b ─► A3
```

### A1a — Surface-seam fix + single-source guard prototype (FIRST)

**Goal.** Every Volt surface follows the active theme in both modes **and stays opaque inside floats**; kill the dead `--color-p-surface-*` namespace; **establish `--color-surface-solid-*` as the named source**; **re-chain `--cv-float-tint`/`--dv-*` to Tier-2**; **ship the CI single-source guard prototype (run against `HEAD`, allowlist enumerated, hard-gate flipped once clean).**
**Files.** `generate.ts` (emit `--color-surface-solid-*`, stop emitting `--color-p-surface-*`); `main.css:58-69` (rung→role table sourcing `-solid-*` + foreground); `tokens.css` (`-solid-*` defaults + dark, _outside_ the float-transparency selector; re-chain `--cv-float-tint` from `var(--color-slate-*)` → a Tier-2 surface role); `dockview.css` (re-chain `--dv-paneview-active-outline-color: var(--color-accent-500)` → `var(--color-border-accent)`; cross-ref comment; re-chain any other theme-blind `--dv-*`); `knownTokens.ts` (add `-solid-*`; **retain** `--color-p-surface-*` names as accepted-but-ignored until the v2 import upcast lands, per companion §3j); **new** `scripts/check-single-source.mjs` + CI wiring; `src/volt/*` (A2-full `:pt` rewrite — scope-gated fast-follow); docs (the three traps + the source/projection contract).
**Verification.** Stage 1: for each built-in + one generated theme, open a Volt Dialog and Menu, assert computed `background-color` equals resolved `--color-surface-solid-*`; toggle dark, re-assert; live-override the source token and assert recolor; **HARD GATE** — open a Volt Dialog/Menu _from inside a floating panel_ and assert opaque (`background-color` not `rgba(…,0)`); assert a float panel's active outline now follows a custom accent (the `--dv-*` re-chain); assert the guard fails on a planted `bg-green-100` **and** passes clean on `HEAD` (no false positives against the enumerated allowlist). Console errors/warnings = 0. Stage 2: dialog reads as "same app"? mid-ramp contrast preserved across 6 built-ins? float dialogs legible over imagery?

### A1a.5 — v2 data model + schema/DB bump (keystone)

**Goal.** `base + overrides + mandatory cache`, `resolve.ts`, schema 1→2, DB 2→3, full migration. **Adopted from the companion spec §3a/§3h/§3i/§5 unchanged.**
**Verification.** Upgrade a fixture DB (generated + imported + built-in-shaped) → every record renders pixel-identical; import a real v1 `.commandvue-theme.json` (with `--color-p-surface-*` keys) → succeeds (upcast-before-validate); reload with a generated custom theme active → **no unthemed first-paint frame**; downgrade-write survival round-trip (open at v3, write, reopen at v2 build, assert `base`/`overrides` survive). Console = 0.

### A1b — Status/toast unlock + the variant resolver

**Goal.** Hue-tunable success/danger/warning/info; severity-colored tags/toasts that follow the theme; **the full Chakra quartet incl. `-fg`/`-border`**; **the central variant resolver behind the §3.6 hard gate**. Byte-identical for the two pre-existing status keys when unset.
**Files.** `theme.ts` (`StatusFamilyOverride`/`StatusOverrides`); `generate.ts` (`const hues = {...STATUS_HUES, ...input.statusHues}`; `resolveStatusFamily`; emit `--color-status-{s}-fg` + `-border` + per-severity toast keys _when an override is present_; thread into `generatePairedVariant`); `tokens.css` (the **variant resolver `--sev-*` block** §3.6 + quartet/toast defaults as `var()` chains — single source, covers built-ins); `Tag.vue` (delete all four `green/sky/orange/red-100` literals — note `sky`/`orange` are off-palette today, so this also removes a latent off-theme bug → `var(--sev-*)`); `ui/Toast.vue` (`:pt` → `var(--sev-*)`; **wire only after the §3.6 Toast PT severity gate confirms the slot**); `knownTokens.ts`; `portableSchema.ts`; docs + guard test.
**Pre-commit hard gates (§3.6).** Confirm at runtime (1) which severity hook PrimeVue 4 applies to Tag/Toast in unstyled mode (attribute vs class), and (2) the Toast `message` PT severity surface — before wiring; fall back to a `severity`-keyed `:pt` map reading the same `--color-status-*` chain if neither hook emits.
**Verification.** Re-point `statusHues.danger` → assert `--color-status-danger` hue shifts and `-fg`/toast follow; fire one toast per severity → computed stripe = resolved status color; render a Tag per severity across 6 built-ins (screenshot-diff); assert **a _built-in_ renders a colored danger toast** (no generator path — only the `tokens.css` chain); no `contrastReport.failures` entry; the two pre-existing status keys are byte-identical with `{}`/`undefined` overrides; guard fails on a planted severity literal outside the resolver. Console = 0.

### A1c — Richer "less-flat" palette

**Goal.** Bevel + tiered colored borders + accent triad as themeable Tier-2 roles, adopted on a curated surface set. **Additive keys only — no existing key's math changes** (engine-stability, companion §3i), so migrated themes do not recolor.
**Files.** `generate.ts` (emit `--color-surface-bevel-{light,dark}`, `--color-border-accent`, `--color-interactive-glow` (alpha), `-dim`; composed `--shadow-bevel-{raised,sunken}`, `--shadow-accent-glow`); `tokens.css`; `knownTokens.ts`; curated adoption (panel headers/cards/primary Button → bevel; active panels → `--color-border-accent` via `--dv-paneview-active-outline-color`; focus → accent-glow); docs + guard test; `generate.spec.ts`.
**Verification.** Assert bevel/glow/border-accent present, gamut-valid (incl. the `oklch(L C H / a)` alpha string accepted by box-shadow/`color-mix`); screenshot card + active panel + focused button across light/dark **and inside a float** (bevel survives float transparency); engine-stability regression (migrate a v1 generated theme, assert `resolve()` output unchanged for all pre-A1c keys). **Guard asserts glow/bevel are `var()`/`color-mix` chains, never literals.** Console = 0.

### A2a — Theme Studio dockview panel

**Goal.** Authoring moves OUT of the modal INTO a floatable, pop-outable **singleton** panel that live-recolors the main window + every float + every pop-out on every edit, **including when the Studio itself is popped out**.
**Design.** §6 + companion §3e. The single decision that makes live-recolor free: the panel writes draft tokens to the **captured top-window root `APP_ROOT`**, never the pop-out child's `document`. Adopted from the companion spec §3e (apply primitives with explicit `root`; `data-theme-preview-applied`; draft session in the Pinia store; additive-first/clear-second no-flash ordering; rAF-coalesced observer).
**Verification.** Drag the contrast slider → opener `<html>` style updates; a second pop-out recolors; **pop out the Studio itself, drag a control → opener + a separate pop-out both update (HARD GATE — proves `APP_ROOT` not child)**; cancel → instant rollback everywhere; drag ~1s with 2 pop-outs → **zero frames with empty `--color-surface-base`** (no-flash); reload with Studio open → exactly one instance, no preview applied. Mandatory click-through. Console = 0.

### A2b — Per-token editor + advisory WCAG

**Goal.** A searchable, manifest-driven per-token editor (second Studio tab) writing sparse `overrides`, with live advisory WCAG incl. status/toast pairs.
**Design.** §6 + companion §3f. The manifest exposes the **full Tier-2 role set incl. the status quartet `-fg`/`-border` and toast pairs** (so the authoring contract — not just runtime — covers "everything"). The `tokenManifest` uniqueness test is **subsumed by the broader CI namespace guard** from A1a (§3.7 scan 2).
**Verification.** Filter, override `--color-surface-solid-raised`, assert the modified-dot, live app + pop-out recolor, WCAG chip recomputes against the effective paired value, reset reverts; override a Tier-2 status color → `status-fg`-on-`status-subtle` advisory chip computes; commit + reload → override persists, cache matches `resolve()`. Console = 0.

### A3 — Themeable duotone icons (LATER)

**Goal.** `--icon-tone-{primary,secondary,accent}` Tier-2 roles + an in-house ~12-icon duotone set + optional leading-icon affordance. Same single source; just more Tier-2 roles. Depends on A2. Adopted from the companion spec §3g unchanged.

**One cross-cutting workstream** (threaded through A1a + A1b + A2b, not a separate phase): the **single-source invariant guard** — literal scan + unknown-`--*` scan + the variant-resolver `--sev-*` allowlist + the emitted-key snapshot.

---

## 6. Theme Studio + per-token editor (the no-code authoring surface)

Grounded in the best-in-class admin customizers (Vuexy/Materio live customizers — preset swatches + free pickers + instant runtime recolor) and exceeding them with pop-out-aware live recolor and a per-token editor with advisory WCAG. **The machinery is the companion spec's §3e/§3f, adopted verbatim; only the authoring _vocabulary_ widens to the full Tier-2 role set.**

**Shell.** A **singleton** `theme-studio` dockview panel (category `tools`, icon `palette`), dual-registered (`panelRegistry.register` in `builtin.ts` + `app.component('theme-studio', …)` in `main.ts`, per dockview-vue 6). Floatable and pop-outable to a second monitor. Two tabs: **Create** and **Tokens**.

**Create tab (Tier-1 seeds — the "non-technical" path).** Base color + accent color via the hand-rolled `ui/ColorPicker.vue` (ADR-0002 exception; never `<input type=color>`); contrast `Slider` (30–100); mode `Select`; density `Select`; **a 4-swatch "Status colors" row** (hue-first, the visible A1b win); optional font `Select`; optional richness `Slider`s (bevel depth, glow alpha). Every change → `generateTheme` → `applyTokenOverrides(overrides, APP_ROOT)`. Preset swatch row (the Vuexy/Materio affordance) seeds common base/accent pairs.

**Tokens tab (per-token editor — "change ANY value").** Driven by `tokenManifest.ts` layered over `knownTokens.ts` (`{ name, section, label, kind, description?, contrastAgainst? }`). Library-first UI: filter box (`IconField` + `InputIcon` + `InputText`, fuzzysort over name+label+section); collapsible `Fieldset` per section (Surfaces, Borders, Text, Interactive, **Status quartet**, Toast, Focus, Accent scale, Bevel); per-kind controls (color → `ui/ColorPicker`, length/number → `InputNumber` + unit `Select` / `Slider`, font-stack → `Select`). Sections mirror the Tier-2 role set so "everything" is _visible_. Color values round-trip OKLCH via culori.

**Sparse capture.** A token whose value equals the resolved base is **not** an override (dropped); changing it captures it into `overrides`. Per-token reset deletes the key; per-section/panel "reset all" clear scoped/all.

**Advisory WCAG.** `wcagContrast` (culori) per `contrastAgainst` pair — _now including_ `status-{s}-fg`-on-`status-{s}-subtle` and `toast-fg`-on-`toast-bg`. Inline chip (green ≥ target, amber ≥3, red below), computed off the **debounced effective map**, **memoized per pair** (no forced reflow per keystroke). **Never blocks save** — single-source means you can recolor anything, including into low contrast; the chip _advises_, the operator decides.

**The live-recolor backbone (why it's free).** Edit in _any_ window → `applyTokenOverrides(overrides, APP_ROOT)` writes inline `--*` on the **captured top-window root** → Track B's `MutationObserver` (`style` filter, now rAF-coalesced) mirrors every `--*` to every pop-out → the whole constellation (main + floats + pop-outs, including the Studio's own pop-out) recolors in one frame. Draft session lives in the Pinia store (survives unmount/pop-out): `beginPreview` / `setPreviewToken` (debounced ~16–32ms at the DOM-write boundary) / `commitPreview` (additive-first, clear-second → no flash → `themeRepo`) / `cancelPreview` (re-apply committed, then clear preview → instant rollback everywhere).

**Excluded from the editable set** (or marked "pins the cascade"): `DENSITY_TOKEN_NAMES` and `--font-family-*` — they cascade from `data-density` and an inline override would pin them regardless of the attribute.

---

## 7. Open decisions (each with a recommended default)

1. **Guard teeth — hard CI gate or warn-level, and when to flip?** → **Prototype-first.** Build `scripts/check-single-source.mjs`, run against `HEAD`, enumerate the §3.7 allowlist (`color-mix in oklch`/`in srgb`, generator math, `tokens.css` `:root` defaults, `--cv-float-alpha` numerics, neutral elevation rgba), and only then flip to **hard gate (red build)** for `src/volt/**` + `src/components/ui/**` + theme CSS; warn-level elsewhere. Model the wiring on the existing `no-restricted-imports` datatable rule.
2. **Surface-source naming — `--color-surface-solid-*` or rename to `--color-elevation-*`?** → **Keep `-solid-*`** (lower churn vs the existing Volt occurrences) and add a one-paragraph "source vs projections" doc block. Re-document `--color-surface-*` + `--p-surface-N` as projections.
3. **Status quartet — full `{fill, subtle, fg, border}` now or `-fg`/`-border` later?** → **Now, in A1b.** The on-color is what makes severity Tags/Badges legible across arbitrary hues; retrofitting later re-touches Tag/Toast.
4. **Variant resolver form — CSS `var()` chains or a JS helper?** → **CSS chains in `tokens.css`**, keyed on **explicit `.p-*`/`[data-p-severity]` selectors** (not framework variant utilities), behind the §3.6 hard gate — survives unstyled mode and the pop-out stylesheet copy; readable from `:pt` strings.
5. **`--cv-float-tint` / `--dv-*` re-chain — fold into A1a or a separate PR?** → **Fold into A1a**, so "every surface" is audited in one pass. Screenshot-diff floats for the 6 built-ins (it _is_ a deliberate visual change — floats and active-panel outlines now follow custom themes). **Verified gap closed:** `--cv-float-tint` (tokens.css:468/518) and `--dv-paneview-active-outline-color` (dockview.css:52) are theme-blind today.
6. **Guard scope — also cover `src/components/panels/*` + chrome, or only the primitive layer?** → **Strict (hard) on primitive/wrapper/theme CSS; warn on panels** (panels legitimately use semantic utilities). Spot-check panels via the manifest, not the literal scan.
7. **Open ADR-0003?** → **Yes** — "Theme single source of truth — custom `--color-*` namespace, PrimeVue/Volt as derived consumer (Option C); PrimeVue styled preset (Option B) rejected on unstyled/styled mutual-exclusivity (verified quote) + loss of the AA generator, with own-surface coverage and template-genericity as secondary considerations." Permanently settles B so a future contributor cannot "just install `@primeuix/themes`."
8. **v2 model placement — folded into A1a or standalone A1a.5?** → **Standalone A1a.5** (adopted from the companion spec) so the CSS-only seam fix and the schema/DB migration are reviewed/reverted independently.
9. **A1a scope — A2-light only or +A2-full Volt rewrite?** → **A2-light (derivation + generator fix + `-solid-*`) as the core; A2-full `:pt` rewrite as a scope-gated fast-follow in the same PR.** The derivation is the safety net; the Volt rewrite is the true single-source fix (Volt becomes structurally identical to the already-correct `ContextMenu.vue`).
10. **Diff-into-overrides on upgrade — pixel-identical or live-against-engine?** → **Diff-into-overrides** (non-surprising upgrade), backed by the additive-only engine-stability contract.
11. **Engine-stability enforcement — convention + regression test, or a CI snapshot of every emitted key across a fixed input set?** → **Both** — the snapshot guard makes an accidental math change a red CI, not a silent recolor. This complements the literal/namespace guard.
12. **Studio panel — singleton or multiple drafts?** → **Singleton + focus-existing** (multiple instances race on the single `APP_ROOT`).
13. **PortableTheme cross-app contract — embed the resolved `tokens` cache alongside sparse `base`+`overrides`, and surface the status quartet `-fg`/`-border`/toast pairs in the export schema?** → **Yes to both** — a fork with a divergent engine still renders the original (static fallback), and an LLM/import author can set the on-colors so "everything themeable" holds through the _documented authoring contract_, not just at runtime.
14. **Accent-triad naming — `--color-interactive-glow/-dim` or a parallel `--color-accent-*`?** → **`--color-interactive-*`** (stays in the semantic vocabulary the wrappers already read; avoids minting a near-parallel namespace the guard would have to reason about).

---

## Comparison with the original spec (.internal/specs/track-a-theming.md)

The two specs are **not competing architectures** — they are the **same** architecture (Option C: CommandVue's custom `--color-*` namespace is the single authored source of color truth; PrimeVue/Volt is a mechanically-derived consumer) at two levels of doctrine. Verified against the live tree and PrimeVue's own docs: the dead-namespace seam is real (`grep "var(--color-p-surface" src/` → 0 reads; the live lever is single-`p` `--p-surface-*` hardcoded at main.css:58-69), `@primeuix/themes` is not installed (resolves to `undefined` in `package.json`), the app runs `unstyled: true` with no preset, and PrimeVue 4's styled preset engine is genuinely mutually exclusive with unstyled mode (_"In unstyled mode the css variables of the design tokens and the css rule sets that utilize them are not included"_ — confirmed via Context7 + direct fetch). So Option B is correctly rejected, and this edition argues that rejection with evidence the original leaves implicit.

| Dimension                          | EXISTING spec (`track-a-theming.md`)                                                                                                                                                                                           | THIS single-source edition                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**                   | Option C _in practice_ but never _named_: extends the custom `--color-*` graph, heals the seam via a `--p-surface-N` derivation in `main.css`. Three-tier model implicit.                                                      | Option C made **explicit and doctrinal** (§3.0). Names the 3 tiers (seeds → `--color-*` semantic → component projections), maps PrimeVue's primitive/semantic/component model onto the custom namespace. Same engine, same seam fix — _renamed and enforced_.  |
| **Single-source completeness**     | Heals the seam and introduces the float-immune `-solid-*` source. **Does NOT re-chain `--cv-float-tint` / `--dv-paneview-active-outline-color`** (verified theme-blind primitive refs at tokens.css:468/518, dockview.css:52). | Folds the `--cv-float-tint` + `--dv-*` re-chain into A1a (Open Decision 5) — closes a verified gap. Adds status `-fg`/`-border` quartet. **Marginally more complete** on "every surface."                                                                      |
| **Seam elimination**               | Identical core mechanism (A2-light derivation + A2-full Volt `:pt` rewrite; `-solid-*` float-immune source).                                                                                                                   | Identical mechanism. Adds a **CI guard** so the seam cannot regrow — the real differentiator.                                                                                                                                                                  |
| **No-code / everything-themeable** | Theme Studio dockview panel, per-token editor, advisory WCAG, sparse overrides. Meets the bar.                                                                                                                                 | Same Studio + editor (adopted verbatim) + a Create-tab status-swatch row + the variant resolver making severity components themeable from one place. Slightly richer authoring; same machinery.                                                                |
| **Migration cost / risk**          | Fully specified: v2 model, schema 1→2, DB 2→3, diff-into-overrides, upcast-before-validate, downgrade-write tolerance, engine-stability contract.                                                                              | **Identical** (adopted verbatim from companion §3a/§3h/§3i/§5). Adds the CI guard (tuned vs `HEAD` first to avoid spurious red) + a status-quartet retrofit touching Tag/Toast. Net new risk: **small** (guard false-positives, mitigated by prototype-first). |
| **PrimeVue alignment**             | Correctly stays unstyled+Volt; doesn't engage the native preset engine.                                                                                                                                                        | Explicitly evaluates and **rejects** Option B with a verified citation (unstyled omits design-token CSS vars). Honors PrimeVue's 3-tier _model_, rejects its _engine_. **Better-argued, same outcome.** Corrects the "three modes" claim to two.               |
| **Phasing**                        | A1a → A1a.5 → A1b → A1c → A2a → A2b → A3.                                                                                                                                                                                      | **Identical critical path.** Adds the guard as a cross-cutting workstream; folds the re-chain into A1a.                                                                                                                                                        |
| **Effort**                         | Baseline (6 phases, well-scoped).                                                                                                                                                                                              | Baseline **+ CI guard tuning + status `-fg`/`-border` + `--cv-float-tint`/`--dv-*` re-chain + ADR-0003**. ~1.1–1.2×. No re-platform.                                                                                                                           |

### Recommendation

**MERGE — do not choose one.** This edition is a governance-and-completeness overlay, not a rival. By design it adopts the v2 data model, migration, Theme Studio, per-token editor, anti-FOUC cache contract, engine-stability contract, and the A1a→A3 critical path **verbatim** from the original. Its genuine net contribution is four things:

1. **The single-source CI guard (§3.7)** — the only mechanism in either spec that makes the seam un-regrowable by a future contributor, and the only thing that delivers the maintainer's _"now and forever."_ The original answers _"now"_; this answers _"forever."_ Ship it **prototype-first**: build it, run against `HEAD`, enumerate the real allowlist (`color-mix in oklch`, generator math, `tokens.css` defaults, `--cv-float-alpha` numerics, neutral elevation rgba), and **only then** flip the hard gate. This is the original's Open Decision 17 expanded.
2. **ADR-0003** settling Option C vs B permanently, with the verified mutual-exclusivity citation. The original never writes this ADR; it should.
3. **The `--cv-float-tint` / `--dv-*` re-chain folded into A1a.** Closes a verified gap (float glass + active-panel outline are theme-blind today). Cheap, high-value, belongs in A1a's "every surface in one pass."
4. **The status `-fg`/`-border` on-color quartet + the central variant resolver**, behind the §3.6 **hard verification gate** (confirm the PrimeVue 4 severity hook _and_ the Toast PT severity surface emit in unstyled mode before wiring; fall back to a `severity`-keyed `:pt` map on the same `--color-status-*` chain if not).

**Keep from the original unchanged:** the entire v2 data model, migration strategy, Studio panel, per-token editor, anti-FOUC cache contract, engine-stability contract, and the A1a→A3 critical path — there is nothing to reconcile.

**Corrections applied in this edition** (carried into the merged artifact): "three modes" → **two** (styled + unstyled); the Option-B rejection rests on **(1) mutual exclusivity** and **(3) loss of the AA generator**, with own-surface coverage and template-genericity demoted to secondary considerations; the variant resolver keyed on **explicit `.p-*`/`[data-p-severity]` selectors**, not unverified `tailwindcss-primeui` severity variants; the byte-identity claim scoped explicitly to the **two pre-existing status keys** (the new `-fg`/`-border` are additive).

**The right end-state is one spec:** the original `track-a-theming.md` plus a "§3.0 single-source doctrine + §3.7 CI guard + ADR-0003 + status-fg/border + variant resolver + float-tint/`--dv-*` re-chain" section — i.e. this document's net-new content folded in. Adopting this edition as a wholesale replacement would needlessly re-present ~80% of work that is already correct.
