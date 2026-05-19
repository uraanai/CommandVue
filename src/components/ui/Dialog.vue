<script setup lang="ts">
import PvDialog from "primevue/dialog";

import { cn } from "@/utils/cn";

interface Props {
  visible: boolean;
  header?: string;
  modal?: boolean;
  closable?: boolean;
}

withDefaults(defineProps<Props>(), {
  header: undefined,
  modal: true,
  closable: true,
});

defineEmits<{
  "update:visible": [value: boolean];
}>();
</script>

<template>
  <PvDialog
    :visible="visible"
    :modal="modal"
    :closable="closable"
    :header="header"
    :pt="{
      root: {
        class: cn(
          'rounded-lg border border-border bg-surface-raised shadow-2xl',
          'min-w-[320px] max-w-[600px]',
        ),
      },
      mask: {
        class: cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-brand-950/70 backdrop-blur-sm',
        ),
      },
      header: {
        class: cn(
          'flex items-center justify-between gap-4 border-b border-border px-4 py-3',
          'text-sm font-medium text-foreground',
        ),
      },
      title: { class: 'truncate' },
      headerActions: { class: 'flex items-center gap-1' },
      pcCloseButton: {
        root: {
          class: cn(
            'inline-flex items-center justify-center rounded-md p-1 text-muted',
            'hover:bg-surface-sunken hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500',
          ),
        },
      },
      content: { class: cn('px-4 py-4 text-sm text-foreground') },
      footer: { class: cn('flex justify-end gap-2 border-t border-border px-4 py-3') },
    }"
    @update:visible="(value: boolean) => $emit('update:visible', value)"
  >
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </PvDialog>
</template>
