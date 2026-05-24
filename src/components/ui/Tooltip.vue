<script setup lang="ts">
import { Tooltip as VTooltip } from "floating-vue";
import "floating-vue/dist/style.css";

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
</script>

<template>
  <VTooltip
    :triggers="['hover', 'focus']"
    :placement="placement"
    :delay="delay"
    :disabled="disabled"
    :distance="6"
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
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
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
