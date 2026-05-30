<script setup lang="ts">
import Button from "@/components/ui/Button.vue";
import { useConfirm } from "@/composables/useConfirm";
import Dialog from "@/volt/Dialog.vue";

/**
 * App-wide confirmation dialog host. Mounted ONCE in `App.vue`. Driven by the
 * `useConfirm()` singleton — feature components never use this directly; they
 * call `useConfirm().confirm({ … })` / `.confirmIf(needed, { … })` and await a
 * boolean. This renders the active prompt and resolves the promise.
 *
 * Because the state lives in the composable (not here / not per-call-site),
 * there's no "armed" affordance to reset: closing the prompt always resolves
 * and clears it, so a destructive action that re-opens its host list can never
 * show a stale confirm state.
 */

const { current, resolveCurrent } = useConfirm();

function onVisibleChange(visible: boolean): void {
  // ESC / backdrop / the dialog's own close control → treat as cancel.
  if (!visible) resolveCurrent(false);
}
</script>

<template>
  <Dialog
    :visible="current !== null"
    modal
    :style="{ width: '26rem', maxWidth: '92vw' }"
    :header="current?.title ?? ''"
    @update:visible="onVisibleChange"
  >
    <div v-if="current" class="flex flex-col gap-4">
      <p v-if="current.message" class="text-muted text-sm leading-snug">
        {{ current.message }}
      </p>

      <ul
        v-if="current.details && current.details.length > 0"
        class="border-border-subtle bg-surface-sunken flex flex-col gap-0.5 rounded-md border px-3 py-2 text-xs"
      >
        <li v-for="(line, i) in current.details" :key="i" class="text-foreground">
          {{ line }}
        </li>
      </ul>

      <footer class="flex items-center justify-end gap-2 pt-1">
        <Button variant="secondary" size="sm" @click="resolveCurrent(false)">
          {{ current.cancelLabel ?? "Cancel" }}
        </Button>
        <Button
          :variant="current.danger ? 'danger' : 'primary'"
          size="sm"
          @click="resolveCurrent(true)"
        >
          {{ current.confirmLabel ?? "Confirm" }}
        </Button>
      </footer>
    </div>
  </Dialog>
</template>
