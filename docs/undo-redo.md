# Undo / Redo

CommandVue ships an app-wide undo/redo system. Most meaningful user actions are
reversible: map drawings, panel-opacity edits, Dockview panel close, and
workspace / layout / preset CRUD (including a cascading workspace delete), plus
theme commits.

Press **Ctrl/Cmd + Z** to undo and **Ctrl/Cmd + Shift + Z** (or **Ctrl + Y**) to
redo. You can also use the undo/redo buttons in the top bar, the **Edit → Undo /
Redo** menu, or open the **History** panel to see and jump around the timeline.

## Mental model — undo calls the real inverse

The engine is a **reversible command pattern**, not a detached state-snapshot
mirror. Every undoable action is a `Command { label, scope, redo(), undo() }`
whose `undo()` invokes the **real inverse store/repo operation**:

> If the user inserts something, undo calls the delete API; if the user deletes,
> undo calls insert.

So undo flows through the same store actions (idb writes + reactive caches) as
the original action — reactive consumers re-render exactly as they would for a
normal edit. For tedious nested-state blobs (a panel's `state`), a command may
capture **immer inverse-patches** internally instead of hand-writing the inverse,
but the outer abstraction is always a `Command`.

## In-memory, per-session, per-workspace

- History is **in-memory** — it is **not** persisted. A reload starts with an
  empty stack (so commands may close over live objects).
- It is **scoped per workspace**. Switching workspaces drops the stack of the one
  you leave, so history never bleeds across workspaces. A watcher in `App.vue`
  keeps `history.setActiveWorkspace(...)` in sync with the active workspace.
- The undo stack is capped at **100** entries (oldest evicted).

## What's undoable (v1)

| Scope             | Undoable actions                                            | Surface                              |
| ----------------- | ----------------------------------------------------------- | ------------------------------------ |
| `drawings`        | add / remove / clear a finalized drawing                    | Map tools (measure, draw-polygon)    |
| `panel-state`     | edit a panel's `state` blob (immer patches); window opacity | Float-window opacity slider          |
| `dockview-layout` | close window, close-all-in-group                            | Float / group header close buttons   |
| `workspace`       | create, rename, set-default, **cascading delete**           | Manage Workspaces dialog             |
| `layout`          | rename, delete, duplicate, set-default                      | Manage Layouts dialog                |
| `preset`          | create, update, delete, duplicate                           | Manage Presets / Edit Preset dialogs |
| `theme`           | commit a theme (global or per-workspace)                    | Theme Picker dialog                  |

### Deliberately excluded

- **Ephemeral surfaces:** command-palette open/close, tool activation, telemetry
  stream buffers, and in-progress theme **preview** drafts (only theme _commits_
  are undoable).
- **`entities`** — the entities store is mock seed data with no user-edit or
  stream producer yet, so there is nothing to record. The `entities` scope is
  reserved for when entity-editing UI lands.
- **`chrome`** arrangement — deferred: it is edit-mode-only, and chrome profiles
  are global while history is per-workspace (rearranging chrome in workspace A
  then switching to B would leave it un-undoable). Reserved for a later pass.

## Using it

- **Keyboard:** `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redo. While a
  text field is focused, the browser's native text-undo wins — the global handler
  steps aside.
- **Top bar:** the **Undo / Redo** chrome item (two icon buttons; the tooltip
  names the next action, e.g. "Undo Add drawing").
- **Edit menu:** **Edit → Undo / Redo**, reactively enabled/disabled with shortcut
  hints.
- **History panel:** open from **View → Add Component → History**. It lists the
  undo stack newest-first with the redo stack greyed above; click any row to jump
  there.

## Making an action undoable — the adapter pattern

Call sites invoke history at the **user-intent boundary** (a dialog or action
handler), not deep inside a store:

```ts
import { makeAddDrawingCommand } from "@/modules/history/adapters";
import { useHistoryStore } from "@/stores/history";

const history = useHistoryStore();
// ...at the click / finalize handler:
await history.execute(makeAddDrawingCommand(feature));
```

Adapters are thin factory functions under `src/modules/history/adapters/` that
close over the live store/repo and return a `Command`. The simplest shape:

```ts
import { makeCommand } from "@/modules/history";
import type { Command } from "@/modules/history";
import { useDrawingsStore } from "@/stores/drawings";

export function makeAddDrawingCommand(feature: Feature): Command {
  const drawings = useDrawingsStore();
  let id: string | null = null;
  return makeCommand({
    label: "Add drawing",
    scope: "drawings",
    category: "create",
    redo() {
      id = drawings.add(feature);
    }, // runs on execute AND redo
    undo() {
      if (id) drawings.remove(id);
    }, // the real inverse
  });
}
```

Rules of thumb:

- `redo()` runs on the **initial execute and every redo** — capture ids / prior
  values once and reuse them on replay.
- `undo()` calls the **real inverse** store/repo API (so reactive consumers
  re-render).
- For nested-blob edits, use `makeUpdatePanelStateCommand` or `capturePatches` +
  `makePatchCommand` (immer inverse-patches) instead of hand-writing the inverse.
- For multi-call cascades, group with `history.runInTransaction(label, scope, fn)`
  — children commit as one undo step and roll back atomically if the body throws.
- For deletes whose repo mints fresh ids, snapshot the full record(s) and
  re-insert by **original id** on undo (see `adapters/workspace.ts`).
- Pass a `coalesceKey` to merge rapid same-control edits (slider drags) into one
  entry within a 400 ms window.

A copy-paste scaffold lives in the `commandvue-history-system` agent skill
(`.agent/skills/commandvue-history-system/reference/command-template.ts`).

## Limitations (v1)

- **Dockview undo** uses `api.toJSON()` snapshots, which don't capture
  header-hidden / float-opacity / float-maximized _visuals_ — those may not
  perfectly restore on a dock undo (window opacity has its own undoable command).
  A **per-tab close** uses Dockview's built-in control and isn't routed through
  history.
- **Theme authoring** (create / save / commit-preview a custom theme) isn't
  undoable — only the _committed theme pointer_ is. The live-preview path is
  intentionally never recorded.
- Undoing a pop-out into a separate browser window the user already closed is not
  supported.

## Internals

- Engine: `src/stores/history.ts` (`useHistoryStore`). See
  [ADR 0005](./decisions/0005-undo-redo-reversible-command-pattern).
- Building blocks: `src/modules/history/{types,factories,patches}.ts`.
- Adapters: `src/modules/history/adapters/*`.
