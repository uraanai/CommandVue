/**
 * Re-exports every Pinia store. Stores are added in phases:
 *   - Phase 4: ui, layout (this commit)
 *   - Phase 6: entities, telemetry, connection
 *   - Phase 7: tools
 */
export { useLayoutStore } from "./layout";
export { useUiStore, type AppMode } from "./ui";
