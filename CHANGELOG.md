# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Custom theme storage foundation (Prompt 4 Phase A).**
  - New IndexedDB object store `custom-themes` (database version 2, ULID keys, indexed by `name` + `source`). Upgrade is additive — existing workspaces / layouts / presets / chrome profiles untouched.
  - **Version-skew guard in `getDb()`.** Bumping `DB_VERSION` (1 → 2) made the boot brittle: if a browser profile already holds the DB at a _higher_ version than the running build — e.g. a developer tests this branch (v2) then runs an older build (v1) in the same profile, or an end user is rolled back — IndexedDB throws `VersionError: The requested version (1) is less than the existing version (2)` and the app fails to boot. `getDb()` now catches that and reopens at the existing version with no upgrade. Safe because migrations are additive and never edited after release, so a higher version is always a superset of the stores the build knows about; it never deletes data. Covered by `tests/unit/storage/db.spec.ts`.
  - `themeRepo` (`src/modules/storage/themeRepo.ts`) with 8 write-time invariants: ULID id, name uniqueness within source (case-insensitive), source enum (`user` / `imported` / `generated` — never `built-in`), known-token names only, CSS-injection safety (`<script>` / `javascript:` / `expression(` rejected), valid mode, valid density, and generation-block shape for generated themes.
  - Known-token registry (`src/modules/themes/knownTokens.ts`) — the single source of truth for overridable token names (semantic + component + density + a curated set of themeable primitives). Used by repo invariants and the import validator.
  - `appMetaRepo.getKeysByPrefix()` for workspace-binding scans.
  - `themeRepo.delete()` cleans up any per-workspace theme binding pointing at the deleted theme.
  - `THEME_SCHEMA_VERSION = 1` constant + `PortableTheme` export/import envelope + `ThemeDefinition` (bundled-JSON shape) in `src/types/theme.ts`.
  - 13 unit tests in `tests/unit/storage/themeRepo.spec.ts`.
- **Theme type reconciliation.** `Theme.isBuiltIn: boolean` → `Theme.source: ThemeSource` enum; `createdAt` / `updatedAt` migrated from ISO strings to unix-ms numbers (aligns themes with the rest of the storage layer); added optional `generation` block. The apply engine now normalizes token keys to `--`-prefixed form, accepting both the bare keys the bundled JSON uses and the `--`-prefixed keys the generator / import path produce.
- **Universal density consumption.** Stage-2 review revealed the `--density-*` tokens from Phase 3.1 had no consumers — switching themes between compact / comfortable / spacious did nothing visible. Wire density tokens through every UI primitive so the entire app rescales with `data-density` on `<html>`: chrome bars (top + status, via new `--density-titlebar-height` / `--density-statusbar-height`), `Button` + `IconButton` sm preset, `Input` + `Select` wrappers, `Volt Menu` / `Menubar` wrapper / `ContextMenu` `itemLink` padding + font-size, `Volt InputText` + `Textarea` padding + font-size + min-height, `DataTable` row height + cell padding + font-size now read from the global density tokens, `Volt Dialog` header / content / footer padding scale with density (2× the cell padding), `MarkdownPanel` header bar, and consumer `#item` slot templates in `MenuBar` / `WorkspaceSwitcher` / `AppIconItem`. Compact mode now compresses the chrome bar to ~2rem, comfortable stays ~2.5rem, spacious expands to ~3rem; menus, inputs, table rows, and dialog headers all scale to match.
- **Six built-in theme variants + picker dialog + per-workspace theme binding (Phase 3.3 of Prompt 3).**
  - `src/assets/themes/*.json` ships six bundled variants: `compact-light`, `compact-dark`, `command-center-light`, `command-center-dark`, `admin-panel-light`, `admin-panel-dark`. Each overrides 30–50 semantic + component tokens; primitives stay constant.
  - `src/types/theme.ts` adds the `Theme`, `PortableTheme`, `ThemeMode`, `ThemeDensity`, and `ThemeTokens` types.
  - `src/modules/themes/registry.ts` singleton (`themeRegistry`) with `register` / `unregister` / `get` / `list` / `listBuiltIn` / `listByMode` / `subscribe`. `__resetForTests` for spec isolation. Mirrors the panel / chrome-item / preset registry pattern.
  - `src/modules/themes/builtin.ts` exports `registerBuiltinThemes()` — imports the six JSON files, fills `isBuiltIn` / timestamps, registers each. Called once from `main.ts` before mount. Idempotent.
  - `src/modules/themes/apply.ts` ships `applyTheme(theme)` + `clearTheme()`. The apply engine writes each token override as `root.style.setProperty('--key', value)`, tracks applied keys via `data-theme-applied` (JSON-encoded array) for clean teardown on the next swap, and sets `data-theme-id`, `data-theme`, `data-density` for identity. Clear preserves `data-theme` (owned by `useTheme`).
  - `src/stores/theme.ts` adds `useThemeStore()` with `currentThemeId`, `currentTheme`, `loadInitial(workspaceId)`, `setTheme(id, activeWorkspaceId?)`, `setWorkspaceTheme(workspaceId, id, activeWorkspaceId)`, `clearWorkspaceTheme(workspaceId, activeWorkspaceId)`, `resolveForWorkspace(workspaceId)`, `getWorkspaceBinding(workspaceId)`. Precedence: workspace binding → global pointer → `compact-light` fallback. Persisted via `appMetaRepo` under `commandvue:theme-id` and `commandvue:workspace-theme-{wsId}`.
  - **Workspace switching integration** — `useSessionStore.switchWorkspace()` now calls `themeStore.loadInitial(workspaceId)` after `workspaceStore.setCurrentWorkspace()` so a workspace-bound theme applies before its layout's panels mount.
  - **Light/Dark/Auto toggle bridges to theme variants** — `useTheme().applyResolved()` now calls `bridgeVariant(resolved)` which finds the paired-suffix variant of the active theme (`compact-light` ↔ `compact-dark`, etc.) and applies it via `themeStore.setTheme()`. No-ops when no theme is active, when the current id has no suffix, or when the paired id isn't registered.
  - **Theme picker dialog** — `src/components/dialogs/ThemePickerDialog.vue`. Volt Dialog with one card per registered theme: name + description + mode/density badges + six color swatches (sampled live via a hidden helper element so `var()` references resolve) + Apply button + "Set as workspace default" checkbox. Wired via `View → Themes…` in the menu bar.
  - **Workspace-switcher theme indicator dots** — a small accent-colored dot next to each workspace name in the dropdown shows its bound theme. Hover for "Theme: \<name\>" tooltip. The store's `getWorkspaceBinding()` cache + `resolveForWorkspace()` hydrate on mount.
  - **`docs/themes.md`** — user-facing theme guide. Registered in the VitePress sidebar under "Look & feel".
  - Updated `docs/design-tokens.md` and the `commandvue-theming-system` skill with the registry / apply engine / store contract.
  - 17 new unit tests in `tests/unit/themes/registry.spec.ts` + `tests/unit/themes/apply.spec.ts` covering register / unregister / subscribe / mode filtering / listener replay, plus apply / clear / re-apply / stale-key teardown / identity attributes.
