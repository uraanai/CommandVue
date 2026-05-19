import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Base Vite configuration for CommandVue.
 *
 * Map-specific plugin wiring (Cesium static-copy, CESIUM_BASE_URL define,
 * optimizeDeps.exclude) is added in Phase 5 when the map dependencies land.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
