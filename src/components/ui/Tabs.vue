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
 * outgrow the available width: the row scrolls horizontally and PrimeVue shows
 * left/right chevron nav buttons (auto-hidden at the extremes) instead of
 * wrapping to multiple lines. The buttons are absolutely positioned over a
 * reserved gutter so the row never jumps when they appear/disappear. This is the
 * single reusable affordance to use anywhere a horizontal tab/segment strip can
 * overflow (the navigation, the Theme Studio, the showcase, …) — just add
 * `scrollable`.
 *
 * `scrollbar` (default false) shows a thin 2px native scrollbar under the strip;
 * by default there is none (scroll via chevrons / wheel / drag). `scrollbarColor`
 * recolors that bar's thumb (any CSS color or `var(--token)`; theme border by
 * default).
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
  /**
   * Show the native (2px) scrollbar under a `scrollable` strip. Default `false`
   * — the row scrolls via the chevrons / wheel / drag with no visible bar.
   */
  scrollbar?: boolean;
  /**
   * CSS color for the scrollbar thumb when `scrollbar` is on (any CSS color,
   * including a `var(--token)`). Defaults to the theme border.
   */
  scrollbarColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "underline",
  scrollable: false,
  scrollbar: false,
  scrollbarColor: "", // empty → theme-default thumb color
});

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
  // `border-b` baseline so the active accent line sits exactly on the bar
  // (inactive tabs let the baseline show through). Scrollable strips have no
  // real `border-b` (the baseline is a pseudo-line pinned above the scrollbar),
  // so the pull would nudge the underline 1px into the bar — skip it there.
  return cn(
    base,
    "border-b-2 px-3 py-2 focus-visible:ring-offset-2",
    !props.scrollable && "-mb-px",
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

  // Scrollable: the scroll viewport (`content`) spans the full width and the
  // chevron nav buttons are absolutely positioned over each edge. PrimeVue
  // mounts/unmounts those buttons (v-if on can-scroll-this-way), so keeping them
  // OUT of flow is what stops the row from jumping 28px when one appears — the
  // viewport width never changes. The viewport carries NO horizontal padding:
  // PrimeVue's end-detection measures `getWidth` (content-box, padding excluded)
  // against `scrollWidth` (padding included), so any padding here would leave the
  // next chevron stuck visible at the end. Instead the tabs fade out under the
  // chevrons via the `.tab-scroll-thin` mask (in main.css), matched to each
  // button with `:has()`.
  const navButton =
    "absolute inset-y-0 z-10 flex w-7 items-center justify-center cursor-pointer text-muted transition-colors hover:text-foreground";
  // When the scrollbar is shown it must sit flush UNDER the tab line, not overlap
  // it; when hidden, the tab line drops to the strip's bottom edge (no bar gutter):
  //   - underline: the baseline is a 1px PSEUDO-line. A real `border-b` can't be
  //     used — it lands under the bar, splitting the underline from the baseline.
  //     Pinned `2px` above the bottom when the bar shows, at the bottom otherwise.
  //   - segmented: drop the sunken track's BOTTOM padding so the bar hugs the
  //     track's bottom edge (no gap); keep symmetric `p-1` when there's no bar.
  // `relative` also anchors the absolute nav buttons; `min-w-0 max-w-full` lets
  // the strip fit the available width instead of its intrinsic (all-tabs) width.
  const showBar = props.scrollable && props.scrollbar;
  const base = "relative flex w-full min-w-0 max-w-full items-center";
  const scrollRoot =
    props.variant === "segmented"
      ? cn(base, "rounded-lg bg-surface-sunken", showBar ? "px-1 pt-1 pb-0" : "p-1")
      : cn(
          base,
          "after:pointer-events-none after:absolute after:inset-x-0 after:h-px after:bg-[var(--color-border)] after:content-['']",
          showBar ? "after:bottom-[2px]" : "after:bottom-0",
        );
  // `overflow-y-hidden` kills the scrollbar-induced vertical scrollbar. The
  // `tab-scroll-thin` base carries the chevron edge-fade mask; the bar/nobar
  // modifier shows or hides the 2px bar (hidden by default).
  const contentClass = cn(
    "tab-scroll-thin min-w-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth",
    showBar ? "tab-scroll-bar" : "tab-scroll-nobar",
  );
  const content =
    showBar && props.scrollbarColor
      ? { class: contentClass, style: { "--tab-scrollbar-color": props.scrollbarColor } }
      : { class: contentClass };
  return {
    root: { class: scrollRoot },
    content,
    tabList: { class: "flex items-center gap-1" },
    activeBar: { class: "hidden" },
    prevButton: { class: cn(navButton, "left-0") },
    nextButton: { class: cn(navButton, "right-0") },
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
