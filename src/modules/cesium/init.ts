/**
 * Cesium runtime base-URL setup.
 *
 * Cesium's worker loader resolves `window.CESIUM_BASE_URL` (with a fallback
 * to the global `CESIUM_BASE_URL` constant injected by Vite's `define`). This
 * module sets the window property so first-paint workers can find their
 * assets even before the bundled global is evaluated.
 *
 * Import this file as the FIRST statement of `@/composables/useCesium.ts`
 * so it runs before any other Cesium module is loaded. The order matters —
 * Cesium reads the URL once at module-load time, not per-construction.
 */
if (typeof window !== "undefined" && !window.CESIUM_BASE_URL) {
  window.CESIUM_BASE_URL = "/cesium/";
}

export {};
