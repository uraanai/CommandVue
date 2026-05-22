# Workspaces, Layouts, and Sessions

This page is for engineers integrating with or extending CommandVue's workspace system. For a system-level overview, see [Architecture](/architecture). For operator-facing usage, see the [User guide](/user-guide).

## The shape

```
Workspace 1 ──┬── Layout A (default) ──┬── PanelState (cesium)
              │                        ├── PanelState (maplibre)
              │                        └── PanelState (entities)
              └── Layout B ─────────────── PanelState (chart)

Workspace 2 ─── Layout C (default) ──── PanelState (empty)
```

- A **Workspace** is a named collection of Layouts with exactly one default.
- A **Layout** is one named arrangement of panels — owns the Dockview-serialized JSON plus the list of panel ids in it.
- A **PanelState** is one panel instance: id, type, assignment state (`empty` / `assigned` / `configured`), state blob, and a list of applied preset ids.
- Exactly one Workspace has `isGlobalDefault: true` (the app opens it on launch).

## The store layer

Four Pinia stores wrap the repositories. UI never calls repos directly.

### `useWorkspaceStore`

```typescript
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
await workspace.loadAll();
const current = workspace.currentWorkspace; // Workspace | null
const id = workspace.currentWorkspaceId; // Ulid | null
await workspace.createWorkspace({ name: "Ops B" });
await workspace.setCurrentWorkspace(otherId);
await workspace.setGlobalDefault(otherId);
await workspace.deleteWorkspace(idToRemove); // cascades layouts + panel-states + workspace-scoped presets
```

The current pointer persists to `app-meta` under `current-workspace-id` — reloads restore it.

### `useLayoutStore`

Scoped to whichever workspace is loaded.

```typescript
import { useLayoutStore } from "@/stores/layout";

const layoutStore = useLayoutStore();
await layoutStore.loadForWorkspace(workspaceId);
await layoutStore.createLayout({ workspaceId, name: "Compact" });
await layoutStore.renameLayout(id, { name: "Renamed" });
await layoutStore.duplicateLayout(id, { name: "Forked" });
await layoutStore.setDefaultForWorkspace(workspaceId, layoutId);
await layoutStore.deleteLayout(id); // refuses if it's the last layout in workspace
```

Pointer persists to `app-meta` under `current-layout-id`.

### `usePanelStateStore`

Map-cached, keyed by panel id.

```typescript
import { usePanelStateStore } from "@/stores/panelState";

const panels = usePanelStateStore();
await panels.loadForLayout(layoutId);
const ps = panels.getState(panelId);
await panels.assignComponent(panelId, "maplibre", "configured");
await panels.clearComponent(panelId); // wipes state, marks empty
await panels.createEmptyPanel(layoutId); // returns a PanelState with panelType: null
await panels.deletePanel(panelId);
await panels.applyPreset(panelId, presetId); // re-applying an existing preset moves it to the end (raises precedence)
await panels.removePreset(panelId, presetId);
```

### `useSessionStore`

Bridge between persisted state and the live Dockview instance. The `DockviewApi` is held in a **module-scope `shallowRef`** outside the Pinia state surface — never put it in store state.

```typescript
import { useSessionStore } from "@/stores/session";

const session = useSessionStore();
session.bindDockview(api); // call from DockLayout.vue @ready
await session.loadLayout(layoutId);
session.markDirty(); // every onDidLayoutChange marks dirty
await session.updateCurrentLayout(); // Save Layout (Cmd/Ctrl+S)
await session.saveCurrentAsNewLayout({
  name: "Saved",
  description: "Optional",
  setAsWorkspaceDefault: true,
});
await session.discardChanges(); // re-load persisted state
await session.switchWorkspace(otherId); // assumes dirty was resolved by the caller
session.unbindDockview(); // on unmount
```

## The eight invariants

Repositories enforce these at the IndexedDB layer; Supabase will enforce them via constraints + triggers (see [`supabase-migration.md`](/supabase-migration)).

