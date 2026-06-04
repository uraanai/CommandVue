<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue";
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
 *
 * `scrollable` (default false) keeps the strip on **one line** when the tabs
 * outgrow the available width: the row scrolls horizontally and PrimeVue renders
 * left/right chevron nav buttons (auto-disabled at the extremes) instead of
 * wrapping to multiple lines. The user can click the chevrons, drag the
 * scrollbar, or wheel-scroll. This is the single reusable affordance to use
 * anywhere a horizontal tab/segment strip can overflow (the navigation, the
 * Theme Studio, the showcase, …) — just add `scrollable`.
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
  /** One-line horizontal scroll + chevron nav buttons instead of wrapping. */
  scrollable?: boolean;
}

const props = withDefaults(defineProps<Props>(), { variant: "underline", scrollable: false });

defineEmits<{
  "update:modelValue": [value: string];
}>();

function tabClass(tab: Tab): string {
  const isActive = tab.id === props.modelValue;
  const base = cn(
    "inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]",
    // Scrollable strips keep each tab at its natural width so the row can scroll;
    // non-scrollable strips are unchanged from before.
    props.scrollable && "shrink-0 whitespace-nowrap",
  );

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
const tabListPt = computed(() => {
  const rootBase =
    props.variant === "segmented"
      ? "inline-flex rounded-lg bg-surface-sunken p-1"
      : "border-b border-border";

  // Non-scrollable: the original behavior, unchanged.
  if (!props.scrollable) {
    return {
      root: { class: rootBase },
      content: { class: "flex items-center gap-1" },
      activeBar: { class: "hidden" },
    };
  }

  // Scrollable: lay out as [prev] [scroll viewport] [next] on one line. The
  // chevron nav buttons are rendered by PrimeVue only while the row overflows,
  // and it toggles their `disabled` attr at the scroll extremes. `content` is
  // the scroll viewport; `tabList` is the actual (no-wrap) flex row of tabs.
  const navButton =
    "flex shrink-0 items-center justify-center self-stretch w-7 cursor-pointer text-muted transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-30";
  return {
    root: { class: cn(rootBase, "flex w-full items-center") },
    content: { class: "min-w-0 flex-1 overflow-x-auto scroll-smooth [scrollbar-width:thin]" },
    tabList: { class: "flex items-center gap-1" },
    activeBar: { class: "hidden" },
    prevButton: { class: navButton },
    nextButton: { class: navButton },
  };
});
</script>

<template>
  <PvTabs
    :value="modelValue"
    :scrollable="scrollable"
    @update:value="(v) => $emit('update:modelValue', String(v))"
  >
    <template #previcon><ChevronLeft :size="16" /></template>
    <template #nexticon><ChevronRight :size="16" /></template>
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
