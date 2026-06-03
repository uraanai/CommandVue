<template>
  <Message
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template #closeicon>
      <TimesIcon />
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Message>
</template>

<script setup lang="ts">
import TimesIcon from "@primevue/icons/times";
import Message, { type MessagePassThroughOptions, type MessageProps } from "primevue/message";
import { ref } from "vue";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ MessageProps {}
defineProps<Props>();

const theme = ref<MessagePassThroughOptions>({
  root: `rounded-md outline outline-1
        p-outlined:bg-transparent p-outlined:outline p-outlined:outline-1
        p-simple:bg-transparent p-simple:outline-none
        p-info:bg-[var(--color-status-info-subtle)] p-info:outline-[var(--color-status-info-border)] p-info:text-[var(--color-status-info)]
        p-info:p-outlined:text-[var(--color-status-info)] p-info:p-outlined:outline-[var(--color-status-info)]
        p-info:p-simple:text-[var(--color-status-info)]
        p-success:bg-[var(--color-status-success-subtle)] p-success:outline-[var(--color-status-success-border)] p-success:text-[var(--color-status-success)]
        p-success:p-outlined:text-[var(--color-status-success)] p-success:p-outlined:outline-[var(--color-status-success)]
        p-success:p-simple:text-[var(--color-status-success)]
        p-warn:bg-[var(--color-status-warning-subtle)] p-warn:outline-[var(--color-status-warning-border)] p-warn:text-[var(--color-status-warning)]
        p-warn:p-outlined:text-[var(--color-status-warning)] p-warn:p-outlined:outline-[var(--color-status-warning)]
        p-warn:p-simple:text-[var(--color-status-warning)]
        p-error:bg-[var(--color-status-danger-subtle)] p-error:outline-[var(--color-status-danger-border)] p-error:text-[var(--color-status-danger)]
        p-error:p-outlined:text-[var(--color-status-danger)] p-error:p-outlined:outline-[var(--color-status-danger)]
        p-error:p-simple:text-[var(--color-status-danger)]
        p-secondary:bg-surface-100 p-secondary:outline-surface-200 p-secondary:text-surface-600 dark:p-secondary:bg-surface-800 dark:p-secondary:outline-surface-700 dark:p-secondary:text-surface-300
        p-secondary:p-outlined:text-surface-500 p-secondary:p-outlined:outline-surface-500 dark:p-secondary:p-outlined:text-surface-400 dark:p-secondary:p-outlined:outline-surface-400
        p-secondary:p-simple:text-surface-500 dark:p-secondary:p-simple:text-surface-400
        p-contrast:bg-surface-900 p-contrast:outline-surface-950 p-contrast:text-surface-50 dark:p-contrast:bg-surface-0 dark:p-contrast:outline-surface-100 dark:p-contrast:text-surface-950
        p-contrast:p-outlined:text-surface-950 p-contrast:p-outlined:outline-surface-950 dark:p-contrast:p-outlined:text-surface-0 dark:p-contrast:p-outlined:outline-surface-0
        p-contrast:p-simple:text-surface-950 dark:p-contrast:p-simple:text-surface-0`,
  content: `flex items-center
        p-simple:p-0
        px-3 py-2 gap-2 h-full
        p-small:px-2.5 p-small:py-[0.375rem]
        p-large:px-3.5 p-large:py-2.5`,
  icon: `flex-shrink-0 text-lg w-[1.125rem] h-[1.125rem]
        p-small:w-[0.875rem] p-small:h-[0.875rem] p-small:text-sm
        p-large:w-5 p-large:h-5 p-large:text-xl`,
  text: `text-base font-medium p-small:text-sm p-large:text-xl`,
  closeButton: `flex items-center justify-center flex-shrink-0 ms-auto overflow-hidden relative cursor-pointer select-none
        w-7 h-7 rounded-full bg-transparent transition-colors duration-200 text-inherit p-0 border-none
        focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2
        p-info:hover:bg-[var(--color-status-info-subtle)] p-info:focus-visible:outline-[var(--color-status-info)]
        p-success:hover:bg-[var(--color-status-success-subtle)] p-success:focus-visible:outline-[var(--color-status-success)]
        p-warn:hover:bg-[var(--color-status-warning-subtle)] p-warn:focus-visible:outline-[var(--color-status-warning)]
        p-error:hover:bg-[var(--color-status-danger-subtle)] p-error:focus-visible:outline-[var(--color-status-danger)]
        p-secondary:hover:bg-surface-200 p-secondary:focus-visible:outline-surface-600 dark:p-secondary:hover:bg-surface-700 dark:p-secondary:focus-visible:outline-surface-300
        p-contrast:hover:bg-surface-800 p-contrast:focus-visible:outline-surface-50 dark:p-contrast:hover:bg-surface-100 dark:p-contrast:focus-visible:outline-surface-950
        p-outlined:hover:bg-transparent p-simple:hover:bg-transparent`,
  closeIcon: `w-4 h-4 text-base
        p-small:w-3.5 p-small:h-3.5 p-small:text-sm 
        p-large:w-[1.125rem] p-large:h-[1.125rem] p-large:text-xl`,
  transition: {
    enterFromClass: "opacity-0",
    enterActiveClass: "transition-opacity duration-300",
    leaveFromClass: "max-h-40",
    leaveActiveClass: "overflow-hidden transition-all duration-300 ease-in",
    leaveToClass: "max-h-0 opacity-0 !m-0",
  },
});
</script>
