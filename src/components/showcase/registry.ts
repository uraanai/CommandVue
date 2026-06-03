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

export type ShowcaseTab =
  | "form-inputs"
  | "selection"
  | "forms"
  | "buttons"
  | "data-display"
  | "feedback-status"
  | "overlays"
  | "panels-layout"
  | "navigation"
  | "notifications";

/** Ordered tab metadata — drives the Showcase tab bar + section grouping. */
export const SHOWCASE_TABS: readonly { id: ShowcaseTab; label: string }[] = [
  { id: "form-inputs", label: "Form Inputs" },
  { id: "selection", label: "Selection" },
  { id: "forms", label: "Forms" },
  { id: "buttons", label: "Buttons" },
  { id: "data-display", label: "Data Display" },
  { id: "feedback-status", label: "Feedback & Status" },
  { id: "overlays", label: "Overlays" },
  { id: "panels-layout", label: "Panels & Layout" },
  { id: "navigation", label: "Navigation" },
  { id: "notifications", label: "Notifications" },
];

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
  // --- Form Inputs ---------------------------------------------------------
  { source: "ui", id: "Input", label: "Input (text)", tab: "form-inputs" },
  { source: "volt", id: "InputText", label: "InputText (Volt)", tab: "form-inputs" },
  { source: "volt", id: "Textarea", label: "Textarea", tab: "form-inputs" },
  { source: "volt", id: "Password", label: "Password (strength meter)", tab: "form-inputs" },
  { source: "volt", id: "InputNumber", label: "InputNumber", tab: "form-inputs" },
  { source: "volt", id: "InputMask", label: "InputMask", tab: "form-inputs" },
  { source: "volt", id: "InputOtp", label: "InputOtp", tab: "form-inputs" },
  { source: "volt", id: "DatePicker", label: "DatePicker (date + time)", tab: "form-inputs" },
  { source: "volt", id: "Slider", label: "Slider", tab: "form-inputs" },
  { source: "volt", id: "FloatLabel", label: "FloatLabel", tab: "form-inputs" },
  { source: "volt", id: "IftaLabel", label: "IftaLabel", tab: "form-inputs" },
  { source: "volt", id: "IconField", label: "IconField + InputIcon", tab: "form-inputs" },
  { source: "volt", id: "InputGroup", label: "InputGroup + Addon", tab: "form-inputs" },
  { source: "volt", id: "Knob", label: "Knob", tab: "form-inputs" },
  { source: "ui", id: "ColorPicker", label: "ColorPicker", tab: "form-inputs" },
  { source: "ui", id: "ColorSwatchPicker", label: "ColorSwatchPicker", tab: "form-inputs" },
  { source: "ui", id: "FileUpload", label: "FileUpload", tab: "form-inputs" },
  // --- Selection -----------------------------------------------------------
  { source: "ui", id: "Select", label: "Select", tab: "selection" },
  { source: "volt", id: "Checkbox", label: "Checkbox", tab: "selection" },
  { source: "volt", id: "RadioButton", label: "RadioButton", tab: "selection" },
  { source: "volt", id: "MultiSelect", label: "MultiSelect", tab: "selection" },
  { source: "volt", id: "AutoComplete", label: "AutoComplete", tab: "selection" },
  { source: "volt", id: "SelectButton", label: "SelectButton (segmented)", tab: "selection" },
  { source: "volt", id: "ToggleButton", label: "ToggleButton", tab: "selection" },
  { source: "volt", id: "ToggleSwitch", label: "ToggleSwitch", tab: "selection" },
  { source: "volt", id: "Listbox", label: "Listbox", tab: "selection" },
  { source: "volt", id: "Rating", label: "Rating", tab: "selection" },
  // --- Buttons -------------------------------------------------------------
  { source: "ui", id: "Button", label: "Button", tab: "buttons" },
  { source: "ui", id: "IconButton", label: "IconButton", tab: "buttons" },
  { source: "volt", id: "SecondaryButton", label: "SecondaryButton", tab: "buttons" },
  { source: "volt", id: "SplitButton", label: "SplitButton", tab: "buttons" },
  // --- Data Display --------------------------------------------------------
  { source: "ui", id: "DataTable", label: "DataTable (TanStack)", tab: "data-display" },
  { source: "volt", id: "DataView", label: "DataView (grid)", tab: "data-display" },
  { source: "volt", id: "Tag", label: "Tag", tab: "data-display" },
  { source: "volt", id: "Chip", label: "Chip", tab: "data-display" },
  { source: "volt", id: "Avatar", label: "Avatar + AvatarGroup", tab: "data-display" },
  { source: "volt", id: "Badge", label: "Badge + OverlayBadge", tab: "data-display" },
  { source: "volt", id: "Timeline", label: "Timeline", tab: "data-display" },
  { source: "volt", id: "Tree", label: "Tree", tab: "data-display" },
  { source: "volt", id: "MeterGroup", label: "MeterGroup", tab: "data-display" },
  { source: "volt", id: "Inplace", label: "Inplace (click-to-edit)", tab: "data-display" },
  // --- Feedback & Status ---------------------------------------------------
  { source: "volt", id: "Message", label: "Message", tab: "feedback-status" },
  { source: "volt", id: "ProgressBar", label: "ProgressBar", tab: "feedback-status" },
  { source: "volt", id: "ProgressSpinner", label: "ProgressSpinner", tab: "feedback-status" },
  { source: "volt", id: "Skeleton", label: "Skeleton", tab: "feedback-status" },
  { source: "volt", id: "BlockUI", label: "BlockUI", tab: "feedback-status" },
  // --- Overlays ------------------------------------------------------------
  { source: "volt", id: "Dialog", label: "Dialog", tab: "overlays" },
  { source: "volt", id: "ConfirmDialog", label: "ConfirmDialog", tab: "overlays" },
  { source: "volt", id: "ConfirmPopup", label: "ConfirmPopup", tab: "overlays" },
  { source: "volt", id: "Drawer", label: "Drawer", tab: "overlays" },
  { source: "volt", id: "Popover", label: "Popover", tab: "overlays" },
  { source: "ui", id: "Tooltip", label: "Tooltip", tab: "overlays" },
  { source: "ui", id: "ContextMenu", label: "ContextMenu", tab: "overlays" },
  { source: "volt", id: "Menu", label: "Menu (popup)", tab: "overlays" },
  // --- Panels & Layout -----------------------------------------------------
  { source: "volt", id: "Fieldset", label: "Fieldset", tab: "panels-layout" },
  { source: "volt", id: "Panel", label: "Panel (toggleable)", tab: "panels-layout" },
  { source: "volt", id: "Card", label: "Card", tab: "panels-layout" },
  { source: "volt", id: "Divider", label: "Divider", tab: "panels-layout" },
  { source: "volt", id: "Accordion", label: "Accordion", tab: "panels-layout" },
  { source: "volt", id: "Toolbar", label: "Toolbar", tab: "panels-layout" },
  // --- Navigation ----------------------------------------------------------
  { source: "ui", id: "Tabs", label: "Tabs", tab: "navigation" },
  { source: "ui", id: "Menubar", label: "Menubar", tab: "navigation" },
  { source: "volt", id: "Breadcrumb", label: "Breadcrumb", tab: "navigation" },
  { source: "volt", id: "Paginator", label: "Paginator", tab: "navigation" },
  { source: "volt", id: "Stepper", label: "Stepper", tab: "navigation" },
];

