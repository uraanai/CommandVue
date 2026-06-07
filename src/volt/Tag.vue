<template>
  <Tag
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Tag>
</template>

<script setup lang="ts">
import Tag, { type TagPassThroughOptions, type TagProps } from "primevue/tag";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ TagProps {}
defineProps<Props>();

const theme = ref<TagPassThroughOptions>({
  // Severity colors paint from the `--color-status-*` theme tokens (Track A
  // A1b): subtle fill, solid text, family-colored 1px border. The tokens flip
  // with `data-theme`, so a single rule covers light + dark and follows custom
  // themes — no `dark:` variants and no off-palette literals (`sky`/`orange`
  // were never themeable). The base/secondary/contrast variants stay on the
  // PrimeUI `primary`/`surface` token utilities.
  root: `inline-flex items-center justify-center text-[length:var(--density-font-size)] font-bold py-1 px-2 rounded-md gap-1 p-rounded:rounded-2xl
        bg-primary-100 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300
        p-success:bg-[var(--color-status-success-subtle)] p-success:text-[var(--color-status-success)] p-success:border p-success:border-[var(--color-status-success-border)]
        p-info:bg-[var(--color-status-info-subtle)] p-info:text-[var(--color-status-info)] p-info:border p-info:border-[var(--color-status-info-border)]
        p-warn:bg-[var(--color-status-warning-subtle)] p-warn:text-[var(--color-status-warning)] p-warn:border p-warn:border-[var(--color-status-warning-border)]
        p-danger:bg-[var(--color-status-danger-subtle)] p-danger:text-[var(--color-status-danger)] p-danger:border p-danger:border-[var(--color-status-danger-border)]
        p-secondary:bg-surface-100 dark:p-secondary:bg-surface-800 p-secondary:text-surface-600 dark:p-secondary:text-surface-300
        p-contrast:bg-surface-950 dark:p-contrast:bg-surface-0 p-contrast:text-surface-0 dark:p-contrast:text-surface-950`,
  icon: `text-xs w-3 h-3`,
});
</script>
