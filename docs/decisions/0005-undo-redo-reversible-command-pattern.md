# 0005. Undo / Redo — reversible command pattern (not state snapshots)

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Project maintainer
- **Relates to:** the Panel / Preset / Chrome registries and the idb repos under `src/modules/storage/`

## Context

CommandVue needs app-wide undo/redo across heterogeneous surfaces: in-memory map
drawings, idb-persisted workspace / layout / preset CRUD (with cascading
deletes), non-serializable Dockview layout state, panel-state blobs, and theme
commits. One mechanism has to span ~13 Pinia stores, 7 idb repos, and the
Dockview API — and stay extensible for downstream forks (this repo is a
template).

## Decision

Adopt a **reversible command pattern**. Each undoable action is a
`Command { label, scope, redo(), undo() }` whose `undo()` calls the **real
inverse** store/repo operation (insert ⇄ delete, apply ⇄ remove) — _undo invokes
the real inverse API, not a detached state mirror_. Commands compose into a
`Transaction` committed, and undone, as a single step.

For tedious nested-state blobs (a panel's `state`), a command may capture
**immer inverse-patches** internally (`produceWithPatches` / `applyPatches`),
wrapped inside a `Command` — never as the top-level engine.

History is **in-memory, per-session, scoped per workspace** (cleared on reload
and on workspace switch), capacity-capped at 100 entries, with a 400 ms
coalescing window and an `isApplying` reentrancy guard that composes with the
Dockview layer's existing `session.restoring` flag.

The engine lives in `src/stores/history.ts`; building blocks in
`src/modules/history/{types,factories,patches}.ts`; adapters (factory functions
closing over live stores/repos) in `src/modules/history/adapters/*`. Call sites
invoke `history.execute(makeXCommand(...))` at the user-intent boundary.

## Options considered

### Reversible command pattern — chosen

Only model that calls the **real inverse API**, composes cross-store cascades
(workspace delete → layouts → panel-states → presets) into one undo step, and
maps onto both serializable idb state and non-serializable dock/map state. Costs
a small custom core (~250 LOC) and one adapter per surface, but stays explicit
and extensible.

### immer `produceWithPatches` as the top-level engine

Generates forward + inverse patches in one pass — ideal for nested blobs, so it
is **used internally** inside `makePatchCommand`. Rejected as the _top-level_
engine: patches model object diffs, not "call the delete API", so they can't
express cross-store cascades or non-serializable dock operations.

### rfc6902 (JSON Patch over whole-object diffs)

Diffs two whole objects — needs snapshots and is more expensive than immer, which
captures inverse patches for free during a mutation. Left listed-but-unused in the
stack; revisit only if network state-sync is added.

### `@vueuse/core` useRefHistory / `pinia-undo` (whole-store snapshots)

Single-ref or whole-store snapshots: no cross-store atomic undo, no action
semantics (labels/scopes), deep-clone cost, and they snapshot serializable state
only (can't capture the Dockview API or map instances). Fine for an isolated form
ref; wrong for an app-wide system.

### idb-persisted history

Rejected for v1: persisting commands that close over live objects is unsound, and
session-scoped history matches user expectations (a reload is a clean slate).

## Consequences

- Each new undoable surface needs a small adapter; the `commandvue-history-system`
  skill documents the recipe and ships a copy-paste template.
- Deletes whose repos mint fresh ids restore by snapshotting the full record(s)
  and re-inserting by **original id** via raw `getDb().add(...)` (only
  `panelStateRepo.create` accepts an explicit id today).
- History is lost on reload and on workspace switch — an intentional simplicity
  trade, documented in `docs/undo-redo.md`.
- Two scopes are reserved but inert in v1: `entities` (no producer yet) and
  `chrome` (global-vs-per-workspace mismatch). Dockview undo is snapshot-based and
  does not restore header-hidden / float-opacity / float-maximized visuals; theme
  _authoring_ is not undoable (only the committed theme pointer is).

## References

- `docs/undo-redo.md`
- `src/stores/history.ts`, `src/modules/history/*`
- Reference implementation borrowed two ideas (patch-based inverse for blobs;
  transaction batching) from Orbit Mapper's `immerStore`, without its smells
  (manual JSON-pointer conversion, no coalescing, unbounded stacks).
