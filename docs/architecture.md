# Architecture

CommandVue is a Vue 3 boilerplate for operations dashboards. This page is the system-level overview — for engineer-facing details on each subsystem, see the dedicated pages: [Workspaces](/workspaces), [Panels](/panels), [Presets](/presets), [Chrome](/chrome).

## The big picture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Chrome (top bar + status bar + items)         ← ChromeProfile       │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  Dockview (DockLayout.vue)                                 │      │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │      │
│  │  │  Panel       │  │  Panel       │  │  Panel       │      │      │
│  │  │  (Cesium)    │  │  (MapLibre)  │  │  (Chart)     │      │      │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │      │
│  └────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Pinia stores    │  │ Panel registry  │  │ Preset registry │
│  workspace      │  │ Chrome registry │  │ Panel-instance  │
│  layout         │  │ Preset-type reg │  │  registry       │
│  panelState     │  │                 │  │                 │
│  session        │  │                 │  │                 │
│  preset         │  │                 │  │                 │
│  chrome         │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│  Repositories (typed CRUD over idb)          │
│  workspaceRepo  layoutRepo  panelStateRepo   │
│  presetRepo  chromeProfileRepo  appMetaRepo  │
└──────────────────────────────────────────────┘
        │
        ▼
   IndexedDB (commandvue-workspaces)
