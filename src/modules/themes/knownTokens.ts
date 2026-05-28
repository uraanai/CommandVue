/**
 * Known-token registry — the single source of truth for which CSS custom
 * property names a theme may override.
 *
 * Hand-authored by extracting names from `src/assets/styles/tokens.css`.
 * Deliberately NOT auto-generated at runtime — the explicit list is the
 * contract that `themeRepo` invariants and the import validator enforce.
 * When `tokens.css` adds/removes a themeable token, update this file in the
 * same PR.
 *
 * Token-key convention: `--`-prefixed throughout (matches the form the
 * generator, import path, and apply engine use). The bundled built-in JSON
 * files store bare keys for historical reasons; `builtin.ts` normalizes them
 * before they reach the registry, and they never pass through these
 * validators (built-ins are registered, not stored in `themeRepo`).
 *
 * Themes override **semantic + component + density** tokens, plus a small
 * curated set of **themeable primitives** (radii + font families) that the
 * six built-ins legitimately tune for their aesthetic. The raw color /
 * spacing primitive scales (`--color-slate-500`, `--space-4`, …) are NOT
 * themeable — they're the foundation every other layer references.
 */

export const SEMANTIC_TOKEN_NAMES = [
  // Surface
  "--color-surface-base",
  "--color-surface-raised",
  "--color-surface-overlay",
  "--color-surface-sunken",
  // Border
  "--color-border-subtle",
  "--color-border-default",
  "--color-border-strong",
  // Text
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-disabled",
  "--color-text-inverse",
  // Interactive
  "--color-interactive",
  "--color-interactive-hover",
  "--color-interactive-active",
  "--color-interactive-subtle",
  "--color-on-interactive",
  // Status
  "--color-status-success",
  "--color-status-success-subtle",
  "--color-status-warning",
  "--color-status-warning-subtle",
  "--color-status-danger",
  "--color-status-danger-subtle",
  "--color-status-info",
  "--color-status-info-subtle",
  // Focus
  "--color-focus-ring",
  "--shadow-focus-ring",
  // Semantic spacing
  "--space-panel-padding",
  "--space-panel-gap",
  "--space-form-gap",
  "--space-inline-gap",
  "--space-section-gap",
  // Semantic typography
  "--font-family-body",
  // Backwards-compat aliases (the built-ins set these so old utility classes
  // such as `bg-surface` / `text-foreground` keep working).
  "--color-surface",
  "--color-foreground",
  "--color-muted",
  "--color-faint",
  "--color-border",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--color-info",
] as const;

export const COMPONENT_TOKEN_NAMES = [
  // DataTable
  "--datatable-header-bg",
  "--datatable-header-fg",
  "--datatable-row-hover-bg",
  "--datatable-row-selected-bg",
  "--datatable-border",
  "--datatable-cell-padding-y",
  "--datatable-cell-padding-x",
  "--datatable-row-height",
  "--datatable-font-size",
  // DockPanel
  "--dockpanel-bg",
  "--dockpanel-tab-bg",
  "--dockpanel-tab-active-bg",
  "--dockpanel-tab-border",
  "--dockpanel-padding",
  // MenuBar
  "--menubar-bg",
  "--menubar-fg",
  "--menubar-item-hover-bg",
  "--menubar-height",
  // StatusBar
  "--statusbar-bg",
  "--statusbar-fg",
  "--statusbar-border",
  "--statusbar-height",
  "--statusbar-font-size",
  // Dialog
  "--dialog-bg",
  "--dialog-backdrop",
  "--dialog-shadow",
  "--dialog-border",
  // Tooltip
  "--tooltip-bg",
  "--tooltip-text",
  "--tooltip-radius",
  "--tooltip-font-size",
  // Button
  "--button-radius",
  "--button-font-weight",
  "--button-height-sm",
  "--button-height-md",
  "--button-height-lg",
] as const;

export const DENSITY_TOKEN_NAMES = [
  "--density-row-height",
  "--density-cell-padding-y",
  "--density-cell-padding-x",
  "--density-control-height",
  "--density-icon-size",
  "--density-font-size",
  "--density-titlebar-height",
  "--density-statusbar-height",
  "--density-panel-header-height",
] as const;

/**
 * The curated primitives a theme MAY override — radii + font stacks + the
 * accent-color scale.
 *
 * The `--color-accent-*` scale (50–900) is here on purpose. In `tokens.css`
 * those tokens are *aliases* of `--color-blue-*` — they exist precisely so
 * themes can re-point the entire UI-primitive accent (Button, IconButton,
 * Input, Select, Tabs, Menubar, DataTable, ColorPicker, dockview panel
 * borders, …) by overriding one curated channel. The six built-ins all use
 * the default blue alias so they don't override these; the Phase B engine
 * derives the full scale from the user's accent so a non-blue generated
 * theme propagates through every wrapper that reads `bg-accent-500` etc.
 *
 * The raw color / spacing primitive scales (`--color-slate-500`,
 * `--color-blue-500`, `--space-4`, …) remain intentionally absent — themes
 * never touch those. The aliases are the documented extension point.
 */
export const THEMEABLE_PRIMITIVE_TOKEN_NAMES = [
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--radius-xl",
  "--font-family-sans",
  "--font-family-mono",
  // Accent scale aliases — overridable so generated / imported themes can
  // re-point every primitive that consumes `--color-accent-*`.
  "--color-accent-50",
  "--color-accent-100",
  "--color-accent-200",
  "--color-accent-300",
  "--color-accent-400",
  "--color-accent-500",
  "--color-accent-600",
  "--color-accent-700",
  "--color-accent-800",
  "--color-accent-900",
] as const;

export const ALL_KNOWN_TOKEN_NAMES = [
  ...SEMANTIC_TOKEN_NAMES,
  ...COMPONENT_TOKEN_NAMES,
  ...DENSITY_TOKEN_NAMES,
  ...THEMEABLE_PRIMITIVE_TOKEN_NAMES,
] as const;

export type KnownTokenName = (typeof ALL_KNOWN_TOKEN_NAMES)[number];

const KNOWN_SET = new Set<string>(ALL_KNOWN_TOKEN_NAMES);

/** True when `name` is an overridable token (`--`-prefixed form). */
export function isKnownToken(name: string): boolean {
  return KNOWN_SET.has(name);
}

/** Return the subset of `names` that are NOT overridable tokens. */
export function listUnknownTokens(names: string[]): string[] {
  return names.filter((n) => !isKnownToken(n));
}