- **Drag-and-drop reorder inside chrome edit mode.** Each chrome item becomes a draggable handle when edit mode is on; drop anywhere left or right of a sibling item to move it. Wired via `@atlaskit/pragmatic-drag-and-drop` and `@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge` (both already in the locked stack). An accent-coloured vertical bar marks the insertion point on the side of the hovered target. Source item dims to 40% opacity while dragging. Cross-slot drag intentionally out of scope for this PR — the `canDrop` filter restricts to same-slot moves. Non-removable items (the always-on app icon) are anchored at their canonical position and don't drag.
- **`docs/concepts.md` walkthrough page** — top-level overview of how workspaces, layouts, panels, chrome, and presets fit together, with annotated screenshots from a fresh launch. Now ships eight screenshots covering the overview, workspace switcher, Manage Workspaces dialog, Edit menu, Manage Layouts dialog, components panel, chrome edit mode, and the dark theme. Registered in the VitePress sidebar under "Overview".
- **`docs/public/concepts/MANIFEST.md`** — tracks every embedded screenshot, the steps to reproduce it, and the theme/density used at capture so Phase 3.3 can re-take them against the chosen built-in documentation theme.
- **Theme-aware scrollbar styling** — `*::-webkit-scrollbar-*` + `scrollbar-color` rules read from the semantic surface + border tokens so scrollbar thumbs flip automatically with `data-theme`.
- **Light / Dark / Auto theme toggle (Phase 3.2 of Prompt 3).**
  - `useTheme()` composable rewritten as a three-mode controller: `light` / `dark` / `auto`. Auto follows `prefers-color-scheme` and re-resolves automatically when the OS preference changes.
  - `setMode(next)` / `cycleMode()` actions. Cycle order: light → dark → auto → light. `resolvedTheme` always returns a concrete `light` | `dark`.
  - Dual-write persistence: `appMetaRepo` (IDB) under key `commandvue:theme` is authoritative (stores the mode); `localStorage` mirrors the resolved theme for the anti-FOUC inline script.
  - Anti-FOUC inline `<script>` in `index.html` runs synchronously in `<head>` before any CSS loads; reads the localStorage mirror or falls back to `prefers-color-scheme` so the first paint matches user choice.
  - `initializeTheme()` runs from `main.ts` before `app.mount()` — hydrates the in-memory mode from IDB, wires the matchMedia listener, applies the resolved theme.
  - `ThemeToggleItem` chrome item replaced with the new three-way cycle (Sun → Moon → Monitor). `aria-label` and `title` describe the next mode for discoverability.
  - Mode changes announce via a visually-hidden `role="status" aria-live="polite"` region (`#commandvue-theme-announce`).
  - 13 new unit tests in `tests/unit/composables/useTheme.spec.ts` covering default state, mode setting, cycle order, system-preference resolution, dual-write persistence, listener teardown, idempotent init, aria-live region creation.
- **Three-layer design token foundation (Phase 3.1 of Prompt 3).**
  - Primitive token layer (`@theme` in `src/assets/styles/tokens.css`) — OKLCH neutral scale (slate 50→950) + six accent palettes (blue, teal, green, amber, red, violet), spacing scale (`--space-0` → `--space-48`), typography (font families, font size scale, font weights, line heights), border radii, shadows, motion (durations + easings), z-index. Mirrors Tailwind v4's default palette values.
  - Semantic token layer (`:root` in `tokens.css`) — surface (base/raised/overlay/sunken), border (subtle/default/strong), text (primary/secondary/tertiary/disabled/inverse), interactive (default/hover/active/subtle + `on-interactive`), status (success/warning/danger/info with `-subtle` companions), focus ring, semantic spacing (`--space-panel-padding`, …), semantic typography.
  - Component token layer (`:root` in `tokens.css`) — `--datatable-*`, `--dockpanel-*`, `--menubar-*`, `--statusbar-*`, `--dialog-*`, `--tooltip-*`, `--button-*`.
  - Density modes (`[data-density="compact" | "comfortable" | "spacious"]`) driving six `--density-*` tokens (row height, cell padding, control height, icon size, font size).
  - Dark-theme overrides (`html[data-theme="dark"]`) for every semantic + component token used in Phase 3.1 — full coverage extension lands in Phase 3.2.
  - Tailwind v4 `@theme` bridge in `main.css` — exposes semantic names (`bg-surface`, `text-fg`, `border-border-default`, `bg-interactive`, `bg-success-subtle`, …) as utility classes.
