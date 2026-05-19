import type { Viewer } from "cesium";

/**
 * Re-exports of frequently used Cesium types so consumers don't have to
 * know Cesium's internal module layout. Add to this list as the surface
 * area grows; do NOT re-export runtime values from here (keeps tree-shaking
 * predictable).
 */
export type { Cartesian3, Cartographic, Color, Entity, Viewer } from "cesium";

/** The full options bag accepted by `new Viewer(container, options)`. */
export type ViewerOptions = Viewer.ConstructorOptions;
