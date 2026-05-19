/**
 * Re-exports every Pinia store. Stores are added in phases:
 *   - Phase 4: ui, layout
 *   - Phase 6: entities, telemetry, connection (this commit)
 *   - Phase 7: tools
 */
export { useConnectionStore } from "./connection";
export { useEntitiesStore, type Entity } from "./entities";
export { useLayoutStore } from "./layout";
export { useTelemetryStore } from "./telemetry";
export { useUiStore, type AppMode } from "./ui";
