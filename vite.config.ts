import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

/**
 * Base Vite configuration for CommandVue.
 *
 * Cesium wiring:
 *   - `vite-plugin-static-copy` copies Cesium's runtime assets from
 *     `node_modules/cesium/Build/Cesium/{Assets,Workers,ThirdParty,Widgets}`
 *     into `dist/cesium/` at build time, and serves them via dev middleware
 *     at the same URL during `pnpm dev`.
 *   - `define.CESIUM_BASE_URL` injects the URL globally so Cesium's worker
 *     loader resolves to `/cesium/`.
 *   - `optimizeDeps.exclude: ["cesium"]` keeps Vite from prebundling Cesium
 *     (its module layout breaks under esbuild's rewrites).
 *   - `src/modules/cesium/init.ts` sets `window.CESIUM_BASE_URL` at runtime
 *     before any Cesium import is evaluated.
 *
 * Documented in `docs/architecture.md`.
 */
const cesiumSource = "node_modules/cesium/Build/Cesium";

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/Assets`, dest: "cesium" },
        { src: `${cesiumSource}/Workers`, dest: "cesium" },
        { src: `${cesiumSource}/ThirdParty`, dest: "cesium" },
        { src: `${cesiumSource}/Widgets`, dest: "cesium" },
      ],
    }),
  ],
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
