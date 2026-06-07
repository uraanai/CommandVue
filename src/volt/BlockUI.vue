<template>
  <BlockUI
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </BlockUI>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb).
import BlockUI, { type BlockUIPassThroughOptions, type BlockUIProps } from "primevue/blockui";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ BlockUIProps {}
defineProps<Props>();

const theme = ref<BlockUIPassThroughOptions>({
  root: `relative`,
  mask: `absolute inset-0 z-10 flex items-center justify-center
        bg-surface-0/60 dark:bg-surface-950/60
        backdrop-blur-[1px]`,
});
</script>