1. **Exactly one workspace** has `isGlobalDefault: true`.
2. **Every workspace** has a valid `defaultLayoutId` except transiently during creation.
3. **Every layout** belongs to exactly one workspace. Cascade delete.
4. **Every panel-state** belongs to exactly one layout. Cascade delete.
5. **At least one workspace** always exists; `workspaceRepo.delete` refuses the last one.
6. **At least one layout per workspace** always exists; `layoutRepo.delete` refuses the last in a workspace.
7. **At least one chrome profile** has `isDefault: true`.
8. **Workspace-scoped presets** cascade-delete with their workspace. Global presets persist.

Plus one runtime rule: **dangling preset references** in panel-states are silently dropped at apply time (the preset registry's `get` returns `undefined`).

## Repository API

Stores wrap these. Direct repo calls are valid for non-UI code (seed scripts, the portable export/import, tests).

| Repo                | Highlights                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workspaceRepo`     | `create`, `getById`, `getGlobalDefault`, `list`, `update`, `setGlobalDefault`, `delete` (cascades)                                                                             |
| `layoutRepo`        | `create`, `getById`, `listByWorkspace`, `update`, `delete` (cascades + repoints default), `duplicate` (fresh ULIDs + dockview-ref rewriting)                                   |
| `panelStateRepo`    | `create`, `getById`, `listByLayout`, `update`, `delete`, `bulkDeleteByLayout`, `applyPreset` (cascading order), `removePreset`                                                 |
| `presetRepo`        | `create`, `getById`, `list({ workspaceId?, presetTypeId? })`, `listGlobal`, `listForWorkspace`, `update`, `delete` (refuses on conflict unless `{ force: true }`), `duplicate` |
| `chromeProfileRepo` | `create`, `getById`, `getDefault`, `list`, `update`, `setDefault`, `delete` (refuses default + last)                                                                           |
| `appMetaRepo`       | `get<T>`, `set<T>`, `delete`                                                                                                                                                   |

All repos throw typed errors: `InvariantError`, `NotFoundError`, `ConflictError`.

## Common patterns

### Creating a workspace from code

```typescript
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

const ws = await workspaceRepo.create({ name: "QA", isGlobalDefault: false });
// Invariant 6: every workspace needs ≥1 layout before the user can switch in.
const layout = await layoutRepo.create({ workspaceId: ws.id, name: "Default" });
await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });
```

`ManageWorkspacesDialog.create` does exactly this.

### Migrating workspaces between machines

Use the portable JSON helpers (`src/modules/workspaces/portable.ts`):

```typescript
import { exportWorkspace, importWorkspace } from "@/modules/workspaces/portable";

const payload = await exportWorkspace(workspaceId, { includeChrome: true });
// → JSON.stringify(payload) → download or sync

const imported = await importWorkspace(payload, { renameOnConflict: true, importChrome: false });
// imported.id is fresh; every nested record gets a new ULID; preset refs are rewritten.
```

`schemaVersion: 2` — bumping requires explicit handling. Imports with the wrong version are refused.

### Enforcing a custom invariant

Wrap the repo call in your own helper. Don't add the rule to the repo itself unless it's universally true.

```typescript
import { layoutRepo } from "@/modules/storage/layoutRepo";

export async function createOpsLayout(workspaceId: Ulid, name: string) {
  if (!name.startsWith("OPS-")) {
    throw new Error("Ops layouts must be prefixed with OPS-");
  }
  return layoutRepo.create({ workspaceId, name });
}
```

## What NOT to do

- **Don't put `DockviewApi` in Pinia state.** It's held in `src/stores/session.ts` as a module-scope `shallowRef` outside the returned store surface. Same rule for live MapLibre / Cesium / ECharts instances — those go in `src/modules/panels/instances.ts`.
- **Don't bypass the repo layer.** Components and dialogs go through stores; stores go through repos. Direct `idb` calls in component code make migration to Supabase impossible.
- **Don't store reactive values in panel-state `state`.** The `state` field is JSON-serializable. Use the imperative panel-instance registry for live values that don't need persistence.
- **Don't create a workspace without a layout.** Invariant 6 fires the moment you try to switch into it.
