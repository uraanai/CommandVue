<template>
  <Inplace
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Inplace>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb).
import Inplace, { type InplacePassThroughOptions, type InplaceProps } from "primevue/inplace";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ InplaceProps {}
defineProps<Props>();

const theme = ref<InplacePassThroughOptions>({
  root: `text-surface-700 dark:text-surface-0`,
  display: `inline-flex items-center cursor-pointer rounded-md px-2 py-1
        text-surface-700 dark:text-surface-0
        hover:bg-surface-100 dark:hover:bg-surface-800
        focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary
        transition-colors duration-200`,
  content: `flex items-center gap-2`,
});
</script>
