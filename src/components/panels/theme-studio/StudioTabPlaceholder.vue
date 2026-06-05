<script setup lang="ts">
import type { Component } from "vue";

/**
 * StudioTabPlaceholder — presentational stub rendered as the body of the L1
 * tabs not yet built (Tokens C1 · Typography C2 · Panels & Chrome C4 · Effects
 * C5). Deliberate custom component: it is not a PrimeVue surface (no library
 * equivalent), so the library-first rule does not apply. Token-pure (no color
 * literals); no raw interactive elements → governance-clean.
 */
interface Props {
  icon: Component;
  title: string;
  phase: string;
  note: string;
}
defineProps<Props>();
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
    <component :is="icon" :size="20" class="text-faint" />
    <p class="text-muted text-sm font-medium">{{ title }}</p>
    <p class="text-faint max-w-[20rem] text-xs">{{ note }}</p>
    <p class="text-faint text-[10px] tracking-wider uppercase">Lands in {{ phase }}</p>
  </div>
</template>
