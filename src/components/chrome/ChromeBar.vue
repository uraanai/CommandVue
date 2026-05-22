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
  <div
    class="border-border bg-surface-raised relative grid grid-cols-3 items-center border-b py-1"
    :class="position === 'status' ? 'h-[var(--spacing-statusbar)] border-t border-b-0' : ''"
  >
    <ChromeSlotView :slot-name="leftSlot" align="start" />
    <ChromeSlotView :slot-name="centerSlot" align="center" />
    <ChromeSlotView :slot-name="rightSlot" align="end" />
  </div>
</template>
