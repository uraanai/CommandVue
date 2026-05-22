<script setup lang="ts">
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";

export type UnsavedChoice = "save" | "save-as" | "discard" | "cancel";

interface Props {
  visible: boolean;
  message?: string;
}

withDefaults(defineProps<Props>(), {
  message: "You have unsaved changes to the current layout.",
});

const emit = defineEmits<{
  "update:visible": [value: boolean];
  choose: [choice: UnsavedChoice];
}>();

function pick(choice: UnsavedChoice): void {
  emit("choose", choice);
  emit("update:visible", false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Unsaved changes"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <p class="text-muted text-sm">{{ message }}</p>
    <template #footer>
      <Button variant="ghost" size="sm" @click="pick('cancel')">Cancel</Button>
      <Button variant="secondary" size="sm" @click="pick('discard')">Discard</Button>
      <Button variant="secondary" size="sm" @click="pick('save-as')">Save as new</Button>
      <Button variant="primary" size="sm" @click="pick('save')">Save</Button>
    </template>
  </Dialog>
</template>
