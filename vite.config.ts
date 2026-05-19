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
    exclude: ["cesium"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
