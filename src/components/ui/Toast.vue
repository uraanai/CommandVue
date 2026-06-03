<script setup lang="ts">
import type { ToastPosition } from "@/components/ui/toastTheme";

import PvToast, { type ToastPassThroughOptions } from "primevue/toast";

import { toastMessageClass } from "@/components/ui/toastTheme";
import { cn } from "@/utils/cn";

/**
 * Toast outlet. Wraps `primevue/toast`, painting each message from the
 * `--color-toast-*` theme tokens via {@link toastMessageClass} (Track A A1b).
 *
 * Not mounted directly — `NotificationOutlets.vue` (mounted once in
 * `AppShell.vue`, alongside `<ConfirmDialog/>`) renders one `<Toast>` per
 * position+group, and producers fire via the `useNotify()` composable. A single
 * bare `<Toast>` here would be ungrouped and never receive grouped `add()`
 * calls, so the outlet host is the supported entry point.
 *
 * Layering: toasts must float above modal overlays and Dockview popouts, so the
 * outlet uses PrimeVue's `autoZIndex` + `baseZIndex: 9000` (plus a `z-[9000]`
 * fallback) — well clear of the ~1100–2000 overlay band and Dockview's ~1000
 * range. The root is `pointer-events-none`; only the message re-enables clicks.
 */
withDefaults(
  defineProps<{
    position?: ToastPosition;
    group?: string;
    baseZIndex?: number;
    autoZIndex?: boolean;
  }>(),
  { position: "bottom-right", group: undefined, baseZIndex: 9000, autoZIndex: true },
);

const pt: ToastPassThroughOptions = {
  root: {
    class: cn(
      "pointer-events-none fixed z-[9000] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 p-4",
    ),
  },
  message: ({ props }) => ({ class: cn(toastMessageClass(props.message?.severity)) }),
  messageContent: { class: "flex items-start gap-2" },
  messageText: { class: "min-w-0 flex-1" },
  summary: { class: "font-medium" },
  detail: { class: "mt-0.5 text-xs opacity-80" },
  // Disable Vue's CSS-transition machinery on the message TransitionGroup. In
  // unstyled mode there's no `p-toast-message-*` CSS, and inside PrimeVue's
  // Portal the enter transition never advances past `enter-from` — so any
  // enter-from styling (e.g. opacity:0) sticks and the toast renders invisible,
  // while removal lingers waiting on a phantom transition. `css: false` makes
  // enter/leave instant and reliable (PrimeVue's JS z-index hooks still run). A
  // proper animated transition is a follow-up once the Portal interaction is
  // resolved.
  transition: { css: false },
  buttonContainer: { class: "ml-2 shrink-0" },
  closeButton: {
    class: cn(
      "inline-flex shrink-0 items-center justify-center rounded p-0.5 opacity-60 transition-opacity hover:opacity-100",
      "focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:outline-none",
    ),
  },
  closeIcon: { class: "h-3.5 w-3.5" },
};
</script>

<template>
  <PvToast
    :position="position"
    :group="group"
    :base-z-index="baseZIndex"
    :auto-z-index="autoZIndex"
    :pt="pt"
  />
</template>
