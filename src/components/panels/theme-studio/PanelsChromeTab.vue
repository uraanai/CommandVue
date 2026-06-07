<script setup lang="ts">
import type { ThemeAuthoring } from "@/composables/useThemeAuthoring";
import type { PanelAppearanceVariant } from "@/modules/presets/panelAppearance";
import type { Preset } from "@/types/preset";

import { computed, ref } from "vue";

import TokenRow from "@/components/panels/theme-studio/TokenRow.vue";
import Button from "@/components/ui/Button.vue";
import Select from "@/components/ui/Select.vue";
import { useNotify } from "@/composables/useNotify";
import { panelRegistry } from "@/modules/panels/registry";
import { PANEL_APPEARANCE_VARIANTS } from "@/modules/presets/panelAppearance";
import { TOKEN_MANIFEST_LIST } from "@/modules/themes/tokenManifest";
import { usePanelStateStore } from "@/stores/panelState";
import { usePresetStore } from "@/stores/preset";
import { useSessionStore } from "@/stores/session";

/**
 * PanelsChromeTab — the "Panels & Chrome" Studio-tab body (Track A C4).
 *
 * Two regions:
 *  (a) Chrome token editors — the `component-dockpanel` ("Dock panel") manifest
 *      section rendered as the SAME `TokenRow` controls the Tokens tab uses, so
 *      editing the dock frame here feels identical to editing any token. Each row
 *      writes through the C6 override seam (`a.setOverride` / `a.clearOverride`);
 *      the panel's existing `watch(a.overrides)` re-pushes the merged preview.
 *  (b) Per-panel appearance assignment — pick an open panel + a variant
 *      (flat/bordered/raised/glass) and Apply. Apply find-or-creates ONE reusable
 *      GLOBAL `panel-appearance` preset per variant, then applies it via the
 *      preset store (which writes panel-state AND sets `data-cv-appearance`).
 */
const props = defineProps<{
  authoring: ThemeAuthoring;
  /**
   * Resolved current value for every manifest token — the panel's shared
   * getComputedStyle(APP_ROOT) snapshot. The panel refreshes it AFTER each live
   * push, so a per-token reset shows the reverted value rather than the stale
   * pre-reset one (the previous own-snapshot read the root before the debounced
   * push had applied, so a reverted color kept showing the old value).
   */
  resolved: Record<string, string>;
}>();
const a = props.authoring;

const notify = useNotify();
const presetStore = usePresetStore();
const panelStateStore = usePanelStateStore();
const session = useSessionStore();

// --- Region (a): chrome token editors --------------------------------------
// Two sub-groups so dock windows and float windows are themed separately:
//  - "Dock windows" = the component-dockpanel section (5 legacy + 7 C4 tokens).
//  - "Float windows" = the component-floatpanel geometry/depth tokens (each
//    defaults to its --dockpanel-* counterpart, so floats match docked chrome
//    until customized).
// Static. Resolved values come from the shared `resolved` prop (refreshed after
// the push), so a per-token reset reverts the control too.
const CHROME_GROUPS = [
  { label: "Dock windows", section: "component-dockpanel" },
  { label: "Float windows", section: "component-floatpanel" },
].map((g) => ({ ...g, entries: TOKEN_MANIFEST_LIST.filter((e) => e.section === g.section) }));

// --- Region (b): per-panel appearance assignment ---------------------------
const VARIANT_OPTIONS = PANEL_APPEARANCE_VARIANTS.map((v) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}));

const selectedPanelId = ref<null | string>(null);
const selectedVariant = ref<PanelAppearanceVariant>("bordered");

/** Assigned (non-empty) panels in the current layout, labeled by live title.
 *  Reactive over the panel-state map, so it tracks assigns/removes. */
const panelOptions = computed(() => {
  const api = session.getDockviewApi();
  return panelStateStore
    .listForLayout()
    .filter((ps) => ps.assignmentState !== "empty" && ps.panelType)
    .map((ps) => ({
      value: ps.id,
      label:
        api?.getPanel(ps.id)?.title ??
        (ps.panelType ? (panelRegistry.get(ps.panelType)?.title ?? ps.panelType) : ps.id),
    }));
});

/** Current panel → variant assignments (the applied `panel-appearance` presets). */
const assignments = computed(() => {
  const api = session.getDockviewApi();
  const out: { panelId: string; panelLabel: string; presetId: string; variant: string }[] = [];
  for (const ps of panelStateStore.listForLayout()) {
    for (const presetId of ps.appliedPresetIds ?? []) {
      const preset = presetStore.getPreset(presetId);
      if (preset?.presetTypeId !== "panel-appearance") continue;
      out.push({
        panelId: ps.id,
        panelLabel:
          api?.getPanel(ps.id)?.title ??
          (ps.panelType ? (panelRegistry.get(ps.panelType)?.title ?? ps.panelType) : ps.id),
        presetId,
        variant: String(preset.config.variant ?? "flat"),
      });
    }
  }
  return out;
});

