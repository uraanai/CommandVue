<template>
  <ToggleButton
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </ToggleButton>
</template>

<script setup lang="ts">
import ToggleButton, {
  type ToggleButtonPassThroughOptions,
  type ToggleButtonProps,
} from "primevue/togglebutton";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ ToggleButtonProps {}
defineProps<Props>();

const theme = ref<ToggleButtonPassThroughOptions>({
  root: `inline-flex items-center justify-center overflow-hidden relative cursor-pointer select-none
        border border-surface-100 dark:border-surface-950 rounded-md
        bg-surface-100 dark:bg-surface-950
        text-surface-500 dark:text-surface-400
        p-checked:text-primary-contrast
        text-[length:var(--density-font-size)] font-medium
        focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]
        disabled:cursor-default
        disabled:bg-surface-200 disabled:border-surface-200 disabled:text-surface-500
        disabled:dark:bg-surface-700 disabled:dark:border-surface-700 disabled:dark:text-surface-400
        p-invalid:border-[var(--color-status-danger)]
        transition-colors duration-200
        p-1 p-small:text-sm p-large:text-lg
    `,
  content: `relative flex-auto inline-flex items-center justify-center gap-2 py-[var(--density-cell-padding-y)] px-[var(--density-cell-padding-x)]
        rounded-md transition-colors duration-200
        p-checked:bg-primary p-checked:border-primary`,
  icon: ``,
  label: ``,
});
</script>
