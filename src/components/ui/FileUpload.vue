<script setup lang="ts">
import PvFileUpload, { type FileUploadSelectEvent } from "primevue/fileupload";
import { ref } from "vue";

/**
 * FileUpload — thin wrapper over PrimeVue `FileUpload` in Unstyled mode.
 *
 * Hand-rolled exception to the Volt-default rule (ADR 0002 Option C): Volt's
 * catalog as of 2026-05-24 has no `FileUpload` component. Tracked for
 * promotion to `@/volt/FileUpload.vue` if Volt ships it later. See
 * `docs/decisions/0002-volt-vs-handrolled-wrappers.md` and
 * `docs/audits/primevue-firstrule-audit-2026-05-24.md`.
 *
 * Defaults to a hidden, programmatic mode (`mode="basic"`, `customUpload`,
 * `auto`) suitable for menu-item-triggered "Import" flows. The consumer
 * obtains a ref and calls `choose()` to open the native file dialog.
 *
 * `choose()` and `clear()` are runtime instance methods PrimeVue exposes on
 * FileUpload but doesn't surface on its exported component type — `defineExpose`
 * re-exports them with a typed shape so consumers don't need to cast.
 */
interface Props {
  accept?: string;
  multiple?: boolean;
  maxFileSize?: number;
}

withDefaults(defineProps<Props>(), {
  accept: undefined,
  multiple: false,
  maxFileSize: undefined,
});

const emit = defineEmits<{
  select: [event: FileUploadSelectEvent];
}>();

const fileUpload = ref<{ choose: () => void; clear: () => void } | null>(null);

function choose(): void {
  fileUpload.value?.choose();
}

function clear(): void {
  fileUpload.value?.clear();
}

defineExpose({ choose, clear });
</script>

<template>
  <PvFileUpload
    ref="fileUpload"
    mode="basic"
    custom-upload
    auto
    :accept="accept"
    :multiple="multiple"
    :max-file-size="maxFileSize"
    :pt="{ root: { class: 'hidden' } }"
    @select="(event: FileUploadSelectEvent) => emit('select', event)"
  />
</template>
