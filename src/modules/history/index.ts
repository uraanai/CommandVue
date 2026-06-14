/**
 * Public barrel for the undo/redo history engine.
 *
 * Adapters (under `./adapters/`) and call sites import the building blocks from
 * here; the engine store itself lives at `@/stores/history` (`useHistoryStore`)
 * because Pinia stores are registered separately. See ADR 0005.
 */

export type {
  Command,
  HistoryCategory,
  HistoryEntry,
  HistoryScope,
  HistoryStack,
  Transaction,
} from "./types";

export { capturePatches, makePatchCommand } from "./patches";
export type { CapturedPatches, MakePatchCommandOptions } from "./patches";

export { makeCommand, makeTransaction } from "./factories";
export type { MakeCommandOptions } from "./factories";
