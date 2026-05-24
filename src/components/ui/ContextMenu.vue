<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import PvContextMenu from "primevue/contextmenu";
import { ref } from "vue";

/**
 * ContextMenu — thin wrapper over PrimeVue `ContextMenu` in Unstyled mode.
 *
 * Hand-rolled exception to the Volt-default rule (ADR 0002 Option C): Volt's
 * catalog as of 2026-05-24 has no `ContextMenu` component. Tracked for
 * promotion to `@/volt/ContextMenu.vue` if Volt ships it later. See
 * `docs/decisions/0002-volt-vs-handrolled-wrappers.md` and
 * `docs/audits/primevue-firstrule-audit-2026-05-24.md`.
 *
 * Exposes `show(event)` and `hide()` from the underlying PrimeVue instance so
 * callers can drive it imperatively from a `@contextmenu` handler.
 */
interface Props {
  model: MenuItem[];
}

defineProps<Props>();

const cm = ref<InstanceType<typeof PvContextMenu> | null>(null);

function show(event: MouseEvent): void {
  cm.value?.show(event);
}

function hide(): void {
  cm.value?.hide();
}

defineExpose({ show, hide });
</script>

<template>
  <PvContextMenu
    ref="cm"
    :model="model"
    :pt="{
      root: {
        class:
          'border-border bg-surface-raised z-50 min-w-[200px] rounded-md border py-1 shadow-lg',
      },
      rootList: { class: 'flex flex-col' },
      item: { class: 'relative' },
      itemContent: { class: 'hover:bg-surface-sunken cursor-pointer transition-colors' },
      itemLink: {
        class: 'text-foreground flex items-center gap-2 px-3 py-1.5 text-xs',
      },
      itemIcon: { class: 'text-muted size-3.5' },
      submenu: {
        class:
          'border-border bg-surface-raised absolute top-0 left-full ml-0.5 min-w-[200px] rounded-md border py-1 shadow-lg',
      },
      submenuIcon: { class: 'text-muted ml-auto size-3' },
      separator: { class: 'border-border my-1 border-t' },
    }"
  />
</template>
