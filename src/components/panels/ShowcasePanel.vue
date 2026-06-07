<script setup lang="ts">
import type { ShowcaseTab } from "@/components/showcase/registry";
import type { PanelApiProps } from "@/composables/usePanelApi";
import type { Component } from "vue";

import { ref } from "vue";

import { SHOWCASE_TABS } from "@/components/showcase/registry";
import ButtonsTab from "@/components/showcase/tabs/ButtonsTab.vue";
import DataDisplayTab from "@/components/showcase/tabs/DataDisplayTab.vue";
import FeedbackStatusTab from "@/components/showcase/tabs/FeedbackStatusTab.vue";
import FormInputsTab from "@/components/showcase/tabs/FormInputsTab.vue";
import FormsTab from "@/components/showcase/tabs/FormsTab.vue";
import NavigationTab from "@/components/showcase/tabs/NavigationTab.vue";
import NotificationsTab from "@/components/showcase/tabs/NotificationsTab.vue";
import OverlaysTab from "@/components/showcase/tabs/OverlaysTab.vue";
import PanelsLayoutTab from "@/components/showcase/tabs/PanelsLayoutTab.vue";
import SelectionTab from "@/components/showcase/tabs/SelectionTab.vue";
import Tabs from "@/components/ui/Tabs.vue";

/**
 * ShowcasePanel — a live gallery of every UI primitive (Track A — A-Showcase).
 * Doubles as living documentation and a theming smoke test: because it renders
 * the project's ACTUAL `ui/*` + `volt/*` wrappers, a token change (A1a/A1b/A1c)
 * recolors the whole panel in one scroll. Coverage is enforced by
 * `src/components/showcase/registry.ts` + its drift test.
 *
 * This shell stays thin: it owns the tab bar (sourced from `SHOWCASE_TABS`) and
 * delegates every demo section to a self-contained per-tab component under
 * `src/components/showcase/tabs/`. Only the active tab mounts, so overlays and
 * service-driven demos (confirm, toast) come alive lazily.
 *
 * Stateless playground — no serialize/restore; just local demo refs per tab.
 */
defineProps<PanelApiProps>();

const TABS = SHOWCASE_TABS.map((t) => ({ id: t.id, label: t.label }));
const activeTab = ref<string>("form-inputs");

const TAB_COMPONENTS: Record<ShowcaseTab, Component> = {
  "form-inputs": FormInputsTab,
  selection: SelectionTab,
  forms: FormsTab,
  buttons: ButtonsTab,
  "data-display": DataDisplayTab,
  "feedback-status": FeedbackStatusTab,
  overlays: OverlaysTab,
  "panels-layout": PanelsLayoutTab,
  navigation: NavigationTab,
  notifications: NotificationsTab,
};
</script>

<template>
  <div class="bg-surface text-foreground flex h-full w-full flex-col overflow-hidden">
    <header class="border-border flex items-center gap-2 border-b px-4 py-2">
      <span class="text-foreground text-sm font-semibold">Component Showcase</span>
      <span class="text-faint text-xs">— live gallery + theming smoke test</span>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <Tabs v-model="activeTab" :tabs="TABS">
        <template #default="{ active }">
          <component :is="TAB_COMPONENTS[active as ShowcaseTab]" />
        </template>
      </Tabs>
    </div>
  </div>
</template>
