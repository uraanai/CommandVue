import type { KnownTokenName } from "@/modules/themes/knownTokens";

import { ALL_KNOWN_TOKEN_NAMES } from "@/modules/themes/knownTokens";

/**
 * Token manifest (Track A C1) — a pure annotation layer over `knownTokens.ts`.
 *
 * It adds NO token names; it categorizes every member of `ALL_KNOWN_TOKEN_NAMES`
 * into a Studio section + an editor `kind` (+ an optional WCAG `contrastAgainst`
 * partner for color foregrounds). The set of `TOKEN_MANIFEST` keys MUST equal
 * `ALL_KNOWN_TOKEN_NAMES` exactly — a second drift tripwire alongside the LLM-doc
 * guard, enforced by `tests/unit/themes/tokenManifest.spec.ts` (set-equality, no
 * numeric literal). When `knownTokens.ts` grows, add the matching manifest entry
 * in the same PR or that spec fails.
 *
 * No Vue, no DOM, no IDB — pure data, unit-testable in isolation.
 */

/** Control-selection category for a token's editor. */
export type TokenKind =
  | "color" // OKLCH/hex/color-mix/var → TokenColorField (custom-any, OKLCH-aware)
  | "length" // rem/px dimension → InputNumber + unit Select (free-text fallback for var() chains)
  | "number" // unitless scalar (font-weight) → InputNumber
  | "font-stack" // CSS font-family list → Select (curated) + free text
  | "shadow" // box-shadow composite → validated text Input
  | "duration"; // reserved; zero entries today (asserted) — forward-compat for a motion phase

/** Canonical Studio section ids. Order here is display order. Later phases
 *  (C2/C4/C5) append their own sections in their PRs; C1 owns these. */
export const TOKEN_SECTIONS = [
  "surface",
  "border",
  "text",
  "interactive",
  "status",
  "focus-and-depth",
  "spacing",
  "radius",
  "typography",
  "accent-scale",
  "surface-scale",
  "component-datatable",
  "component-dockpanel",
  "component-menubar",
  "component-statusbar",
  "component-dialog",
  "component-tooltip",
  "component-button",
  "density",
  "compat-aliases",
] as const;
export type TokenSection = (typeof TOKEN_SECTIONS)[number];

export const TOKEN_SECTION_LABELS: Record<TokenSection, string> = {
  surface: "Surface",
  border: "Border",
  text: "Text",
  interactive: "Interactive",
  status: "Status",
  "focus-and-depth": "Focus & Depth",
  spacing: "Spacing",
  radius: "Radius",
  typography: "Typography",
  "accent-scale": "Accent scale",
  "surface-scale": "Surface scale",
  "component-datatable": "DataTable",
  "component-dockpanel": "Dock panel",
  "component-menubar": "Menu bar",
  "component-statusbar": "Status bar",
  "component-dialog": "Dialog",
  "component-tooltip": "Tooltip",
  "component-button": "Button",
  density: "Density",
  "compat-aliases": "Compatibility aliases",
};

export interface TokenManifestEntry {
  name: KnownTokenName;
  section: TokenSection;
  label: string;
  kind: TokenKind;
  /** For color foregrounds: a color-kind KnownTokenName background to compute an
   *  advisory WCAG ratio against. Never the token itself. */
  contrastAgainst?: KnownTokenName;
}

/**
 * One entry per `ALL_KNOWN_TOKEN_NAMES` member, in section display order. The
 * `tokenManifest.spec.ts` set-equality guard — NOT this comment — is the
 * authority on completeness. Re-derive against `knownTokens.ts` if it drifts.
 */
