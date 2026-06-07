<template>
  <PvIftaLabel
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvIftaLabel>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. IftaLabel renders an in-field,
// top-aligned label: the contained <label> is pinned to the top of the field
// and the wrapped input is padded so its text sits below the label. Only a
// single `root` pt section exists; the label and input are reached via
// descendant selectors. Styled entirely from theme tokens (no raw palette /
// hex / rgb).
import PvIftaLabel, {
  type IftaLabelPassThroughOptions,
  type IftaLabelProps,
} from "primevue/iftalabel";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ IftaLabelProps {}
defineProps<Props>();

const theme = ref<IftaLabelPassThroughOptions>({
  root: `block relative

        [&>label]:absolute [&>label]:top-2 [&>label]:start-3
        [&>label]:pointer-events-none [&>label]:leading-none
        [&>label]:text-xs [&>label]:font-medium
        [&>label]:text-surface-500 dark:[&>label]:text-surface-400
        [&>label]:transition-colors [&>label]:duration-200

        has-[:focus]:[&>label]:text-primary
        has-[.p-invalid]:[&>label]:text-[var(--color-status-danger)]

        [&_input]:pt-6 [&_input]:pb-2
        [&_textarea]:pt-6 [&_textarea]:pb-2`,
});
</script>
