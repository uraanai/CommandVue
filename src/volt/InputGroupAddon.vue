<template>
  <PvInputGroupAddon
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvInputGroupAddon>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb).
import PvInputGroupAddon, {
  type InputGroupAddonPassThroughOptions,
  type InputGroupAddonProps,
} from "primevue/inputgroupaddon";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ InputGroupAddonProps {}
defineProps<Props>();

const theme = ref<InputGroupAddonPassThroughOptions>({
  root: `flex items-center justify-center shrink-0
        bg-surface-50 dark:bg-surface-800
        text-surface-500 dark:text-surface-400
        border border-surface-200 dark:border-surface-700
        px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)]
        min-h-[var(--density-control-height)] text-[length:var(--density-font-size)]
        p-small:text-sm p-small:px-[0.625rem] p-small:py-[0.375rem]
        p-large:text-lg p-large:px-[0.875rem] p-large:py-[0.625rem]`,
});
</script>
