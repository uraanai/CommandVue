/**
 * Adapter barrel — factory functions that close over live stores/repos and
 * return reversible {@link Command}s. Call sites invoke
 * `history.execute(makeXCommand(...))` at the user-intent boundary.
 */

export {
  makeAddDrawingCommand,
  makeClearDrawingsCommand,
  makeRemoveDrawingCommand,
} from "./drawings";
