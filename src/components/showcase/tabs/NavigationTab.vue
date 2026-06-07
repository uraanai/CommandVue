<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import { ChevronRight, Folder, Home, Map } from "@lucide/vue";
import { computed, ref } from "vue";

import ColorPicker from "@/components/ui/ColorPicker.vue";
import Menubar from "@/components/ui/Menubar.vue";
import Tabs from "@/components/ui/Tabs.vue";
import Breadcrumb from "@/volt/Breadcrumb.vue";
import Checkbox from "@/volt/Checkbox.vue";
import Fieldset from "@/volt/Fieldset.vue";
import Paginator from "@/volt/Paginator.vue";
import Step from "@/volt/Step.vue";
import StepList from "@/volt/StepList.vue";
import StepPanel from "@/volt/StepPanel.vue";
import StepPanels from "@/volt/StepPanels.vue";
import Stepper from "@/volt/Stepper.vue";

/**
 * NavigationTab — Navigation surfaces in the Component Showcase.
 *
 * Stateless playground: every section is a Volt `Fieldset` rendering the
 * project's actual `ui/*` + `volt/*` navigation wrappers, so a token change
 * recolors them in one scroll. No props (tab components take none).
 */

// --- Tabs (inline) ---------------------------------------------------------
const innerTab = ref<string>("overview");
const innerTab2 = ref<string>("overview");
const INNER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "archived", label: "Archived", disabled: true },
];

