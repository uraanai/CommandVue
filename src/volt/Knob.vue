<template>
  <PvKnob
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </PvKnob>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for the
// Knob component, so it is styled here with the same unstyled + :pt +
// ptViewMerge convention as the volt-vue generated files. Styled entirely from
// theme tokens (no raw palette / hex / rgb).
//
// Knob is an SVG circular dial: `range` is the unfilled track stroke, `value`
// is the filled arc stroke, and `text` is the centered value label. SVG
// elements take color through `stroke`/`fill` (not `text-*` / `bg-*`), so the
// track and arc use `stroke-*` utilities and the label uses `fill-*`.
import PvKnob, { type KnobPassThroughOptions, type KnobProps } from "primevue/knob";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ KnobProps {}
defineProps<Props>();

const theme = ref<KnobPassThroughOptions>({
  // `select-none` stops the drag from selecting surrounding text (which made the
  // page look "disoriented"); `touch-none` keeps touch drags on the dial.
  root: `inline-flex items-center justify-center select-none
        p-focus-visible:outline p-focus-visible:outline-1 p-focus-visible:outline-offset-2 p-focus-visible:outline-[color:var(--color-focus-ring)]
        p-disabled:opacity-60 p-disabled:pointer-events-none`,
  svg: `rounded-full cursor-pointer touch-none
        focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]`,
  // No CSS transition on the arc — PrimeVue redraws the stroke every pointer
  // move, and an interpolating `transition-all` made the arc lag the pointer and
  // overshoot its bounds mid-drag.
  range: `fill-none stroke-surface-200 dark:stroke-surface-700`,
  value: `fill-none stroke-primary`,
  text: `text-center text-xl font-medium fill-surface-700 dark:fill-surface-0`,
});
</script>
