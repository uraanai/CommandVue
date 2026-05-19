<script setup lang="ts">
import PvToast from "primevue/toast";

import { cn } from "@/utils/cn";

/**
 * Toast root component. Renders the PrimeVue toast outlet with Tailwind
 * styling via passthrough. Drop a single `<Toast />` in `App.vue` and use the
 * PrimeVue `useToast()` composable in any component to push notifications.
 * `app.use(ToastService)` registration is added in Phase 4 when the first
 * notification surface (StatusBar / CommandPalette) needs it.
 */
defineProps<{
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center"
    | "center";
}>();
</script>

<template>
  <PvToast
    :position="position ?? 'bottom-right'"
    :pt="{
      root: { class: cn('fixed z-50 flex flex-col gap-2 p-4 w-[360px] max-w-[calc(100vw-2rem)]') },
      message: {
        class: cn(
          'rounded-md border border-border bg-surface-raised shadow-lg px-3 py-2 text-sm text-foreground',
        ),
      },
      messageContent: { class: 'flex items-start gap-2' },
      messageText: { class: 'flex-1 min-w-0' },
      summary: { class: 'font-medium text-foreground' },
      detail: { class: 'text-muted text-xs mt-0.5' },
    }"
  />
</template>
