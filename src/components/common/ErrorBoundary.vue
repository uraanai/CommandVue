<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { onErrorCaptured, ref } from "vue";

/**
 * Local error boundary built on Vue 3's `onErrorCaptured`. Wraps a slot;
 * when a child throws, renders a fallback with a Reset button that clears
 * the captured error and re-attempts rendering the slot.
 */
const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err));
  // Stop propagation — the boundary owns this error.
  return false;
});

function reset(): void {
  error.value = null;
}
</script>

<template>
  <div
    v-if="error"
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <TriangleAlert class="text-danger size-10" />
    <h3 class="text-foreground text-sm font-medium">Something went wrong</h3>
    <p class="text-muted max-w-prose text-xs">{{ error.message }}</p>
    <button
      type="button"
      class="bg-accent-600 hover:bg-accent-500 rounded px-3 py-1 text-xs text-white transition-colors"
      @click="reset"
    >
      Try again
    </button>
  </div>
  <slot v-else />
</template>
