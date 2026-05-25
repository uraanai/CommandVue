<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import PvMenubar from "primevue/menubar";
import { twMerge } from "tailwind-merge";
import { computed } from "vue";

/**
 * Menubar — thin wrapper over PrimeVue `Menubar` in Unstyled mode.
 *
 * Hand-rolled exception to the Volt-default rule (ADR 0002 Option C): Volt's
 * catalog as of 2026-05-24 has no `Menubar` component. Tracked for promotion
 * to `@/volt/Menubar.vue` if Volt ships it later.
 *
 * Surface mirrors PrimeVue's `Menubar`: pass a `model` (`MenuItem[]`) and the
 * component renders the nested menu structure. The wrapper ships the
 * project's default styling and the structural fixes for nested-submenu
 * positioning, mobile-toggle hiding, and list-reset behavior. Consumers can
 * override per-slot classes via the `pt` prop (Tailwind classes are
 * twMerge'd; other PT keys spread after wrapper defaults).
 *
 * Item rendering: the `#item` slot is forwarded to the underlying Menubar so
 * consumers can fully customize each row (icons, shortcuts, chevrons, etc.).
 */
interface PtSlot {
  class?: string;
  [key: string]: unknown;
}

interface Props {
  model: MenuItem[];
  pt?: Record<string, PtSlot>;
}

const props = defineProps<Props>();

const baseTheme: Record<string, PtSlot> = {
  root: { class: "border-border bg-surface-raised text-foreground border-b" },
  rootList: { class: "flex list-none items-center gap-0.5 p-0 px-1.5 py-1" },
  item: { class: "relative" },
  itemContent: {
    class:
      "hover:bg-surface-sunken focus-visible:ring-accent-500 rounded transition-colors focus-visible:ring-2 focus-visible:outline-none",
  },
  itemLink: {
    class:
      "text-foreground flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-xs no-underline",
  },
  itemLabel: { class: "leading-none" },
  itemIcon: { class: "text-muted size-3.5" },
  submenu: {
    class:
      "border-border bg-surface-raised absolute top-full left-0 z-50 m-0 mt-1 flex min-w-[200px] list-none flex-col rounded-md border p-0 py-1 shadow-lg",
  },
  submenuIcon: { class: "text-muted ml-auto size-3" },
  separator: { class: "border-border my-1 border-t" },
  // PrimeVue Menubar ships a built-in mobile-toggle (hamburger). CommandVue is
  // desktop-first; hide it so the bar starts cleanly at the first menu item.
  button: { class: "hidden" },
};

/**
 * Merge consumer PT with wrapper defaults. Tailwind class strings are merged
 * via `twMerge` (consumer wins on conflicts); other keys are spread shallow.
 */
const mergedPt = computed(() => {
  const consumer = props.pt ?? {};
  const out: Record<string, PtSlot> = {};
  const keys = new Set([...Object.keys(baseTheme), ...Object.keys(consumer)]);
  for (const key of keys) {
    const base = baseTheme[key] ?? {};
    const over = consumer[key] ?? {};
    out[key] = {
      ...base,
      ...over,
      class: twMerge(base.class, over.class),
    };
  }
  return out;
});
</script>

<template>
  <PvMenubar :model="model" unstyled :pt="mergedPt">
    <template v-if="$slots.item" #item="slotProps">
      <slot name="item" v-bind="slotProps" />
    </template>
  </PvMenubar>
</template>
