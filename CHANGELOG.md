# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Changed

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
