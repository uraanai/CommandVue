<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

import Button from "@/components/ui/Button.vue";

/**
 * Group-scoped "Close all panels" confirmation (Track B Phase 4a).
 *
 * CUSTOM by necessity — a documented exception to the library-first rule:
 * PrimeVue's `ConfirmDialog` / `Dialog` teleport to <body> and center on the
 * whole VIEWPORT behind a full-screen mask. The maintainer wants this confirm
 * centered WITHIN the specific dock group whose Close All was clicked, scrimmed
 * over that group ONLY (not the screen, not other groups). So we `Teleport` into
 * that group's own `.dv-groupview` element and absolutely center a small card
 * there. `.dv-groupview` is `position: static`, but its parent `.dv-view` is
 * `position: absolute` with identical bounds, so `absolute inset-0` sizes exactly
 * to the group. Mask uses the project Dialog convention (`bg-brand-950/60`).
 */
const props = defineProps<{
  /** The `.dv-groupview` element to scope the confirm to (Teleport target). */
  target?: HTMLElement;
  /** Number of panels that will close (drives the message). */
  count: number;
  open: boolean;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

// Escape cancels. Capture-phase + stopPropagation so it doesn't also bubble to
// other dock/global Escape handlers while the confirm owns the interaction.
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    emit("cancel");
  }
}
watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener("keydown", onKeydown, true);
    else window.removeEventListener("keydown", onKeydown, true);
  },
);
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <Teleport v-if="open && target" :to="target">
    <div
      class="bg-brand-950/60 absolute inset-0 z-50 flex items-center justify-center p-4"
      @pointerdown.stop
      @mousedown.stop
      @click.self="emit('cancel')"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm close all panels in this group"
        class="border-border bg-surface-raised w-full max-w-[16rem] rounded-lg border p-4 shadow-xl"
      >
        <p class="text-foreground text-sm font-medium">Close all panels?</p>
        <p class="text-muted mt-1 text-xs">
          {{ count }} {{ count === 1 ? "panel" : "panels" }} in this group will close.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" @click="emit('cancel')">Cancel</Button>
          <Button variant="danger" size="sm" @click="emit('confirm')">Close all</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
