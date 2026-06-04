<template>
  <PvFloatLabel
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvFloatLabel>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, and its unstyled build emits none of the state markers
// (`.p-filled`, `data-p`) the animated float needs. Attempts to drive the float
// from `:placeholder-shown` failed too: Chromium ignores a whitespace-only
// placeholder, and Tailwind cannot extract the stacked `has-[...]:[&>label]:…`
// arbitrary variants. So this renders the reliable *notched* label pattern — the
// label sits on the field's top border at all times, never overlapping the text
// (which was the bug). The float is expressed in a small <style> block (like the
// Volt ProgressSpinner's keyframes), namespaced by the `cv-floatlabel` pt class,
// with every color a theme token. The label colors its text with the primary
// token while the field is focused.
import PvFloatLabel, {
  type FloatLabelPassThroughOptions,
  type FloatLabelProps,
} from "primevue/floatlabel";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ FloatLabelProps {}
defineProps<Props>();

const theme = ref<FloatLabelPassThroughOptions>({
  root: `cv-floatlabel`,
});
</script>

<style>
.cv-floatlabel {
  position: relative;
  display: block;
  padding-top: 0.5rem;
}
.cv-floatlabel > label {
  position: absolute;
  top: 0.5rem;
  inset-inline-start: 0.625rem;
  transform: translateY(-50%);
  padding-inline: 0.25rem;
  font-size: 0.7rem;
  line-height: 1;
  pointer-events: none;
  background: var(--color-surface);
  color: var(--color-muted);
  transition: color 0.15s ease-out;
}
.cv-floatlabel:has(input:focus) > label,
.cv-floatlabel:has(textarea:focus) > label {
  color: var(--p-primary-color);
}
.cv-floatlabel:has(.p-invalid) > label {
  color: var(--color-status-danger);
}
</style>
