<template>
  <PvInputIcon
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvInputIcon>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb).
//
// InputIcon is the icon element overlaid by IconField. Mirrors PrimeVue 4's
// `.p-inputicon` styled CSS: absolutely positioned, vertically centered
// (top-1/2 with a negative top margin of half the icon height), muted color,
// above the input on the z-axis. IconField positions it on the leading or
// trailing edge via its first-child / last-child selectors.
import PvInputIcon, {
  type InputIconPassThroughOptions,
  type InputIconProps,
} from "primevue/inputicon";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ InputIconProps {}
defineProps<Props>();

const theme = ref<InputIconPassThroughOptions>({
  root: `absolute top-1/2 -mt-2 w-4 h-4 leading-none z-10
        text-surface-400 dark:text-surface-500
        ms-0 [&:first-child]:start-3 [&:last-child]:end-3`,
});
</script>
