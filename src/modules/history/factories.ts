import type { Command, HistoryCategory, HistoryScope, Transaction } from "./types";

import { nanoid } from "@/utils/id";

export interface MakeCommandOptions {
  label: string;
  scope: HistoryScope;
  category?: HistoryCategory;
  redo(): void | Promise<void>;
  undo(): void | Promise<void>;
  coalesceKey?: string;
  meta?: Record<string, unknown>;
}

/**
 * Assemble a {@link Command} from a hand-written forward/inverse pair, minting a
 * fresh id. This is the adapter author's primary entry point: `redo` performs
 * the forward op, `undo` calls the real inverse store/repo API.
 */
export function makeCommand(opts: MakeCommandOptions): Command {
  if (!opts.label.trim()) {
    throw new Error("makeCommand: `label` must be a non-empty string");
  }
  return {
    id: nanoid(),
    label: opts.label,
    scope: opts.scope,
    category: opts.category,
    coalesceKey: opts.coalesceKey,
    meta: opts.meta,
    redo: opts.redo,
    undo: opts.undo,
  };
}

/**
 * Group already-built commands into a {@link Transaction} that the engine
 * commits, and reverses, as one undo step. Children are defensively copied so
 * later mutation of the source array can't change recorded history.
 */
export function makeTransaction(
  label: string,
  scope: HistoryScope,
  children: readonly Command[],
): Transaction {
  if (!label.trim()) {
    throw new Error("makeTransaction: `label` must be a non-empty string");
  }
  if (children.length === 0) {
    throw new Error("makeTransaction: a transaction must contain at least one command");
  }
  return { id: nanoid(), label, scope, children: [...children] };
}
