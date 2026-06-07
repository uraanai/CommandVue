<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import PvContextMenu from "primevue/contextmenu";
import { twMerge } from "tailwind-merge";
import { computed, ref } from "vue";

import { useOverlayTarget } from "@/composables/useOverlayTarget";

/**
 * ContextMenu — thin wrapper over PrimeVue `ContextMenu` in Unstyled mode.
 *
 * Hand-rolled exception to the Volt-default rule (ADR 0002 Option C): Volt's
 * catalog as of 2026-05-24 has no `ContextMenu` component. Tracked for
 * promotion to `@/volt/ContextMenu.vue` if Volt ships it later.
 *
 * Exposes `show(event)` and `hide()` from the underlying PrimeVue instance so
 * callers can drive it imperatively from a `@contextmenu` handler. Consumers
 * can supply an `#item` slot template to fully customize each row (shortcuts,
 * chevrons, custom icons) — same pattern as the project Menubar wrapper.
 *
 * The `pt` prop merges into the wrapper's defaults via `twMerge` on class
 * strings, so consumers can override per-slot styling without losing the
 * structural shell.
 */
interface PtSlot {
  class?: string;
  [key: string]: unknown;
}

interface Props {
  model: MenuItem[];
  pt?: Record<string, PtSlot>;
  /**
   * Where PrimeVue mounts the overlay. When omitted, the wrapper defaults to the
   * OWNING window's `document.body` (resolved at open time from the trigger
   * event), so a right-click inside a dockview pop-out window renders the menu in
   * that window rather than teleporting it to the opener's monitor (Track B).
   * Pass an explicit value to override — it always takes precedence.
   */
  appendTo?: HTMLElement | "body" | "self";
}

const props = defineProps<Props>();

const cm = ref<InstanceType<typeof PvContextMenu> | null>(null);

// Window-aware default mount target. `useOverlayTarget` reads its anchor's
// `ownerDocument.body` at open time; we feed it the trigger event's target (the
// element the user right-clicked) since that element is guaranteed to live in
// the correct window — including a dockview pop-out. An explicit `appendTo`
// prop always wins over this default.
const triggerEl = ref<HTMLElement | null>(null);
const { target: ownerBody, resolve: resolveOwnerBody } = useOverlayTarget(triggerEl);

const effectiveAppendTo = computed<HTMLElement | "body" | "self">(
  () => props.appendTo ?? ownerBody.value,
);

function show(event: MouseEvent): void {
  // Capture the right-clicked element and resolve its owning-window body BEFORE
  // delegating — PrimeVue mounts the overlay Portal synchronously on show(), so
  // `effectiveAppendTo` must already point at the correct window's body.
  if (event.target instanceof HTMLElement) {
    triggerEl.value = event.target;
    resolveOwnerBody();
  }
  cm.value?.show(event);
}

function hide(): void {
  cm.value?.hide();
}

defineExpose({ show, hide });

const baseTheme: Record<string, PtSlot> = {
  root: {
    class:
      "border-border bg-surface-raised z-50 min-w-[220px] rounded-md border py-1 shadow-xl outline-none",
  },
  rootList: { class: "flex flex-col outline-none" },
  item: { class: "relative" },
  itemContent: { class: "hover:bg-surface-sunken cursor-pointer transition-colors" },
  itemLink: {
    // Density-driven padding + font-size so right-click menus rescale with
    // `data-density` on `<html>`.
    class:
      "text-foreground flex items-center gap-2 px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-[length:var(--density-font-size)]",
  },
  itemIcon: { class: "text-muted size-3.5" },
  submenu: {
    class:
      "border-border bg-surface-raised z-50 min-w-[220px] rounded-md border py-1 shadow-xl outline-none",
  },
  submenuIcon: { class: "text-muted ml-auto size-3" },
  separator: { class: "border-border my-1 border-t" },
};

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
  <PvContextMenu ref="cm" :model="model" unstyled :pt="mergedPt" :append-to="effectiveAppendTo">
    <template v-if="$slots.item" #item="slotProps">
      <slot name="item" v-bind="slotProps" />
    </template>
  </PvContextMenu>
</template>