```

## The vocabulary

These terms appear in code identifiers, store names, component names, and user-facing prose. Use them exactly — don't invent synonyms.

| Term                         | Meaning                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Panel**                    | Single component instance hosted in one Dockview tab. ULID-identified. Has an `assignmentState` — `empty` / `assigned` / `configured`.                                    |
| **Layout**                   | Named saved arrangement of panels. Owns Dockview's serialized JSON plus the list of panel IDs. Belongs to exactly one Workspace.                                          |
| **Workspace**                | Named collection of Layouts. Exactly one default Layout. Represents a mode or role.                                                                                       |
| **Session**                  | Live in-memory dock state on screen. Tracks the `dirty` flag.                                                                                                             |
| **Preset**                   | Typed bundle of visual configuration. Has a `presetType` defining its schema and applicable panel types. Can be **global** (`workspaceId: null`) or **workspace-scoped**. |
| **Preset Type**              | The schema and capabilities of a class of presets. Registered via `presetTypeRegistry`.                                                                                   |
| **Global default workspace** | The Workspace opened at app launch. Exactly one Workspace has this flag.                                                                                                  |
| **Chrome**                   | The persistent UI surrounding the dock: menu bar, app icon, workspace switcher, status bar, slot-based items.                                                             |
| **Chrome Slot**              | A region of chrome that holds Chrome Items: `top-left`, `top-center`, `top-right`, `status-left`, `status-center`, `status-right`.                                        |
| **Chrome Item**              | An individual element placed in a slot. Registered via `chromeItemRegistry`.                                                                                              |
| **Chrome Profile**           | The user's saved chrome configuration. Persisted.                                                                                                                         |

## Five subsystems, one data model

| Subsystem  | Owns                                 | Key files                                                                                     |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Storage    | IndexedDB schema + repositories      | `src/modules/storage/`                                                                        |
| Panels     | Registry + lifecycle                 | `src/modules/panels/`, `src/components/panels/`                                               |
| Workspaces | Stores + session bridge to Dockview  | `src/stores/{workspace,layout,panelState,session}.ts`, `src/components/layout/DockLayout.vue` |
| Presets    | Typed visual configs + apply runtime | `src/modules/presets/`, `src/stores/preset.ts`                                                |
| Chrome     | Slot-driven app shell                | `src/modules/chrome/`, `src/components/chrome/`, `src/stores/chrome.ts`                       |

All five share **one IndexedDB schema** (six stores; see [Supabase migration](/supabase-migration)). The repositories are the only path that touches IndexedDB — stores call repos, components call stores. No component reads the DB directly.

## Lifecycle: app boot to first render

1. **`main.ts` top-level await:**
   - `await seedIfEmpty()` ensures a default Workspace + Layout + ChromeProfile exist.
   - `registerBuiltinPanels()` + `registerUnassignedPanel()` + `registerMissingPanel()` + `registerBuiltinChromeItems()` + `registerBuiltinPresetTypes()` populate the four registries.
2. **`createApp(App)` + Pinia + router + PrimeVue installed.**
3. **`app.component(...)` registrations** for every panel type (Dockview-vue 6 resolves panel components from Vue's global registry).
4. **`app.mount('#app')`.**
5. **`App.vue.onMounted`** loads workspace + layout + presets stores; renders a loading splash until `workspaceStore.ready`.
6. **`AppShell.vue`** mounts (chrome loads its profile in parallel); two `ChromeBar`s render around `<RouterView />`.
7. **`HomeView` → `DockLayout`** binds Dockview to the session store; session loads the current layout.
8. **First panel mount** — each panel component reads its `panel-state` record, optionally restores via `usePanelState`, registers any imperative instance via `registerPanelInstance`, applies any `appliedPresetIds` in cascade order.

## Key architectural decisions

### 1. Repos own the schema; stores own the cache

Repositories are stateless functions over `idb`. Stores are read-through caches that re-load from repos on every mutation. No store has a long-lived in-memory snapshot it tries to keep in sync.

### 2. Non-serializable instances live outside Pinia state

Three places hold non-serializable values that the architecture deliberately keeps out of Pinia state (per CLAUDE.md rule 4):

- **`DockviewApi`** — module-scope `shallowRef` in `src/stores/session.ts`.
- **`MapLibre`, `Cesium`, `ECharts` instances** — module-scope map in `src/modules/panels/instances.ts`, keyed by panel id.
- **Panel-state `state` field** — JSON-serializable; the imperative APIs use the instances registry for runtime mutation.

### 3. Registry pattern, repeated four times

Same shape for panels, chrome items, preset types, and (implicitly) tools: a singleton with `register` / `unregister` / `get` / `list` / `subscribe`, populated once at startup, extensible by downstream apps.

### 4. Cascade behavior centralized in parent repos

Workspace delete cascades to layouts → panel-states → workspace-scoped presets. Layout delete cascades to panel-states. The cascade logic lives in the parent repository's `delete()` so callers never need to walk the tree manually.

### 5. ULIDs everywhere persisted

`src/modules/storage/ids.ts` uses `monotonicFactory()` so same-millisecond writes are still strictly ordered. IDs are 26-char Crockford base32 strings, ready to migrate to Postgres `text` columns.

### 6. The `app-icon` always-on rule

`app-icon` is the only `removable: false` chrome item. Its right-click context menu mirrors the MenuBar's File / Edit / View structure — when the user hides the menu bar, the app icon remains the only path to those actions. This rule is hard: never make `app-icon` removable, never allow it in slots other than `top-left`.

### 7. The `canEdit` auth seam

`useChromeStore.canEdit` is a `computed` that returns `true` today. It's the single integration point for downstream apps that wire authentication — replace this computed with a check against a session store, and every gate in the chrome system (edit mode, slot mutations) starts honoring it.

## Data flow: a representative interaction

User: **picks a preset from the Apply Preset dialog**.

```
ApplyPresetDialog.vue
   └─→ presetStore.applyToPanel(panelId, presetId)
         ├─→ panelStateStore.applyPreset(panelId, presetId)
         │     └─→ panelStateRepo.applyPreset(panelId, presetId)
         │           └─→ writes panel-states.appliedPresetIds in IDB
         │                 (later overrides earlier — CSS cascade semantics)
         └─→ presetTypeRegistry.get(typeId).applyToPanel(panelId, config)
               └─→ getPanelInstance(panelId)  → live MapLibre map
                     └─→ map.setStyle(config.styleUrl)
```

The panel's own `watch` on `appliedPresetIds` also fires, re-applying every preset in order. This handles edits made out-of-band (e.g., another tab via Supabase Realtime in the future).

## See also

- [Workspaces](/workspaces) — store APIs, repo APIs, invariants
- [Panels](/panels) — registry, lifecycle, state schema, worked example
- [Presets](/presets) — registry, `applyToPanel` contract, cascading order, worked example
- [Chrome](/chrome) — slots, items, edit mode, the `canEdit` extension point
- [User guide](/user-guide) — operator-facing
- [Extending](/extending) — for teams forking CommandVue
- [Supabase migration](/supabase-migration) — IndexedDB → Postgres contract
- [Keyboard shortcuts](/keyboard-shortcuts)
