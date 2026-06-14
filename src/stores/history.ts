import type { Command, HistoryEntry, HistoryScope, HistoryStack } from "@/modules/history/types";

import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { makeTransaction } from "@/modules/history/factories";

/** Maximum undo depth per workspace. Oldest entries are evicted past this. */
const CAPACITY = 100;
/** Rapid same-`coalesceKey` edits within this window merge into one entry. */
const COALESCE_WINDOW_MS = 400;

/**
 * The undo/redo engine — a reversible command stack scoped per workspace.
 *
 * `execute()` runs a command's forward op and records it; `undo()`/`redo()`
 * invoke the command's own inverse/forward hooks (which call the real store/repo
 * APIs). History is in-memory and per-session: switching workspace drops the
 * stack you leave (decision #3), and a reload clears everything.
 *
 * Two cooperating guards keep replays from polluting history:
 *  - `isApplying` (here) — suppresses re-recording while an undo/redo runs.
 *  - `session.restoring` (the dock layer) — suppresses `markDirty()` while a
 *    layout snapshot is re-applied. A dockview undo sets both; they're
 *    orthogonal and compose. See ADR 0005.
 */
export const useHistoryStore = defineStore("history", () => {
  /** One stack per workspace id (`null` = pre-workspace / global scope). */
  const stacks = ref<Map<string | null, HistoryStack>>(new Map());
  const activeId = ref<string | null>(null);

  // Transient orchestration flags — deliberately non-reactive (no UI depends on
  // them, and they must not be proxied through Command closures).
  let isApplying = false;
  let currentTxn: { label: string; scope: HistoryScope; children: Command[] } | null = null;

  /** Read the active stack without creating it (safe for getters). */
  function peekStack(): HistoryStack | undefined {
    return stacks.value.get(activeId.value);
  }

  /** Get-or-create the active stack (for mutating actions). Returns the reactive proxy. */
  function ensureStack(): HistoryStack {
    const id = activeId.value;
    let stack = stacks.value.get(id);
    if (!stack) {
      stacks.value.set(id, { workspaceId: id, undo: [], redo: [] });
      stack = stacks.value.get(id)!;
    }
    return stack;
  }

  function labelOf(entry: HistoryEntry | undefined): string | undefined {
    if (!entry) return undefined;
    return entry.kind === "command" ? entry.command.label : entry.transaction.label;
  }

  const undoEntries = computed<readonly HistoryEntry[]>(() => peekStack()?.undo ?? []);
  const redoEntries = computed<readonly HistoryEntry[]>(() => peekStack()?.redo ?? []);
  const canUndo = computed(() => undoEntries.value.length > 0);
  const canRedo = computed(() => redoEntries.value.length > 0);
  const undoLabel = computed(() => labelOf(undoEntries.value[undoEntries.value.length - 1]));
  const redoLabel = computed(() => labelOf(redoEntries.value[redoEntries.value.length - 1]));
  const activeWorkspaceId = computed<string | null>(() => activeId.value);

  /**
   * Push an entry onto the active undo stack — coalescing with the top entry
   * when keys match within the window, clearing the redo stack, and enforcing
   * the capacity cap.
   */
  function recordEntry(entry: HistoryEntry): void {
    const stack = ensureStack();

    if (entry.kind === "command" && entry.command.coalesceKey !== undefined) {
      const top = stack.undo[stack.undo.length - 1];
      if (
        top !== undefined &&
        top.kind === "command" &&
        top.command.coalesceKey === entry.command.coalesceKey &&
        entry.at - top.at <= COALESCE_WINDOW_MS
      ) {
        // Merge: keep the OLDER undo baseline + the NEWER redo/label.
        const merged: Command = {
          id: top.command.id,
          label: entry.command.label,
          scope: entry.command.scope,
          category: entry.command.category,
          coalesceKey: entry.command.coalesceKey,
          meta: entry.command.meta,
          redo: entry.command.redo,
          undo: top.command.undo,
        };
        stack.undo[stack.undo.length - 1] = { kind: "command", command: merged, at: entry.at };
        stack.redo = [];
        return;
      }
    }

    stack.undo.push(entry);
    stack.redo = []; // any new action invalidates the redo branch
    while (stack.undo.length > CAPACITY) stack.undo.shift();
  }

  function record(cmd: Command): void {
    if (isApplying) return; // never record a replay
    if (currentTxn) {
      currentTxn.children.push(cmd);
      return;
    }
    recordEntry({ kind: "command", command: cmd, at: Date.now() });
  }

  /**
   * Run a command's forward op, then record it (unless we're mid-replay). This
   * is the call-site API: `history.execute(makeXCommand(...))`.
   */
  async function execute(cmd: Command): Promise<void> {
    await cmd.redo();
    // `record()` is the single authority on replay-suppression (it early-returns
    // when `isApplying`) and on transaction routing — don't duplicate that guard
    // here, or the rule lives in two places and can drift.
    record(cmd);
  }

  /**
   * Group several `execute()` calls into one undo step. On success the children
   * collapse (0 → no-op, 1 → plain command, ≥2 → a transaction entry). If the
   * body throws, already-applied children are undone in reverse and the error
   * rethrown — nothing partial is recorded (atomicity).
   */
  async function runInTransaction(
    label: string,
    scope: HistoryScope,
    fn: () => void | Promise<void>,
  ): Promise<void> {
    if (currentTxn) {
      // Already inside a transaction — flatten into the open one.
      await fn();
      return;
    }

    const txn = { label, scope, children: [] as Command[] };
    currentTxn = txn;
    try {
      await fn();
    } catch (err) {
      currentTxn = null;
      isApplying = true;
      try {
        for (let i = txn.children.length - 1; i >= 0; i--) {
          await txn.children[i]!.undo();
        }
      } finally {
        isApplying = false;
      }
      throw err;
    }
    currentTxn = null;

    const children = txn.children;
    if (children.length === 0) return;
    if (children.length === 1) {
      recordEntry({ kind: "command", command: children[0]!, at: Date.now() });
      return;
    }
    recordEntry({
      kind: "transaction",
      transaction: makeTransaction(label, scope, children),
      at: Date.now(),
    });
  }

  async function undo(): Promise<void> {
    const stack = ensureStack();
    const entry = stack.undo[stack.undo.length - 1];
    if (entry === undefined) return;

    isApplying = true;
    try {
      if (entry.kind === "command") {
        await entry.command.undo();
      } else {
        const children = entry.transaction.children;
        for (let i = children.length - 1; i >= 0; i--) {
          await children[i]!.undo();
        }
      }
    } finally {
      isApplying = false;
    }

    stack.undo.pop();
    stack.redo.push(entry);
  }

  async function redo(): Promise<void> {
    const stack = ensureStack();
    const entry = stack.redo[stack.redo.length - 1];
    if (entry === undefined) return;

    isApplying = true;
    try {
      if (entry.kind === "command") {
        await entry.command.redo();
      } else {
        for (const child of entry.transaction.children) {
          await child.redo();
        }
      }
    } finally {
      isApplying = false;
    }

    stack.redo.pop();
    stack.undo.push(entry);
  }

  /** Drop the active workspace's undo + redo history (keeps the stack object). */
  function clear(): void {
    const stack = ensureStack();
    stack.undo = [];
    stack.redo = [];
  }

  /**
   * Switch the active scope. Per decision #3, this drops the stack of the
   * workspace being left so history never accumulates across workspaces.
   */
  function setActiveWorkspace(id: string | null): void {
    if (id === activeId.value) return;
    stacks.value.delete(activeId.value);
    activeId.value = id;
  }

  function __resetForTests(): void {
    stacks.value = new Map();
    activeId.value = null;
    isApplying = false;
    currentTxn = null;
  }

  return {
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    undoEntries,
    redoEntries,
    activeWorkspaceId,
    execute,
    runInTransaction,
    undo,
    redo,
    clear,
    setActiveWorkspace,
    __resetForTests,
  };
});
