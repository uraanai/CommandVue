/**
 * Curated color palette for the `<ColorPicker>` wrapper.
 *
 * Inspired by orbat-mapper's `src/components/colors.ts` (a similar
 * domain-operational template), reproduced here without taking that project's
 * `reka-ui` dependency. CommandVue's `<ColorPicker>` wraps `primevue/colorpicker`
 * and surfaces this palette as a typed export consumers can render as swatches.
 *
 * Each color is a hex string. The list is intentionally small — extend per
 * downstream app, do not bloat the template.
 */

export interface PaletteColor {
  /** Display name shown in tooltips and swatch labels. */
  name: string;
  /** Hex value with leading `#`. */
  hex: string;
}

/** Default operational palette — neutrals + standard semantic affordances. */
export const defaultColors: readonly PaletteColor[] = [
  { name: "Black", hex: "#000000" },
  { name: "Slate", hex: "#64748b" },
  { name: "White", hex: "#ffffff" },
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
] as const;

/** Affiliation colors mirroring the project's symbology defaults. */
export const affiliationColors: Readonly<Record<string, string>> = {
  friend: "#3b82f6",
  hostile: "#ef4444",
  neutral: "#10b981",
  unknown: "#eab308",
};
