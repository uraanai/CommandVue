---
name: commandvue-workspace-system
description: Use when working with workspaces, layouts, panel-states, sessions, or the storage repositories in CommandVue.
when_to_use: |
  - Editing src/stores/workspace.ts, layout.ts, panelState.ts, or session.ts
  - Editing any repository under src/modules/storage/
  - Adding or modifying workspace/layout/session invariants
  - Writing migrations that touch these stores
  - Touching src/modules/workspaces/portable.ts (export/import)
---

# CommandVue Workspace System

> **Library-first reminder:** any UI surface inside this subsystem (management dialogs, save-as flows, import/export wiring) must use PrimeVue components — never hand-rolled equivalents. The portable-JSON import flow specifically uses PrimeVue `FileUpload` (`mode="basic"` + `customUpload` + ref-triggered `choose()`), not a DOM `input[type=file]`. See [`CLAUDE.md → Library-first rule`](../../../CLAUDE.md) and [`workflows/library-first.md`](../../workflows/library-first.md).

The workspace system owns the data model: workspaces contain layouts contain panel-states. Repositories persist to IndexedDB; Pinia stores wrap the repos as read-through caches; one session store bridges the persisted state to the live Dockview instance.

## The four stores

| Store                | Owns                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `useWorkspaceStore`  | The list of workspaces + the active-workspace pointer            |
| `useLayoutStore`     | Layouts of the active workspace + the active-layout pointer      |
| `usePanelStateStore` | Panel-state cache for the loaded layout                          |
| `useSessionStore`    | DockviewApi (module-scope ref), dirty flag, save/discard actions |

Two `app-meta` keys carry the "where am I" pointer across reloads: `current-workspace-id` and `current-layout-id`. These are written via `setCurrentWorkspace` / `setCurrentLayout` and read at store `loadAll` / `loadForWorkspace` time.

## The eight invariants

See [`reference/invariants.md`](./reference/invariants.md) for the full table with code-level enforcement points.

1. Exactly one workspace `isGlobalDefault: true`.
2. Every workspace has a valid `defaultLayoutId`.
3. Every layout belongs to exactly one workspace. Cascade delete.
4. Every panel-state belongs to exactly one layout. Cascade delete.
5. ≥ 1 workspace always exists (last can't be deleted).
6. ≥ 1 layout per workspace.
7. Exactly one chrome profile `isDefault: true`.
8. Workspace-scoped presets cascade with their workspace. Global presets persist.

Plus one runtime rule: dangling preset references in `panel-states.appliedPresetIds` are silently dropped at apply time.

## Critical guardrails

- **Never put `DockviewApi` in Pinia state.** It's held in `src/stores/session.ts` as a module-scope `shallowRef` outside the returned store surface. CLAUDE.md rule 4 forbids non-serializable values in stores. Same goes for live MapLibre / Cesium / ECharts instances — those live in `src/modules/panels/instances.ts`.
- **Never bypass the repo layer.** Components → stores → repos. Direct `idb` calls in component code break the Supabase migration path.
- **Never create a workspace without a layout.** Invariant 6 fires the moment the user switches into it. `ManageWorkspacesDialog.create` auto-creates a "Default" layout — match that pattern.
- **Cascade lives in the parent repo.** Workspace delete cascades to layouts → panel-states → workspace-scoped presets, all in one transaction. Don't walk the tree manually from store code.

## Transactional patterns

`layoutRepo.delete` runs in one transaction across `layouts`, `panel-states`, and `workspaces` (to repoint `defaultLayoutId` if needed). `workspaceRepo.delete` runs across `workspaces`, `layouts`, `panel-states`, and `presets`. Don't introduce out-of-transaction multi-store writes.

## Common mistakes

See [`reference/common-mistakes.md`](./reference/common-mistakes.md) for the full list. Highlights:

- Storing reactive Dockview API in Pinia state → leaks into devtools, breaks serialization, can't be moved to Supabase.
- Creating a workspace without a layout → user can't switch in (invariant 6).
- Putting business logic in the repo layer → repos must stay schema-pure for the Supabase swap.

## Supabase migration

The repo abstraction IS the migration contract. Swapping the implementation under those exports moves the entire app from IndexedDB to Supabase. See [`reference/data-model.md`](./reference/data-model.md) for the store→table mapping and `docs/supabase-migration.md` for the full plan.

## Reference files

- [`reference/data-model.md`](./reference/data-model.md)
- [`reference/invariants.md`](./reference/invariants.md)
- [`reference/common-mistakes.md`](./reference/common-mistakes.md)
