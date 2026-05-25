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
    unstyled
    :pt="{
      root: { class: 'border-border bg-surface-raised text-foreground border-b' },
      rootList: { class: 'flex list-none items-center gap-0.5 p-0 px-1.5 py-1' },
      item: { class: 'relative' },
      itemContent: {
        class:
          'hover:bg-surface-sunken focus-visible:ring-accent-500 rounded transition-colors focus-visible:ring-2 focus-visible:outline-none',
      },
      itemLink: {
        class:
          'text-foreground flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-xs no-underline',
      },
      itemLabel: { class: 'leading-none' },
      itemIcon: { class: 'text-muted size-3.5' },
      submenu: {
        class:
          'border-border bg-surface-raised absolute top-full left-0 z-50 m-0 mt-1 flex min-w-[200px] list-none flex-col rounded-md border p-0 py-1 shadow-lg',
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
