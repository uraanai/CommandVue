---
name: commandvue-theming-system
description: Use when working with design tokens, theming (light/dark/auto), density modes, theme variants, or any visual style change that should propagate across components.
when_to_use: |
  - Editing src/assets/styles/tokens.css
  - Editing src/assets/styles/main.css
  - Touching the useTheme composable, theme store, or theme registry
  - Adding or modifying built-in theme variants (Phase 3.3)
  - A component needs a color/spacing/typography value and you're tempted to hardcode it
  - Adding density-aware behavior to a component
  - Anyone says "theme", "tokens", "design tokens", "dark mode", "light mode", "density", "compact", "spacious"
---

# CommandVue Theming System

> **PrimeVue-first reminder:** components consume tokens via Tailwind utility classes (`bg-surface`, `text-fg`, `border-border-default`) or via PrimeVue/Volt PT passthroughs. Never hardcode hex/OKLCH/rgb values in components. See [`docs/design-tokens.md`](../../../docs/design-tokens.md) for the full catalogue.

## The three things to know first

1. **Three-layer architecture.** Primitive (raw scales) → Semantic (meaning-based) → Component (component-specific). Components consume semantic + component tokens. Themes override semantic + component tokens. **Primitives are off-limits to themes.**

2. **All tokens live in `src/assets/styles/tokens.css`.** Primitives go in `@theme { … }`. Semantic + component go in `:root { … }`. Dark overrides go in `html[data-theme="dark"] { … }`. Density overrides go in `[data-density="compact"] { … }` / `[data-density="spacious"] { … }`.

3. **Tailwind v4 `@theme` bridge in `main.css`** exposes semantic tokens as utility classes. A change to a semantic token in `tokens.css` propagates to every utility consumer without component edits.

## Token vocabulary cheat sheet

| Need                      | Use                                                  |
| ------------------------- | ---------------------------------------------------- |
| Page background           | `bg-surface`                                         |
| Card background           | `bg-surface-raised`                                  |
| Dialog/popover            | `bg-surface-overlay`                                 |
| Hovered row               | `bg-surface-sunken`                                  |
| Body text                 | `text-fg`                                            |
| Secondary text            | `text-fg-muted`                                      |
| Faint text                | `text-fg-faint`                                      |
| Disabled text             | `text-fg-disabled`                                   |
| Primary link/button fill  | `bg-interactive` (`text-on-interactive` on top)      |
| Hover state               | `bg-interactive-hover`                               |
| Subtle selected fill      | `bg-interactive-subtle`                              |
| Card border               | `border border-border-default`                       |
| Hairline divider          | `border-border-subtle`                               |
| Section separator         | `border-border-strong`                               |
| Success badge             | `bg-success-subtle text-success`                     |
| Warning badge             | `bg-warning-subtle text-warning`                     |
| Danger badge              | `bg-danger-subtle text-danger`                       |
| Focus ring                | `focus-visible:ring-2 focus-visible:ring-focus-ring` |
| Inter font (default body) | `font-sans`                                          |
| JetBrains Mono            | `font-mono`                                          |
| Fade-in animation         | `animate-fade-in`                                    |

## Density-aware components

When a component should respond to compact / comfortable / spacious modes, read `--density-*` CSS variables — never tie to a fixed size.

```vue
<template>
  <div
    class="border-border-subtle bg-surface border"
    :style="{ height: 'var(--density-row-height)', fontSize: 'var(--density-font-size)' }"
  >
    Row content
  </div>
</template>
```

For Tailwind-only consumers, the row-height tokens are available as inline `style` references. Density tokens are not (yet) bridged to Tailwind utilities — that's deliberate, because `[data-density]` is dynamic at runtime.

## The dark mode contract

- `useTheme()` (composable, `src/composables/useTheme.ts`) owns `data-theme` on `<html>`.
- Dark overrides live under `html[data-theme="dark"] { … }` in `tokens.css`. They override **semantic + component tokens**, never primitives.
- Tailwind's `dark:` variant resolves on `[data-theme="dark"]` (via `@custom-variant` in `main.css`). `dark:bg-surface-raised` works, but in most cases you don't need it because the semantic token already flips automatically.

## Three-way theme toggle (Phase 3.2)

