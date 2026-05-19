/**
 * Re-exports every Pinia store. Stores are added in phases:
 *   - Phase 4: ui, layout
 *   - Phase 6: entities, telemetry, connection
 *   - Phase 7: tools (this commit), drawings (next commit)
 */
export { useConnectionStore } from "./connection";
export { useEntitiesStore, type Entity } from "./entities";
export { useLayoutStore } from "./layout";
export { useTelemetryStore } from "./telemetry";
export { useToolsStore } from "./tools";
export { useUiStore, type AppMode } from "./ui";
