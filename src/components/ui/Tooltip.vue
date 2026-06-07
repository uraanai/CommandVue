<script setup lang="ts">
import { Tooltip as VTooltip } from "floating-vue";
import "floating-vue/dist/style.css";
import { ref, type Ref } from "vue";

import { type ElementLike, useOverlayTarget } from "@/composables/useOverlayTarget";

/**
 * Tooltip — thin wrapper over `floating-vue`'s `Tooltip` component.
 *
 * Specialized hand-rolled wrapper under ADR 0002 Option C. Replaces the
 * earlier native-`title` placeholder; uses floating-ui under the hood for
 * placement, collision avoidance, arrow positioning, and ARIA. Keeps the
 * `label` prop the placeholder exposed so existing consumers can swap without
 * code changes.
 *
 * Surface:
 *   - `label` — string shown in the tooltip.
 *   - `placement?` — floating-ui placement; default `top`.
 *   - `delay?` — open/close delay in ms; default `200`.
 *   - default slot — the trigger element.
 *
 * Styling is driven by floating-vue's themable CSS variables, scoped to the
 * `--cv-tooltip-*` overrides at the bottom of this file so theming flows from
 * the project's surface / foreground / border tokens.
 */

interface Props {
  label: string;
  placement?:
    | "auto"
    | "auto-start"
    | "auto-end"
    | "top"
    | "top-start"
    | "top-end"
    | "right"
    | "right-start"
    | "right-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "left-start"
    | "left-end";
  delay?: number;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  placement: "top",
  delay: 200,
  disabled: false,
});

// Pop-out: floating-vue teleports the popper to its `container` (default
// `"body"` → the OPENER document). The `<VTooltip>` root (`.v-popper` div) moves
// with the panel into its own window, so bind `:container` to that element's
// owning-window body and re-resolve on show. floating-vue's `container` watcher
// re-teleports the live popper when the bound element changes, so resolving at
// show time relocates the bubble into the correct window.
const tooltipRef = ref<{ $el?: unknown } | null>(null);
const { target: overlayContainer, resolve: resolveContainer } = useOverlayTarget(
  tooltipRef as Ref<ElementLike>,
);
</script>

<template>
  <VTooltip
    ref="tooltipRef"
    :triggers="['hover', 'focus']"
    :placement="placement"
    :delay="delay"
    :disabled="disabled"
    :distance="6"
    :container="overlayContainer"
    @apply-show="resolveContainer"
  >
    <slot />
    <template #popper>
      <span class="cv-tooltip-content">{{ label }}</span>
    </template>
  </VTooltip>
</template>

<style>
/* Theme floating-vue's default popper to match CommandVue's surface tokens.
 * The library uses --vp-color-* CSS variables; we override the few that paint
 * the bubble. */
.v-popper--theme-tooltip .v-popper__inner {
  background-color: var(--color-surface-raised);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1rem;
  box-shadow: var(--shadow-md);
}
.v-popper--theme-tooltip .v-popper__arrow-outer {
  border-color: var(--color-surface-raised);
}
.v-popper--theme-tooltip .v-popper__arrow-inner {
  visibility: hidden;
}
.cv-tooltip-content {
  display: inline-block;
  white-space: nowrap;
}
</style>
