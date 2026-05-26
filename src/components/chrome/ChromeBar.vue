<script setup lang="ts">
import type { ChromeSlot } from "@/types/chrome";

import ChromeSlotView from "./ChromeSlot.vue";

interface Props {
  position: "top" | "status";
}

const props = defineProps<Props>();

// Derive the three slot keys from the bar position. The order in CHROME_SLOTS
// mirrors the left-center-right convention used by ChromeProfile.
const leftSlot: ChromeSlot = props.position === "top" ? "top-left" : "status-left";
const centerSlot: ChromeSlot = props.position === "top" ? "top-center" : "status-center";
const rightSlot: ChromeSlot = props.position === "top" ? "top-right" : "status-right";
</script>

<template>
  <!--
    `min-h` (not a fixed `h`) on the status bar: an interactive control sized
    to `--density-control-height` (e.g. the Edit toggle, ~26px compact) is
    taller than `--density-statusbar-height` (~24px). A fixed height would clip
    it and inflate the grid row, dragging every item below centre. `min-h` lets
    the bar grow to its tallest control so `items-center` truly centres. The top
    bar keeps `py-1` (it has no fixed height and already fits its controls).
  -->
  <div
    class="border-border bg-surface-raised relative grid grid-cols-3 items-center"
    :class="position === 'status' ? 'min-h-[var(--spacing-statusbar)] border-t' : 'border-b py-1'"
  >
    <ChromeSlotView :slot-name="leftSlot" align="start" />
    <ChromeSlotView :slot-name="centerSlot" align="center" />
    <ChromeSlotView :slot-name="rightSlot" align="end" />
  </div>
</template>
