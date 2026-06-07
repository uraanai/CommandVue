<script setup lang="ts">
import type { ToastPosition } from "@/components/ui/toastTheme";

import Toast from "@/components/ui/Toast.vue";
import { handleMessageClosed, installNotify, POSITION_TO_GROUP } from "@/composables/useNotify";

/**
 * Host for the toast outlets. Mounted ONCE in `AppShell.vue` (alongside
 * `<ConfirmDialog/>`). Renders exactly one `<Toast>` per canonical position —
 * the full key set of `POSITION_TO_GROUP` — each bound to its stable group id,
 * so `useNotify` can route to any of the seven positions and never fire into a
 * group that has no mounted outlet (which PrimeVue would silently drop).
 *
 * `installNotify()` captures the `useToast()` handle + history store here (this
 * component is inside the app + Pinia), so non-component producers — stores, the
 * WebSocket watcher — can call `useNotify()` without a setup() context. `close`
 * / `life-end` feed `handleMessageClosed` so coalesce keys + history records are
 * reconciled when a toast leaves the screen.
 */
installNotify();

const positions = Object.keys(POSITION_TO_GROUP) as ToastPosition[];

// Dev-only safety net: the outlet set must match the routing table exactly.
if (import.meta.env.DEV && positions.length !== Object.keys(POSITION_TO_GROUP).length) {
  console.warn("[NotificationOutlets] outlet set drifted from POSITION_TO_GROUP");
}

function onClosed(event: { message?: unknown }): void {
  handleMessageClosed(event.message as Parameters<typeof handleMessageClosed>[0]);
}
</script>

<template>
  <Toast
    v-for="pos in positions"
    :key="pos"
    :position="pos"
    :group="POSITION_TO_GROUP[pos]"
    @close="onClosed"
    @life-end="onClosed"
  />
</template>
