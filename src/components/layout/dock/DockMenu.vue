<script setup lang="ts">
import type { DockMenuItem } from "./useDockMenuModel";

import { ChevronRight } from "@lucide/vue";
import { ref } from "vue";

import ContextMenu from "@/components/ui/ContextMenu.vue";

/**
 * Presentational dock context menu (Track B Phase 6c). Wraps the project
 * `ContextMenu` with the shared `#item` template (Lucide glyph + label + submenu
 * chevron) and forwards `show(event)` / `hide()`. Extracted from
 * `DockContextMenu.vue` so the main-window menu and the per-pop-out-window menu
 * (`DockPopoutContextMenu`) render identically from one definition.
 *
 * `appendTo` is the load-bearing prop for pop-outs: PrimeVue's ContextMenu
 * defaults its overlay to the OPENER's `<body>`, so inside a pop-out document the
 * menu would teleport back to the opener's monitor. The pop-out menu passes that
 * window's `document.body` here so the overlay renders in the correct window.
 */
defineProps<{
  model: DockMenuItem[];
  /** Where PrimeVue mounts the overlay. Pop-outs pass their own `document.body`. */
  appendTo?: HTMLElement | "body" | "self";
}>();

const menuRef = ref<InstanceType<typeof ContextMenu> | null>(null);

function show(event: MouseEvent): void {
  menuRef.value?.show(event);
}

function hide(): void {
  menuRef.value?.hide();
}

defineExpose({ show, hide });
</script>

<template>
  <ContextMenu ref="menuRef" :model="model" :append-to="appendTo" data-testid="dock-context-menu">
    <template #item="{ item, props: itemProps, hasSubmenu }">
      <a
        v-bind="itemProps.action"
        :class="[
          'flex w-full items-center gap-2 text-[length:var(--density-font-size)]',
          (item as DockMenuItem).disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        ]"
      >
        <component
          :is="(item as DockMenuItem).lucide"
          v-if="(item as DockMenuItem).lucide"
          class="text-muted size-3.5"
        />
        <span class="flex-1">{{ item.label }}</span>
        <ChevronRight v-if="hasSubmenu" class="text-faint size-3.5" />
      </a>
    </template>
  </ContextMenu>
</template>
