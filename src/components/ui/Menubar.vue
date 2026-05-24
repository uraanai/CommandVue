<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import PvMenubar from "primevue/menubar";

/**
 * Menubar — thin wrapper over PrimeVue `Menubar` in Unstyled mode.
 *
 * Hand-rolled exception to the Volt-default rule (ADR 0002 Option C): Volt's
 * catalog as of 2026-05-24 has no `Menubar` component. Tracked for promotion
 * to `@/volt/Menubar.vue` if Volt ships it later. See
 * `docs/decisions/0002-volt-vs-handrolled-wrappers.md` and
 * `docs/audits/primevue-firstrule-audit-2026-05-24.md`.
 *
 * Surface mirrors PrimeVue's `Menubar`: pass a `model` (`MenuItem[]`) and the
 * component renders the nested menu structure. Styling targets project tokens.
 */
interface Props {
  model: MenuItem[];
}

defineProps<Props>();
</script>

<template>
  <PvMenubar
    :model="model"
    :pt="{
      root: { class: 'border-border bg-surface-raised text-foreground border-b' },
      rootList: { class: 'flex items-center gap-0.5 px-1.5 py-1' },
      item: { class: 'relative' },
      itemContent: {
        class:
          'hover:bg-surface-sunken focus-visible:ring-accent-500 cursor-pointer rounded transition-colors focus-visible:ring-2 focus-visible:outline-none',
      },
      itemLink: { class: 'text-foreground flex items-center gap-2 px-2 py-1 text-xs' },
      itemLabel: { class: 'leading-none' },
      itemIcon: { class: 'text-muted size-3.5' },
      submenu: {
        class:
          'border-border bg-surface-raised absolute z-50 mt-1 min-w-[200px] rounded-md border py-1 shadow-lg',
      },
      submenuIcon: { class: 'text-muted ml-auto size-3' },
      separator: { class: 'border-border my-1 border-t' },
    }"
  >
    <template v-if="$slots.item" #item="slotProps">
      <slot name="item" v-bind="slotProps" />
    </template>
  </PvMenubar>
</template>
