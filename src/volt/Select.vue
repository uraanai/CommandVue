<template>
  <Select
    ref="selectRef"
    unstyled
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
    :append-to="overlayTarget"
    @before-show="resolveOverlay"
  >
    <template #dropdownicon>
      <ChevronDownIcon />
    </template>
    <template #loadingicon>
      <SpinnerIcon class="animate-spin" />
    </template>
    <template #filtericon>
      <SearchIcon class="text-faint" />
    </template>
    <template #clearicon="{ clearCallback }">
      <TimesIcon class="text-faint absolute end-10 top-1/2 -mt-2" @click="clearCallback" />
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Select>
</template>

<script setup lang="ts">
// Themed to the project's SEMANTIC tokens (bg-surface*/border-border/text-foreground),
// NOT the Volt surface-0..950 palette, so it matches ui/Select + the live theme.
import ChevronDownIcon from "@primevue/icons/chevrondown";
import SearchIcon from "@primevue/icons/search";
import SpinnerIcon from "@primevue/icons/spinner";
import TimesIcon from "@primevue/icons/times";
import Select, { type SelectPassThroughOptions, type SelectProps } from "primevue/select";
import { ref } from "vue";

import { type ElementLike, useOverlayTarget } from "@/composables/useOverlayTarget";

import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ SelectProps {}
defineProps<Props>();

// Pop-out aware: mount the overlay in THIS component's window, not the opener's.
const selectRef = ref<ElementLike>();
const { target: overlayTarget, resolve: resolveOverlay } = useOverlayTarget(selectRef);

const theme = ref<SelectPassThroughOptions>({
  root: `relative inline-flex w-full cursor-pointer select-none items-center rounded-md p-fluid:flex
        border border-border bg-surface text-foreground
        p-focus:border-[color:var(--color-focus-ring)]
        p-invalid:border-[color:var(--color-status-danger)]
        p-disabled:cursor-not-allowed p-disabled:opacity-50 p-disabled:pointer-events-none
        min-h-[var(--density-control-height)] transition-colors duration-200`,
  label: `block w-[1%] flex-auto truncate border-none bg-transparent text-foreground outline-none
        px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)]
        text-[length:var(--density-font-size)]
        p-clearable:pe-7 p-empty:opacity-0 p-editable:cursor-default
        p-placeholder:text-faint p-disabled:text-faint`,
  dropdown: `flex w-9 shrink-0 items-center justify-center rounded-e-md bg-transparent text-faint`,
  overlay: `absolute left-0 top-0 z-[100] mt-1 rounded-md p-portal-self:min-w-full
        border border-border bg-surface-raised text-foreground shadow-lg`,
  header: `px-2 pb-1 pt-2`,
  pcFilterContainer: {
    root: `relative`,
  },
  pcFilter: {
    root: `w-full appearance-none rounded-md p-fluid:w-full outline-none
            border border-border bg-surface text-foreground placeholder:text-faint
            focus:border-[color:var(--color-focus-ring)]
            ps-3 pe-9 py-2 text-[length:var(--density-font-size)]
            transition-colors duration-200`,
  },
  pcFilterIconContainer: {
    root: `absolute end-3 top-1/2 z-1 -mt-2 leading-none text-faint`,
  },
  listContainer: `max-h-60 overflow-auto`,
  list: `m-0 flex list-none flex-col gap-[2px] p-1`,
  optionGroup: `m-0 bg-transparent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint`,
  optionGroupLabel: ``,
  option: `relative flex cursor-pointer items-center overflow-hidden whitespace-nowrap rounded-sm
        border-none bg-transparent px-3 py-2 text-foreground
        hover:bg-surface-sunken p-focus:bg-surface-sunken
        p-selected:bg-surface-sunken p-selected:text-foreground p-focus:p-selected:bg-surface-sunken
        transition-colors duration-200`,
  optionLabel: ``,
  optionCheckIcon: `relative -ms-1 me-1 text-foreground`,
  optionBlankIcon: ``,
  emptyMessage: `px-3 py-2 text-faint`,
  virtualScroller: ``,
  transition: {
    enterFromClass: "opacity-0 scale-y-75",
    enterActiveClass: "transition duration-120 ease-[cubic-bezier(0,0,0.2,1)]",
    leaveActiveClass: "transition-opacity duration-100 ease-linear",
    leaveToClass: "opacity-0",
  },
});
</script>
