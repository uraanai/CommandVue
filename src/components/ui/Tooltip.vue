<script setup lang="ts">
/**
 * Minimal tooltip wrapper.
 *
 * Phase 3 ships a native `title`-based tooltip; later phases can swap in a
 * floating-ui-backed implementation (e.g. via @vueuse/integrations) without
 * changing the public API.
 */
interface Props {
  label: string;
}

defineProps<Props>();
</script>

<template>
  <span :title="label" class="inline-block">
    <slot />
  </span>
</template>
