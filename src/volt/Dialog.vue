<template>
  <Dialog
    unstyled
    :modal="modalValue"
    :pt="theme"
    :pt-options="{
      mergeProps: ptViewMerge,
    }"
  >
    <!--
      Close button hover: a semi-transparent danger wash + red icon so it reads
      as a destructive "close" affordance. `danger` is theme-aware (red-600 light
      / red-400 dark), and the /15 alpha keeps it a tint, not a solid fill — so it
      contrasts on any dialog surface in either theme. The consumer class wins over
      IconButton's neutral ghost hover via its `cn()` merge. Maximize stays neutral
      (`surface-sunken`, the project's row-hover token) — it isn't destructive.
    -->
    <template #closebutton="{ closeCallback }">
      <IconButton
        label="Close dialog"
        size="sm"
        autofocus
        class="hover:bg-danger/15 hover:text-danger rounded-tr-xl"
        @click="closeCallback"
      >
        <X />
      </IconButton>
    </template>
    <template #maximizebutton="{ maximized, maximizeCallback }">
      <IconButton
        :label="maximized ? 'Restore dialog' : 'Maximize dialog'"
        size="sm"
        autofocus
        class="hover:bg-surface-sunken"
        @click="maximizeCallback"
      >
        <Minimize2 v-if="maximized" />
        <Maximize2 v-else />
      </IconButton>
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Maximize2, Minimize2, X } from "@lucide/vue";
import Dialog, { type DialogPassThroughOptions, type DialogProps } from "primevue/dialog";
import { computed } from "vue";

// The close / maximize controls reuse the project's density-aware IconButton
// (src/components/ui) rather than the Volt SecondaryButton: its `sm` size pulls
// height, padding, and icon size from the `--density-*` tokens, so the cross
// rescales with `data-density` (compact / comfortable / spacious). This is a
// deliberate ui ← volt import; re-running `volt-vue add Dialog` would overwrite
// it, so keep this slot when regenerating.
import IconButton from "@/components/ui/IconButton.vue";

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
  root: `relative min-w-[360px] w-[480px] max-w-[720px] max-h-[90%] rounded-xl
        border border-surface-200 dark:border-surface-700
        bg-surface-0 dark:bg-surface-900
        text-surface-700 dark:text-surface-0 shadow-lg
        p-maximized:w-screen p-maximized:h-screen p-maximized:top-0 p-maximized:start-0 p-maximized:max-h-full p-maximized:max-w-none p-maximized:rounded-none`,
  // `pe-` reserves the corner so a long title never slides under the absolutely
  // positioned close button (control height + symmetric inset on each side).
  header: `flex items-center justify-between shrink-0
        py-[calc(var(--density-cell-padding-y)*2)]
        ps-[calc(var(--density-cell-padding-x)*2)]
        pe-[calc(var(--density-control-height)+var(--density-cell-padding-y)*2)]`,
  title: `font-semibold text-xl`,
  // Absolutely anchored flush to the dialog's extreme top-right corner (relative
  // `root`), no gap. Holds the maximize + close controls when both are present.
  headerActions: `absolute top-0 end-0 z-10 flex items-center gap-1`,
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
