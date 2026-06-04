<script setup lang="ts">
import PvTab from "primevue/tab";
import PvTabList from "primevue/tablist";
import PvTabPanel from "primevue/tabpanel";
import PvTabPanels from "primevue/tabpanels";
import PvTabs from "primevue/tabs";
import { computed } from "vue";

import { cn } from "@/utils/cn";

/**
 * Tabs — thin wrapper over PrimeVue Tabs / TabList / Tab / TabPanels / TabPanel.
 * Preserves the previous flat `tabs: { id, label, disabled }[]` + v-model API.
 *
 * `variant` selects the visual style:
 *   - `underline` (default) — a baseline with the active tab's accent underline.
 *   - `segmented` — a button-group "switch": the tabs sit in a sunken track and
 *     the active one reads as a raised, selected button.
 */
interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

type TabVariant = "underline" | "segmented";

interface Props {
  modelValue: string;
  tabs: Tab[];
  variant?: TabVariant;
}

const props = withDefaults(defineProps<Props>(), { variant: "underline" });

defineEmits<{
  "update:modelValue": [value: string];
}>();

function tabClass(tab: Tab): string {
  const isActive = tab.id === props.modelValue;
  const base =
    "inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]";

  if (props.variant === "segmented") {
    return cn(
      base,
      "rounded-md px-3 py-1.5",
      isActive
        ? "bg-accent-600 text-white shadow-sm"
        : "text-muted hover:text-foreground hover:bg-surface",
      tab.disabled && "cursor-not-allowed opacity-50",
    );
  }

  // underline — `-mb-px` pulls the tab's 2px bottom border onto the tablist's
  // baseline so the active accent line sits exactly on the bar (inactive tabs
  // let the baseline show through).
  return cn(
    base,
    "-mb-px border-b-2 px-3 py-2 focus-visible:ring-offset-2",
    isActive
      ? "border-accent-500 text-foreground"
      : "border-transparent text-muted hover:text-foreground hover:bg-surface-raised",
    tab.disabled && "cursor-not-allowed opacity-50",
  );
}

// The active-bar is hidden in both variants (the per-tab styling is the
// indicator). The `tablist` key on the Tabs pt does NOT reach the TabList, so
// the row styling lives on `<PvTabList>` directly.
const tabListPt = computed(() =>
  props.variant === "segmented"
    ? {
        root: { class: "inline-flex rounded-lg bg-surface-sunken p-1" },
        content: { class: "flex items-center gap-1" },
        activeBar: { class: "hidden" },
      }
    : {
        root: { class: "border-b border-border" },
        content: { class: "flex items-center gap-1" },
        activeBar: { class: "hidden" },
      },
);
</script>

<template>
  <PvTabs :value="modelValue" @update:value="(v) => $emit('update:modelValue', String(v))">
    <PvTabList :pt="tabListPt">
      <PvTab
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
        :disabled="tab.disabled"
        :pt="{ root: { class: tabClass(tab) } }"
      >
        <slot :name="`tab-${tab.id}`" :tab="tab">
          {{ tab.label }}
        </slot>
      </PvTab>
    </PvTabList>
    <PvTabPanels :pt="{ root: { class: 'pt-3' } }">
      <PvTabPanel v-for="tab in tabs" :key="tab.id" :value="tab.id">
        <slot v-if="tab.id === modelValue" :active="tab.id" />
      </PvTabPanel>
    </PvTabPanels>
  </PvTabs>
</template>
