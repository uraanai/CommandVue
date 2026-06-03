<template>
  <Rating
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <!-- No @click on the icons: PrimeVue's option element owns the click, and a
         second handler on the icon double-toggled (so a real star click
         appeared to do nothing). The slots are visual only. -->
    <template #onicon>
      <StarFillIcon class="text-primary h-4 w-4 transition-colors duration-200" />
    </template>
    <template #officon>
      <StarIcon
        class="text-surface-500 dark:text-surface-400 h-4 w-4 transition-colors duration-200"
      />
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Rating>
</template>

<script setup lang="ts">
import StarIcon from "@primevue/icons/star";
import StarFillIcon from "@primevue/icons/starfill";
import Rating, { type RatingPassThroughOptions, type RatingProps } from "primevue/rating";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ RatingProps {}
defineProps<Props>();

const theme = ref<RatingPassThroughOptions>({
  root: `relative flex items-center gap-1 p-disabled:opacity-60 p-disabled:pointer-events-none p-readonly:pointer-events-none`,
  option: `inline-flex items-center cursor-pointer rounded-full
        p-focus-visible:outline p-focus-visible:outline-1 p-focus-visible:outline-offset-2 p-focus-visible:outline-[color:var(--color-focus-ring)]`,
});
</script>
