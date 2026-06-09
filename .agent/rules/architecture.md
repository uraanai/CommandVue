# Architecture & conventions

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Architectural rules

1. **Cesium and MapLibre run in separate DOM containers with separate render loops.** Do not attempt to sync cameras automatically. If sync is needed for a specific feature, it is opt-in and lives in a composable.
2. **Viewer/map instances are never stored in reactive state.** Hold them in `shallowRef` or plain refs. Reactive proxies break Cesium's internals.
3. **Tools (measure, draw, select) register through the Tool Registry pattern** (`src/modules/tools/registry.ts`). Tools must implement `activate()`, `deactivate()`, and clean up all listeners.
4. **Pinia stores hold serializable state only.** No DOM refs, no Cesium objects, no Map instances in stores.
5. **Composables own lifecycle.** Initialization and teardown of viewers/maps happens in composables, not components.
6. **One panel = one component in `src/components/panels/`.** Panels are registered globally via `app.component(id, ...)` in `main.ts` (Dockview resolves panel components from Vue's global registry). The **Panel Registry** (`src/modules/panels/registry.ts`) owns the metadata — title, icon, category, async loader, lifecycle hooks — used by menus and (from Phase F) preset application.

---

## Panel Registry

The Panel Registry is the single source of truth for "what panel types exist in this app."

- **Source of truth:** `src/modules/panels/registry.ts` (singleton `panelRegistry`).
- **Built-in registration:** `registerBuiltinPanels()` in `src/modules/panels/builtin.ts`, called once from `main.ts` before `app.mount()`.
- **Definition shape:** `PanelDefinition` in `src/modules/panels/types.ts` — `id`, `title`, `description`, `icon` (Lucide name), `category`, async `component()` loader, optional `singleton`, optional `serialize` / `restore` lifecycle hooks (wired in Phase G).
- **Dockview integration:** the registry does NOT replace `app.component()`. Dockview-vue 6 resolves panel components from Vue's global registry. The registry sits alongside it and adds metadata for the View / Components Panel / Add Component menu and the Phase F preset `applicableTo` contract. The `id` field of a registry entry must equal the string passed to `app.component()` and to `addPanel({ component: id })`.
- **Synthetic types:** `UNASSIGNED_PANEL_TYPE = "__unassigned__"` (in `src/modules/panels/unassigned.ts`) reserves the namespace for empty panels (assignment state: `empty`). Underscore-prefixed ids are reserved for synthetic types and must not be used by real panels.
- **Extending downstream:** apps that fork CommandVue add their own panel types via `panelRegistry.register({ id, ... })` plus an `app.component(id, ...)` registration. The registry exposes `subscribe()` so UI surfaces stay in sync as types are added at runtime.
- **Categories:** `charts`, `data`, `docs`, `maps`, `monitoring`, `tools`. Use the closest match; don't invent one-offs.
- **Test seam:** `panelRegistry.__resetForTests()` / `__unregisterBuiltinPanelsForTests()` exist for spec isolation. Never call them from app code.

---

## Chrome System

The Chrome System owns the persistent application UI surrounding the dock — top bar, status bar, and all their items.

- **Source of truth:** `src/modules/chrome/registry.ts` (singleton `chromeItemRegistry`) + `src/stores/chrome.ts` (`useChromeStore`) + `src/components/chrome/ChromeBar.vue` (renders one bar with three slots).
- **Built-in registration:** `registerBuiltinChromeItems()` in `src/modules/chrome/builtin.ts`, called once from `main.ts` before mount.
- **Slots:** `top-left`, `top-center`, `top-right`, `status-left`, `status-center`, `status-right` — defined in `src/types/chrome.ts` (`CHROME_SLOTS`).
- **Item shape:** `ChromeItemDefinition` in `src/modules/chrome/types.ts` — `id`, `title`, `description`, `icon` (Lucide), `allowedSlots`, optional `defaultSlot`, async `component()` loader, `removable`, `singleton`.
- **The always-on rule:** `app-icon` is registered with `removable: false`. Its right-click context menu mirrors the MenuBar's File / Edit / View structure — when the user hides the menu bar (View → Hide Menu Bar) the app icon remains the only path to those actions. Never make `app-icon` removable, never allow it in slots other than `top-left`.
- **Permission gating:** `useChromeStore.canEdit` is the extension point. Phase E returns `true` (unconditional). Downstream apps replace this computed with their own permission check (e.g. read from a session store). When `canEdit` is `false`, `enterEditMode` is a no-op and `EditModeToggleItem` doesn't render.
- **Edit mode:** `useChromeStore.editMode` toggles via the EditModeToggle item or the app-icon context menu. In edit mode, slots show a dashed border, present items get an `×` badge (only for `removable: true`), and a `+` button per slot opens a dropdown of items that can be added (filtered by `allowedSlots` and excluding items already present elsewhere).
- **Persistence:** active arrangement is a `ChromeProfile` record persisted via `chromeProfileRepo`. Exactly one profile has `isDefault: true`. The store auto-persists every mutation to the active profile.
- **Test seam:** `chromeItemRegistry.__resetForTests()` / `__unregisterBuiltinChromeItemsForTests()` exist for spec isolation. Never call them from app code.

---

## Presets

Typed bundles of visual configuration applied to panels at runtime.

- **Source of truth:** `src/modules/presets/registry.ts` (`presetTypeRegistry`) + `src/stores/preset.ts` (`usePresetStore`).
- **Built-in registration:** `registerBuiltinPresetTypes()` in `src/modules/presets/builtin.ts`, called once from `main.ts` before mount. Ships three example types: `map-style` (runtime-wired to `map.setStyle`), `map-overlay` and `chart-theme` (registered with stub `applyToPanel`s — downstream apps replace these with tailored implementations).
- **Type shape:** `PresetTypeDefinition<TConfig>` in `src/modules/presets/types.ts` — `id`, `title`, `description`, `icon`, `applicableTo` (panel-type ids), `defaultConfig`, async `editComponent`, `applyToPanel(panelId, config)`, optional `removeFromPanel`.
- **Records vs types:** a `Preset` record (`src/types/preset.ts`) is one user-created instance of a type, persisted via `presetRepo`. Records have `workspaceId: null` (global to user) or a workspace id (scoped, cascades on workspace delete).
- **Runtime apply path:** the panel component watches `panelStateStore.getState(panelId)?.appliedPresetIds`. On change, it iterates in order (later overrides earlier — CSS-cascade semantics) and calls `presetTypeRegistry.get(typeId).applyToPanel(panelId, config)`. Panel components reach their live instance via the **panel-instance registry** (`src/modules/panels/instances.ts`) — each panel registers its imperative handle on mount.
- **Cascading order** is enforced by `panelStateRepo.applyPreset`: re-applying an already-applied preset moves it to the end of `appliedPresetIds`, raising its precedence.
- **`applicableTo` contract:** preset types declare which panel types they apply to. The Apply Preset dialog filters candidates by panel type; downstream apps adding panels must opt in by listing them here.
- **Test seam:** `presetTypeRegistry.__resetForTests()` / `__unregisterBuiltinPresetTypesForTests()` for spec isolation.

---

## State management rules

- One store per concern. Don't create kitchen-sink stores.
- Stores expose actions; components don't mutate state directly.
- Use `storeToRefs` when destructuring state in components.
- Persist layout state via `idb`, not localStorage (larger quota, async).

---

## File / folder conventions

- Components: PascalCase (`EntityListPanel.vue`).
- Composables: camelCase, prefixed with `use` (`useCesium.ts`).
- Stores: lowercase singular (`ui.ts`, `telemetry.ts`).
- Modules: lowercase, domain-grouped (`modules/symbology/`, `modules/geo/`).
- Types: colocated with their module; shared types in `src/types/`.

---

## Testing conventions

- Unit tests in `tests/unit/` mirror `src/` structure.
- Use Vitest + @vue/test-utils.
- Test utilities, composables, and store logic. Don't aim for component snapshot coverage.
