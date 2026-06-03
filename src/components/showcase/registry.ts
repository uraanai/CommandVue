/**
 * Showcase primitive registry — the single source of truth for which UI
 * primitives the Component Showcase panel demonstrates.
 *
 * This list is the anti-drift backbone (Track A — A-Showcase). Every `.vue`
 * file under `src/components/ui/` and `src/volt/` must appear EITHER here (it's
 * demoed in the showcase) OR in {@link SHOWCASE_EXCLUDE} (deliberately not
 * inlined). `tests/unit/components/showcase/registry.spec.ts` enforces both
 * directions, so adding a new primitive without a showcase section — or leaving
 * a stale entry after deleting one — fails CI rather than silently rotting.
 *
 * `ShowcasePanel.vue` groups its sections by the `tab` here; the panel itself
 * holds the per-primitive demo markup (interactive controls need shared local
 * refs), so this file stays pure data with no Vue imports.
 */

export type ShowcaseTab = "buttons" | "display" | "inputs" | "overlays";

/** Where the primitive lives — its wrapper layer. */
export type ShowcaseSource = "ui" | "volt";

export interface ShowcaseEntry {
  /** Wrapper layer the file lives in (`src/components/ui` or `src/volt`). */
  source: ShowcaseSource;
  /** Component file basename without extension, e.g. `Button`. */
  id: string;
  /** Human label shown as the section legend. */
  label: string;
  /** Which showcase tab the section belongs to. */
  tab: ShowcaseTab;
}

export interface ShowcaseExclusion {
  source: ShowcaseSource;
  id: string;
  /** Why it isn't inlined in the showcase — keeps exclusions reviewed. */
  reason: string;
}

/** Every primitive the showcase demonstrates, grouped by tab. */
export const SHOWCASE_PRIMITIVES: readonly ShowcaseEntry[] = [
  // --- Display -------------------------------------------------------------
  { source: "volt", id: "Tag", label: "Tag", tab: "display" },
  { source: "volt", id: "Fieldset", label: "Fieldset", tab: "display" },
  { source: "ui", id: "Tabs", label: "Tabs", tab: "display" },
  // --- Inputs --------------------------------------------------------------
  { source: "ui", id: "Input", label: "Input", tab: "inputs" },
  { source: "volt", id: "InputText", label: "InputText (Volt)", tab: "inputs" },
  { source: "volt", id: "Textarea", label: "Textarea", tab: "inputs" },
  { source: "ui", id: "Select", label: "Select", tab: "inputs" },
  { source: "volt", id: "Checkbox", label: "Checkbox", tab: "inputs" },
  { source: "volt", id: "Slider", label: "Slider", tab: "inputs" },
  { source: "ui", id: "ColorPicker", label: "ColorPicker", tab: "inputs" },
  { source: "ui", id: "ColorSwatchPicker", label: "ColorSwatchPicker", tab: "inputs" },
  { source: "ui", id: "FileUpload", label: "FileUpload", tab: "inputs" },
  // --- Buttons -------------------------------------------------------------
  { source: "ui", id: "Button", label: "Button", tab: "buttons" },
  { source: "ui", id: "IconButton", label: "IconButton", tab: "buttons" },
  { source: "volt", id: "SecondaryButton", label: "SecondaryButton", tab: "buttons" },
  // --- Overlays & feedback -------------------------------------------------
  { source: "volt", id: "Dialog", label: "Dialog", tab: "overlays" },
  { source: "ui", id: "ContextMenu", label: "ContextMenu", tab: "overlays" },
  { source: "volt", id: "Menu", label: "Menu (popup)", tab: "overlays" },
  { source: "ui", id: "Menubar", label: "Menubar", tab: "overlays" },
  { source: "ui", id: "Tooltip", label: "Tooltip", tab: "overlays" },
];

/** Primitives deliberately NOT inlined in the showcase, with rationale. */
export const SHOWCASE_EXCLUDE: readonly ShowcaseExclusion[] = [
  {
    source: "ui",
    id: "DataTable",
    reason: "Heavy, data-driven, governed by ADR-0001; demoed by the Entity List panel.",
  },
  {
    source: "volt",
    id: "DataView",
    reason: "Heavy, data-driven grid; demoed by the Components browser panel.",
  },
  {
    source: "ui",
    id: "Toast",
    reason:
      "Rendered via NotificationOutlets, not inline; demoed by the Notifications tab triggers.",
  },
];

/** The primitive sections for a given tab, in registry order. */
export function primitivesForTab(tab: ShowcaseTab): readonly ShowcaseEntry[] {
  return SHOWCASE_PRIMITIVES.filter((p) => p.tab === tab);
}
