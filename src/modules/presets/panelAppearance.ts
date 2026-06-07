import type { PresetTypeDefinition } from "./types";
import type { Ulid } from "@/types/workspace";

import { ALL_BUILTIN_PANEL_TYPE_IDS } from "@/modules/panels/builtin";
import { useSessionStore } from "@/stores/session";

/**
 * `panel-appearance` preset type (Track A C4).
 *
 * Lets the maintainer give any dock panel one of four frame styles — flat /
 * bordered / raised / glass — without a new assignment subsystem. The variant
 * lands as a `data-cv-appearance` ATTRIBUTE on the panel's dock GROUP element;
 * `dockview.css` carries one closed set of `[data-cv-appearance="…"]` rule
 * blocks whose every value reads a `--dockpanel-*` theme token, so a THEME
 * controls what each variant looks like and this preset only picks WHICH panel
 * uses WHICH variant.
 *
 * Why the DockviewApi path (not the panel-instance registry): the instance
 * registry holds DOMAIN handles (MapLibre `Map`, Cesium `Viewer`) and most
 * panels (ChartPanel, …) never register one. Reaching `group.element` through
 * the session store's bound DockviewApi works for EVERY panel type with zero
 * per-panel code, in whatever document the panel currently lives (docked or
 * popped-out), and is exactly how `session.ts` already mutates group elements
 * (`--cv-float-alpha`). The attribute is idempotent and DOM-direct: it only
 * needs the group element to exist, which it does the moment the panel mounts.
 */

/** The closed set of panel appearance variants. */
export const PANEL_APPEARANCE_VARIANTS = ["flat", "bordered", "raised", "glass"] as const;
export type PanelAppearanceVariant = (typeof PANEL_APPEARANCE_VARIANTS)[number];

export interface PanelAppearanceConfig extends Record<string, unknown> {
  variant: PanelAppearanceVariant;
}

/** Panel types this preset applies to — derived from the registered built-ins,
 *  never frozen, so it can't drift from the registered set (the registry spec
 *  asserts equality). Downstream apps that register new panels get coverage for
 *  free if they extend this list, or the preset's dialog simply won't offer it. */
export const PANEL_APPEARANCE_APPLICABLE_TO = ALL_BUILTIN_PANEL_TYPE_IDS;

const APPEARANCE_ATTR = "data-cv-appearance";

/** Resolve a panel's dock GROUP element via the session store's bound DockviewApi.
 *  Works in whatever document the panel currently lives (docked or popped-out). */
function groupElementFor(panelId: Ulid): HTMLElement | undefined {
  const api = useSessionStore().getDockviewApi();
  if (!api) return undefined;
  // dockview-vue 6: `panel.api.group.element` is the `.dv-groupview` node — the
  // same element session.ts mutates for `--cv-float-alpha`.
  return api.getPanel(panelId)?.api.group.element ?? undefined;
}

export function applyAppearance(panelId: Ulid, config: PanelAppearanceConfig): void {
  const el = groupElementFor(panelId);
  if (!el) return; // panel not mounted / group not resolvable → silent no-op
  const variant: PanelAppearanceVariant = PANEL_APPEARANCE_VARIANTS.includes(config.variant)
    ? config.variant
    : "flat";
  el.setAttribute(APPEARANCE_ATTR, variant);
}

export function removeAppearance(panelId: Ulid): void {
  groupElementFor(panelId)?.removeAttribute(APPEARANCE_ATTR);
}

export const PANEL_APPEARANCE_PRESET: PresetTypeDefinition<PanelAppearanceConfig> = {
  id: "panel-appearance",
  title: "Panel Appearance",
  description: "Set a panel's frame style — flat, bordered, raised, or glass.",
  // Lucide chrome icon (a panel frame).
  icon: "square",
  applicableTo: PANEL_APPEARANCE_APPLICABLE_TO,
  defaultConfig: { variant: "flat" },
  editComponent: () => import("@/components/presets/editors/PanelAppearancePresetEditor.vue"),
  applyToPanel: applyAppearance,
  removeFromPanel: removeAppearance,
};
