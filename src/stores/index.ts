/**
 * Re-exports every Pinia store. Stores are added in later phases:
 *   - Phase 4: ui, layout
 *   - Phase 6: entities, telemetry, connection
 *   - Phase 7: tools
 *
 * Keep the export list flat so consumers can `import { useUi } from '@/stores'`.
 */
export {};
