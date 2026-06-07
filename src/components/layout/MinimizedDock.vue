<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { storeToRefs } from "pinia";
import { computed } from "vue";

import Button from "@/components/ui/Button.vue";
import { vHorizontalWheel } from "@/directives/horizontalWheel";
import { useMinimizedStore } from "@/stores/minimized";

import MinimizedBar from "./MinimizedBar.vue";

/**
 * Bottom-left minimized-window tray (Track B Phase 4c/5b, master-spec D6). A
 * standalone overlay in `AppShell`'s dock area (NOT a chrome item — the status bar
 * stays the app's). `pointer-events-none` so its empty space never intercepts dock
 * clicks; the handle + bars re-enable pointer events. Renders nothing when empty.
 *
 * Phase 5b: a left-edge HANDLE (always shown while the tray has entries) toggles
 * the bars. They start COLLAPSED — just the handle + count, out of the way — and
 * EXPAND into a single horizontally-scrolling row, so any number of minimized
 * windows never climb over the dock or run off-screen. Toggle via the handle or the
 * `mod+j` shortcut (`view.toggleMinimizedTray`). `z-30`: above the dock + floats,
 * below modals (`z-50`). The list is ephemeral — `session.loadLayout` clears it.
 */
const minimized = useMinimizedStore();
const { entries, collapsed } = storeToRefs(minimized);

const plural = computed(() => (entries.value.length === 1 ? "" : "s"));
const showLabel = computed(() => `Show ${entries.value.length} minimized window${plural.value}`);
const hideLabel = computed(() => `Hide ${entries.value.length} minimized window${plural.value}`);
</script>

<template>
  <!-- `items-start`, not `items-end`: when the bars overflow, the scroll row gets a
       horizontal scrollbar BELOW the bars, which adds to its height. Bottom-aligning
       would drop the handle to the scrollbar line (lower than the bars); top-aligning
       keeps the handle level with the bar row, with the scrollbar sitting below both. -->
  <div
    v-if="entries.length > 0"
    class="pointer-events-none absolute bottom-0 left-0 z-30 flex max-w-full items-start gap-1.5 py-2 pr-2"
  >
    <!-- Handle: flush to the left edge (square left corner), always visible (solid
         `secondary` fill, not ghost), and the count is shown in BOTH states so the
         button height never changes and stays aligned with the bars. -->
    <Button
      variant="secondary"
      size="sm"
      class="pointer-events-auto h-[var(--density-control-height)] shrink-0 rounded-l-none shadow-md"
      :title="collapsed ? showLabel : hideLabel"
      :aria-label="collapsed ? showLabel : hideLabel"
      :aria-expanded="!collapsed"
      aria-controls="minimized-tray-row"
      @click="minimized.toggleCollapsed()"
    >
      <component :is="collapsed ? ChevronRight : ChevronLeft" class="size-4 shrink-0" />
      <span class="text-[length:var(--density-font-size)] tabular-nums">{{ entries.length }}</span>
    </Button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-x-3 opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="-translate-x-3 opacity-0"
    >
      <!-- `tab-scroll-bar` (main.css) is the shared 2px themed scrollbar used by the
           scrollable Tabs strip — reused here so the overflow scrollbar is a thin
           1–2px bar instead of the chunky default. -->
      <!-- `v-horizontal-wheel`: a plain vertical mouse wheel over the row scrolls it
           sideways (shared with the Tabs strip). `pb-px` insets the 2px scrollbar a
           hair from the bars so it doesn't sit flush against them. -->
      <div
        v-if="!collapsed"
        id="minimized-tray-row"
        v-horizontal-wheel
        class="tab-scroll-bar pointer-events-auto flex min-w-0 items-start gap-2 overflow-x-auto pb-px"
      >
        <MinimizedBar
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          class="shrink-0"
          @restore="minimized.restore(entry.id)"
          @discard="minimized.discard(entry.id)"
        />
      </div>
    </Transition>
  </div>
</template>