- **`docs/design-tokens.md`** — full reference for the token vocabulary, with architecture diagram, per-layer catalogues, usage rules, Tailwind class examples, "adding a token" how-to, and migration guidance. Registered in VitePress sidebar under "Look & feel".
- **`.agent/skills/commandvue-theming-system/`** — new agent skill (`SKILL.md` + `reference/token-categories.md` + `reference/component-styling-pattern.md`) for future agent sessions working in this area.
- **Verification protocol section in `CLAUDE.md`** — documents the two-stage (Playwright MCP automated + human design review) verification model now standing for all agent-driven phases.
- **`.verification-screenshots/`** gitignored — Stage 1 screenshot output target.
- **PrimeVue-first rule enforcement (Phase 2.4 — capstone of Prompt 2).**
  - ESLint `vue/no-restricted-html-elements` warns on raw `<button>`, `<input>`, `<select>`, `<textarea>` in `.vue` templates outside `src/components/ui/**` and `src/volt/**`. Message points at the wrapper to use plus `docs/contributing-ui.md`.
  - ESLint `@typescript-eslint/no-restricted-imports` warns on direct `primevue/*` component imports from consumer files. `allowTypeImports: true` lets `import type { ... } from "primevue/*"` through automatically. Helper modules (`primevue/menuitem`, `primevue/config`, `primevue/api`, `primevue/usetoast`, `primevue/useconfirm`) are excluded via negation patterns; `primevue/datatable` and `primevue/column` are excluded because the more specific ADR 0001 named rule already covers them.
  - New ESLint override `commandvue/ui-primitives` disables the two rules above for `src/components/ui/**` and `src/volt/**` so the primitives themselves can use raw HTML and direct `primevue/*` imports.
  - New GitHub Actions workflow `.github/workflows/ui-primitive-governance.yml` — scans PR diffs for added raw HTML interactive elements outside the primitive directories and applies the `governance: raw-html-element` label. Mirrors the datatable-governance pattern; informational, not blocking.
  - PR template gains two governance checkboxes for raw-HTML deviations and direct `primevue/*` consumer imports.
  - New `docs/contributing-ui.md` — full contributor reference: when to use Volt vs hand-rolled wrappers, complete mappings table, styling patterns, enforcement layers, deviation workflow. Registered in the VitePress sidebar under "Building".
  - `CONTRIBUTING.md` gains a "## UI primitives" section summarizing the rule with a pointer to the new doc.
  - Four agent skills (`commandvue-panel-development`, `commandvue-chrome-system`, `commandvue-preset-development`, `commandvue-workspace-system`) gain an "Enforcement (Phase 2.4)" paragraph pointing at the new doc and ADR 0002.
- **Volt foundation for PrimeVue-first UI primitives.**
  - Installed 9 Volt components into `src/volt/` via `npx volt-vue add`: `Dialog`, `InputText`, `Checkbox`, `Slider`, `Textarea`, `Fieldset`, `Tag`, `Menu`, `SecondaryButton`. Each lives in the codebase as ownable source rather than a dependency.
  - Added `tailwindcss-primeui` plugin to `src/assets/styles/main.css` so Volt's `surface-N` palette and `p-filled` / `p-invalid` / `p-fluid` / `p-small` / `p-large` variants resolve.
  - Added `@primevue/icons` runtime dependency for Volt's default icon imports.
  - Added `src/components/ui/Menubar.vue`, `ContextMenu.vue`, `FileUpload.vue` — hand-rolled exception wrappers because Volt does not cover these three (verified 2026-05-24). Tracked for promotion if Volt ships them.
  - Added `src/components/ui/ColorPicker.vue` + `colors.ts` — specialized wrapper over `primevue/colorpicker` with a curated `defaultColors` palette (orbat-mapper-inspired, no `reka-ui` dependency).
  - Rewrote `src/components/ui/Tooltip.vue` on `floating-vue` (floating-ui under the hood) — replaces the native-`title` placeholder; same `label` API, adds `placement`, `delay`, `disabled` props.
  - Added `floating-vue` runtime dependency.
  - Added ESLint override for `src/volt/**` so vendored Volt sources keep upstream parity (relaxes `no-explicit-any` / `no-empty-object-type` / `no-unsafe-function-type` / `vue/no-v-html` for that directory).
  - Updated `src/components/ui/index.ts` to re-export the new wrappers and the palette.
- **`<DataTable>` wrapper component — CommandVue's default tabular-data primitive.**
  - `src/components/ui/DataTable.vue` — generic over `TData`, built on `@tanstack/vue-table` (state) + `@tanstack/vue-virtual` (windowing).
  - Three density modes (`compact` / `comfortable` / `spacious`) via CSS data-attribute; sortable, filterable, resizable columns; column visibility toggle; sticky header and optional sticky first column; keyboard accessibility (`aria-sort`, focusable headers, Enter/Space).
  - Supporting modules at `src/components/ui/datatable/`: `types.ts` (public types incl. `DataTableProps`), `columnHelpers.ts` (re-exports `createColumnHelper` + `formatDateColumn` / `formatNumberColumn`), `useDataTableState.ts` (external-state composable for advanced consumers).
  - Demo route at `/dev/datatable` (gated behind `import.meta.env.DEV` — never ships in production builds) — 1,000 mock rows exercising every feature.
  - 11 unit tests in `tests/unit/components/ui/DataTable.spec.ts`.
- **`docs/decisions/0001-datatable-library.md`** — architecture decision record establishing `@tanstack/vue-table` as the default. Explicitly scoped: tabular-data only. Every other UI surface (menus, dialogs, color pickers, file uploads, form controls, fieldsets, tags) still follows the library-first PrimeVue rule.
- **`docs/datatable.md`** — full props / events / slots reference, common patterns, accessibility notes, performance tuning, and a PrimeVue → wrapper migration guide. Registered in the VitePress sidebar under "Building".
- **`docs/audits/datatable-usage-inventory.md`** — snapshot of every `primevue/datatable` site at the time of the policy reversal, with migration phase per file.
- **PR labeler for `primevue/datatable` governance.**
  - `.github/workflows/datatable-governance.yml` — auto-applies the `governance: primevue-datatable` label when a PR diff introduces or touches a `primevue/datatable` import. (Custom diff-grep approach because `actions/labeler` v5 only supports path globs, not file content.)
- **Workspace / layout / preset / chrome storage layer (Phase A of the workspace system).**
  - Six typed IndexedDB repositories: `workspaceRepo`, `layoutRepo`, `panelStateRepo`, `presetRepo`, `chromeProfileRepo`, `appMetaRepo` under `src/modules/storage/`.
  - ULID-based ids via the new `ulid` runtime dependency; `src/modules/storage/ids.ts` is now the canonical id source for persisted entities (`src/utils/id.ts` nanoid stays for ephemeral ids).
  - Cascade behavior: workspace delete → layouts → panel-states → workspace-scoped presets. Layout delete → panel-states + workspace `defaultLayoutId` repointed.
  - Invariants enforced at the repo layer: exactly one global-default workspace, exactly one default chrome profile, ≥1 workspace + ≥1 layout per workspace + ≥1 chrome profile always present.
  - First-run seed (`seedIfEmpty`) — idempotent; creates the Operations workspace, Default layout (seven configured panels), and Default chrome profile with the canonical slot assignments.
  - `docs/supabase-migration.md` — agent-only reference capturing the IndexedDB → Postgres + RLS migration contract.
  - 121 unit tests via `fake-indexeddb`; full cascade and invariant coverage.