export const TOKEN_MANIFEST_LIST: readonly TokenManifestEntry[] = [
  // ── surface ───────────────────────────────────────────────────────────────
  { name: "--color-surface-base", section: "surface", label: "Surface · base", kind: "color" },
  { name: "--color-surface-raised", section: "surface", label: "Surface · raised", kind: "color" },
  {
    name: "--color-surface-overlay",
    section: "surface",
    label: "Surface · overlay",
    kind: "color",
  },
  { name: "--color-surface-sunken", section: "surface", label: "Surface · sunken", kind: "color" },
  {
    name: "--color-surface-bevel-light",
    section: "surface",
    label: "Surface · bevel light",
    kind: "color",
  },
  {
    name: "--color-surface-bevel-dark",
    section: "surface",
    label: "Surface · bevel dark",
    kind: "color",
  },
  // ── border ────────────────────────────────────────────────────────────────
  { name: "--color-border-subtle", section: "border", label: "Border · subtle", kind: "color" },
  { name: "--color-border-default", section: "border", label: "Border · default", kind: "color" },
  { name: "--color-border-strong", section: "border", label: "Border · strong", kind: "color" },
  { name: "--color-border-accent", section: "border", label: "Border · accent", kind: "color" },
  // ── text ──────────────────────────────────────────────────────────────────
  {
    name: "--color-text-primary",
    section: "text",
    label: "Text · primary",
    kind: "color",
    contrastAgainst: "--color-surface-base",
  },
  {
    name: "--color-text-secondary",
    section: "text",
    label: "Text · secondary",
    kind: "color",
    contrastAgainst: "--color-surface-base",
  },
  {
    name: "--color-text-tertiary",
    section: "text",
    label: "Text · tertiary",
    kind: "color",
    contrastAgainst: "--color-surface-base",
  },
  {
    name: "--color-text-disabled",
    section: "text",
    label: "Text · disabled",
    kind: "color",
    contrastAgainst: "--color-surface-base",
  },
  {
    name: "--color-text-inverse",
    section: "text",
    label: "Text · inverse",
    kind: "color",
    contrastAgainst: "--color-interactive",
  },
  // ── interactive ───────────────────────────────────────────────────────────
  { name: "--color-interactive", section: "interactive", label: "Interactive", kind: "color" },
  {
    name: "--color-interactive-hover",
    section: "interactive",
    label: "Interactive · hover",
    kind: "color",
  },
  {
    name: "--color-interactive-active",
    section: "interactive",
    label: "Interactive · active",
    kind: "color",
  },
  {
    name: "--color-interactive-subtle",
    section: "interactive",
    label: "Interactive · subtle",
    kind: "color",
  },
  {
    name: "--color-on-interactive",
    section: "interactive",
    label: "On interactive",
    kind: "color",
    contrastAgainst: "--color-interactive",
  },
  {
    name: "--color-interactive-glow",
    section: "interactive",
    label: "Interactive · glow",
    kind: "color",
  },
  {
    name: "--color-interactive-dim",
    section: "interactive",
    label: "Interactive · dim",
    kind: "color",
  },
  // ── status ────────────────────────────────────────────────────────────────
  {
    name: "--color-status-success",
    section: "status",
    label: "Status · success",
    kind: "color",
    contrastAgainst: "--color-status-success-subtle",
  },
  {
    name: "--color-status-success-subtle",
    section: "status",
    label: "Status · success subtle",
    kind: "color",
  },
  {
    name: "--color-status-success-border",
    section: "status",
    label: "Status · success border",
    kind: "color",
  },
  {
    name: "--color-status-warning",
    section: "status",
    label: "Status · warning",
    kind: "color",
    contrastAgainst: "--color-status-warning-subtle",
  },
  {
    name: "--color-status-warning-subtle",
    section: "status",
    label: "Status · warning subtle",
    kind: "color",
  },
  {
    name: "--color-status-warning-border",
    section: "status",
    label: "Status · warning border",
    kind: "color",
  },
  {
    name: "--color-status-danger",
    section: "status",
    label: "Status · danger",
    kind: "color",
    contrastAgainst: "--color-status-danger-subtle",
  },
  {
    name: "--color-status-danger-subtle",
    section: "status",
    label: "Status · danger subtle",
    kind: "color",
  },
  {
    name: "--color-status-danger-border",
    section: "status",
    label: "Status · danger border",
    kind: "color",
  },
  {
    name: "--color-status-info",
    section: "status",
    label: "Status · info",
    kind: "color",
    contrastAgainst: "--color-status-info-subtle",
  },
  {
    name: "--color-status-info-subtle",
    section: "status",
    label: "Status · info subtle",
    kind: "color",
  },
  {
    name: "--color-status-info-border",
    section: "status",
    label: "Status · info border",
    kind: "color",
  },
  { name: "--color-toast-bg", section: "status", label: "Toast · bg", kind: "color" },
  {
    name: "--color-toast-fg",
    section: "status",
    label: "Toast · fg",
    kind: "color",
    contrastAgainst: "--color-toast-bg",
  },
  { name: "--color-toast-border", section: "status", label: "Toast · border", kind: "color" },
  {
    name: "--color-toast-success-bg",
    section: "status",
    label: "Toast · success bg",
    kind: "color",
  },
  {
    name: "--color-toast-success-fg",
    section: "status",
    label: "Toast · success fg",
    kind: "color",
    contrastAgainst: "--color-toast-success-bg",
  },
  { name: "--color-toast-info-bg", section: "status", label: "Toast · info bg", kind: "color" },
  {
    name: "--color-toast-info-fg",
    section: "status",
    label: "Toast · info fg",
    kind: "color",
    contrastAgainst: "--color-toast-info-bg",
  },
  {
    name: "--color-toast-warning-bg",
    section: "status",
    label: "Toast · warning bg",
    kind: "color",
  },
  {
    name: "--color-toast-warning-fg",
    section: "status",
    label: "Toast · warning fg",
    kind: "color",
    contrastAgainst: "--color-toast-warning-bg",
  },
  { name: "--color-toast-danger-bg", section: "status", label: "Toast · danger bg", kind: "color" },
  {
    name: "--color-toast-danger-fg",
    section: "status",
    label: "Toast · danger fg",
    kind: "color",
    contrastAgainst: "--color-toast-danger-bg",
  },
  // ── focus-and-depth ───────────────────────────────────────────────────────
  { name: "--color-focus-ring", section: "focus-and-depth", label: "Focus ring", kind: "color" },
  {
    name: "--shadow-focus-ring",
    section: "focus-and-depth",
    label: "Focus ring shadow",
    kind: "shadow",
  },
  {
    name: "--shadow-bevel-raised",
    section: "focus-and-depth",
    label: "Shadow · bevel raised",
    kind: "shadow",
  },
  {
    name: "--shadow-bevel-sunken",
    section: "focus-and-depth",
    label: "Shadow · bevel sunken",
    kind: "shadow",
  },
  {
    name: "--shadow-accent-glow",
    section: "focus-and-depth",
    label: "Shadow · accent glow",
    kind: "shadow",
  },
  // ── spacing ───────────────────────────────────────────────────────────────
  {
    name: "--space-panel-padding",
    section: "spacing",
    label: "Space · panel padding",
    kind: "length",
  },
  { name: "--space-panel-gap", section: "spacing", label: "Space · panel gap", kind: "length" },
  { name: "--space-form-gap", section: "spacing", label: "Space · form gap", kind: "length" },
  { name: "--space-inline-gap", section: "spacing", label: "Space · inline gap", kind: "length" },
  { name: "--space-section-gap", section: "spacing", label: "Space · section gap", kind: "length" },
  // ── radius ────────────────────────────────────────────────────────────────
  { name: "--radius-sm", section: "radius", label: "Radius · sm", kind: "length" },
  { name: "--radius-md", section: "radius", label: "Radius · md", kind: "length" },
  { name: "--radius-lg", section: "radius", label: "Radius · lg", kind: "length" },
  { name: "--radius-xl", section: "radius", label: "Radius · xl", kind: "length" },
  // ── typography ────────────────────────────────────────────────────────────
  { name: "--font-family-body", section: "typography", label: "Font · body", kind: "font-stack" },
  { name: "--font-family-sans", section: "typography", label: "Font · sans", kind: "font-stack" },
  { name: "--font-family-mono", section: "typography", label: "Font · mono", kind: "font-stack" },
  // ── accent-scale ──────────────────────────────────────────────────────────
  { name: "--color-accent-50", section: "accent-scale", label: "Accent · 50", kind: "color" },
  { name: "--color-accent-100", section: "accent-scale", label: "Accent · 100", kind: "color" },
  { name: "--color-accent-200", section: "accent-scale", label: "Accent · 200", kind: "color" },
  { name: "--color-accent-300", section: "accent-scale", label: "Accent · 300", kind: "color" },
  { name: "--color-accent-400", section: "accent-scale", label: "Accent · 400", kind: "color" },
  { name: "--color-accent-500", section: "accent-scale", label: "Accent · 500", kind: "color" },
  { name: "--color-accent-600", section: "accent-scale", label: "Accent · 600", kind: "color" },
  { name: "--color-accent-700", section: "accent-scale", label: "Accent · 700", kind: "color" },
  { name: "--color-accent-800", section: "accent-scale", label: "Accent · 800", kind: "color" },
  { name: "--color-accent-900", section: "accent-scale", label: "Accent · 900", kind: "color" },
  // ── surface-scale ─────────────────────────────────────────────────────────
  {
    name: "--color-p-surface-0",
    section: "surface-scale",
    label: "Surface scale · 0",
    kind: "color",
  },
  {
    name: "--color-p-surface-50",
    section: "surface-scale",
    label: "Surface scale · 50",
    kind: "color",
  },
  {
    name: "--color-p-surface-100",
    section: "surface-scale",
    label: "Surface scale · 100",
    kind: "color",
  },
  {
    name: "--color-p-surface-200",
    section: "surface-scale",
    label: "Surface scale · 200",
    kind: "color",
  },
  {
    name: "--color-p-surface-300",
    section: "surface-scale",
    label: "Surface scale · 300",
    kind: "color",
  },
  {
    name: "--color-p-surface-400",
    section: "surface-scale",
    label: "Surface scale · 400",
    kind: "color",
  },
  {
    name: "--color-p-surface-500",
    section: "surface-scale",
    label: "Surface scale · 500",
    kind: "color",
  },
  {
    name: "--color-p-surface-600",
    section: "surface-scale",
    label: "Surface scale · 600",
    kind: "color",
  },
  {
    name: "--color-p-surface-700",
    section: "surface-scale",
    label: "Surface scale · 700",
    kind: "color",
  },
  {
    name: "--color-p-surface-800",
    section: "surface-scale",
    label: "Surface scale · 800",
    kind: "color",
  },
  {
    name: "--color-p-surface-900",
    section: "surface-scale",
    label: "Surface scale · 900",
    kind: "color",
  },
  {
    name: "--color-p-surface-950",
    section: "surface-scale",
    label: "Surface scale · 950",
    kind: "color",
  },
  // ── component-datatable ───────────────────────────────────────────────────
  {
    name: "--datatable-header-bg",
    section: "component-datatable",
    label: "DataTable · header bg",
    kind: "color",
  },
  {
    name: "--datatable-header-fg",
    section: "component-datatable",
    label: "DataTable · header fg",
    kind: "color",
    contrastAgainst: "--datatable-header-bg",
  },
  {
    name: "--datatable-row-hover-bg",
    section: "component-datatable",
    label: "DataTable · row hover",
    kind: "color",
  },
  {
    name: "--datatable-row-selected-bg",
    section: "component-datatable",
    label: "DataTable · row selected",
    kind: "color",
  },
  {
    name: "--datatable-border",
    section: "component-datatable",
    label: "DataTable · border",
    kind: "color",
  },
  {
    name: "--datatable-cell-padding-y",
    section: "component-datatable",
    label: "DataTable · cell pad Y",
    kind: "length",
  },
  {
    name: "--datatable-cell-padding-x",
    section: "component-datatable",
    label: "DataTable · cell pad X",
    kind: "length",
  },
  {
    name: "--datatable-row-height",
    section: "component-datatable",
    label: "DataTable · row height",
    kind: "length",
  },
  {
    name: "--datatable-font-size",
    section: "component-datatable",
    label: "DataTable · font size",
    kind: "length",
  },
  // ── component-dockpanel ───────────────────────────────────────────────────
  {
    name: "--dockpanel-bg",
    section: "component-dockpanel",
    label: "Dock panel · bg",
    kind: "color",
  },
  {
    name: "--dockpanel-tab-bg",
    section: "component-dockpanel",
    label: "Dock panel · tab bg",
    kind: "color",
  },
  {
    name: "--dockpanel-tab-active-bg",
    section: "component-dockpanel",
    label: "Dock panel · tab active",
    kind: "color",
  },
  {
    name: "--dockpanel-tab-border",
    section: "component-dockpanel",
    label: "Dock panel · tab border",
    kind: "color",
  },
  {
    name: "--dockpanel-padding",
    section: "component-dockpanel",
    label: "Dock panel · padding",
    kind: "length",
  },
  // ── component-menubar ─────────────────────────────────────────────────────
  { name: "--menubar-bg", section: "component-menubar", label: "Menu bar · bg", kind: "color" },
  {
    name: "--menubar-fg",
    section: "component-menubar",
    label: "Menu bar · fg",
    kind: "color",
    contrastAgainst: "--menubar-bg",
  },
  {
    name: "--menubar-item-hover-bg",
    section: "component-menubar",
    label: "Menu bar · item hover",
    kind: "color",
  },
  {
    name: "--menubar-height",
    section: "component-menubar",
    label: "Menu bar · height",
    kind: "length",
  },
  // ── component-statusbar ───────────────────────────────────────────────────
  {
    name: "--statusbar-bg",
    section: "component-statusbar",
    label: "Status bar · bg",
    kind: "color",
  },
  {
    name: "--statusbar-fg",
    section: "component-statusbar",
    label: "Status bar · fg",
    kind: "color",
    contrastAgainst: "--statusbar-bg",
  },
  {
    name: "--statusbar-border",
    section: "component-statusbar",
    label: "Status bar · border",
    kind: "color",
  },
  {
    name: "--statusbar-height",
    section: "component-statusbar",
    label: "Status bar · height",
    kind: "length",
  },
  {
    name: "--statusbar-font-size",
    section: "component-statusbar",
    label: "Status bar · font size",
    kind: "length",
  },
  // ── component-dialog ──────────────────────────────────────────────────────
  { name: "--dialog-bg", section: "component-dialog", label: "Dialog · bg", kind: "color" },
  {
    name: "--dialog-backdrop",
    section: "component-dialog",
    label: "Dialog · backdrop",
    kind: "color",
  },
  {
    name: "--dialog-shadow",
    section: "component-dialog",
    label: "Dialog · shadow",
    kind: "shadow",
  },
  { name: "--dialog-border", section: "component-dialog", label: "Dialog · border", kind: "color" },
  // ── component-tooltip ─────────────────────────────────────────────────────
  { name: "--tooltip-bg", section: "component-tooltip", label: "Tooltip · bg", kind: "color" },
  {
    name: "--tooltip-text",
    section: "component-tooltip",
    label: "Tooltip · text",
    kind: "color",
    contrastAgainst: "--tooltip-bg",
  },
  {
    name: "--tooltip-radius",
    section: "component-tooltip",
    label: "Tooltip · radius",
    kind: "length",
  },
  {
    name: "--tooltip-font-size",
    section: "component-tooltip",
    label: "Tooltip · font size",
    kind: "length",
  },
  // ── component-button ──────────────────────────────────────────────────────
  {
    name: "--button-radius",
    section: "component-button",
    label: "Button · radius",
    kind: "length",
  },
  {
    name: "--button-font-weight",
    section: "component-button",
    label: "Button · font weight",
    kind: "number",
  },
  {
    name: "--button-height-sm",
    section: "component-button",
    label: "Button · height sm",
    kind: "length",
  },
  {
    name: "--button-height-md",
    section: "component-button",
    label: "Button · height md",
    kind: "length",
  },
  {
    name: "--button-height-lg",
    section: "component-button",
    label: "Button · height lg",
    kind: "length",
  },
  // ── density ───────────────────────────────────────────────────────────────
  {
    name: "--density-row-height",
    section: "density",
    label: "Density · row height",
    kind: "length",
  },
  {
    name: "--density-cell-padding-y",
    section: "density",
    label: "Density · cell pad Y",
    kind: "length",
  },
  {
    name: "--density-cell-padding-x",
    section: "density",
    label: "Density · cell pad X",
    kind: "length",
  },
  {
    name: "--density-control-height",
    section: "density",
    label: "Density · control height",
    kind: "length",
  },
  { name: "--density-icon-size", section: "density", label: "Density · icon size", kind: "length" },
  { name: "--density-font-size", section: "density", label: "Density · font size", kind: "length" },
  {
    name: "--density-titlebar-height",
    section: "density",
    label: "Density · titlebar height",
    kind: "length",
  },
  {
    name: "--density-statusbar-height",
    section: "density",
    label: "Density · statusbar height",
    kind: "length",
  },
  {
    name: "--density-panel-header-height",
    section: "density",
    label: "Density · panel header",
    kind: "length",
  },
  // ── compat-aliases ────────────────────────────────────────────────────────
  { name: "--color-surface", section: "compat-aliases", label: "Alias · surface", kind: "color" },
  {
    name: "--color-foreground",
    section: "compat-aliases",
    label: "Alias · foreground",
    kind: "color",
    contrastAgainst: "--color-surface",
  },
  { name: "--color-muted", section: "compat-aliases", label: "Alias · muted", kind: "color" },
  { name: "--color-faint", section: "compat-aliases", label: "Alias · faint", kind: "color" },
  { name: "--color-border", section: "compat-aliases", label: "Alias · border", kind: "color" },
  { name: "--color-success", section: "compat-aliases", label: "Alias · success", kind: "color" },
  { name: "--color-warning", section: "compat-aliases", label: "Alias · warning", kind: "color" },
  { name: "--color-danger", section: "compat-aliases", label: "Alias · danger", kind: "color" },
  { name: "--color-info", section: "compat-aliases", label: "Alias · info", kind: "color" },
];

export const TOKEN_MANIFEST: Readonly<Record<KnownTokenName, TokenManifestEntry>> = Object.freeze(
  Object.fromEntries(TOKEN_MANIFEST_LIST.map((e) => [e.name, e])),
) as Record<KnownTokenName, TokenManifestEntry>;

export function getTokenManifestEntry(name: string): TokenManifestEntry | undefined {
  return (TOKEN_MANIFEST as Record<string, TokenManifestEntry>)[name];
}
export function tokenEntriesForSection(section: TokenSection): readonly TokenManifestEntry[] {
  return TOKEN_MANIFEST_LIST.filter((e) => e.section === section);
}
export function populatedSections(): readonly TokenSection[] {
  return TOKEN_SECTIONS.filter((s) => TOKEN_MANIFEST_LIST.some((e) => e.section === s));
}

// Re-export so a single import gives consumers the manifest + the allowlist it mirrors.
export { ALL_KNOWN_TOKEN_NAMES };
