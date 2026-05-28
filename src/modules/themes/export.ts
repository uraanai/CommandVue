/**
 * Theme export — serialize a {@link Theme} into a {@link PortableTheme} JSON
 * string and (in the browser) trigger a download.
 *
 * Three functions split by side effects so tests don't need DOM mocking for
 * the pure logic:
 *
 *   - `exportThemeToJson(theme)`   — pure: theme → PortableTheme JSON string.
 *   - `buildExportFilename(theme)` — pure: theme → `<slug>.commandvue-theme.json`.
 *   - `downloadThemeFile(theme)`   — composes the two above and dispatches a
 *                                    browser download via a hidden `<a>` click.
 *
 * The download filename uses a kebab-case slug of the theme's `name` (e.g.
 * `Ocean Sunrise` → `ocean-sunrise.commandvue-theme.json`) with a `*.commandvue-theme.json`
 * suffix that the Phase G import dialog later filters on.
 */

import { type PortableTheme, THEME_SCHEMA_VERSION, type Theme } from "@/types/theme";

import pkgJson from "../../../package.json";

const APP_VERSION = pkgJson.version;

/** Serialize a Theme into a PortableTheme envelope and pretty-print as JSON. */
export function exportThemeToJson(theme: Theme): string {
  const portable: PortableTheme = {
    schemaVersion: THEME_SCHEMA_VERSION,
    exportedAt: Date.now(),
    exportedBy: "commandvue",
    exportedByVersion: APP_VERSION,
    theme,
  };
  return JSON.stringify(portable, null, 2);
}

/**
 * Build the download filename from a theme name. Lowercased, non-alphanumeric
 * runs collapsed to single hyphens, leading / trailing hyphens trimmed, and
 * the canonical `*.commandvue-theme.json` suffix appended. Empty / punctuation-only
 * names fall back to `theme`.
 */
export function buildExportFilename(theme: Theme): string {
  const slug = theme.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "theme"}.commandvue-theme.json`;
}

/**
 * Browser-side download of a theme JSON. Creates an object URL, dispatches a
 * synthetic click on a hidden `<a download>` element, and revokes the URL.
 * No-op outside a browser context (tests cover the pure pair above).
 */
export function downloadThemeFile(theme: Theme): void {
  const json = exportThemeToJson(theme);
  const filename = buildExportFilename(theme);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
