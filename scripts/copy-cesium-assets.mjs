#!/usr/bin/env node
/**
 * Copy Cesium's runtime asset directories from `node_modules/cesium/Build/Cesium/`
 * into `public/cesium/` so Vite serves them at `/cesium/*` in both `dev` and
 * `build` modes.
 *
 * Why this exists (and not just `vite-plugin-static-copy`):
 * `vite-plugin-static-copy@4.x` regressed the dev-mode middleware in our setup
 * — copied paths returned the SPA fallback HTML instead of the actual files,
 * which made Cesium fail with `InvalidStateError: The source image could not
 * be decoded` (browser tried to decode HTML as an image). Vite's built-in
 * `public/` static directory handling is dead-simple and works reliably, so
 * we mirror what we need into `public/cesium/` before dev / build starts.
 *
 * `public/cesium/` is gitignored — this script repopulates it every time.
 * Run automatically via the `predev` and `prebuild` npm hooks; safe to run
 * manually too: `node scripts/copy-cesium-assets.mjs`.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const cesiumSource = resolve(projectRoot, "node_modules/cesium/Build/Cesium");
const cesiumDest = resolve(projectRoot, "public/cesium");

const dirs = ["Assets", "Workers", "ThirdParty", "Widgets"];

if (!existsSync(cesiumSource)) {
  console.error(
    `[copy-cesium-assets] Cesium source not found at ${cesiumSource}. Run \`pnpm install\` first.`,
  );
  process.exit(1);
}

// Clean any stale partial copy so we don't accumulate orphaned files between
// Cesium upgrades. The directory is gitignored.
if (existsSync(cesiumDest)) {
  rmSync(cesiumDest, { recursive: true, force: true });
}
mkdirSync(cesiumDest, { recursive: true });

for (const dir of dirs) {
  const from = resolve(cesiumSource, dir);
  const to = resolve(cesiumDest, dir);
  if (!existsSync(from)) {
    console.error(`[copy-cesium-assets] Missing ${dir} under ${cesiumSource}`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true });
}

// eslint-disable-next-line no-console -- this is a CLI script, stdout is the contract.
console.log(`[copy-cesium-assets] Copied ${dirs.join(", ")} → public/cesium/`);
