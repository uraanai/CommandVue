<script setup lang="ts">
import PvToast, { type ToastPassThroughOptions } from "primevue/toast";

import { toastMessageClass } from "@/components/ui/toastTheme";
import { cn } from "@/utils/cn";

/**
 * Toast root component. Renders the PrimeVue toast outlet with Tailwind
 * styling via passthrough. Drop a single `<Toast />` in `App.vue` and use the
 * PrimeVue `useToast()` composable in any component to push notifications.
 * `app.use(ToastService)` registration is added when the first notification
 * surface (StatusBar / CommandPalette) needs it.
 *
 * Theming (Track A A1b): every message paints from the `--color-toast-*`
 * theme tokens via {@link toastMessageClass}, switching on the message
 * severity. The `message` passthrough is a function so each toast resolves its
 * own severity (`props.message.severity`); summary/detail inherit the message
 * color so a severity tint flows through without per-element overrides.
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

const pt: ToastPassThroughOptions = {
  root: { class: cn("fixed z-50 flex flex-col gap-2 p-4 w-[360px] max-w-[calc(100vw-2rem)]") },
  message: ({ props }) => ({ class: cn(toastMessageClass(props.message?.severity)) }),
  messageContent: { class: "flex items-start gap-2" },
  messageText: { class: "flex-1 min-w-0" },
  summary: { class: "font-medium" },
  detail: { class: "text-xs opacity-80 mt-0.5" },
};
</script>

<template>
  <PvToast :position="position ?? 'bottom-right'" :pt="pt" />
</template>
