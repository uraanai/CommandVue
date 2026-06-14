import type { Command, HistoryCategory, HistoryScope } from "./types";

import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";

import { nanoid } from "@/utils/id";

// Patch generation is opt-in in immer. Enable it once, at module load, before
// any `produceWithPatches`/`applyPatches` call. Idempotent.
enablePatches();

export interface CapturedPatches<T> {
  /** The produced next state (frozen by immer). */
  next: T;
  /** Forward patches: base → next. */
  patches: Patch[];
  /** Inverse patches: next → base. This is what `undo()` replays. */
  inversePatches: Patch[];
}

/**
 * Run `recipe` against an immer draft of `base` and capture both the forward
 * and inverse patch sets in a single pass. `base` is never mutated. Ideal for
 * nested state blobs (e.g. a panel's `state`) where hand-writing the inverse
 * would be tedious and error-prone.
 */
export function capturePatches<T>(base: T, recipe: (draft: Draft<T>) => void): CapturedPatches<T> {
  const [next, patches, inversePatches] = produceWithPatches(base, recipe);
  return { next: next as T, patches, inversePatches };
}

export interface MakePatchCommandOptions {
  label: string;
  scope: HistoryScope;
  category?: HistoryCategory;
  patches: Patch[];
  inversePatches: Patch[];
  /**
   * Read the current value from the real store. `redo`/`undo` apply patches to
   * whatever this returns, so concurrent out-of-band edits last-writer-win
   * rather than clobbering the whole blob with a stale snapshot.
   */
  read(): unknown;
  /** Write the next value back through the real store action (idb + reactive cache). */
  write(next: unknown): void | Promise<void>;
  coalesceKey?: string;
  meta?: Record<string, unknown>;
}

/**
 * Build a {@link Command} whose `redo`/`undo` apply the forward/inverse patch
 * sets through the supplied `read`/`write` seam. `read`/`write` MUST hit the
 * real store action so undo flows through the live write path — persisting and
 * re-rendering reactive consumers — exactly like the original user action.
 */
export function makePatchCommand(opts: MakePatchCommandOptions): Command {
  return {
    id: nanoid(),
    label: opts.label,
    scope: opts.scope,
    category: opts.category,
    coalesceKey: opts.coalesceKey,
    meta: opts.meta,
    redo() {
      return opts.write(applyPatches(opts.read() as object, opts.patches));
    },
    undo() {
      return opts.write(applyPatches(opts.read() as object, opts.inversePatches));
    },
  };
}