- **Panel Registry (Phase B of the workspace system).**
  - `src/modules/panels/registry.ts` — singleton with `register` / `unregister` / `get` / `list` / `listByCategory` / `subscribe`.
  - `src/modules/panels/types.ts` — `PanelDefinition`, `PanelCategory`, `PanelLifecycle` (stubs to be wired in Phase G).
  - `src/modules/panels/builtin.ts` — idempotent `registerBuiltinPanels()` covering the seven built-in panels (Cesium, MapLibre, EntityList, Chart, Telemetry, Markdown, Symbology).
  - `src/modules/panels/unassigned.ts` — reserved synthetic type `__unassigned__` for empty panels.
  - Wired into `main.ts` before mount; sits alongside the existing `app.component()` registrations (Dockview still resolves components from Vue's global registry).
  - 9 new unit tests covering registry surface and built-in registration.

### Fixed

- **MapLibre 2D-map panel crashed on mount.** Wiring panel-state persistence to the real Dockview api (the params-bag fix in #89) activated `MapLibrePanel`'s previously-dead `restore` path. Two problems surfaced: (1) seeded panels persist an empty `{}` state, and `restore({})` called `jumpTo({ center: undefined, bearing: undefined, … })` — `jumpTo` treats present-but-`undefined` options as "apply", feeding NaN into maplibre-gl's matrix math (`Cannot read properties of null (reading '0')`, plus cascading `_updatePlacement` / `updateTransitions` render crashes and two `[Vue warn]` mounted/watcher errors); (2) `usePanelState` dispatches `restore` synchronously on mount, before MapLibre has built its style + transform. `restore` now guards every camera field before use (mirroring `MarkdownPanel` / `EntityListPanel`) and defers `jumpTo` until the map's `load` event. Verified via Playwright: the 2D map mounts and renders tiles with zero console errors/warnings.
- **Edit-mode banner no longer overlays the menu bar.** The Chrome-edit banner was absolutely positioned over the top of the shell, which made the File / Edit / View dropdowns unreachable while editing chrome. Rendered inline as the first flex row of `AppShell` instead, so the banner pushes the chrome bar (and everything below it) down. Wording updated to reflect the new drag affordance.
- **Dropdown hover frame removed.** Consumer `#item` slot templates in `WorkspaceSwitcher`, `MenuBar`, and `AppIconItem` all painted their own `hover:bg-surface-sunken` + `rounded` + duplicate padding on top of the wrapper's hover state, producing a visible nested frame around the hovered item. Stripped the duplicates — the wrapper's `itemContent` hover handles the fill, the consumer templates only own text color, padding, and icon layout.
- **Browser native context menu suppressed site-wide.** A global capture-phase `contextmenu` listener `preventDefault()`s everywhere so only PrimeVue ContextMenu instances render on right-click. Native menu is preserved for `<input>`, `<textarea>`, and `contenteditable` hosts so cut / copy / paste / spell-check still work. Mirrors the eventual desktop-shell (Tauri / Electron) packaging where the browser has no native page menu to overlay app menus with.
- **Edit menu's "Rename Layout…" label was misleading** — the entry actually opens the Manage Layouts dialog. Renamed to "Manage Layouts…" to match the AppIconItem context menu wording.
- **Dropdown popup blended into the body in dark mode.** Volt `Menu` used `dark:bg-surface-900`, which is the same shade as the body. Raised the popup to `dark:bg-surface-800` and the hover state to `dark:hover:bg-surface-700` so the body → popup → hover hierarchy is clearly three steps. Tightened item vertical padding (`py-2` → `py-1.5`) for denser rows.
- **Manage Layouts "Make Default" button** — clicking the star now refreshes the workspace store so the UI reflects the new default immediately. Previously the IDB write succeeded but the star indicator stayed on the old default until the user switched workspaces.
- **Components Panel cards** — clicking a panel card now reliably spawns the panel even when the panel's `containerApi` prop is briefly undefined during mount; falls back to `useSessionStore().getDockviewApi()`. Previously silently no-op'd.
- **Workspace dropdown hover** — Volt `Menu` had both `p-1` list padding *and* a `rounded-sm` `bg-surface-100` hover fill on the inner div, producing a visible "double-frame" effect on hover. Dropped both so the hover fills the full row of the popup edge-to-edge.
- **Menu bar dismissal on right-click** — opening the app-icon context menu while a top-bar dropdown was visible now dismisses the dropdown first (synthesises a click outside the menubar to trigger PrimeVue's outside-click handler before opening the context menu).
- **Empty/Missing panel "Assign" / "Reassign" buttons now work.** Two stacked bugs left the buttons dead. (1) dockview-vue 6 passes a panel its api + containerApi inside a single `params` prop bag (`{ params, api, containerApi, tabLocation }`), but several panels declared `api` / `containerApi` as separate top-level props, so they arrived `undefined`. `UnassignedPanel` / `MissingPanelPlaceholder` threw on `props.api.id` (button appeared dead); `MapLibrePanel` / `MarkdownPanel` / `EntityListPanel` silently skipped per-panel state persistence; `ComponentsPanel` limped via the session-store fallback. All six now read through a new `usePanelApi(props)` composable (`props.params.api` / `props.params.containerApi`). (2) With the api wired, the component-swap then hit `dockview: panel with id X already exists` — the swap added the replacement panel with the same id *before* closing the placeholder, which dockview 6 rejects. Extracted `swapPanelComponent()` (`src/modules/panels/swap.ts`) which closes first (synchronous, frees the id) then re-adds, re-joining the original group when it survived the close or floating otherwise. Covered by `tests/unit/panels/swap.spec.ts`.
- **`ComponentsPanel` card grid raw `<button>` lint** — the card-style grid tile (two-line, left-aligned, fills the cell) can't be expressed by PrimeVue `Button`, so it now carries a documented `vue/no-restricted-html-elements` escape-valve disable per `docs/contributing-ui.md` instead of a bare warning.

### Changed

- **`src/assets/styles/tokens.css` rewritten** as the single-source three-layer authority. Light defaults previously in `main.css`'s `@theme` block now live alongside the new primitive scales. `main.css` retains the Tailwind `@theme` bridge, the PrimeVue runtime palette (`--p-surface-*`, `--p-primary-*`), base styles, the `@custom-variant dark` declaration, the cursor-pointer rule, and the menubar/contextmenu submenu positioning rules. Legacy semantic aliases (`--color-surface`, `--color-foreground`, `--color-muted`, `--color-border`, `--color-success`, …) are preserved so existing `bg-surface` / `text-foreground` / `bg-success` classes keep working.
- **`Tooltip.vue`** `box-shadow` hardcoded value → `var(--shadow-md)` (first sample migration to design tokens).
- **`ChartPanel.vue`** documents the hardcoded ECharts color literals with a Phase 3.2 TODO — ECharts can't read CSS variables directly; the JS bridge ships with the Light/Dark/Auto toggle.
- **Migrated all 7 dialogs to the Volt `Dialog`.** `ApplyPresetDialog`, `EditPresetDialog`, `ManageLayoutsDialog`, `ManagePresetsDialog`, `ManageWorkspacesDialog`, `SaveLayoutAsDialog`, `UnsavedChangesDialog` now import `Dialog` from `@/volt/Dialog.vue`. The legacy project wrapper at `src/components/ui/Dialog.vue` is removed (also dropped from `src/components/ui/index.ts`); update-visible handlers gain explicit `(v: boolean)` annotations under strict TS.
- **`SaveLayoutAsDialog` Checkbox swapped to `@/volt/Checkbox.vue`.** Drops the inline `:pt` overrides and the now-unused `cn` import.
- **`ManagePresetsDialog` Tabs use the project `<Tabs>` wrapper.** The 5 direct `primevue/tabs*` imports are gone; tab labels render via the wrapper's new `#tab-{id}` named slots (icons + counts preserved).
- **Extended `<Tabs>` wrapper with per-tab label slots.** New optional `#tab-{id}` named slot lets consumers customize a single tab's label with icons, badges, counts. Falls back to `{{ tab.label }}` when not provided. No breaking change.
- **Migrated `AppIconItem`, `EditModeToggleItem`, `ChromeSlot`, and `ErrorBoundary` to PrimeVue-first primitives (PR 6 + folded PR 7 of Phase 2.3).**
  - `AppIconItem`: `primevue/contextmenu` → `@/components/ui/ContextMenu.vue` wrapper; raw `<button>` trigger → `<Button variant="ghost">`. Unicode `▸` submenu indicator → Lucide `ChevronRight`.
  - `EditModeToggleItem`: raw `<button>` → `<Button variant="ghost">`.
  - `ChromeSlot`: hand-rolled "+ Add item" popup (trigger + outside-click + item list) rebuilt as a single Volt `Menu` (popup mode) per ADR 0002 audit decision **1a**. Drops the local `addOpen` ref. Trigger + remove-`×` badges now use `<IconButton>`. The trigger is disabled when no items remain to add.
  - `ErrorBoundary`: raw "Try again" `<button>` → `<Button variant="primary">` (folds in PR 7 of Phase 2.3 — single-file change in the common area).
- **Extended `ContextMenu` wrapper with `pt` prop + `#item` slot forwarding.** Mirrors the Menubar wrapper pattern from PR 5: consumer PT classes twMerge against wrapper defaults; consumers can supply a custom `#item` template for rich rendering (shortcuts, chevrons, etc.).
- **Migrated `MenuBar`, `WorkspaceSwitcher`, `TitleBar`, and `CommandPalette` to PrimeVue-first primitives (PR 5 of Phase 2.3).**
  - `MenuBar`: `primevue/menubar` → `@/components/ui/Menubar.vue` wrapper (now accepts a `pt` prop that twMerge's with wrapper defaults so consumers can override per-slot classes without duplicating the structural fixes); `primevue/fileupload` → `@/components/ui/FileUpload.vue` wrapper (the manual `choose()` / `clear()` ref typing is gone because the wrapper exposes them via `defineExpose`).
  - `WorkspaceSwitcher`: `primevue/menu` → `@/volt/Menu.vue`; trigger raw `<button>` → `@/components/ui/Button.vue` (`variant="ghost"`).
  - `TitleBar`: command-palette trigger raw `<button>` → `@/components/ui/Button.vue` (`variant="ghost"`).
  - `CommandPalette`: search raw `<input>` → `@/components/ui/Input.vue` wrapper with a small `focusInput()` helper that walks `$el` to find the underlying input element; close raw `<button>` → `@/components/ui/IconButton.vue`. Result-row buttons kept raw with a documented file-header exception per ADR 0002 audit decision **2b** (virtualization-style list affordances).
- **Migrated `MarkdownPanel`, `SymbologyPanel`, and `ComponentsPanel` to PrimeVue-first primitives (PR 4 of Phase 2.3).**
  - `MarkdownPanel`: `primevue/textarea` → `@/volt/Textarea.vue` (drops the inline `:pt` styling — Volt's defaults handle theme + cursor).
  - `SymbologyPanel`: `primevue/fieldset` → `@/volt/Fieldset.vue`; `primevue/tag` → `@/volt/Tag.vue` (drops the local `fieldsetPT` / `tagPT` constants).
  - `ComponentsPanel` rebuilt on Volt `DataView` (`layout="grid"`) per ADR 0002 audit item 3b — replaces the hand-rolled grid+button pattern. Filter `<input>` swapped to the project `<Input>` wrapper.
  - Volt `DataView` installed (`npx volt-vue add DataView`); spell-check dictionary gains the matching component-section terms.
- **Migrated `MapOverlayPresetEditor` to PrimeVue-first primitives per ADR 0002.** `primevue/checkbox` → `@/volt/Checkbox.vue`; `primevue/slider` → `@/volt/Slider.vue`; `primevue/colorpicker` → `@/components/ui/ColorPicker.vue` (project wrapper with curated palette). Drops the local `colorHex` computed and the inline `:pt` overrides — both are now owned by the primitive layer.
- **`EntityListPanel` migrated to the `<DataTable>` wrapper.** Replaces the prior `primevue/datatable` implementation introduced during PR #65. Header content and filter-icon alignment are now driven by the wrapper's CSS-grid header layout (1fr title + auto icons), eliminating the column-by-column misalignment present in the PrimeVue version. Panel state — sort, global filter text, column visibility, density — persists across workspace reloads via `usePanelState` and the new wrapper events.
- **ESLint warn-level rule on `primevue/datatable` imports.** `eslint.config.ts` adds a `no-restricted-imports` rule that surfaces the choice during local lint and CI. Severity is `warn`, not `error` — it doesn't block CI; intent is reviewer visibility. Fires currently on `TelemetryPanel.vue` and three manage-X dialogs (tracked in `docs/audits/datatable-usage-inventory.md` for follow-up migration PRs).
- **`commandvue-panel-development` agent skill updated.** New "Data tables" section teaches future agent sessions to reach for the wrapper, points at `EntityListPanel` as the canonical example, and links to the ADR. The library-first reminder at the top now lists tabular data as the one governed exception.
- **`CLAUDE.md` library-first mapping and locked-stack tables** point at the wrapper as the canonical path; the new "Data tables — TanStack default" policy section documents the escape valve and links to the ADR (added in Phase 1.1, refined here).
- **Storage seed: align panel type ids with existing Dockview registrations.** `SEED_PANEL_TYPES` now uses `entities` (not `entity-list`) so the seeded `panel-states` match the strings passed to `app.component()` and `addPanel({ component: ... })`.
- **Workspace-aware stores and session management (Phase C of the workspace system).**
  - `src/stores/workspace.ts` — `useWorkspaceStore` over `workspaceRepo`; loads workspaces, tracks `currentWorkspaceId`, persists the pointer to `app-meta` (`current-workspace-id`).
  - `src/stores/layout.ts` — **REPLACES** the prior single-Dockview-JSON store; new `useLayoutStore` over `layoutRepo`; tracks `currentLayoutId` per workspace and persists the pointer (`current-layout-id`).
  - `src/stores/panelState.ts` — `usePanelStateStore` with map-based cache for the loaded layout; supports assign/clear, applyPreset/removePreset, createEmpty/delete.
  - `src/stores/session.ts` — `useSessionStore` bridging persisted state and the live Dockview API. Holds `DockviewApi` in a module-scope `shallowRef` (intentionally outside Pinia state per CLAUDE.md rule 4). Exposes `loadLayout`, `saveCurrentAsNewLayout` (fork-on-save with fresh ULIDs), `updateCurrentLayout`, `discardChanges`, `switchWorkspace`; tracks `dirty` flag.
  - `main.ts` now `await seedIfEmpty()` before mount via Vite top-level await; `App.vue` guards rendering on `workspaceStore.ready` with a loading splash.
  - `DockLayout.vue` refactored: hardcoded panel arrangement removed; loads from the current Layout via session store; falls back to stacking panel-states as tabs when `dockviewState` is null.
  - 34 new store unit tests; the old `tests/unit/layout-store.spec.ts` (single-JSON-store API) was removed.

### Changed

- **ULID generation is now monotonic.** `src/modules/storage/ids.ts` uses `ulid.monotonicFactory()` so two ULIDs minted in the same millisecond are guaranteed to sort lexicographically in creation order. Without this, IDB key order could disagree with creation order for same-millisecond writes — which broke "ORDER BY created_at" assumptions in the store list APIs.

- **Menu bar, workspace switcher, manage dialogs, and panel-creation flows (Phase D of the workspace system).**
  - `src/components/layout/MenuBar.vue` — PrimeVue Menubar (unstyled) with File / Edit / View menus, including a cascade "Add Component ▸ <category>" submenu sourced from the panel registry.
  - `src/components/layout/WorkspaceSwitcher.vue` — top-right dropdown listing workspaces with dirty-check on switch (triggers UnsavedChangesDialog).
  - `src/components/dialogs/{SaveLayoutAsDialog,UnsavedChangesDialog,ManageWorkspacesDialog,ManageLayoutsDialog}.vue` — full CRUD for workspaces and layouts, plus the Save-As and unsaved-changes flows.
  - `src/components/panels/UnassignedPanel.vue` — empty-panel placeholder with "Assign a component…" dropdown; swaps the Dockview panel in-group on assignment (Dockview has no `setComponent`, so the swap is `addPanel({ ..., position: { referenceGroup: currentGroup, direction: 'within' } })` then `currentPanel.api.close()`).
  - `src/components/panels/ComponentsPanel.vue` — singleton browser registered as `components-browser` panel type; subscribes to the registry; click-to-spawn floating panels grouped by category with a search filter.
  - `src/components/layout/AppShell.vue` — adds a MenuBar row beneath the TitleBar with the WorkspaceSwitcher and a dirty indicator ("Layout: Default •" when dirty).
  - Keyboard shortcuts: **Cmd/Ctrl+S** (Save Layout), **Cmd/Ctrl+Shift+S** (Save Layout As…), **Cmd/Ctrl+B** (Toggle Components Panel) — extended `src/modules/shortcuts/catalog.ts` and bridged in AppShell.

- **Chrome system: slots, items registry, edit mode, app-icon fallback (Phase E of the workspace system).**
  - `src/modules/chrome/{types,registry}.ts` — `ChromeItemDefinition` + singleton `chromeItemRegistry` with `register` / `unregister` (refuses non-removable) / `listForSlot` / `subscribe`.
  - `src/modules/chrome/builtin.ts` — `registerBuiltinChromeItems()` registers nine items: `app-icon` (non-removable, top-left only), `menu-bar`, `workspace-switcher`, `current-workspace-label`, `current-layout-label`, `dirty-indicator`, `websocket-status`, `clock`, `edit-mode-toggle`.
  - `src/stores/chrome.ts` — `useChromeStore` with `editMode`, `canEdit` (always `true` in Phase E — auth seam), `slotItems` / `isVisible` / `addItemToSlot` (strips from other slots first) / `removeItemFromSlot` / `moveItem` / `toggleMenuBar` / `toggleStatusBar` / `createProfile` / `setDefaultProfile` / `deleteProfile`. Auto-persists every mutation to the active profile.
  - `src/components/chrome/items/*.vue` — nine item components including the **AppIconItem** whose right-click context menu mirrors the MenuBar File / Edit / View structure (the fallback when the menu bar is hidden).
  - `src/components/chrome/{ChromeBar,ChromeSlot,EditModeOverlay}.vue` — ChromeBar renders one bar (top or status) with three slots; ChromeSlot renders items and (in edit mode) shows the `×` badge per item and a `+` dropdown to add hidden items; EditModeOverlay renders the bar-top edit-mode banner with an Exit button.
  - `src/components/layout/AppShell.vue` refactored: TitleBar + MenuBar + StatusBar composition replaced by **two ChromeBars** driven by the active ChromeProfile.
  - 16 new unit tests (chrome registry + store); total **171/171 passing**.
  - `CLAUDE.md` gains a `## Chrome System` section documenting the registry, slots, edit mode, the `app-icon` always-on rule, and the `canEdit` extension point for downstream auth.

### Removed

- **TitleBar and StatusBar are no longer mounted by AppShell.** Their items moved into the new Chrome System (workspace switcher, menu bar, layout/workspace labels, WS status, clock, edit-mode toggle). The component files remain in `src/components/layout/` because they're still referenced by tests / docs; they can be deleted in a follow-up if no downstream apps reference them.

### Added (continued)

- **Presets system: typed registry, panel binding, cascading application (Phase F of the workspace system).**
  - `src/modules/presets/{types,registry,builtin}.ts` — `PresetTypeDefinition<TConfig>` + singleton `presetTypeRegistry` + `registerBuiltinPresetTypes()`. Three built-in types: **`map-style`** (fully runtime-wired to `map.setStyle`), **`map-overlay`** and **`chart-theme`** (registered with stub `applyToPanel`s; downstream apps replace per their needs).
  - `src/modules/panels/instances.ts` — module-scope panel-instance registry (`registerPanelInstance` / `unregisterPanelInstance` / `getPanelInstance`) bridges preset `applyToPanel` calls to live panel handles (MapLibre map, Cesium viewer, ECharts chart). Non-Pinia by design — values are deliberately non-serializable.
  - `src/stores/preset.ts` — `usePresetStore` with `loadAll` / `loadForWorkspace` / `presetsForPanel` / `createPreset` / `updatePreset` (re-applies to every referencing panel) / `deletePreset` / `duplicatePreset` (`{ workspaceId }` override for promote/scope) / `applyToPanel` / `removeFromPanel`.
  - `src/components/dialogs/{ManagePresetsDialog,EditPresetDialog,ApplyPresetDialog}.vue` — full CRUD with global/workspace tabs, promote-to-global and scope-to-workspace duplicate actions, and a per-type editor switcher.
  - `src/components/presets/editors/{MapStylePresetEditor,MapOverlayPresetEditor,ChartThemePresetEditor}.vue` — per-type edit UI.
  - `src/components/panels/UnassignedPanel.vue` — the "Apply preset" dropdown is now populated from `usePresetStore.presetsForPanel`; selecting a preset before Assign applies it to the new panel.
  - `src/components/panels/MapLibrePanel.vue` — registers its `MapLibreMap` instance on mount and watches `appliedPresetIds` to re-apply presets in cascade order on every change.
  - `MenuBar` Edit → Manage Presets… opens the dialog.
  - `App.vue.onMounted` loads presets for the current workspace alongside layouts.
  - 10 new unit tests (preset registry + store); total **181/181 passing**.
  - `CLAUDE.md` gains a `## Presets` section; `docs/supabase-migration.md` gains a Phase F note covering schema decisions (`org_id` / `is_system` columns) and the runtime apply path.

- **Portable JSON, per-panel state, missing-panel fallback (Phase G of the workspace system).**
  - `src/modules/workspaces/portable.ts` — `exportWorkspace` / `importWorkspace` with `schemaVersion: 2`. Captures a workspace + layouts + panel-states + workspace-scoped presets + optional chrome profile in one JSON blob. Imports regenerate every ULID, rewrite panel-id refs inside `dockviewState`, remap preset refs in `appliedPresetIds`, rename on conflict, and refuse mismatched schema versions or non-CommandVue payloads.
  - File → Import / Export Workspace wired in MenuBar via plain DOM file picker + Blob download (avoids adding `browser-fs-access` this late in the project).
  - `src/composables/usePanelState.ts` — shared `{ serialize, restore }` helper with debounced writes (400 ms default), flush-on-unmount, and `session.dirty` marking.
  - **MapLibrePanel** persists `{ center, zoom, bearing, pitch }` on map move/zoom/rotate/pitch events.
  - **MarkdownPanel** gains an Edit/Done toggle with a textarea and persists `{ content }`.
  - `src/components/panels/MissingPanelPlaceholder.vue` + `src/modules/panels/missing.ts` — synthetic `__missing__` panel type. `session.rebuildFromPanelStates` falls back to it when a panel-state references an unregistered `panelType` (common after import). Users can Reassign (keeps panel id intact, preserves preset refs) or Remove.
  - 13 new unit tests (10 portable round-trip + ID regeneration + version rejection + chrome opt-in; 3 missing-panel registry). Total: **194/194 passing**.
  - `docs/supabase-migration.md` gains a Phase G note (portable JSON contract, per-panel state hook, missing-panel fallback all map cleanly to Supabase with no schema changes).

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] — 2026-05-19

First public release of the CommandVue template. Every layer of the
locked stack is wired and demonstrated by at least one working panel.

### Added

#### Scaffold and identity (Phase 1)

- Vue 3 + Vite + TypeScript (strict) + Vue Router 4 + Pinia, packaged via pnpm 10 workspaces.
- Four-tsconfig project-references layout (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json`) with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `verbatimModuleSyntax` enabled.
- Repository identity and governance: Apache 2.0 LICENSE, Contributor Covenant 3.0 code of conduct, security disclosure policy, contributor guidelines, AI-agent guidance in `CLAUDE.md`.
- Home / Demo / About views wired through Vue Router with lazy route components.

#### Quality tooling and CI (Phase 2)

- ESLint 9 flat config composing `eslint-plugin-vue`, `@vue/eslint-config-typescript`, `@vue/eslint-config-prettier/skip-formatting`, `eslint-plugin-perfectionist` (import sorting).
- Vitest 3 + `@vue/test-utils` + jsdom; CSpell with operations / project / tech dictionaries.
- Husky v9 pre-commit + commit-msg hooks; lint-staged + commitlint (Conventional Commits).
- GitHub Actions workflows: lint + type-check + test + build on push/PR; PR-only spell check.
- `.github` templates: bug report, feature request, PR description; Dependabot weekly grouped updates; FUNDING placeholder; VS Code workspace defaults and extension recommendations.

#### Styling foundation (Phase 3)

- Tailwind v4 via `@tailwindcss/vite` with `@tailwindcss/forms` and `@tailwindcss/typography` plugins; `tw-animate-css` for utility animations.
- Design tokens: light-theme palette + semantic tokens in `main.css` `@theme` block; dark-theme runtime overrides in `tokens.css` via `html[data-theme="dark"]`.
- `@custom-variant dark` wired to the `data-theme` attribute so the `dark:` Tailwind variant tracks the same switch as the CSS-variable cascade.
- PrimeVue v4 in unstyled mode; UI primitive wrappers (`Button`, `IconButton`, `Input`, `Select`, `Tabs`, `Tooltip` + PrimeVue-backed `Dialog` and `Toast`); `cn()` utility (clsx + tailwind-merge).
- `useTheme` composable built on `@vueuse/core`'s `useDark`, persisted to localStorage.
- Icon libraries: `@lucide/vue`, `@heroicons/vue`, `@iconify-prerendered/vue-mdi` — named imports only.

#### Layout shell with Dockview persistence (Phase 4)

- Pinia stores: `useUiStore` (mode / sidebar / command-palette flag), `useLayoutStore` (Dockview JSON + idb persistence).
- `src/utils/storage.ts` — minimal idb wrapper over a single `keyval` object store.
- `AppShell` (TitleBar + RouterView + StatusBar) with `useTheme` bootstrap.
- `DockLayout`: `dockview-vue` wrapper with `defineAsyncComponent` panel registration, `@ready` rehydration, 400 ms debounced persistence on `onDidLayoutChange`.
- Custom `.dockview-theme-commandvue` class remapping Dockview's `--dv-*` variables to project semantic tokens.
- Seven placeholder panels (Cesium / MapLibre / Entities / Chart / Telemetry / Symbology / Markdown).

#### Cesium 3D globe and MapLibre 2D map (Phase 5)

- `vite-plugin-static-copy` mirrors Cesium runtime assets into `/cesium/*` at dev and build time; `define.CESIUM_BASE_URL` and `optimizeDeps.exclude: ["cesium"]` configured.
- `useCesium` / `useMapLibre` composables with `shallowRef`-held viewer / map and `onBeforeUnmount` cleanup.
- `CesiumPanel` mounts at lon 70 / lat 30 / 5 000 km altitude with two demo entities; `MapLibrePanel` mounts the OpenFreeMap Liberty style centered on the same coordinates.

#### Symbology, charts, tables, real-time, markdown (Phase 6)

- `WsMessage<T>` envelope (`type` / `id` / `ts` / `payload`) + `createMessage`, `serializeMessage`, `parseMessage`, `isWsMessage`, `calculateBackoff` (with jitter).
- `milsymbol` rendering helpers + `@orbat-mapper/convert-symbology` for MIL-STD-2525 / APP-6 SIDC conversion; 20-entry `DEMO_SYMBOLS` table covering four affiliations × five dimensions.
- `useWebSocketClient` composable wrapping `@vueuse/core`'s `useWebSocket` with JSON encode/decode, 25 s heartbeat, infinite auto-reconnect, reactive `lastMessage` + `latencyMs`.
- Pinia stores: `useEntitiesStore` (50 mock entries with civilian-neutral callsigns + SIDC codes), `useTelemetryStore` (rolling 50-message buffer + 1 Hz synthetic signal), `useConnectionStore` (WS lifecycle).
- Utilities: `id` (nanoid + numeric + Crockford `shortId`), `format` (dayjs timestamps, duration, lat/lon, bytes).
- Real panel implementations: `SymbologyPanel`, `ChartPanel` (vue-echarts), `EntityListPanel` (TanStack vue-table with sortable columns + inline symbology), `TelemetryPanel` (live `wss://echo.websocket.events` connection), `MarkdownPanel` (markdown-it + `@tailwindcss/typography`).

#### Tools, command palette, shortcuts, common UI (Phase 7)

- Tool registry contract (`Tool` / `ToolContext` / `ToolSetupResult`); `useToolsStore` with toggle / activate / deactivate semantics and 10-entry MRU history.
- `useToolRegistry` composable that watches `activeId`, calls `setup()` / `cleanup()`, and pipes finalized features to a host-supplied callback.
- `measure-distance` and `draw-polygon` tools — no external drawing library; vertex array → dual GeoJSON sources → draggable handles → labels with halos.
- `useDrawingsStore` for finalized features (in-memory; idb persistence is on the roadmap).
- Geo modules: `coords` (DD / DMS / MGRS round-trip), `measure` (turf-backed distance / length / area / midpoint / centroid / bearing), `h3` (h3-js cell helpers with GeoJSON lon-first ordering).
- Declarative shortcut catalog with platform-conditional `mod` token; `formatCombo()` renders combos for display.
- `useKeyboardShortcuts` composable: single capture-phase `keydown` listener, skips while typing in inputs (except Escape and the palette combo); `useFullscreen` re-export.
- Common UI primitives: `ErrorBoundary` (Vue's `onErrorCaptured` with reset), `LoadingSpinner`, `EmptyState`.
- Hand-rolled `CommandPalette` (Cmd+K) with `fuzzysort`, manual arrow / enter / escape navigation, result grouping by category; tool toggles + palette hint button in TitleBar.

#### Containerization (Phase 8)

- Multi-stage `Dockerfile`: `node:22-alpine` build with Corepack-managed pnpm and a BuildKit cache mount on the pnpm store; `nginx:alpine` runtime carrying only `dist/` and the vhost config. `HEALTHCHECK` via `wget --spider`.
- `nginx.conf`: gzip (incl. `application/wasm`), long-cache immutable `Cache-Control` on hash-named `/assets/` and `/cesium/`, no-cache on `/index.html`, SPA fallback via `try_files`, security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), `server_tokens off`. CSP intentionally not set — baseline documented inline.
- `docker-compose.yml`: single `frontend` service on `8080:80` with wget healthcheck; commented backend stub showing both the compose entry and the nginx `proxy_pass` line.

#### Documentation (Phase 9)

- Ten docs under `docs/`: `architecture`, `icons`, `panels`, `tools`, `styling`, `state`, `realtime`, `theming`, `deployment`, `roadmap`. Each references real source paths and shows concrete code patterns.

### Verified

- `pnpm lint` — 0 errors (1 expected `vue/no-v-html` warning on `MarkdownPanel.vue` where `markdown-it` runs with `html: false`).
- `pnpm type-check` — clean across all four tsconfig projects.
- `pnpm test` — **66 tests passing across 12 spec files**.
- `pnpm spell` — 0 issues.
- `pnpm format:check` — clean.
- `pnpm build` — clean; initial route ~63 KB gzipped + ~42 KB lazy dock shell (≈ 17 % of the 600 KB budget). Heavy chunks (Cesium 1.1 MB, MapLibre 285 KB, ECharts 165 KB, milsymbol 197 KB, markdown-it 47 KB) live in their own lazy chunks pulled in only when the corresponding panel mounts.
- `pnpm docker:build` — produces `commandvue:local` (~150 MB on disk).

[Unreleased]: https://github.com/uraanai/CommandVue/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/uraanai/CommandVue/releases/tag/v0.1.0
