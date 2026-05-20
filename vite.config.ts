import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/**
 * Base Vite configuration for CommandVue.
 *
 * Cesium wiring:
 *   - `scripts/copy-cesium-assets.mjs` mirrors
 *     `node_modules/cesium/Build/Cesium/{Assets,Workers,ThirdParty,Widgets}`
 *     into `public/cesium/` before `dev` and `build` (`predev` / `prebuild`
 *     npm hooks). Vite's built-in `public/` serving then handles both modes
 *     reliably — `vite-plugin-static-copy@4` regressed the dev middleware in
 *     our setup and returned the SPA fallback for Cesium asset URLs, which
 *     made `createImageBitmap` throw `InvalidStateError`.
 *   - `define.CESIUM_BASE_URL` injects the URL globally so Cesium's worker
 *     loader resolves to `/cesium/`.
 *   - `src/modules/cesium/init.ts` sets `window.CESIUM_BASE_URL` at runtime
 *     before any Cesium import is evaluated, and also clears the Ion access
 *     token so the default Viewer doesn't hit Cesium Ion at boot.
 *
 * Documented in `docs/architecture.md`.
 */

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium/"),
  },
  optimizeDeps: {
    // We used to exclude `cesium` here because esbuild's rewrites broke its
    // module layout. Under Vite 8 + the current Cesium release, pre-bundling
    // works correctly and — critically — drags Cesium's CJS subdeps like
    // `mersenne-twister` into the same pre-bundle pass, so the browser
    // receives valid ESM everywhere. If pre-bundling regresses on a future
    // Cesium release, re-add the exclude and reach for a Vite plugin or
    // `optimizeDeps.entries` to handle the transitive CJS.
    include: ["mersenne-twister"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      // Playwright MCP writes per-interaction snapshots into `.playwright-mcp/`.
      // Without this exclusion they trigger an infinite HMR reload loop.
      ignored: ["**/.playwright-mcp/**", "**/temp/**"],
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
