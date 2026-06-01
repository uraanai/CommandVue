<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import { popModalCapture, pushModalCapture } from "@/modules/shortcuts/modalGate";

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
 *
 * It is deliberately NOT a full modal: the rest of the app (other groups, chrome)
 * stays interactive, so this is `role="alertdialog"` WITHOUT `aria-modal` (which
 * would falsely claim everything else is inert). For keyboard users it still
 * moves focus into the card on open and restores it on close, and Escape /
 * backdrop-click / Cancel all dismiss. While open it `pushModalCapture()` so the
 * global keyboard-shortcut binder skips Escape (otherwise Escape would also fire
 * `tool.deactivate`) — see `modules/shortcuts/modalGate`.
 */
const props = defineProps<{
  /** The `.dv-groupview` element to scope the confirm to (Teleport target). */
  target?: HTMLElement;
  /** Number of panels that will actually close (guard-aware; drives the message). */
  count: number;
  open: boolean;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const cardRef = ref<HTMLElement>();
let previouslyFocused: HTMLElement | null = null;
let captured = false; // whether the modal-capture gate is currently pushed

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("cancel");
}

function teardown() {
  window.removeEventListener("keydown", onKeydown, true);
  if (captured) {
    popModalCapture();
    captured = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      pushModalCapture();
      captured = true;
      window.addEventListener("keydown", onKeydown, true);
      // Move focus into the dialog so keyboard users land on the confirm.
      void nextTick(() => cardRef.value?.focus());
    } else {
      teardown();
      // Restore focus to the trigger if it still exists (on confirm the whole
      // group — and its trigger button — may have been removed).
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      previouslyFocused = null;
    }
  },
);

onBeforeUnmount(teardown);
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
        ref="cardRef"
        role="alertdialog"
        tabindex="-1"
        aria-label="Confirm close all panels in this group"
        class="border-border bg-surface-raised w-full max-w-[16rem] rounded-lg border p-4 shadow-xl outline-none"
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
