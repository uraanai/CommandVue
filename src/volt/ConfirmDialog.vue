<template>
  <ConfirmDialog
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template #container="{ message, acceptCallback, rejectCallback }">
      <!-- Close control mirrors Dialog.vue: density-aware IconButton anchored to
           the extreme top-right corner of the (relative) root. -->
      <IconButton
        label="Close dialog"
        size="sm"
        autofocus
        class="hover:bg-danger/15 hover:text-danger absolute end-0 top-0 z-10 rounded-tr-xl"
        @click="rejectCallback"
      >
        <X />
      </IconButton>
      <div
        class="flex shrink-0 items-center justify-between py-[calc(var(--density-cell-padding-y)*2)] ps-[calc(var(--density-cell-padding-x)*2)] pe-[calc(var(--density-control-height)+var(--density-cell-padding-y)*2)]"
      >
        <span class="text-xl font-semibold">{{ message.header }}</span>
      </div>
      <div
        class="flex items-center gap-4 overflow-y-auto px-[calc(var(--density-cell-padding-x)*2)] pt-0 pb-[calc(var(--density-cell-padding-y)*2)]"
      >
        <ExclamationTriangleIcon class="size-6" />
        {{ message.message }}
      </div>
      <div
        class="flex justify-end gap-2 px-[calc(var(--density-cell-padding-x)*2)] pt-0 pb-[calc(var(--density-cell-padding-y)*2)]"
      >
        <SecondaryButton :label="message.rejectProps.label" size="small" @click="rejectCallback" />
        <Button :label="message.acceptProps.label" size="small" @click="acceptCallback" />
      </div>
    </template>
  </ConfirmDialog>
</template>

<script setup lang="ts">
import { X } from "@lucide/vue";
import ExclamationTriangleIcon from "@primevue/icons/exclamationtriangle";
import ConfirmDialog, {
  type ConfirmDialogPassThroughOptions,
  type ConfirmDialogProps,
} from "primevue/confirmdialog";
import { ref } from "vue";

// Density-aware close button shared with Dialog.vue — see the note there.
import IconButton from "@/components/ui/IconButton.vue";

import Button from "./Button.vue";
import SecondaryButton from "./SecondaryButton.vue";
import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ ConfirmDialogProps {}
defineProps<Props>();

const theme = ref<ConfirmDialogPassThroughOptions>({
  root: `relative max-h-[90%] max-w-screen rounded-xl
        border border-surface-200 dark:border-surface-700
        bg-surface-0 dark:bg-surface-900
        text-surface-700 dark:text-surface-0 shadow-lg`,
  mask: `bg-black/50 fixed top-0 start-0 w-full h-full`,
  transition: {
    enterFromClass: "opacity-0 scale-75",
    enterActiveClass: "transition-all duration-150 ease-[cubic-bezier(0,0,0.2,1)]",
    leaveActiveClass: "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
    leaveToClass: "opacity-0 scale-75",
  },
});
</script>