Modes: `light` / `dark` / `auto`. Auto follows `prefers-color-scheme` and re-resolves live on OS change. Cycle order: `light → dark → auto → light`.

**Persistence is dual-write:**

- `appMetaRepo` (IDB) is authoritative under key `commandvue:theme`. Stores the _mode_.
- `localStorage` mirrors the _resolved_ theme (light|dark) for the anti-FOUC inline script in `index.html`.

**Bootstrap:** `initializeTheme()` is called from `main.ts` once before `app.mount()`. Hydrates the in-memory mode ref from IDB, wires the matchMedia listener, applies the resolved theme. The anti-FOUC script in `index.html` runs first synchronously to avoid a flash.

**Accessibility:** `useTheme().setMode()` announces via a visually-hidden `aria-live="polite"` region (`#commandvue-theme-announce`).

Full reference: [`docs/design-tokens.md → Theme toggle`](../../../docs/design-tokens.md). Tests: `tests/unit/composables/useTheme.spec.ts`.

## Built-in theme variants (Phase 3.3)

Six bundled themes under `src/assets/themes/*.json` — `compact-light`, `compact-dark`, `command-center-light`, `command-center-dark`, `admin-panel-light`, `admin-panel-dark`. Each overrides 30-50 semantic + component tokens; primitives stay constant.

**Registry:** `src/modules/themes/registry.ts` — singleton (`themeRegistry`). `register`, `unregister`, `get`, `list`, `listBuiltIn`, `listByMode`, `subscribe`. Built-in registration via `registerBuiltinThemes()` in `src/modules/themes/builtin.ts`, called once from `main.ts` before mount.

**Application engine:** `src/modules/themes/apply.ts` — `applyTheme(theme)` writes `--{key}` inline styles on `<html>`, tracks applied keys in `data-theme-applied` for clean teardown on the next swap, and sets the three identity attributes (`data-theme-id`, `data-theme`, `data-density`). `clearTheme()` removes overrides + identity attributes but preserves `data-theme` (owned by `useTheme`).

**Store:** `src/stores/theme.ts` — `useThemeStore()` with `currentThemeId`, `loadInitial(workspaceId)`, `setTheme(id, workspaceId?)`, `setWorkspaceTheme(workspaceId, id, activeId)`, `clearWorkspaceTheme(workspaceId, activeId)`. Precedence: workspace-bound > global pointer > `compact-light` fallback. Persisted via `appMetaRepo` (keys `commandvue:theme-id` and `commandvue:workspace-theme-{wsId}`).

**Variant pairing (Prompt 4 Phase F):** `bridgeVariant` in `useTheme.ts` runs after `setMode()` writes `data-theme` and has two precedence rules:

1. **`generation.paired`** — generated / imported themes carry an explicit cross-link to their opposite-mode counterpart. If the paired theme's `mode` matches the resolved mode, swap to it via `themeStore.setTheme()`. Works regardless of id format (ULIDs, suffix-less names, anything).
2. **`-light` / `-dark` suffix swap** — the Prompt 3 fallback for bundled built-ins (`compact-light` ↔ `compact-dark`). Only fires when generation.paired didn't.

If neither produces a paired theme, the bridge no-ops gracefully — `data-theme` is still flipped by `applyResolved`, so the dark-mode CSS rules in `tokens.css` (`html[data-theme="dark"]` overrides) take effect; the user just doesn't lose their chosen aesthetic.

**Workspace integration:** `useSessionStore.switchWorkspace()` calls `themeStore.loadInitial(workspaceId)` after `workspaceStore.setCurrentWorkspace()` so the new workspace's bound theme applies before the layout's panels mount.

**Picker:** `src/components/dialogs/ThemePickerDialog.vue` — Volt Dialog with one card per registered theme. Swatches resolved at render time via a hidden helper element so `var()` references collapse to concrete colors.

Full reference: [`docs/themes.md`](../../../docs/themes.md). Tests: `tests/unit/themes/registry.spec.ts`, `tests/unit/themes/apply.spec.ts`.

## Custom theme registry (Prompt 4 Phase C)

The registry now holds **both** the six built-ins **and** any custom themes (`user` / `imported` / `generated`) persisted in IndexedDB via `themeRepo`. Same singleton, same `subscribe()` — no UI surface has to know whether a theme came from JSON or from a user's IndexedDB profile.

