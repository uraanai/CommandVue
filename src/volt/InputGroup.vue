<template>
  <PvInputGroup
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvInputGroup>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb).
import PvInputGroup, {
  type InputGroupPassThroughOptions,
  type InputGroupProps,
} from "primevue/inputgroup";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ InputGroupProps {}
defineProps<Props>();

const theme = ref<InputGroupPassThroughOptions>({
  root: `flex items-stretch w-full
        [&>*]:rounded-none [&>*]:m-0
        [&>*:first-child]:rounded-s-md [&>*:last-child]:rounded-e-md
        [&>*:not(:first-child)]:border-s-0
        [&>*:focus-within]:relative [&>*:focus-within]:z-10`,
});
</script>
