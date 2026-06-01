import type { FloatBox } from "@/modules/panels/float";
import type { PanelType, Ulid } from "@/types/workspace";

import { defineStore } from "pinia";
import { ref } from "vue";

import { useSessionStore } from "./session";

/** One captured panel within a minimized group — a serializable snapshot. */
export interface CapturedPanel {
  id: Ulid;
  panelType: PanelType | null;
  title: string;
  /** `structuredClone` of the panel's `PanelState.state` at minimize time — read
   *  on restore for `headerless` / `floatAlpha`. (Everything else round-trips off
   *  the SURVIVING `PanelState` record, keyed by panel id, not this snapshot.) */
  state: Record<string, unknown>;
}

/**
 * One minimized dock GROUP, rendered as a bar in the bottom-left tray. Held
 * in-memory only (never persisted). All fields are plain serializable data —
 * no dockview / Cesium objects — per CLAUDE.md state rule 4.
 */
export interface MinimizedEntry {
  /** Fresh, stable handle — dockview group ids are unstable across removal. */
  id: string;
  location: "grid" | "floating";
  /** Floating groups only: the overlay box to re-float at on restore. */
  floatBox?: FloatBox;
  /** Best-effort re-dock anchor (a surviving panel + side). A single minimized
   *  TAB uses `direction: "within"` to re-join its sibling's group on restore —
   *  wherever that group then lives (grid or float). */
  originAnchor: {
    referencePanelId?: Ulid;
    direction: "left" | "right" | "above" | "below" | "within";
  };
  /** Every panel captured for this entry, in tab order. A whole-group minimize
   *  holds all the group's tabs; a single-tab minimize holds exactly one. */
  panels: CapturedPanel[];
  activePanelId: Ulid;
  /** Active panel's title — the bar label. (The bar uses a fixed glyph, not a
   *  per-type icon — the app has no Lucide-name → component resolver.) */
  title: string;
}

/**
 * Minimize-to-tray store (Track B Phase 4c). Holds the IN-MEMORY list of
 * minimized dock groups the bottom-left tray renders.
 *
 * EPHEMERAL by decision (master-spec D6): never persisted; `clear()` is called
 * from `session.loadLayout`, so a reload / layout switch / workspace switch
 * empties the tray and the (un-saved) groups come back docked from the layout.
 *
 * Per CLAUDE.md state rule 4 (stores hold serializable state only), this store
 * holds just the serializable `MinimizedEntry[]`; the dockview work — removing a
 * group on minimize, re-adding it on restore — lives in `session` actions, which
 * own the live `DockviewApi`. The two stores reference each other lazily inside
 * actions (a supported Pinia pattern), never at module load.
 */
export const useMinimizedStore = defineStore("minimized", () => {
  const entries = ref<MinimizedEntry[]>([]);

  /** Minimize the whole group containing `panelId` into the tray (all its tabs). */
  function minimizeGroup(panelId: Ulid): void {
    const entry = useSessionStore().minimizeGroup(panelId);
    if (entry) entries.value.push(entry);
  }

  /** Minimize only the single panel `panelId` (one tab) into the tray; the rest of
   *  its group stays docked. Falls back to a whole-group minimize when the panel is
   *  its group's sole member. */
  function minimizePanel(panelId: Ulid): void {
    const entry = useSessionStore().minimizePanel(panelId);
    if (entry) entries.value.push(entry);
  }

  /** Restore a minimized group back into the dock and drop its bar. */
  function restore(entryId: string): void {
    const entry = entries.value.find((e) => e.id === entryId);
    if (!entry) return;
    if (useSessionStore().restoreMinimized(entry)) {
      entries.value = entries.value.filter((e) => e.id !== entryId);
    }
  }

  /**
   * Discard a minimized group without restoring it — drop the bar; the panels
   * were already removed from the dock at minimize time. (v1: their `PanelState`
   * records persist and are reclaimed only by the layout/workspace delete cascade.)
   */
  function discard(entryId: string): void {
    entries.value = entries.value.filter((e) => e.id !== entryId);
  }

  /** Empty the tray (called from `session.loadLayout` — ephemeral v1). */
  function clear(): void {
    entries.value = [];
  }

  return { entries, minimizeGroup, minimizePanel, restore, discard, clear };
});
