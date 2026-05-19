/**
 * Ambient declarations shared across the application.
 *
 * `CESIUM_BASE_URL` is wired in Phase 5 via Vite's `define` config; declaring
 * it here lets `useCesium.ts` reference the global without `any` casts.
 */
declare const CESIUM_BASE_URL: string;

interface Window {
  CESIUM_BASE_URL?: string;
}

export {};
