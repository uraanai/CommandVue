<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";

import { cn } from "@/utils/cn";
import AutoComplete from "@/volt/AutoComplete.vue";

/**
 * EditableSelect — click-to-edit label constrained to a fixed option set.
 *
 * Resting state is a tight, content-width label (minimal side padding) that
 * reads as a value, not a boxed control; clicking it swaps in a constrained
 * combobox that fills the parent's width. The N options drop down on focus
 * (`completeOnFocus`); click one or type to filter. Only a value present in
 * `options` commits; anything else reverts. Enter / selecting commits, Escape
 * reverts.
 *
 * The toggle is hand-rolled (not PrimeVue `Inplace`) so the resting label can be
 * a tight word and the hover / background affordances are opt-in. The combobox
 * itself is the already-installed `volt/AutoComplete`. For free text, use
 * {@link EditableLabel}.
 */
interface Props {
  modelValue: string;
  /** The only values that may be committed. */
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Opt-in hover highlight on the resting label. Off by default. */
  hoverable?: boolean;
  /** Opt-in persistent theme background on the resting label. Off by default. */
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
const draft = ref<string>(props.modelValue);
const suggestions = ref<string[]>([]);
const acRef = ref<{ $el?: HTMLElement } | null>(null);

// Picking an option blurs the input *before* the selection registers, so a
// synchronous blur-close would unmount the combobox mid-click. We defer the
// close on blur; a selection (which updates the draft) is committed by the
// deferred handler, and a true click-away reverts.
let blurTimer: ReturnType<typeof setTimeout> | undefined;
function clearBlurTimer(): void {
  if (blurTimer !== undefined) {
    clearTimeout(blurTimer);
    blurTimer = undefined;
  }
}
onBeforeUnmount(clearBlurTimer);

/**
 * completeOnFocus + typing both route here. On focus the query is the current
 * value (a complete option), so an empty query OR an exact-option match lists
 * every option; a partial query filters. The full list shows the moment the
 * combobox opens, then narrows as the user types.
 */
function filter(event: { query: string }): void {
  const q = event.query.trim().toLowerCase();
  if (!q || props.options.some((o) => o.toLowerCase() === q)) {
    suggestions.value = [...props.options];
    return;
  }
  suggestions.value = props.options.filter((o) => o.toLowerCase().includes(q));
}

function startEdit(): void {
  if (props.disabled) return;
  clearBlurTimer();
  draft.value = props.modelValue;
  suggestions.value = [...props.options];
  editing.value = true;
  void nextTick(() => {
    acRef.value?.$el?.querySelector("input")?.focus();
  });
}

/** Commit only an allowed value; otherwise leave the model untouched. Closes. */
function commit(value: string): void {
  clearBlurTimer();
  if (!editing.value) return;
  editing.value = false;
  if (props.options.includes(value) && value !== props.modelValue) {
    emit("update:modelValue", value);
  } else {
    draft.value = props.modelValue;
  }
}

/** Fast path when AutoComplete reports a selection directly. */
function onItemSelect(event: { value: string }): void {
  commit(event.value);
}

/**
 * Blur defers: a pending option-click updates the draft moments later, so we
 * commit the draft after a short delay. A real click-away leaves the draft at
 * the current value and commits it (a no-op revert when nothing changed).
 */
function onBlur(): void {
  clearBlurTimer();
  blurTimer = setTimeout(() => {
    blurTimer = undefined;
    commit(draft.value);
  }, 150);
}

function cancel(): void {
  clearBlurTimer();
  editing.value = false;
  draft.value = props.modelValue;
}
</script>

<template>
  <div class="w-full">
    <!-- Resting state reads as a tight label (content width, minimal side
         padding) rather than a boxed control; clicking opens the combobox, which
         fills the parent's width. -->
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -- inline-edit display affordance, not a Button surface -->
    <button
      v-if="!editing"
      type="button"
      :disabled="disabled"
      :class="
        cn(
          'text-foreground inline-flex max-w-full cursor-text items-center rounded-sm border-0 bg-transparent px-1 text-left text-[length:var(--density-font-size)] leading-6 outline-none',
          background && 'bg-surface-sunken',
          hoverable && !disabled && !background && 'hover:bg-surface-sunken',
          disabled && 'cursor-not-allowed opacity-50',
        )
      "
      @click="startEdit"
    >
      <span :class="modelValue ? 'truncate' : 'text-faint truncate'">{{
        modelValue || placeholder || "—"
      }}</span>
    </button>
    <AutoComplete
      v-else
      ref="acRef"
      v-model="draft"
      :suggestions="suggestions"
      :placeholder="placeholder"
      complete-on-focus
      fluid
      class="w-full"
      @complete="filter"
      @item-select="onItemSelect"
      @keyup.escape="cancel"
      @blur="onBlur"
    />
  </div>
</template>