**Boot sequence** (`src/main.ts`): `registerBuiltinThemes()` runs first so built-ins own their canonical ids, then `await themeRegistry.loadFromRepo(() => themeRepo.getAll())` hydrates custom themes. The fetcher is passed in (not imported by the registry) to keep `registry` storage-agnostic and avoid a circular import.

**Runtime sync** — `themeRepo.create / update / delete` each call `themeRegistry.unregister(id) + register(theme)` (or `unregister` for delete) so picker subscribers see the new state without a reload. Idempotent — safe even if the registry already holds the id.

**New registry methods on top of Phase 3.3:**

- `loadFromRepo(fetcher)` — async hydration; skips ids already registered (built-ins win).
- `listCustom()` — everything that isn't `source: "built-in"`.
- `listGenerated()` — only `source: "generated"` (engine output, Phase B).
- `listImported()` — only `source: "imported"` (Phase D / G).
- `listBuiltIn()` + `listByMode()` unchanged from Phase 3.3.

**Picker UI** — `ThemePickerDialog.vue` groups cards by source: **Built-in** / **Generated** / **Imported** / **Custom**. Empty groups are hidden, so the picker stays compact until the first custom theme exists. Behaviorally identical to Phase 3.3 — Apply + workspace-binding + swatches all work the same.

Tests: `tests/unit/themes/registry.spec.ts` (filters + `loadFromRepo`), `tests/unit/storage/themeRepo.spec.ts` (CRUD↔registry sync).

## Theme import / export (Prompt 4 Phase D)

The file-I/O core for theme portability. No UI in this phase — the Phase G import dialog and the per-card "Export…" menu both consume these functions.

