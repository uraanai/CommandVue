<script setup lang="ts">
import { nextTick, ref } from "vue";

import { cn } from "@/utils/cn";

/**
 * EditableLabel — an inline, click-to-edit word (free text, no suggestions).
 *
 * It reads as a word in a sentence: it inherits the surrounding font, size,
 * line-height and color (`font: inherit` overrides the UA control reset), sizes
 * to its text (an invisible sizer mirrors the value so the editor grows with the
 * content instead of being a fixed box), and carries no horizontal padding — no
 * left/right space. Clicking it (or an opt-in hover/background) is the only
 * affordance. Enter / blur commits, Escape reverts.
 *
 * For an option-constrained value, use {@link EditableSelect}.
 */
interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  /** Opt-in hover highlight on the resting word. Off by default. */
  hoverable?: boolean;
  /** Opt-in persistent theme background on the resting word. Off by default. */
  background?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  disabled: false,
  hoverable: false,
  background: false,
});
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const editing = ref(false);
const draft = ref(props.modelValue);
const inputRef = ref<HTMLInputElement | null>(null);

function startEdit(): void {
  if (props.disabled) return;
  draft.value = props.modelValue;
  editing.value = true;
  void nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}
function commit(): void {
  if (!editing.value) return;
  editing.value = false;
  if (draft.value !== props.modelValue) emit("update:modelValue", draft.value);
}
function cancel(): void {
  editing.value = false;
  draft.value = props.modelValue;
}
</script>

<template>
  <span class="inline-flex max-w-full align-baseline">
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -- inline-edit word affordance; not a Button surface -->
    <button
      v-if="!editing"
      type="button"
      :disabled="disabled"
      :class="
        cn(
          'inline max-w-full cursor-text rounded-sm border-0 bg-transparent p-0 text-left align-baseline outline-none [font:inherit]',
          background && 'bg-surface-sunken',
          hoverable && !disabled && !background && 'hover:bg-surface-sunken',
          disabled && 'cursor-not-allowed opacity-50',
        )
      "
      @click="startEdit"
    >
      <span :class="modelValue ? '' : 'text-faint'">{{ modelValue || placeholder || "—" }}</span>
    </button>
    <!-- Editor sizes to its text: an invisible sizer sets the grid track width,
         the input overlays it. Grows as the user types; no fixed footprint. -->
    <span v-else class="inline-grid max-w-full align-baseline">
      <span
        class="invisible col-start-1 row-start-1 whitespace-pre [font:inherit]"
        aria-hidden="true"
        >{{ draft || placeholder || " " }}</span
      >
      <!-- eslint-disable-next-line vue/no-restricted-html-elements -- transparent inline editor; width tracks the sizer -->
      <input
        ref="inputRef"
        v-model="draft"
        type="text"
        size="1"
        :placeholder="placeholder"
        spellcheck="false"
        class="text-foreground bg-surface-sunken col-start-1 row-start-1 w-full min-w-0 rounded-sm border-0 p-0 align-baseline outline-none [font:inherit]"
        @keyup.enter="commit"
        @keyup.escape="cancel"
        @blur="commit"
      />
    </span>
  </span>
</template>
