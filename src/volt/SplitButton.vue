<template>
  <PvSplitButton
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvSplitButton>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb). The nested action + dropdown buttons
// mirror the primary look of ./Button.vue.
import PvSplitButton, {
  type SplitButtonPassThroughOptions,
  type SplitButtonProps,
} from "primevue/splitbutton";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ SplitButtonProps {}
defineProps<Props>();

const theme = ref<SplitButtonPassThroughOptions>({
  root: `inline-flex rounded-md`,
  pcButton: {
    root: `inline-flex cursor-pointer select-none items-center justify-center overflow-hidden relative
            px-3 py-2 gap-2 rounded-s-md rounded-e-none transition-colors duration-200
            disabled:pointer-events-none disabled:opacity-60
            bg-primary enabled:hover:bg-primary-emphasis text-primary-contrast
            border border-primary enabled:hover:border-primary-emphasis
            focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`,
  },
  pcDropdown: {
    root: `inline-flex cursor-pointer select-none items-center justify-center overflow-hidden relative
            w-10 px-0 py-2 rounded-e-md rounded-s-none transition-colors duration-200
            disabled:pointer-events-none disabled:opacity-60
            bg-primary enabled:hover:bg-primary-emphasis text-primary-contrast
            border border-primary enabled:hover:border-primary-emphasis border-s border-s-primary-emphasis
            focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`,
  },
  pcMenu: {
    root: `min-w-48 py-1 rounded-md shadow-lg
            bg-surface-0 dark:bg-surface-900
            border border-surface-200 dark:border-surface-700
            text-surface-700 dark:text-surface-0`,
    item: `cursor-pointer select-none`,
    itemContent: `flex items-center gap-2 px-3 py-2 rounded-none transition-colors duration-200
            hover:bg-surface-100 dark:hover:bg-surface-800`,
    itemLink: `flex items-center gap-2 w-full text-inherit no-underline`,
    itemIcon: `text-surface-500 dark:text-surface-400`,
    itemLabel: `leading-none`,
  },
});
</script>