- **`src/modules/themes/portableSchema.ts`** — Zod schemas (`TokenValueSchema`, `TokenNameSchema`, `ThemeSchema`, `PortableThemeSchema`) for structural validation. Token names are validated against the `knownTokens` allowlist; values are length-bounded and filtered for `<script` / `javascript:` / `expression(` / HTML-like injection vectors.
- **`src/modules/themes/import.ts`** — `importThemeFromJson(jsonText, options?)` → `ImportResult`. Flow: JSON parse → explicit `schemaVersion` check (clearer error than Zod literal mismatch) → Zod validate → ID-conflict resolution → **force `source: "imported"`** (provenance always reflects the import event, even if the file claimed `user` or `generated`; the `generation` block carries through so a re-imported generated theme stays editable) → `themeRepo.create` (which re-runs the 8 invariants as defense-in-depth and syncs `themeRegistry` via Phase C).
- **Conflict policies** — trigger on **either** an id match OR a name match within `source: "imported"` (since `themeRepo` invariant 2 is name-unique-within-source). `abort` (default; returns `conflictWithExistingId` pointing at the colliding record), `rename` (mint fresh ULID + iteratively suffix the name " (Imported)" / " (Imported 2)" / … until unique), `replace` (delete whichever record(s) collide — by id and/or name — and create the imported one).
- **Non-ULID ids auto-mint with a warning.** Storage requires ULIDs (`themeRepo` invariant 1) but imported files often use friendly ids like `"my-cool-theme"`. Import silently reassigns to a fresh ULID and surfaces the change via `warnings`, so any JSON the schema accepts "just works". Auto-mint runs before the conflict check (a non-ULID id can't collide with anything stored).
- **`src/modules/themes/export.ts`** — `exportThemeToJson(theme)` wraps a Theme in the PortableTheme envelope (`schemaVersion: 1`, `exportedBy: "commandvue"`, `exportedByVersion` from `package.json`). `buildExportFilename(theme)` produces `<slug>.commandvue-theme.json`. `downloadThemeFile(theme)` triggers a browser download via a hidden `<a>` click. Filename slug rules: lowercased, non-alphanumeric runs collapsed to single hyphens, leading / trailing hyphens trimmed, fallback to `theme` for empty / punctuation-only names.

Tests: `tests/unit/themes/portable.spec.ts` (17 cases — pure export logic, filename builder, invalid JSON, unsupported schema version, unknown token, `<script>` injection, source coercion, all three conflict policies, round-trip, registry sync).

## Theme customizer dialog (Prompt 4 Phase E)

The Linear-style authoring surface — 3–4 high-level inputs, live preview, save creates a new generated theme.

- **`src/components/dialogs/ThemeCustomizerDialog.vue`** — opened from `View → Create new theme…` (blank) or `View → Edit current theme…` (pre-fills from the active theme's `generation` block; only enabled when `themeStore.currentTheme.source === "generated"`). Save **always creates a new theme** — even in edit mode the original is untouched, so the pre-fill pattern is intentionally "duplicate to edit".
- **`src/components/ui/ColorSwatchPicker.vue`** — OKLCH-typed sibling of `ColorPicker.vue` (which stays hex-typed for operational use). Round swatch grid + optional native `<input type="color">` popover that converts hex → OKLCH on change. Used by the customizer for base + accent inputs.
- **`src/modules/themes/curated-swatches.ts`** — 10 base swatches (near-neutral with a whisper of tint, sitting in the engine's surface-base lightness band) + 10 accent swatches (mid-lightness mid-chroma, covering the hue wheel) + 6 curated font stacks. Picking from the grid lands the user in the engine's sweet spot; custom picks still go through the engine's clamp + gamut mapping.
- **Inputs:** name, optional description, mode (Light / Dark), base color, accent color, contrast slider (30–100), density (Compact / Comfortable / Spacious), font family, "Generate paired variant" checkbox, "Apply after saving" checkbox.
- **Live preview** — scoped `<div>` with all generated tokens written as inline custom properties; nested mini-app sample (menubar, telemetry rows, status badges, sample buttons, text hierarchy) reads via `var(--color-*)` so the preview never bleeds the generated tokens into the rest of the app. Contrast report below the preview surfaces the three headline ratios + any failures with pass/fail color.
- **Paired variant flow** — when the checkbox is on, save creates the primary theme, generates + creates the opposite-mode variant with `generation.paired` pointing at the primary, then backfills the primary's `generation.paired` with the variant's id. The Light/Dark/Auto toggle's `bridgeVariant` (Phase 3.2) uses `generation.paired` to swap.
- **Apply after save** — convenience checkbox; defaults on. Routes through `themeStore.setTheme(id, workspaceId)` so the workspace binding contract from Prompt 3.3 still applies.

Tests: `tests/unit/themes/curated-swatches.spec.ts` (BLANK_DEFAULTS alignment, OKLCH validity, every accent round-trips through `generateTheme` cleanly) + `tests/unit/components/ui/ColorSwatchPicker.spec.ts` (render, aria-checked, click emits, whitespace-tolerant match, `allowCustom` toggle, disabled state).

## Theme generation (Prompt 4 Phase B)

`src/modules/themes/generate.ts` is the Linear-style generation engine: 3–4 high-level inputs → the full ~50-token semantic set. All color math runs in OKLCH via [culori](https://culorijs.org) (see [ADR 0003](../../../docs/decisions/0003-theme-generation-color-library.md)).

- **`generateTheme(input)`** → `{ tokens, contrastReport }`. Inputs: `baseColor`, `accentColor`, `contrast` (30–100), `mode`, `density`, optional `fontFamily`. Surfaces brighten with elevation in light mode / lighten in dark; text + border lightness are **solved** via binary search to hit a target WCAG ratio (accessibility is computed, not eyeballed); colors are gamut-mapped into sRGB.
- **What it emits:** semantic colors + backwards-compat aliases + color-bearing component overrides. **It never emits `--density-*` tokens** — density rides the `data-density` attribute, and emitting them would break density switching. Sizing/radius/font-size component tokens cascade from the density layer + primitives.
- **`generatePairedVariant(theme)`** regenerates the opposite-mode variant from the same `generation` inputs (mode flipped, density carried) — the bridge for Light/Dark/Auto on user-authored themes.
- **Contrast report:** headline ratios (`textOnSurface`, `textOnRaised`, `onInteractive`) + `failures[]`. A good theme has `failures: []`.
- **Inspect output:** `pnpm theme:demo` writes four sample themes to `.verification-screenshots/feat-theme-generation-engine/sample-output.json`.

Full reference: [`docs/theme-generation-algorithm.md`](../../../docs/theme-generation-algorithm.md). Tests: `tests/unit/themes/generate.spec.ts`.

## Common operations

### "I need a color and I'm tempted to hardcode it"

1. Is there an existing semantic token that fits? (`text-fg`, `bg-surface-raised`, etc.) → use it.
2. Is it status-related? Use `text-success` / `text-warning` / `text-danger`.
3. Is it interactive? Use `bg-interactive` / `bg-interactive-subtle`.
4. None fit? Open `tokens.css`, add a new semantic token referencing the appropriate primitive, bridge it in `main.css`, document it in `docs/design-tokens.md`.

### "I need a one-off accent for a specific use case"

Push back first — is it really one-off, or is it a recurring pattern? If recurring, add a semantic token. If truly one-off, use the primitive directly (`bg-blue-500`, `bg-violet-300`) and add an inline comment explaining why.

### "I need a custom shadow"

Use `shadow-sm` / `shadow-md` / `shadow-lg` / `shadow-xl`. They're neutral-tinted and work in both themes. Custom shadows tied to a brand color rarely look right in both modes.

### "I need a component-specific themeable token for a new control"

Most new controls just consume semantic tokens (`bg-surface-raised`, `text-text-primary`) and theme correctly under every built-in and every generated theme — zero token work. Reach for the cheat sheet first.

If the new control genuinely needs its own named token so it can be tuned independently (e.g. `--titlebox-header-bg`, `--titlebox-border`), it's a two-step recipe — **no `generate.ts` changes**:

1. Define the token in `src/assets/styles/tokens.css`, referencing a semantic token so it inherits via the cascade — e.g. `--titlebox-header-bg: var(--color-surface-raised);`.
2. Add the name to `COMPONENT_TOKEN_NAMES` in `src/modules/themes/knownTokens.ts` so `themeRepo` invariants and the import validator accept it as a legal override.

The new token inherits the generated semantic value automatically; custom theme JSON can override it explicitly when needed. `THEME_SCHEMA_VERSION` stays `1` — adding tokens is backward-compatible. Full decision tree (and when to instead emit a derived value from the generator) in [`docs/theme-generation-algorithm.md` → Extending the vocabulary](../../../docs/theme-generation-algorithm.md#extending-the-vocabulary).

### "I want to extend theming into a new dimension (typography roles, motion, icons, etc.)"

The current generator only handles colors. Other pillars — typography (font roles / weights / sizes / line-heights / tracking), motion, shadows, effects, iconography, data-viz palettes, accessibility variants — follow the same three-layer cascade and can be added as additional pillars. Each pillar's current state in CommandVue, the role-based extension pattern (with a worked typography example using `--font-family-ui` / `-display` / `-mono`), and operational-dashboard priorities (motion tokens, data-viz unification, high-contrast / CVD-safe variants) live in [`docs/theme-generation-algorithm.md` → Beyond colors](../../../docs/theme-generation-algorithm.md#beyond-colors-other-themeable-dimensions).

### "I need to add a new theme variant"

That's Phase 3.3 work. The theme is a JSON file under `src/assets/themes/` that overrides 30–50 semantic + component tokens. See `docs/themes.md` (added in Phase 3.3) for the schema.

## Common mistakes

- **Hardcoding a hex in a component** — bypasses themes, breaks dark mode. Always reach through a token.
- **Referencing primitive tokens from components** — locks the palette. Use semantic tokens (`bg-surface-raised` not `bg-slate-50`).
- **Adding `dark:bg-X dark:text-Y` everywhere** — the semantic tokens already flip on dark mode. Adding `dark:` variants doubles the work and the maintenance.
- **Creating a new primitive scale "just for this theme"** — themes don't override primitives. Add new semantic or component tokens instead.
- **Using `data-density` per-component** — density is a global mode controlled by user preference on `<html>`. Reading `--density-*` is fine; writing `data-density` from a component is wrong.

## Reference files

- [`reference/token-categories.md`](./reference/token-categories.md) — quick map of all token categories and where they live.
- [`reference/component-styling-pattern.md`](./reference/component-styling-pattern.md) — copy-paste patterns for styling new components with tokens.

## References

- Source of truth: `src/assets/styles/tokens.css`
- Tailwind v4 bridge: `src/assets/styles/main.css`
- Full reference: [`docs/design-tokens.md`](../../../docs/design-tokens.md)
- Prompt 3 — design token foundation + Light/Dark/Auto toggle + 6 built-in themes
- Prompt 4 — in-app theme authoring (uses the foundation laid down here)
