/**
 * Cesium runtime base-URL setup + Ion shutoff.
 *
 * Cesium's worker loader resolves `window.CESIUM_BASE_URL` (with a fallback
 * to the global `CESIUM_BASE_URL` constant injected by Vite's `define`). This
 * module sets the window property so first-paint workers can find their
 * assets even before the bundled global is evaluated.
 *
 * Import this file as the FIRST statement of `@/composables/useCesium.ts`
 * so it runs before any other Cesium module is loaded. The order matters —
 * Cesium reads the URL once at module-load time, not per-construction.
 *
 * We also clear `Ion.defaultAccessToken`. The default Cesium Viewer hits
 * Cesium Ion for imagery + terrain — without a token it falls back to a
 * shared developer token that's rate-limited and frequently returns an
 * HTML error page. That HTML response is what's behind the runtime
 * `Unexpected token '<'` (JSON.parse choking on the error page) and
 * `InvalidStateError: The source image could not be decoded` (imagery
 * tiles fed HTML to the browser's image decoder).
 *
 * The template instead uses the bundled `NaturalEarthII` tiles and an
 * ellipsoid terrain provider (see `useCesium.ts`), so there's no Ion
 * dependency. A consumer with an Ion subscription can re-enable Ion in
 * their fork by setting `Ion.defaultAccessToken = '<their-token>'`.
 */
import { Ion } from "cesium";

if (typeof window !== "undefined" && !window.CESIUM_BASE_URL) {
  window.CESIUM_BASE_URL = "/cesium/";
}

Ion.defaultAccessToken = "";

export {};
