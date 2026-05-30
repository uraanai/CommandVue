<script setup lang="ts">
import { ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Checkbox from "@/volt/Checkbox.vue";
import Dialog from "@/volt/Dialog.vue";

interface Props {
  visible: boolean;
  defaultName?: string;
}

const props = withDefaults(defineProps<Props>(), { defaultName: "" });
const emit = defineEmits<{
  "update:visible": [value: boolean];
  save: [payload: { name: string; description?: string; setAsWorkspaceDefault: boolean }];
}>();

const name = ref("");
const description = ref("");
const setAsDefault = ref(false);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      name.value = props.defaultName ?? "";
      description.value = "";
      setAsDefault.value = false;
    }
  },
);

function close(): void {
  emit("update:visible", false);
}

function submit(): void {
  if (!name.value.trim()) return;
  emit("save", {
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    setAsWorkspaceDefault: setAsDefault.value,
  });
  close();
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Save layout as…"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Name</span>
        <Input v-model="name" placeholder="My layout" @keydown.enter="submit" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase"
          >Description (optional)</span
        >
        <Input v-model="description" placeholder="What this layout is for" />
      </label>
      <label class="flex items-center gap-2 text-sm">
        <Checkbox v-model="setAsDefault" binary input-id="save-as-set-default" />
        <label for="save-as-set-default">Set as workspace default</label>
      </label>
    </div>
    <template #footer>
      <Button variant="secondary" size="sm" @click="close">Cancel</Button>
      <Button variant="primary" size="sm" :disabled="!name.trim()" @click="submit"> Save </Button>
    </template>
  </Dialog>
</template>