// A long tab set to demonstrate the `scrollable` variants (one row + chevron
// scroll buttons instead of wrapping to multiple lines).
const innerTab3 = ref<string>("t1");
const innerTab4 = ref<string>("t1");
const MANY_TABS = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i + 1}`,
  label: `Section ${i + 1}`,
}));

// Shared controls for the two scrollable demos: the scrollbar is hidden by
// default (chevrons / wheel / drag still scroll) and its color is selectable.
const showScrollbar = ref<boolean>(false);
const scrollbarColor = ref<string>("#94a3b8");

// --- Menubar ---------------------------------------------------------------
// Harmless File / Edit / View model — no side effects beyond a transient note.
const lastMenuAction = ref<string>("—");
function note(action: string): void {
  lastMenuAction.value = action;
}
const MENUBAR_MODEL: MenuItem[] = [
  {
    label: "File",
    items: [
      { label: "New", command: () => note("File ▸ New") },
      { label: "Open", command: () => note("File ▸ Open") },
      { separator: true },
      { label: "Save", command: () => note("File ▸ Save") },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", command: () => note("Edit ▸ Undo") },
      { label: "Redo", command: () => note("Edit ▸ Redo") },
    ],
  },
  { label: "View", command: () => note("View") },
];

// --- Breadcrumb ------------------------------------------------------------
const BREADCRUMB_HOME: MenuItem = { icon: "home", label: "Home" };
const BREADCRUMB_MODEL: MenuItem[] = [
  { label: "Operations", icon: "folder" },
  { label: "Maps", icon: "map" },
  { label: "Theater View" },
];

// --- Paginator -------------------------------------------------------------
const PAGE_ROWS = 10;
const PAGE_TOTAL = 84;
const first = ref<number>(0);
const currentPage = computed(() => Math.floor(first.value / PAGE_ROWS) + 1);
const totalPages = computed(() => Math.ceil(PAGE_TOTAL / PAGE_ROWS));

// --- Stepper (read-only) ---------------------------------------------------
const activeStep = ref<string>("1");
const STEP_TITLES: Record<string, string> = {
  "1": "Select source",
  "2": "Configure layers",
  "3": "Review",
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ================= TABS (STYLES) ================= -->
    <Fieldset legend="Tabs — underline">
      <Tabs v-model="innerTab" :tabs="INNER_TABS">
        <template #default="{ active }">
          <p class="text-muted text-sm">
            Active tab id: <span class="text-foreground font-mono">{{ active }}</span>
          </p>
        </template>
      </Tabs>
    </Fieldset>

    <Fieldset legend="Tabs — segmented (button switch)">
      <Tabs v-model="innerTab2" :tabs="INNER_TABS" variant="segmented">
        <template #default="{ active }">
          <p class="text-muted text-sm">
            Active tab id: <span class="text-foreground font-mono">{{ active }}</span>
          </p>
        </template>
      </Tabs>
    </Fieldset>

    <Fieldset legend="Tabs — scrollable (underline + segmented)">
      <p class="text-muted mb-3 text-sm">
        Too many tabs for the width → one row with left/right chevron scroll buttons (and wheel /
        drag) instead of wrapping. Add <code class="text-foreground">scrollable</code>. The
        scrollbar is <span class="text-foreground font-medium">hidden by default</span> — toggle and
        recolor it below (<code class="text-foreground">scrollbar</code> /
        <code class="text-foreground">scrollbar-color</code>).
      </p>

      <!-- Shared controls — drive the scrollbar on BOTH strips below. -->
      <div
        class="border-border bg-surface-sunken/40 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border p-3"
      >
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="showScrollbar" :binary="true" />
          <span>Show scroll bar</span>
        </label>
        <div class="flex items-center gap-2">
          <span class="text-muted text-sm">Scroll bar color</span>
          <ColorPicker v-model="scrollbarColor" :disabled="!showScrollbar" />
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-faint text-xs">underline</span>
          <Tabs
            v-model="innerTab3"
            :tabs="MANY_TABS"
            scrollable
            :scrollbar="showScrollbar"
            :scrollbar-color="scrollbarColor"
          >
            <template #default="{ active }">
              <p class="text-muted text-sm">
                Active tab id: <span class="text-foreground font-mono">{{ active }}</span>
              </p>
            </template>
          </Tabs>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-faint text-xs">segmented</span>
          <Tabs
            v-model="innerTab4"
            :tabs="MANY_TABS"
            variant="segmented"
            scrollable
            :scrollbar="showScrollbar"
            :scrollbar-color="scrollbarColor"
          >
            <template #default="{ active }">
              <p class="text-muted text-sm">
                Active tab id: <span class="text-foreground font-mono">{{ active }}</span>
              </p>
            </template>
          </Tabs>
        </div>
      </div>
    </Fieldset>

    <!-- ================= MENUBAR ================= -->
    <Fieldset legend="Menubar">
      <div class="flex flex-col gap-2">
        <Menubar :model="MENUBAR_MODEL" />
        <p class="text-faint text-sm">
          Last action: <span class="text-muted font-mono">{{ lastMenuAction }}</span>
        </p>
      </div>
    </Fieldset>

    <!-- ================= BREADCRUMB ================= -->
    <Fieldset legend="Breadcrumb">
      <Breadcrumb
        :home="BREADCRUMB_HOME"
        :model="BREADCRUMB_MODEL"
        :pt="{ root: { class: 'bg-surface-sunken text-foreground rounded-md p-2' } }"
      >
        <template #item="{ item }">
          <span class="text-muted hover:text-foreground flex items-center gap-1.5 text-sm">
            <Home v-if="item.icon === 'home'" :size="14" />
            <Folder v-else-if="item.icon === 'folder'" :size="14" />
            <Map v-else-if="item.icon === 'map'" :size="14" />
            <span>{{ item.label }}</span>
          </span>
        </template>
        <template #separator>
          <ChevronRight class="text-faint" :size="14" />
        </template>
      </Breadcrumb>
    </Fieldset>

    <!-- ================= PAGINATOR ================= -->
    <Fieldset legend="Paginator">
      <div class="flex flex-col gap-2">
        <Paginator
          v-model:first="first"
          :rows="PAGE_ROWS"
          :total-records="PAGE_TOTAL"
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        />
        <p class="text-faint text-center text-sm">
          Page
          <span class="text-foreground font-mono tabular-nums">{{ currentPage }}</span>
          of
          <span class="text-foreground font-mono tabular-nums">{{ totalPages }}</span>
          ({{ PAGE_TOTAL }} records)
        </p>
      </div>
    </Fieldset>

    <!-- ================= STEPPER (READ-ONLY) ================= -->
    <Fieldset legend="Stepper (read-only)">
      <div class="flex flex-col gap-2">
        <Stepper v-model:value="activeStep">
          <StepList>
            <Step value="1">{{ STEP_TITLES["1"] }}</Step>
            <Step value="2">{{ STEP_TITLES["2"] }}</Step>
            <Step value="3">{{ STEP_TITLES["3"] }}</Step>
          </StepList>
          <StepPanels>
            <StepPanel value="1">
              <p class="text-muted text-sm">Choose the data source for the new map layer set.</p>
            </StepPanel>
            <StepPanel value="2">
              <p class="text-muted text-sm">Pick which overlays and symbology to enable.</p>
            </StepPanel>
            <StepPanel value="3">
              <p class="text-muted text-sm">Confirm the selection before applying.</p>
            </StepPanel>
          </StepPanels>
        </Stepper>
        <p class="text-faint text-sm">
          Click any step header to navigate. Active step:
          <span class="text-foreground font-mono">{{ activeStep }}</span>
          — {{ STEP_TITLES[activeStep] }}
        </p>
      </div>
    </Fieldset>
  </div>
</template>
