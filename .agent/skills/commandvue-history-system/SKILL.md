---
name: commandvue-history-system
description: Use when adding undo/redo to an action, editing the history engine, or writing a history adapter.
when_to_use: |
  - Editing src/stores/history.ts or src/modules/history/*
  - Adding a new undoable action (writing an adapter under src/modules/history/adapters/)
  - Wiring a dialog / handler through history.execute(...) or runInTransaction(...)
  - Anyone says "undo", "redo", "reversible", "command", "coalesce", or "history stack"
---

# CommandVue History (Undo / Redo) System

> Public usage docs: [`docs/undo-redo.md`](../../../docs/undo-redo.md). Design rationale: [ADR 0005](../../../docs/decisions/0005-undo-redo-reversible-command-pattern.md).

The history system makes user actions reversible via a **reversible command
pattern**: undo calls the **real inverse** store/repo API, never a detached state
mirror. _Insert → undo deletes; delete → undo inserts._

| Layer               | What it is                                                                              | Where it lives                                     |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Engine**          | per-workspace undo/redo stacks + execute / undo / redo / runInTransaction               | `src/stores/history.ts` (`useHistoryStore`)        |
| **Building blocks** | `Command` / `Transaction` types, `makeCommand` / `makeTransaction`, immer patch helpers | `src/modules/history/{types,factories,patches}.ts` |
| **Adapters**        | factory fns closing over live stores/repos, returning a `Command`                       | `src/modules/history/adapters/*`                   |

## The `Command` contract

```typescript
interface Command {
  readonly id: string; // nanoid
  readonly label: string; // "Add polygon" — shown in menus/tooltips/History panel
  readonly scope: HistoryScope; // "drawings" | "panel-state" | "workspace" | …
  readonly category?: HistoryCategory; // "create" | "update" | "delete" | …
  redo(): void | Promise<void>; // forward op — runs on execute AND every redo
  undo(): void | Promise<void>; // the REAL inverse
  readonly coalesceKey?: string; // merge rapid same-key edits within 400 ms
  readonly meta?: Readonly<Record<string, unknown>>;
}
```

## Making an action undoable — the touchpoints

1. **Write an adapter** in `src/modules/history/adapters/<store>.ts` — a
   `makeXCommand(...)` that closes over the store/repo and returns a `Command`.
   Export it from `adapters/index.ts`.
2. **Call it at the user-intent boundary** (a dialog handler, a finalize
   callback): `await history.execute(makeXCommand(...))`. Never call it inside a
   store action that also runs during restore / load.
3. **Add a unit test** in `tests/unit/history/adapters/<store>.spec.ts` —
   round-trip through the real store (`resetForStoreTest` + fake-indexeddb for
   persisted stores).

See [`reference/command-template.ts`](./reference/command-template.ts) for a copy-paste scaffold.

## Patterns by store type

- **In-memory store** (drawings): redo adds, undo removes. Re-capture the live id
  on each replay so remove → undo → redo stays consistent (the store mints a fresh
  id per add).
- **Persisted blob edit** (panel-state): use `makeUpdatePanelStateCommand` /
  `capturePatches` + `makePatchCommand` — immer inverse-patches applied through the
  real `updateState` (idb + reactive cache).
- **Persisted CRUD with cascade** (workspace delete): snapshot the whole cascade
  before delete and re-insert by **original id** with raw `getDb().add(...)` (only
  `panelStateRepo.create` accepts an explicit id), then reload the affected stores.
  Wrap multi-call user intents in `runInTransaction`.
- **Non-serializable (Dockview)**: `makeDockviewLayoutCommand` snapshots
  `api.toJSON()` before/after and restores via `fromJSON` inside
  `session.setRestoring(true)`.

## Engine invariants

- **`isApplying` guard** — set during undo/redo so replays never re-record. It
  composes with the Dockview layer's `session.restoring` (which suppresses
  `markDirty`); a dock undo sets both — they're orthogonal.
- **Coalescing** — `coalesceKey` + 400 ms window; the merge keeps the **older
  `undo`** baseline + the **newer `redo`**.
- **Transaction atomicity** — a throw mid-`runInTransaction` undoes applied
  children in reverse and rethrows; nothing partial lands.
- **Per-workspace scope** — switching workspaces drops the prior stack
  (`setActiveWorkspace`), kept in sync by the watcher in `App.vue`.
- **Capacity** — cap 100, evict oldest. In-memory only; cleared on reload.

## Common mistakes

- Calling `history.execute(...)` inside a store action that also runs during
  `loadLayout` / restore — record only **user-initiated** actions, at the call
  site.
- Capturing ids / prior values inside `undo()` instead of `redo()` — `redo()` is
  the capture point (it runs first, on execute).
- Hand-writing the inverse of a nested blob instead of using immer patches.
- Re-inserting a deleted record with a new id — snapshot + restore by original id
  so later commands referencing that id still resolve.
- Forgetting to reload a `shallowRef`-backed store after a raw `getDb().add(...)`
  restore (the array is replaced wholesale; in-place mutation isn't observed).

## Reference files

- [`reference/command-template.ts`](./reference/command-template.ts) — copy-paste adapter scaffold.
- Public docs: [`docs/undo-redo.md`](../../../docs/undo-redo.md).
