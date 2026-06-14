/**
 * Core types for the undo/redo history engine.
 *
 * Every undoable user action is modelled as a {@link Command} whose `undo()`
 * invokes the **real inverse** store/repo operation (insert ⇄ delete, apply ⇄
 * remove) — not a detached state mirror. Commands compose into a
 * {@link Transaction} that commits, and undoes, as a single step.
 *
 * The engine lives in `src/stores/history.ts`; concrete adapters that close
 * over live stores/repos live under `src/modules/history/adapters/`. See ADR
 * 0005 for the rationale (reversible command pattern + immer inverse-patches
 * for nested blobs, in-memory and scoped per workspace).
 */

/**
 * The subsystem a command/transaction targets. Drives History-panel grouping
 * and per-scope iconography. Mirrors the registries it reverses against.
 */
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

/**
 * The kind of mutation, used for labelling and future per-category UI
 * affordances. Distinct from {@link HistoryScope}: a `preset` scope may carry
 * `create`, `update`, `delete`, `apply`, or `remove`.
 */
export type HistoryCategory =
  | "create"
  | "update"
  | "delete"
  | "apply"
  | "remove"
  | "arrange"
  | "commit";

/**
 * An atomic reversible action.
 *
 * `redo()` runs on **both** the initial execute and every subsequent redo, so
 * adapters that mint ids or snapshot prior values capture once (on first run)
 * and reuse the captured value on replay. `undo()` performs the real inverse.
 * Either hook may be sync or async; the store always awaits.
 */
export interface Command {
  /** Unique id (nanoid). */
  readonly id: string;
  /** Imperative, human-readable label, e.g. `"Add polygon"`. Shown in menus/tooltips. */
  readonly label: string;
  /** Target subsystem. */
  readonly scope: HistoryScope;
  /** Mutation kind. */
  readonly category?: HistoryCategory;
  /** Forward operation — runs on initial execute and on every redo. */
  redo(): void | Promise<void>;
  /** The real inverse operation. */
  undo(): void | Promise<void>;
  /**
   * When set, a freshly recorded command with the same key arriving within the
   * coalescing window merges into the previous entry — keeping the **older
   * `undo`** baseline and the **newer `redo`** target. Targets rapid same-control
   * edits (slider drags, repeated panel-state writes, theme commits).
   */
  readonly coalesceKey?: string;
  /** Optional structured metadata (panel id, record id, …). */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/**
 * A labelled group of commands committed — and undone — as one step. Undo
 * reverses the children in reverse order; redo replays them forward.
 */
export interface Transaction {
  readonly id: string;
  readonly label: string;
  readonly scope: HistoryScope;
  readonly children: readonly Command[];
}

/**
 * One entry on a history stack: a single command or a transaction, tagged with
 * the epoch-ms it landed (drives coalescing windows and relative-time display).
 */
export type HistoryEntry =
  | { readonly kind: "command"; readonly command: Command; readonly at: number }
  | {
      readonly kind: "transaction";
      readonly transaction: Transaction;
      readonly at: number;
    };

/** Undo/redo stacks for a single workspace scope. */
export interface HistoryStack {
  /** `null` is the pre-workspace / global scope (before any workspace is active). */
  readonly workspaceId: string | null;
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}
