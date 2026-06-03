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
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. FloatLabel only exposes a single
// `root` pt section; the contained <label> is styled via descendant selectors
// keyed off the variant classes (p-floatlabel-over / -in / -on, added to root
// from the `variant` prop) and the input's focus / filled state. Styled
// entirely from theme tokens (no raw palette / hex / rgb).
import PvFloatLabel, {
  type FloatLabelPassThroughOptions,
  type FloatLabelProps,
} from "primevue/floatlabel";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ FloatLabelProps {}
defineProps<Props>();

const theme = ref<FloatLabelPassThroughOptions>({
  root: `block relative

        [&>label]:absolute [&>label]:pointer-events-none
        [&>label]:text-surface-500 dark:[&>label]:text-surface-400
        [&>label]:transition-all [&>label]:duration-200 [&>label]:ease-in-out

        [&>label]:top-1/2 [&>label]:-translate-y-1/2
        [&>label]:start-3 [&>label]:leading-none

        has-[:focus]:[&>label]:text-primary
        has-[.p-invalid]:[&>label]:text-[var(--color-status-danger)]

        p-floatlabel-over:[&>label]:top-1/2
        p-floatlabel-over:has-[:focus]:[&>label]:top-0
        p-floatlabel-over:has-[:focus]:[&>label]:-translate-y-1/2
        p-floatlabel-over:has-[:focus]:[&>label]:text-xs
        p-floatlabel-over:has-[.p-filled]:[&>label]:top-0
        p-floatlabel-over:has-[.p-filled]:[&>label]:-translate-y-1/2
        p-floatlabel-over:has-[.p-filled]:[&>label]:text-xs
        p-floatlabel-over:has-[:autofill]:[&>label]:top-0
        p-floatlabel-over:has-[:autofill]:[&>label]:-translate-y-1/2
        p-floatlabel-over:has-[:autofill]:[&>label]:text-xs

        p-floatlabel-in:[&>label]:top-1/2
        p-floatlabel-in:has-[:focus]:[&>label]:top-1
        p-floatlabel-in:has-[:focus]:[&>label]:translate-y-0
        p-floatlabel-in:has-[:focus]:[&>label]:text-xs
        p-floatlabel-in:has-[.p-filled]:[&>label]:top-1
        p-floatlabel-in:has-[.p-filled]:[&>label]:translate-y-0
        p-floatlabel-in:has-[.p-filled]:[&>label]:text-xs

        p-floatlabel-on:[&>label]:top-1/2
        p-floatlabel-on:has-[:focus]:[&>label]:top-0
        p-floatlabel-on:has-[:focus]:[&>label]:-translate-y-1/2
        p-floatlabel-on:has-[:focus]:[&>label]:text-xs
        p-floatlabel-on:has-[:focus]:[&>label]:px-1
        p-floatlabel-on:has-[:focus]:[&>label]:bg-surface-0 dark:p-floatlabel-on:has-[:focus]:[&>label]:bg-surface-900
        p-floatlabel-on:has-[.p-filled]:[&>label]:top-0
        p-floatlabel-on:has-[.p-filled]:[&>label]:-translate-y-1/2
        p-floatlabel-on:has-[.p-filled]:[&>label]:text-xs
        p-floatlabel-on:has-[.p-filled]:[&>label]:px-1
        p-floatlabel-on:has-[.p-filled]:[&>label]:bg-surface-0 dark:p-floatlabel-on:has-[.p-filled]:[&>label]:bg-surface-900`,
});
</script>
