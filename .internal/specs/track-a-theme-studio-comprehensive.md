# Track A — Comprehensive Dynamic Theming (Theme Studio v2)

> Status: **Draft for maintainer review.** Owner: Lead Architect. Supersedes the
> later phases of `track-a-theming.md` (A2b onward) and absorbs the Studio-IA
> notes from `track-a-post-a1b-ux-systems.md`. Builds on the **shipped** v2 data
> model (A1a.5), the live-preview engine (A2a-1), and the Theme Studio panel
> (A2a-2). Nothing here re-litigates the settled Option-C architecture.
>
> **Why this doc exists.** The Theme Studio was built bottom-up (panel → live
> preview → polish), and maintainer testing has surfaced a series of "this should
> be themeable too" asks (dockview chrome, raised/blur panels, Google fonts, font
> sizes, per-control density). Patching them one PR at a time is the wrong shape.
> This spec plans the **whole** dynamic-theming surface up front so the remaining
> work ships as a few coherent phases against one agreed design.

---

## 1. Goal

A CommandVue user can change **anything visual** — color, type, spacing, borders,
radii, shadows, blur, panel chrome — for the whole app and every pop-out, live,
from one **Theme Studio** panel, and save it as a portable theme. The guiding
principle: **every design property the app paints is a token; the Studio surfaces
every token; new visual capabilities are added as new token families, never as
hardcoded component values.** The single-source CI guard already enforces the "no
raw values in the UI layer" half of that contract.

Two control layers (already the design):

- **Generate** — a handful of high-level inputs derive a complete, AA-safe,
  gamut-mapped theme. "A good theme fast." (Shipped: A2a.)
- **Tokens / per-area editors** — change any individual token / capability. "Change
  anything." (This spec.)

---

## 2. What already exists (the foundation — do not rebuild)

| Piece               | Where                                                                                                                                           | Gives us                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| v2 data model       | `types/theme.ts` — `base` + sparse `overrides` + resolved `tokens` cache                                                                        | Per-token overrides are first-class + persisted (A1a.5).                                             |
| Token allowlist     | `modules/themes/knownTokens.ts` (~90 names)                                                                                                     | The contract for "what is themeable."                                                                |
| Live-preview engine | `stores/theme.ts` (`previewThemeTokens` / draft session), `modules/themes/apply.ts` (`applyTokenOverrides` on `APP_ROOT`), `usePopoutThemeSync` | Any token override applies live to every window (A2a-1).                                             |
| Theme Studio panel  | `components/panels/ThemeStudioPanel.vue` + `composables/useThemeAuthoring.ts`                                                                   | The host: common band + resizable controls │ preview + footer (A2a-2).                               |
| Generator           | `modules/themes/generate.ts` (OKLCH, AA solver)                                                                                                 | Derives the color system from base/accent/contrast/mode.                                             |
| Tokens stylesheet   | `assets/styles/tokens.css` (3-layer: primitive → semantic → component)                                                                          | The cascade every consumer reads.                                                                    |
| Dockview tokens     | `assets/styles/dockview.css` (`--dv-*` → `--color-*`)                                                                                           | Panel chrome already partly follows the theme (borders, active outline).                             |
| Presets             | `modules/presets/*`, `stores/preset.ts`                                                                                                         | Typed bundles of visual config **applied per-panel** — the natural vehicle for per-panel appearance. |

---

## 3. Capability areas (the new scope)

Each area = a Studio tab + a token family + (where needed) a generator input and a
small runtime. **Everything is additive** to the v2 model — no schema bump unless a
new _generation input_ is introduced, in which case it rides `base.input` (the v2
model already versions that).

### A. Per-token editor (the "Tokens" tab) — was A2b

A manifest (`modules/themes/tokenManifest.ts`) layered over `knownTokens`: every
token gets `{ section, label, kind, contrastAgainst? }`. Searchable list grouped by
section; per-`kind` control (color → `ui/ColorSwatchPicker` with custom-any-color,
length/number → `InputNumber` + unit, font-stack → `Select`, shadow → text).
Editing writes a sparse `override` (live + persisted). Advisory WCAG chips. This is
the literal "change any of the ~90 tokens" surface. **Curated swatches become
optional presets, not limits** — every picker already supports a custom value.

