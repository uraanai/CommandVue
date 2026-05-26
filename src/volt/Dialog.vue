<template>
  <Dialog
    unstyled
    :modal="modalValue"
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <template #closebutton="{ closeCallback }">
      <SecondaryButton variant="text" rounded autofocus @click="closeCallback">
        <template #icon>
          <TimesIcon />
        </template>
      </SecondaryButton>
    </template>
    <template #maximizebutton="{ maximized, maximizeCallback }">
      <SecondaryButton variant="text" rounded autofocus @click="maximizeCallback">
        <template #icon>
          <WindowMinimizeIcon v-if="maximized" />
          <WindowMaximizeIcon v-else />
        </template>
      </SecondaryButton>
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import TimesIcon from "@primevue/icons/times";
import WindowMaximizeIcon from "@primevue/icons/windowmaximize";
import WindowMinimizeIcon from "@primevue/icons/windowminimize";
import Dialog, { type DialogPassThroughOptions, type DialogProps } from "primevue/dialog";
import { computed } from "vue";

import SecondaryButton from "./SecondaryButton.vue";
import { ptViewMerge } from "./utils";

interface Props extends /* @vue-ignore */ DialogProps {
  /**
   * Dim + blur the page behind the dialog. Default `false` — CommandVue is a
   * map-first application and most modals should keep the map visible. Set
   * `true` for dialogs where focus should be enforced (e.g. confirm-destroy
   * prompts).
   */
  blurBackdrop?: boolean;
}
const props = defineProps<Props>();

// CommandVue project convention: modal is true by default (matches the legacy
// project Dialog wrapper). Volt inherits PrimeVue's `modal: false` default,
// which leaves the mask invisible. Consumers can still pass `:modal="false"`.
const modalValue = computed(() => (props as { modal?: boolean }).modal ?? true);

// CommandVue project convention: the mask is invisible by default so the map
// behind a dialog stays at full readability. Consumers opt in to the dim +
// blur by passing `:blur-backdrop="true"`.
const maskClass = computed(() =>
  props.blurBackdrop
    ? "p-modal:fixed p-modal:inset-0 p-modal:bg-brand-950/60 p-modal:backdrop-blur-sm"
    : "p-modal:fixed p-modal:inset-0",
);

const theme = computed<DialogPassThroughOptions>(() => ({
  // CommandVue convention: min-w 360px, max-w 720px, comfortable default
  // width 480px (mirrors the legacy project Dialog wrapper's `min-w-[320px]
  // max-w-[600px]` constraint). Without these the unstyled dialog adopts the
  // natural width of its title only, collapsing content to ~250px.
  root: `min-w-[360px] w-[480px] max-w-[720px] max-h-[90%] rounded-xl
        border border-surface-200 dark:border-surface-700
        bg-surface-0 dark:bg-surface-900
        text-surface-700 dark:text-surface-0 shadow-lg
        p-maximized:w-screen p-maximized:h-screen p-maximized:top-0 p-maximized:start-0 p-maximized:max-h-full p-maximized:max-w-none p-maximized:rounded-none`,
  header: `flex items-center justify-between shrink-0
        py-[calc(var(--density-cell-padding-y)*2)] px-[calc(var(--density-cell-padding-x)*2)]`,
  title: `font-semibold text-xl`,
  headerActions: `flex items-center gap-2`,
  content: `overflow-y-auto pt-0 p-maximized:grow
        px-[calc(var(--density-cell-padding-x)*2)] pb-[calc(var(--density-cell-padding-y)*2)]`,
  footer: `shrink-0 pt-0 flex justify-end gap-2
        px-[calc(var(--density-cell-padding-x)*2)] pb-[calc(var(--density-cell-padding-y)*2)]`,
  // Computed; see `maskClass` for the no-blur / blur-on toggle.
  mask: maskClass.value,
  transition: {
    enterFromClass: "opacity-0 scale-75",
    enterActiveClass: "transition-all duration-150 ease-[cubic-bezier(0,0,0.2,1)]",
    leaveActiveClass: "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
    leaveToClass: "opacity-0 scale-75",
  },
}));
</script>