/** Primitives deliberately NOT inlined in the showcase, with rationale. */
export const SHOWCASE_EXCLUDE: readonly ShowcaseExclusion[] = [
  {
    source: "ui",
    id: "Toast",
    reason:
      "Rendered via NotificationOutlets, not inline; demoed by the Notifications tab triggers.",
  },
  {
    source: "volt",
    id: "Button",
    reason:
      "Internal primary button consumed by the Volt overlay wrappers (ConfirmDialog/ConfirmPopup/SplitButton); the canonical button primitive is ui/Button.",
  },
  {
    source: "volt",
    id: "AvatarGroup",
    reason: "Grouping container demoed within the Avatar section (Data Display).",
  },
  {
    source: "volt",
    id: "OverlayBadge",
    reason: "Badge-overlay variant demoed within the Badge section (Data Display).",
  },
  {
    source: "volt",
    id: "InputIcon",
    reason: "Icon element rendered inside IconField; demoed in that section.",
  },
  {
    source: "volt",
    id: "InputGroupAddon",
    reason: "Addon cell rendered inside InputGroup; demoed in that section.",
  },
  {
    source: "volt",
    id: "AccordionPanel",
    reason: "Structural sub-part of Accordion; demoed within the Accordion section.",
  },
  {
    source: "volt",
    id: "AccordionHeader",
    reason: "Structural sub-part of Accordion; demoed within the Accordion section.",
  },
  {
    source: "volt",
    id: "AccordionContent",
    reason: "Structural sub-part of Accordion; demoed within the Accordion section.",
  },
  {
    source: "volt",
    id: "StepList",
    reason: "Structural sub-part of Stepper; demoed within the Stepper section.",
  },
  {
    source: "volt",
    id: "Step",
    reason: "Structural sub-part of Stepper; demoed within the Stepper section.",
  },
  {
    source: "volt",
    id: "StepItem",
    reason: "Structural sub-part of Stepper; demoed within the Stepper section.",
  },
  {
    source: "volt",
    id: "StepPanels",
    reason: "Structural sub-part of Stepper; demoed within the Stepper section.",
  },
  {
    source: "volt",
    id: "StepPanel",
    reason: "Structural sub-part of Stepper; demoed within the Stepper section.",
  },
];

/** The primitive sections for a given tab, in registry order. */
export function primitivesForTab(tab: ShowcaseTab): readonly ShowcaseEntry[] {
  return SHOWCASE_PRIMITIVES.filter((p) => p.tab === tab);
}
