<template>
  <PvConfirmPopup
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template #container="{ message, acceptCallback, rejectCallback }">
      <div class="flex items-start gap-3 p-3 pb-0">
        <ExclamationTriangleIcon
          class="text-surface-500 dark:text-surface-400 mt-0.5 size-5 shrink-0"
        />
        <span class="text-surface-700 dark:text-surface-0">{{ message.message }}</span>
      </div>
      <div class="flex justify-end gap-2 p-3">
        <SecondaryButton
          :label="message.rejectProps?.label ?? 'Cancel'"
          size="small"
          @click="rejectCallback"
        />
        <Button
          :label="message.acceptProps?.label ?? 'Confirm'"
          size="small"
          @click="acceptCallback"
        />
      </div>
    </template>
  </PvConfirmPopup>
</template>

<script setup lang="ts">
// Hand-authored Volt-style wrapper — PrimeVue ships no Volt template for this
// component, so it is styled here with the same unstyled + :pt + ptViewMerge
// convention as the volt-vue generated files. Styled entirely from theme
// tokens (no raw palette / hex / rgb). Mirrors ./ConfirmDialog.vue: the
// message + Reject/Accept buttons render inside the #container slot using the
// project's styled Button / SecondaryButton.
import ExclamationTriangleIcon from "@primevue/icons/exclamationtriangle";
import PvConfirmPopup, {
  type ConfirmPopupPassThroughOptions,
  type ConfirmPopupProps,
} from "primevue/confirmpopup";
import { ref } from "vue";

import Button from "./Button.vue";
import SecondaryButton from "./SecondaryButton.vue";
import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ ConfirmPopupProps {}
defineProps<Props>();

const theme = ref<ConfirmPopupPassThroughOptions>({
  root: `relative z-40 min-w-48 rounded-md shadow-lg
        bg-surface-0 dark:bg-surface-900
        border border-surface-200 dark:border-surface-700
        text-surface-700 dark:text-surface-0
        before:absolute before:-top-2 before:start-4 before:size-3 before:rotate-45
        before:bg-surface-0 dark:before:bg-surface-900
        before:border-s before:border-t before:border-surface-200 dark:before:border-surface-700`,
  content: `flex items-center p-3`,
  icon: `text-surface-500 dark:text-surface-400`,
  message: `ms-2 text-surface-700 dark:text-surface-0`,
  footer: `flex justify-end gap-2 p-3 pt-0`,
  pcAcceptButton: {
    root: `inline-flex cursor-pointer select-none items-center justify-center
            px-3 py-2 gap-2 rounded-md transition-colors duration-200
            bg-primary enabled:hover:bg-primary-emphasis text-primary-contrast
            border border-primary enabled:hover:border-primary-emphasis
            focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`,
  },
  pcRejectButton: {
    root: `inline-flex cursor-pointer select-none items-center justify-center
            px-3 py-2 gap-2 rounded-md transition-colors duration-200
            bg-surface-100 enabled:hover:bg-surface-200 text-surface-600
            dark:bg-surface-800 dark:enabled:hover:bg-surface-700 dark:text-surface-300
            border border-surface-100 enabled:hover:border-surface-200
            dark:border-surface-800 dark:enabled:hover:border-surface-700
            focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2
            focus-visible:outline-surface-600 dark:focus-visible:outline-surface-300`,
  },
  transition: {
    enterFromClass: "opacity-0 scale-90",
    enterActiveClass: "transition-all duration-150 ease-[cubic-bezier(0,0,0.2,1)]",
    leaveActiveClass: "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
    leaveToClass: "opacity-0",
  },
});
</script>
