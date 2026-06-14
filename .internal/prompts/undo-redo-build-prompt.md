# Build Prompt — CommandVue Undo/Redo Store (Reversible Command Pattern)

> **How to use this file:** Paste this into a fresh Claude Code session opened at
> `D:\Work\UraanAI\Public\CommandVue`. It is a self-contained build spec. Build it in the
> phased order below — **one PR per phase, targeting `develop`, stopping for merge each time**
> (GitFlow is enforced in this repo). Follow every repo rule in `CLAUDE.md` / `.agent/rules/*`
> (library-first/PrimeVue-first, Context7-before-library-work, the two-stage verification
> protocol, the cache-free `type-check` gotcha). Do **not** chain phases without merge confirmation.

---

## 1. Mission

Build a **generic, extensible, app-wide undo/redo system** for CommandVue. Every meaningful user
action becomes reversible: map drawings, panel edits, Dockview layout rearrangement,
workspace/layout/preset/chrome CRUD, and theme commits.

**The driving mental model (from the maintainer):** _"If the user inserts something, undo calls the
delete API; if the user deletes, undo calls insert."_ Undo invokes the **real inverse operation**
against the existing stores/repos — not a detached state mirror.

This repo is a **template**: ship a small engine + example adapters that downstream forks extend.
**No domain business logic.**

A reference exists — **Orbit Mapper** at `D:\Work\UraanAI\Public\orbat-mapper-reference` (its store
is `src/composables/immerStore.ts`). **Do not copy it.** Borrow only two ideas — patch-based inverse
for nested blobs, and transaction batching — and avoid its smells: manual JSON-pointer path
conversion, untyped/optional meta, no coalescing, no capacity cap, no transaction atomicity.

---

## 2. Locked decisions (do not revisit)

1. **Engine = reversible command pattern.** Each undoable action is a `Command { label, redo, undo }`
   whose `undo()` calls the real inverse store/repo API. For tedious nested-state blobs, a command
   may capture **immer inverse-patches** internally instead of hand-writing the inverse — but the
   outer abstraction is always a `Command`.
2. **Coverage v1 = structural + data ops only:** map drawings/features, entities, panel-state,
   Dockview layout, workspace CRUD, layout CRUD, presets (create/update/delete/apply/remove), chrome
   arrangement, theme **commits**. **Excluded:** ephemeral surfaces — command-palette open/close,
   tool activation, telemetry streaming buffers, in-progress theme-preview drafts.
3. **Persistence = in-memory, per-session, scoped per-workspace.** Cleared on reload and on workspace
   switch. No idb history persistence → commands may close over live objects.
4. **Map v1 = wire current tools now.** Make `drawings` add/remove/clear + draw-polygon/measure
   undoable. Deep per-vertex geometry-editing undo is deferred.

---

## 3. Library choice & rationale

