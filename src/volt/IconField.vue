<template>
  <PvIconField
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvIconField>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb).
//
// IconField is a relative positioning context that overlays an InputIcon on an
// InputText. The wrapped input gets a padding inset on the side the icon sits,
// so the text never overlaps the icon. The InputIcon is matched by its
// `data-pc-name="inputicon"` attribute (NOT the `.p-inputicon` class, which is
// only emitted in styled mode) so the inset applies in unstyled mode. Leading
// icon = first child → start inset; trailing icon = last child → end inset.
import PvIconField, {
  type IconFieldPassThroughOptions,
  type IconFieldProps,
} from "primevue/iconfield";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ IconFieldProps {}
defineProps<Props>();

const theme = ref<IconFieldPassThroughOptions>({
  root: `relative block
        [&>input]:w-full
        [&:has([data-pc-name=inputicon]:first-child)_input]:ps-10
        [&:has([data-pc-name=inputicon]:last-child)_input]:pe-10`,
});
</script>
