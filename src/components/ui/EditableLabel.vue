<script setup lang="ts">
import { nextTick, ref } from "vue";

import { cn } from "@/utils/cn";

/**
 * EditableLabel — click-to-edit free-text label (no suggestions).
 *
 * Resting state is a plain label; clicking it swaps in a text input *in the
 * exact same box* — same padding, height, font, radius and a 1px border that is
 * transparent at rest and visible while editing. Tailwind is border-box, so the
 * footprint never changes: no width/height jerk when toggling. The background is
 * transparent throughout, so only the border appears. Enter / blur commits,
 * Escape reverts.
 *
 * The toggle is hand-rolled (not PrimeVue `Inplace`) precisely so the resting
 * box can match the editor's box and the hover affordance can be opt-in. For an
 * option-constrained value, use {@link EditableSelect}.
 */
interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  /** Opt-in hover affordance on the resting label. Off by default. */
  hoverable?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  disabled: false,
  hoverable: false,
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

/**
 * Shared footprint — both states resolve to the identical border-box. `leading-6`
 * (24px) matches the Volt input baseline so the resting label and the editor are
 * the same height as well as width: zero jerk on toggle.
 */
const BOX =
  "block w-full box-border truncate rounded-md border bg-transparent text-left leading-6 " +
  "px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] " +
  "min-h-[var(--density-control-height)] text-[length:var(--density-font-size)]";
</script>

<template>
  <div class="w-full">
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -- inline-edit display affordance, not a Button surface; matched to the editor box -->
    <button
      v-if="!editing"
      type="button"
      :disabled="disabled"
      :class="
        cn(
          BOX,
          'text-foreground flex cursor-text items-center border-transparent',
          hoverable && !disabled && 'hover:bg-surface-sunken',
          disabled && 'cursor-not-allowed opacity-50',
        )
      "
      @click="startEdit"
    >
      <span :class="modelValue ? 'truncate' : 'text-faint truncate'">{{
        modelValue || placeholder || "—"
      }}</span>
    </button>
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -- transparent inline editor matched 1:1 to the display box -->
    <input
      v-else
      ref="inputRef"
      v-model="draft"
      type="text"
      :placeholder="placeholder"
      spellcheck="false"
      :class="
        cn(
          BOX,
          'border-border text-foreground outline-none',
          'focus:border-[color:var(--color-focus-ring)] focus:ring-2 focus:ring-[color:var(--color-focus-ring)]',
        )
      "
      @keyup.enter="commit"
      @keyup.escape="cancel"
      @blur="commit"
    />
  </div>
</template>