| Approach                                               | Verdict             | Why                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reversible command pattern** (custom, ~200 LOC core) | **Chosen**          | Only model that calls the real inverse API (decision #1), composes cross-store cascades into one undo step, and maps cleanly onto 13 stores + 7 repos + non-serializable dock/map state. Extensible for a template. |
| **immer `produceWithPatches`**                         | **Used internally** | Generates forward + inverse patches in one pass — ideal for nested state blobs (`PanelState.state`). Wrapped _inside_ a command, never as the top-level engine.                                                     |
| `rfc6902` (JSON Patch)                                 | Not needed v1       | Diffs two whole objects (expensive, needs snapshots). immer captures inverse patches for free during mutation. Leave listed-but-unused; revisit only if network state-sync is added.                                |
| `@vueuse/core useRefHistory`                           | Rejected app-wide   | Single-ref snapshot; no cross-store atomic undo, no action semantics, deep-clone cost. Fine only for isolated form refs.                                                                                            |
| `pinia-undo` / `pinia-plugin-history`                  | Rejected            | Whole-store snapshots, unmaintained, no transactions/coalescing, new external deps (discouraged).                                                                                                                   |

**Dependency action:** `pnpm add immer` — it is in the locked-stack table (`.agent/rules/project-and-stack.md`)
but **not yet installed**. `klona` optional (`structuredClone` already used in `session.ts`).
`nanoid`/`ulid` already present. Per documentation-sync rules, the README stack table already lists
`immer` (accurate once installed) — verify, don't duplicate.

> **Context7 first:** before writing immer code, fetch current immer docs via the Context7 MCP
> (`resolve-library-id` → `query-docs`) for `produceWithPatches` / `applyPatches` / `enablePatches`.

---

## 4. Architecture overview

- **`Command`** — atomic reversible action. `redo()` runs on both initial execute and redo;
  `undo()` is the real inverse.
- **`Transaction`** — labeled group of commands committed as **one** undo step (cascades, multi-call
  dialog actions). Undo reverses children in reverse order; redo replays forward.
- **`useHistoryStore`** (Pinia) — owns per-workspace undo/redo stacks, the `isApplying` re-entrancy
  guard, coalescing, and a capacity cap (100).
- **Adapters** — thin factory functions (`makeXCommand(...)`) under `src/modules/history/adapters/`
  that close over live stores/repos and return `Command`s. Call sites invoke
  `history.execute(makeXCommand(...))` **at the user-intent boundary** (dialog/action layer) — only
  real user actions are recorded. **No action-proxy** that silently captures excluded/internal writes.

---

## 5. Module layout

```
src/modules/history/
  types.ts        # Command, Transaction, HistoryEntry, HistoryStack, HistoryScope, HistoryCategory
  patches.ts      # capturePatches() (immer produceWithPatches) + makePatchCommand()
  factories.ts    # makeCommand(), makeTransaction() with invariant checks
  index.ts        # public barrel
  adapters/       # drawings.ts, entities.ts, panelState.ts, layout.ts, workspace.ts,
                  # preset.ts, chrome.ts, theme.ts, dockview.ts, index.ts
src/stores/history.ts                          # useHistoryStore (engine state + actions)
src/components/chrome/items/UndoRedoItem.vue   # two IconButtons (one chrome item)
src/components/panels/HistoryPanel.vue          # OPTIONAL labeled-step list (Phase 5)
src/composables/useHistoryShortcuts.ts          # OPTIONAL thin dispatch wrapper
tests/unit/modules/history/{engine,patches}.spec.ts + adapters/*.spec.ts
```

---

## 6. Core types (`src/modules/history/types.ts`)

```ts
import type { Patch } from "immer";

export type HistoryScope =
  | "drawings"
  | "entities"
  | "panel-state"
  | "dockview-layout"
  | "workspace"
  | "layout"
  | "preset"
  | "chrome"
  | "theme";

export type HistoryCategory =
  | "create"
  | "update"
  | "delete"
  | "apply"
  | "remove"
  | "arrange"
  | "commit";

export interface Command {
  readonly id: string; // nanoid
  readonly label: string; // "Add polygon"
  readonly scope: HistoryScope;
  readonly category?: HistoryCategory;
  redo(): void | Promise<void>; // forward op (initial execute + redo)
  undo(): void | Promise<void>; // the REAL inverse
  readonly coalesceKey?: string; // merge rapid same-key edits within a window
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface Transaction {
  readonly id: string;
  readonly label: string;
  readonly scope: HistoryScope;
  readonly children: readonly Command[];
}

export type HistoryEntry =
  | { readonly kind: "command"; readonly command: Command; readonly at: number }
  | { readonly kind: "transaction"; readonly transaction: Transaction; readonly at: number };

export interface HistoryStack {
  readonly workspaceId: string | null;
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}
```

**immer patch helper (`src/modules/history/patches.ts`)** — keeps the outer abstraction a `Command`
while the patch math stays internal:

```ts
import { produceWithPatches, applyPatches, enablePatches, type Patch } from "immer";
enablePatches();

export function capturePatches<T>(base: T, recipe: (draft: T) => void) {
  const [next, patches, inversePatches] = produceWithPatches(base, recipe);
  return { next, patches, inversePatches };
}

// redo: write(applyPatches(read(), patches)); undo: write(applyPatches(read(), inversePatches))
export function makePatchCommand(opts: {
  label: string;
  scope: HistoryScope;
  category?: HistoryCategory;
  patches: Patch[];
  inversePatches: Patch[];
  read(): unknown;
  write(next: unknown): void | Promise<void>;
  coalesceKey?: string;
  meta?: Record<string, unknown>;
}): Command {
  /* build a Command whose redo/undo apply patches via read()/write() */
}
```

`read`/`write` must hit the **real store action** so undo flows through the real write path
(idb + reactive cache).

---

## 7. History store API (`src/stores/history.ts`)

State: `stacksByWorkspace: Map<string|null, HistoryStack>`, `activeWorkspaceId`, `isApplying` guard,
open `currentTxn`, `CAPACITY = 100`. Getters: `canUndo`, `canRedo`, `undoLabel`, `redoLabel`.

Actions:

- **`execute(cmd)`** — if `isApplying`, run `cmd.redo()` without recording; else `await cmd.redo()` then `record(cmd)`.
- **`record(cmd)`** — no-op if `isApplying`; if a txn is open push to its children; else coalesce → push entry → **clear redo stack** → enforce capacity. Reassign the Map for reactivity.
- **`runInTransaction(label, scope, fn)`** — open `currentTxn`; run `fn`. On throw, undo applied children in reverse + rethrow (atomicity). On success collapse: 0 children → no-op, 1 → plain command entry, ≥2 → one transaction entry.
- **`undo()` / `redo()`** — set `isApplying = true`; command → `undo()`/`redo()`; transaction → children `undo()` reversed / `redo()` forward; clear guard; move entry between stacks.
- **`clear()`**, **`setActiveWorkspace(id)`** (on change, drop the previous workspace's stack — decision #3), **`__resetForTests()`**.

**Guard cooperation with `session.ts`** (verified surface): `isApplying` suppresses re-recording at
the history layer; the existing `restoring` flag (`setRestoring`) suppresses `markDirty()` at the
dockview layer. A dockview undo sets **both** — orthogonal and composable. Forward, user-initiated
dock ops call `markDirty()` outside the restoring window so the change stays savable. `dirty` is
**not** undo state.

---

## 8. Integration pattern — three worked examples

**(1) Drawings (simplest).** Adapter closes over the store; one-line change at the
`MapLibrePanel.vue` `onFinalize` seam:

```ts
// src/modules/history/adapters/drawings.ts
export function makeAddDrawingCommand(feature: Feature): Command {
  const drawings = useDrawingsStore();
  let id: string | null = null;
  return makeCommand({
    label: "Add drawing",
    scope: "drawings",
    category: "create",
    redo() {
      id = drawings.add(feature);
    }, // insert on execute + redo
    undo() {
      if (id) drawings.remove(id);
    }, // real inverse: delete
  });
}
export function makeRemoveDrawingCommand(id: string): Command {
  const drawings = useDrawingsStore();
  const prior = drawings.drawings.find((d) => d.id === id); // capture for re-insert
  return makeCommand({
    label: "Delete drawing",
    scope: "drawings",
    category: "delete",
    redo() {
      drawings.remove(id);
    },
    undo() {
      if (prior) drawings.add(prior.feature);
    },
  });
}
// MapLibrePanel.vue onFinalize:
//   onFinalize: (feature) => void history.execute(makeAddDrawingCommand(feature))
```

> Note: `drawings.add` mints a fresh `nanoid`, so undo-of-delete re-inserts under a new id — fine for
> scratch geometry. If id-stability is later required, extend `drawings.add` to accept an optional id.

**(2) Panel-state via immer inverse-patches.** redo applies `patches`, undo applies `inversePatches`,
both through the real `panelState.updateState(id, { state })`:

```ts
export function makeUpdatePanelStateCommand(
  panelId: Ulid,
  recipe: (draft: Record<string, unknown>) => void,
  opts?: { label?: string; coalesceKey?: string },
): Command {
  const ps = usePanelStateStore();
  const base = ps.getState(panelId)?.state ?? {};
  const { patches, inversePatches } = capturePatches(base, recipe);
  return makePatchCommand({
    label: opts?.label ?? "Edit panel",
    scope: "panel-state",
    category: "update",
    patches,
    inversePatches,
    read: () => ps.getState(panelId)?.state ?? {},
    write: (state) => ps.updateState(panelId, { state: state as Record<string, unknown> }),
    coalesceKey: opts?.coalesceKey, // e.g. `panelState:${panelId}:floatAlpha`
    meta: { panelId },
  });
}
```

**(3) Cascading workspace delete as a transaction.** `workspaceRepo.delete` cascades (layouts →
panel-states + workspace-scoped presets + theme bindings) in one idb transaction. Undo must
**capture before delete, then re-insert with preserved ids**:

```ts
export function makeDeleteWorkspaceCommand(workspaceId: Ulid): Command {
  const ws = useWorkspaceStore();
  let snapshot: WorkspaceCascadeSnapshot | null = null;
  return makeCommand({
    label: "Delete workspace",
    scope: "workspace",
    category: "delete",
    async redo() {
      snapshot ??= await captureWorkspaceCascade(workspaceId); // ws row + layouts + panelStates + scoped presets + theme bindings
      await ws.deleteWorkspace(workspaceId);
    },
    async undo() {
      await restoreWorkspaceCascade(snapshot!); // recreate each record by ORIGINAL id
      await ws.loadAll(); // re-sync reactive caches
    },
  });
}
```

- **Undo of delete** → re-`create()` each captured record by **original id**. `panelStateRepo.create`
  already accepts an explicit `id`; add the same to `layoutRepo`/`workspaceRepo`, or re-insert via
  `getDb().add(store, record)` in the adapter. Then reload affected stores (`workspace.loadAll`,
  `layout.loadForWorkspace`, `preset.loadForWorkspace`).
- **Undo of insert** → call `delete()` (symmetry).
- `captureWorkspaceCascade` / `restoreWorkspaceCascade` live in `adapters/workspace.ts`, reading the
  object stores via `getDb()` — structural snapshot/restore only, no business logic. Where the UI
  fires several **independent** store calls (e.g. delete-layout-then-pick-next), wrap them in
  `runInTransaction` to collapse into one undo step.

---

## 9. Non-serializable / Dockview handling

v1 = **snapshot inverse** via `api.toJSON()` / `api.fromJSON()`:

```ts
export function makeDockviewLayoutCommand(label: string, mutate: () => void): Command {
  const session = useSessionStore();
  let before: unknown | null = null,
    after: unknown | null = null;
  return makeCommand({
    label,
    scope: "dockview-layout",
    category: "arrange",
    redo() {
      const a = session.getDockviewApi();
      if (!a) return;
      if (after) {
        applyJson(a, after);
        return;
      } // replay captured target
      before = a.toJSON();
      session.setRestoring(true);
      try {
        mutate();
      } finally {
        session.setRestoring(false);
      }
      after = a.toJSON();
      session.markDirty(); // forward op stays savable
    },
    undo() {
      const a = session.getDockviewApi();
      if (a && before) applyJson(a, before);
    },
  });
}
// applyJson() wraps fromJSON in setRestoring(true)/(false)
```

- Feasible v1: add/remove panel, close-others, float/dock, maximize, minimize/restore (the
  `session.ts` ops). Dock JSON is small → two snapshots/entry are cheap.
- A pure `addPanel` may carry the precise `removePanel(id)` inverse instead of a full snapshot — the
  factory can accept an explicit inverse and default to snapshot.
- `panelState` records survive `api.removePanel` (per `session.ts` docstrings), so a dockview-only
  re-add by id re-mounts cleanly. A flow that deletes both the dock panel and its panelState record
  wraps the dock command + `deletePanel` command in `runInTransaction`.
- **Deferred:** undoing a pop-out into a separate browser window the user already closed (documented
  behavior: it re-docks into the main window).

---

## 10. UI surface (PrimeVue-first; verified seams)

1. **Undo/Redo IconButtons** — new built-in chrome item `undo-redo` in `BUILTIN_CHROME_ITEMS`
   (`src/modules/chrome/builtin.ts`), component `UndoRedoItem.vue`, `removable: true`,
   `defaultSlot: "top-left"`, broad `allowedSlots`. Two `src/components/ui/IconButton.vue` (Lucide
   `undo-2` / `redo-2`), `:disabled="!history.canUndo"` / `!history.canRedo`,
   `label="Undo ${history.undoLabel}"` for a11y + tooltip. Auto-add to existing profiles via
   `ensureItemPresent("undo-redo", "top-left")` in `src/stores/chrome.ts` (the `theme-toggle` precedent).
2. **MenuBar Edit menu** — `src/components/layout/MenuBar.vue` already has **disabled `Undo`/`Redo`
   placeholders** (~lines 311–312). Wire them: `command: () => void history.undo()` /
   `history.redo()`, `disabled: !history.canUndo` / `!history.canRedo`, with shortcut hints via the
   existing `formatCombo` helper.
3. **Keyboard** — extend the existing static system: add `"history.undo" | "history.redo"` to the
   `ShortcutAction` union + `SHORTCUTS` in `src/modules/shortcuts/catalog.ts` (`mod+z`, `mod+shift+z`,
   `mod+y`); dispatch in `src/components/layout/AppShell.vue`'s `onAction`. The existing input-skip +
   `isModalCapturing()` gate already lets native text-field undo win — keep it.
   `useHistoryShortcuts.ts` is optional if you prefer dispatch logic out of `AppShell`.
4. **Optional History panel** (`HistoryPanel.vue`, Phase 5) — register via
   `panelRegistry.register({ id: "history", category: "tools", ... })` + `app.component("history", ...)`
   per the Panel Registry rule. List undo entries (newest top) + redo (greyed), each row = label +
   scope icon + relative time; click-to-jump (undo/redo repeatedly to that cursor). Use `ui/` primitives.

---

## 11. Edge cases & invariants

- **Coalescing:** `coalesceKey` + 400 ms window; merge keeps the **older `undo`** baseline + the
  **newer `redo`**. Targets: opacity-slider drags, repeated panel-state writes, theme **commit**.
- **Transaction atomicity:** throw mid-txn → undo applied children in reverse + rethrow (no partial
  cascade lands).
- **Capacity:** cap 100, evict oldest (`shift()`). In-memory only — no idb growth.
- **Workspace switch:** add a watcher on `workspace.currentWorkspaceId` that calls
  `history.setActiveWorkspace(newId)` → drops the prior stack (no call site missed). The existing
  `session.switchWorkspace` is the switch entry point.
- **Reload** clears everything (in-memory store).
- **Redo invalidation:** any `record()` (incl. a coalesced edit) clears `stack.redo`.
- **Out-of-band changes:** last-writer-wins; commands defensive (`if (!exists) return;`) so undoing a
  vanished target no-ops, never throws. All undos use the real store action so reactive consumers re-render.
- **Restore/load excluded:** `loadLayout` / `discardChanges` / import already run under
  `setRestoring(true)` and are not routed through `execute()`, so they're never recorded.

---

## 12. Phased rollout — one PR per phase → `develop`, STOP for merge each time

> Branch from latest `develop` with the conventional name shown. After Stage-1 (Playwright MCP at UI
> phases) is green, open the PR with the Stage-1 result table + the Stage-2 human checklist, then
> **wait for the maintainer to merge** before starting the next phase. Logic-only phases (1, 2, 4)
> state the manual/smoke fallback explicitly and rely on vitest.

1. **`feat/history-engine`** — `pnpm add immer`; `src/modules/history/{types,patches,factories,index}.ts`
   - `src/stores/history.ts` + `__resetForTests`. Tests: `engine.spec.ts`, `patches.spec.ts`. No UI/adapters.
2. **`feat/history-drawings`** — `adapters/drawings.ts`; wire `MapLibrePanel.vue` `onFinalize` +
   drawings remove/clear; add the workspace-switch scoping watcher. Tests: `adapters/drawings.spec.ts`.
   Smallest end-to-end proof.
3. **`feat/history-ui`** — `UndoRedoItem.vue` + chrome registration + `ensureItemPresent`; catalog
   actions + `AppShell` dispatch; live MenuBar Edit items. First runtime-verifiable UX
   (draw → Ctrl+Z → Ctrl+Y).
4. **`feat/history-data-ops`** (split **4a** panel-state/entities, **4b** layout/workspace/preset if
   large) — those adapters; add restore-by-id helpers where repos mint ids; `runInTransaction` for
   cascades; wire the Manage\* dialogs. Per-adapter `fake-indexeddb` tests for id-preserving re-insert
   - single-undo-step cascades.
5. **`feat/history-layout-chrome-theme`** — `adapters/{dockview,chrome,theme}.ts`; wire `session.ts`
   layout ops, chrome arrangement, theme **commit** (not preview); optional `HistoryPanel.vue`.
   Playwright: move/close panels → undo; rearrange chrome → undo; commit theme → undo; confirm no
   double-record / false-dirty.
6. **`docs/history-undo-redo`** — docs page, ADR 0005, `.agent` skill note, cross-links, CHANGELOG.

---

## 13. Testing

- **Engine** (`tests/unit/modules/history/engine.spec.ts`, fake commands, no idb): execute/undo/redo;
  transaction reverse-undo / forward-redo, single-child collapse, empty no-op, **throw-mid-txn
  rollback**; coalesce within/outside window + redo-clear; capacity eviction; `isApplying` guard
  prevents nested recording; per-workspace scoping drop on `setActiveWorkspace`.
- **Patches** (`patches.spec.ts`): `capturePatches` round-trip on a nested blob; `makePatchCommand`
  forward/inverse against a mutable holder.
- **Adapters** (`adapters/*.spec.ts`, `beforeEach` = `resetStorage()` from
  `tests/unit/storage/helpers.ts` + `setActivePinia`): drawings add/remove round-trip; panelState
  update reverts the idb `state` blob via the real `updateState`; **workspace cascade** — build
  ws+layout+panelState+scoped preset, delete, assert all gone, undo re-creates ALL with original ids
  as **one** entry; layout/preset/entities/chrome/theme analogous.
- **Runtime** (UI phases 3 & 5): per the repo verification protocol, probe
  `mcp__plugin_playwright_playwright__*` (load via `ToolSearch "playwright browser"` if absent), drive
  real flows, screenshot to `.verification-screenshots/<branch>/`, embed the Stage-1 assertion table +
  console error/warning counts in the PR, then the Stage-2 human checkbox checklist.

---

## 14. Docs & sync (per `.agent/rules/libraries-and-knowledge.md` documentation-sync table)

- **New** `docs/undo-redo.md` (scope table per decision #2; the `execute(makeXCommand(...))` pattern +
  a "writing an adapter" recipe; in-memory/per-workspace model; shortcuts; limitations) + sidebar
  entry in `docs/.vitepress/config.ts`.
- **New ADR** `docs/decisions/0005-undo-redo-reversible-command-pattern.md` — Context / Decision
  (reversible command + immer inverse-patches for blobs + in-memory per-workspace) / Rejected
  (full-state snapshots; event-sourcing/CRDT; a `withHistory` action-proxy; idb-persisted history) /
  Consequences.
- **Update** `docs/state.md` (add the history store), `docs/keyboard-shortcuts.md`
  (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), `CHANGELOG.md`.
- **`.agent/skills/`** note on adding an undoable subsystem (mirror the `commandvue-preset-development`
  skill style). Never reference `.internal/` from public docs. README stack table already lists
  `immer` — confirm accuracy after install; note `rfc6902` stays listed-but-unused in v1 (leave it, or
  drop it in the ADR consequences per maintainer preference).

---

## 15. Critical files

- **NEW:** `src/stores/history.ts`, `src/modules/history/types.ts`, `src/modules/history/patches.ts`,
  `src/modules/history/factories.ts`, `src/modules/history/adapters/*`.
- **EXISTING to reuse/wire:**
  - `src/stores/session.ts` — `setRestoring` / `markDirty` / `getDockviewApi` (the dockview adapter composes with these).
  - `src/stores/drawings.ts` — `add` / `remove` / `clear` (first/simplest seam).
  - `src/components/panels/MapLibrePanel.vue` — the `onFinalize` integration line.
  - `src/modules/shortcuts/catalog.ts` + `src/components/layout/AppShell.vue` — shortcut catalog + dispatch.
  - `src/components/layout/MenuBar.vue` — the disabled Undo/Redo placeholders to activate.
  - `src/modules/chrome/builtin.ts` + `src/stores/chrome.ts` — chrome registration + `ensureItemPresent`.
  - `src/components/ui/IconButton.vue` — the button primitive (density-aware, required `label`).
  - `src/modules/storage/*Repo.ts` — `create` with explicit id for restore-by-id (panelStateRepo
    already supports it; extend layoutRepo/workspaceRepo or use `getDb().add`).
  - `tests/unit/storage/helpers.ts` — `resetStorage()` for adapter tests.

---

## 16. Verification (end-to-end)

1. `pnpm add immer` → `pnpm install` clean.
2. `pnpm lint && pnpm type-check && pnpm test` green. **Cache-free type-check:** delete
   `*.tsbuildinfo` first (`Get-ChildItem -Recurse -Filter *.tsbuildinfo | Remove-Item`) — CI runs
   cache-free and a stale local pass can hide a real error.
3. `pnpm dev` → draw a polygon, **Ctrl+Z** removes it, **Ctrl+Y** restores it; delete a workspace,
   undo restores it (and its layouts/panels) as **one** step; move a panel, undo reverts the dock
   arrangement; commit a theme change, undo reverts it. Confirm **no double-recording** and **no
   false `dirty`** after undo.
4. Drive the above with Playwright MCP at the UI phases; capture screenshots per the two-stage protocol.

---

## 17. Reference appendix — Orbit Mapper (what to borrow vs avoid)

- **Path:** `D:\Work\UraanAI\Public\orbat-mapper-reference`; core store `src/composables/immerStore.ts`
  (~140 lines), consumed by `src/scenariostore/newScenarioStore.ts`.
- **Borrow:** the past/future two-stack model; the `groupUpdate` batching concept (our `Transaction`);
  patch-based inverse for nested blobs (our `makePatchCommand`).
- **Avoid:** manual immer-array-path → JSON-pointer-string conversion (we don't use rfc6902 at all in
  v1); optional/untyped `meta` (ours requires a typed `label` + `scope`); no coalescing; unbounded
  stacks (we cap at 100); no transaction atomicity (we roll back on throw); history cleared on load
  with no per-workspace scoping (we scope per workspace).

```

```
