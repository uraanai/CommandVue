<template>
  <Card
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card, { type CardPassThroughOptions, type CardProps } from "primevue/card";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ CardProps {}
defineProps<Props>();

const theme = ref<CardPassThroughOptions>({
  root: `flex flex-col rounded-lg
        border border-surface-200 dark:border-surface-700
        bg-surface-0 dark:bg-surface-900
        text-surface-700 dark:text-surface-0
        shadow-sm`,
  header: ``,
  body: `p-4 flex flex-col gap-2`,
  caption: `flex flex-col gap-1`,
  title: `font-semibold text-base`,
  subtitle: `text-surface-500 dark:text-surface-400 text-[length:var(--density-font-size)]`,
  content: ``,
  footer: ``,
});
</script>