async function findOrCreatePreset(variant: PanelAppearanceVariant): Promise<Preset> {
  const existing = presetStore.presets.find(
    (p) =>
      p.presetTypeId === "panel-appearance" &&
      p.workspaceId === null &&
      p.config.variant === variant,
  );
  if (existing) return existing;
  return presetStore.createPreset({
    presetTypeId: "panel-appearance",
    workspaceId: null,
    name: `Panel: ${variant.charAt(0).toUpperCase() + variant.slice(1)}`,
    config: { variant },
  });
}

async function onApply(): Promise<void> {
  const panelId = selectedPanelId.value;
  if (!panelId) return;
  try {
    const preset = await findOrCreatePreset(selectedVariant.value);
    await presetStore.applyToPanel(panelId, preset.id);
    notify.success("Appearance applied", {
      detail: `“${selectedVariant.value}” applied to the panel’s group.`,
    });
  } catch (error) {
    notify.danger("Couldn’t apply appearance", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function onRemove(panelId: string, presetId: string): Promise<void> {
  try {
    await presetStore.removeFromPanel(panelId, presetId);
  } catch (error) {
    notify.danger("Couldn’t remove appearance", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto px-3 pt-1 pb-3 text-sm">
    <!-- Region (b): per-panel appearance assignment -->
    <section class="flex flex-col gap-2">
      <h3 class="text-faint text-[10px] font-semibold tracking-wider uppercase">
        Panel appearance
      </h3>
      <p class="text-faint text-[11px]">
        Give a panel a frame style. The variant applies to the panel’s dock group, so tabbed
        siblings share it.
      </p>

      <div v-if="panelOptions.length === 0" class="text-muted py-2 text-xs">
        Open a panel to assign an appearance.
      </div>

      <template v-else>
        <div class="flex flex-wrap items-end gap-2">
          <label class="flex min-w-[10rem] flex-1 flex-col gap-1">
            <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Panel</span>
            <Select
              v-model="selectedPanelId"
              :options="panelOptions"
              placeholder="Choose a panel…"
            />
          </label>
          <label class="flex w-32 flex-col gap-1">
            <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Variant</span>
            <Select
              :model-value="selectedVariant"
              :options="VARIANT_OPTIONS"
              @update:model-value="
                (v) => {
                  if (v != null) selectedVariant = v as PanelAppearanceVariant;
                }
              "
            />
          </label>
          <Button size="sm" variant="primary" :disabled="!selectedPanelId" @click="onApply">
            Apply
          </Button>
        </div>

        <p v-if="selectedVariant === 'glass'" class="text-faint text-[11px]">
          Glass uses a GPU backdrop blur where supported. Over a live map it can cost frames, and it
          does not blur a WebGL canvas inside the same panel. Use sparingly.
        </p>

        <ul v-if="assignments.length > 0" class="flex flex-col gap-1">
          <li
            v-for="asn in assignments"
            :key="asn.panelId + ':' + asn.presetId"
            class="border-border-subtle flex items-center justify-between gap-2 rounded-md border px-2 py-1"
          >
            <span class="min-w-0 truncate">
              <span class="text-foreground">{{ asn.panelLabel }}</span>
              <span class="text-faint"> · {{ asn.variant }}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              class="shrink-0"
              @click="onRemove(asn.panelId, asn.presetId)"
            >
              Remove
            </Button>
          </li>
        </ul>
      </template>
    </section>

    <!-- Region (a): chrome token editors — dock windows vs float windows -->
    <section class="flex flex-col gap-3">
      <p class="text-faint text-[11px]">
        Geometry, depth, and tab styling of the panel frame, feeding the four appearance variants
        above. Float windows take their geometry + depth from a separate set (defaulting to the dock
        values) so they can read differently while hovering over the map.
      </p>
      <div v-for="group in CHROME_GROUPS" :key="group.section" class="flex flex-col">
        <h3 class="text-faint px-0 pt-1 pb-1 text-[10px] font-semibold tracking-wider uppercase">
          {{ group.label }}
        </h3>
        <div class="border-border-subtle rounded-md border">
          <TokenRow
            v-for="entry in group.entries"
            :key="entry.name"
            :entry="entry"
            :resolved-value="resolved[entry.name] ?? ''"
            :resolved-contrast-bg="
              entry.contrastAgainst ? resolved[entry.contrastAgainst] : undefined
            "
            :edited="entry.name in a.overrides.value"
            @set="(t: string, v: string) => a.setOverride(t, v)"
            @reset="(t: string) => a.clearOverride(t)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
