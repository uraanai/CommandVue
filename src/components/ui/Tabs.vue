<script setup lang="ts">
import PvTab from "primevue/tab";
import PvTabList from "primevue/tablist";
import PvTabPanel from "primevue/tabpanel";
import PvTabPanels from "primevue/tabpanels";
import PvTabs from "primevue/tabs";

import { cn } from "@/utils/cn";

/**
 * Tabs — thin wrapper over PrimeVue Tabs / TabList / Tab / TabPanels / TabPanel.
 * Preserves the previous flat `tabs: { id, label, disabled }[]` + v-model API.
 */
interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  modelValue: string;
  tabs: Tab[];
}

const props = defineProps<Props>();

defineEmits<{
  "update:modelValue": [value: string];
}>();

function tabClass(tab: Tab) {
  const isActive = tab.id === props.modelValue;
  return cn(
    // `-mb-px` pulls the tab's 2px bottom border onto the tablist's 1px baseline
    // so the active accent line sits exactly on the bar (and inactive tabs let
    // the baseline show through) — a proper tab-bar look.
    "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2",
    isActive
      ? "border-accent-500 text-foreground"
      : "border-transparent text-muted hover:text-foreground hover:bg-surface-raised",
    tab.disabled && "cursor-not-allowed opacity-50",
  );
}
</script>

<template>
  <PvTabs :value="modelValue" @update:value="(v) => $emit('update:modelValue', String(v))">
    <!-- The baseline underline lives on the TabList root (the `tablist` key on
         the Tabs pt does NOT reach it). `content` lays the tabs in a row; the
         native sliding active-bar is hidden in favour of the per-tab border. -->
    <PvTabList
      :pt="{
        root: { class: 'border-b border-border' },
        content: { class: 'flex items-center gap-1' },
        activeBar: { class: 'hidden' },
      }"
    >
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