### B. Typography — sizes, families, **Google Fonts**

The biggest net-new runtime. Three sub-capabilities:

1. **Font families per role** — `--font-family-body / -sans / -mono / -heading`
   (heading is new). Already overridable; just needs role rows in the Studio.
2. **Type scale (font sizes)** — today `--text-xs … -4xl` are fixed primitives. Make
   them themeable via a **scale generator input**: `{ baseSize, ratio }` (e.g.
   16px × 1.2 modular scale) → derives the whole `--text-*` ramp. New
   `GenerationInputV2.typeScale?`; emitted tokens are the existing `--text-*` names
   (additive-only contract holds — they become generated rather than fixed). Plus a
   manual override path in the Tokens tab.
3. **Google Fonts (dynamic load)** — a font **picker** that searches the Google
   Fonts catalog and loads any family at runtime:
   - **Loading:** inject (and de-dupe) a `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=<Family>:wght@…&display=swap">`
     into the top realm; mirror the link into pop-outs (extend `usePopoutThemeSync`
     to copy a registered set of font `<link>`s, not just `<html>` state). Then set
     `--font-family-body` (etc.) to `"<Family>", <fallback>`.
   - **Persistence:** the theme stores `{ family, source: "google" | "system" | "stack", weights }`. On apply, a `useFontLoader` composable ensures the link exists before paint (with a system fallback so there's no FOUT-to-broken).
   - **Catalog:** ship a bundled snapshot of the Google Fonts family list (name + category + variants) under `src/assets/fonts/google-catalog.json` so the picker works **offline** and without an API key; "load on demand" fetches the actual font files from Google only when a family is chosen and the network allows. Offline → the picker still lists families but shows "needs network" and falls back to the system stack.
   - **Security:** allowlist the family-name charset; only `fonts.googleapis.com` / `fonts.gstatic.com` origins; document the CSP additions (`font-src`, `style-src`) in `docs/deployment.md`. No arbitrary URL injection.
   - **Open decision:** bundle the woff2s for a curated ~12 "offline-safe" families vs. always-network for Google. _Recommended: curated offline set + opt-in network for the full catalog._

### C. Panel & dockview chrome — borders, radii, shadows, **raised / glass**

The maintainer wants per-panel control: some panels bordered + rounded, some raised
(shadow), some glass (backdrop-blur). Model it as **appearance variants**, themed
centrally, assigned per-panel.

- **Themeable dockview tokens (new):** `--dv-panel-radius`, `--dv-panel-border-width`,
  `--dv-panel-shadow`, `--dv-panel-gap`, plus tab-strip tokens. Wire them in
  `dockview.css` off `--color-*` + the A1c bevel/shadow tokens so a recolor carries.
- **Panel appearance variants (new token-driven set):** define a small closed set —
  `flat` (no border/shadow), `bordered` (border + radius), `raised` (border +
  `--shadow-bevel-raised` / `--shadow-md`), `glass` (translucent bg via the existing
  float `color-mix` + `backdrop-filter: blur(var(--panel-blur))`). Each variant is a
  CSS class (`.dv-appearance-raised`, …) whose values come entirely from theme
  tokens, so the **theme** controls what "raised" looks like.
- **Assignment — reuse the Preset system, don't reinvent it.** A new built-in
  preset type `panel-appearance` (config `{ variant }`) applies the class to a
  panel via the existing `applyToPanel` runtime (`stores/preset.ts`,
  `panel-instance registry`). So: the **theme** defines the variants' look; a
  **preset** (per-panel, per-workspace) chooses which panel is raised/glass/etc.
  This cleanly separates "how raised looks" (theme) from "which panels are raised"
  (preset/workspace) and uses machinery that already ships.
- **Blur caveat:** `backdrop-filter` is GPU-cost + not free over the map; gate glass
  behind an explicit opt-in + a perf note. Floats already establish the transparency
  precedent (`dockview.css`), so this extends a known pattern.

### D. Effects — shadows, glow, bevel (extend A1c)

A1c already shipped `--color-surface-bevel-*`, `--color-interactive-glow/-dim`,
`--shadow-bevel-*`, `--shadow-accent-glow`. Extend with a themeable elevation scale
(`--shadow-1..5` driven by a depth knob) and expose all of them in an **Effects**
tab (sliders for shadow strength / glow alpha / blur radius). All foreground-class
(border/shadow/filter), so they survive the float-transparency override.

### E. Density & the Studio's own chrome (resolves the reported `sm`-button issue)

Decision to make explicit here: **the Studio's editor controls reflect the
authored theme** when "Live across app" is on (its `md` controls already re-space
with density; `sm` buttons don't, by the deliberate fixed-`sm` decision). Options:
(1) leave `sm` fixed and accept that toolbar-style buttons don't track density
(consistent with the rest of the app); (2) add a density-aware `sm` variant for use
inside dense editor chrome; (3) give the Studio a fixed "comfortable" chrome
regardless of the authored density (editor stability > self-reflection). _Recommended:
(3) — the editor stays stable and legible; only the **preview** reflects the authored
density. The current half-and-half (some controls track, some don't) is the actual
bug, and (3) removes the inconsistency._ Revisit `sm` density only if a real dense
editor surface needs it.

---

## 4. Theme Studio information architecture (the tabs)

Per the maintainer rule: **common controls pinned on top, outside the tabs.**

```
┌ Header: title · "Live across app" toggle ───────────────────────────┐
├ COMMON band: Start-from · Name · Description ───────────────────────┤
├ L1 tabs (controls pane) ─────────────┬ Live preview (resizable) ────┤
│  Generate · Tokens · Typography ·    │  scoped sample, always on     │
│  Panels & Chrome · Effects           │                               │
├ Footer: Discard · Save ─────────────────────────────────────────────┤
```

- **Generate** holds the curated high-level inputs (today's Mode/Palette/Status/
  Contrast). **Tokens** is the manifest per-token editor. **Typography**, **Panels
  & Chrome**, **Effects** are the new areas above. The `tokenManifest.section`
  field is the single source for both the Generate sub-groupings and the Tokens
  sections (drift guard in `tokenManifest.spec`).
- Tabs use the locked `ui/Tabs` wrapper. The resizable `Splitter` (controls │
  preview) and the preview pane stay outside the tabs.

### 4.1 Shared control — the **scrollable tab strip** (`ui/Tabs scrollable`)

Maintainer ask (2026-06-04): tab strips must **not wrap to multiple lines** when
they outgrow the available width. Instead the strip stays a **single row** and
gains **left/right scroll-arrow buttons** that horizontally scroll the tabs into
view. This is a **reusable control with one name**, used everywhere tabs can
overflow — the Studio's L1 tabs, the showcase Navigation demos, and the app's own
navigation/dock tab strips (Track B) — so a consumer opts in identically each time.

- **Name / API:** a `scrollable` boolean (+ optional `scrollButtons`, default on
  when scrollable) on the existing **`src/components/ui/Tabs.vue`** wrapper —
  `<Tabs scrollable> … </Tabs>`. PrimeVue 4 Tabs ships exactly this affordance
  (`scrollable` keeps `TabList` to one row and renders prev/next nav buttons);
  the wrapper styles those buttons via `:pt` to the project tokens (left/right
  chevron `IconButton`s pinned to the strip ends, fade/disable at the extremes).
  Library-first: do **not** hand-roll the overflow math — extend the Tabs wrapper.
- **Default:** today `ui/Tabs` wraps; flip overflow behaviour to "scroll, not
  wrap" wherever a horizontal strip is used. Keep `wrap` available as the explicit
  opt-out for the rare strip that genuinely wants to wrap.
- **Reuse contract:** the same `<Tabs scrollable>` (and, where a strip is built
  from segmented buttons rather than `TabList`, a matching
  `ScrollableStrip`/overflow-scroll utility with the **same name + arrow
  affordance**) is the single shared pattern. The navigation strip in Track B's
  dock header and the Studio L1 tabs both consume it — no per-site reinvention.
- This is a **Track-B-adjacent shared primitive**; sequence it early (it's a small
  `ui/Tabs` enhancement) so both the Studio tabs (C6/IA) and the dock navigation
  can adopt it. Verify the PrimeVue 4 `scrollable` Tabs PT surface via Context7
  before wiring the button styling.

---

## 5. Data-model & file strategy

- **No new persisted-record schema** unless a new _generation input_ lands; those
  ride `base.input` (`GenerationInputV2`) and bump nothing extra (the v2 model
  versions `base.input` already). New inputs anticipated: `typeScale?`,
  `fontSpec?` (family + source + weights), maybe `chrome?` (panel radius/border
  defaults). Per-token edits stay in `overrides`.
- **New token families** → `tokens.css` (defaults, as `var()`/`color-mix` chains so
  built-ins inherit), `knownTokens.ts` (allowlist), `generate.ts` (emit the
  theme-dependent ones), `tokenManifest.ts` (label/kind/section), the LLM doc +
  guard test — all in the same PR (doc-sync rule). §3i engine-stability holds:
  additive keys only; changing an existing key's math bumps `ENGINE_VERSION`.
- **New runtimes** (isolated, testable): `useFontLoader` (Google Fonts),
  `panel-appearance` preset type, a `typeScale` deriver. Each is unit-testable
  without the UI.
- **Portability:** the `fontSpec` (incl. Google family + weights) must travel in
  the exported theme JSON so a re-import re-loads the font. Extend the v2 portable
  schema accordingly (additive, optional).

---

## 6. Phasing (each independently shippable, ends with the 2-stage verification)

1. **C1 — Tokens tab (per-token editor).** The A2b manifest editor; the "change
   anything" core. Unlocks editing for every existing token.
2. **C2 — Typography: families + type scale.** Role rows, the `typeScale` generator
   input, the Tokens-tab typography section. No network yet.
3. **C3 — Google Fonts.** `useFontLoader`, the catalog picker, pop-out font
   mirroring, portability, CSP docs. The riskiest external integration; isolate it.
4. **C4 — Panels & Chrome.** Dockview chrome tokens + the appearance variants +
   the `panel-appearance` preset type (theme defines the look, preset assigns it).
   Windowing change → mandatory click-through.
5. **C5 — Effects.** Elevation scale + glow/blur sliders; extends A1c.
6. **C6 — Studio chrome/density resolution + IA polish.** Lock the tab IA, resolve
   §3E (editor stays "comfortable"; preview reflects density), responsive Splitter.

Order rationale: C1 is the highest-leverage "change anything" win and uses only
shipped machinery. C2→C3 build typography network-last. C4 is the novel
theme×dockview×preset intersection — spec it tightly before building. C5/C6 polish.

---

## 7. Open decisions for the maintainer

1. **Google Fonts:** curated offline woff2 set + opt-in network for the full
   catalog, or always-network? _(Rec: curated offline + opt-in network.)_
2. **Panel appearance:** theme-defines-variant + preset-assigns-per-panel (reusing
   Presets), or a simpler per-group theme setting? _(Rec: theme defines, preset
   assigns.)_
3. **Glass/blur:** ship it (with a perf gate), or defer until a perf budget is set?
4. **Type scale:** modular-ratio knob (baseSize × ratio) or per-step manual sizes,
   or both? _(Rec: ratio knob in Generate + per-step override in Tokens.)_
5. **Studio chrome vs authored density:** §3E option (1)/(2)/(3)? _(Rec: (3) —
   stable editor, preview reflects density.)_
6. **Track naming:** keep these under Track A (theming) as phases C1–C6, or split a
   new "Track C — Theme Studio" so the windowing-adjacent panel work (C4) is
   tracked separately from pure theming? _(Rec: keep under Track A; C4 cross-links
   Track B.)_

---

## 8. Non-goals / guardrails

- No new UI library; PrimeVue (unstyled) + Volt + Tailwind v4 only. The font picker,
  tabs, pickers are all existing primitives.
- No arbitrary remote CSS/JS injection — Google Fonts is the only external origin,
  origin- and charset-allowlisted.
- No per-token math that silently recolors existing themes (engine-stability §3i).
- The token allowlist stays the security boundary; "everything dynamic" means
  "everything the app paints is a token surfaced in the Studio," not "inject
  arbitrary CSS."
