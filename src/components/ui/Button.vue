<script setup lang="ts">
import PvButton from "primevue/button";
import { computed } from "vue";

import { cn } from "@/utils/cn";

/**
 * Button — thin wrapper over PrimeVue Button with our project token palette
 * applied via the unstyled-mode passthrough (`pt`). The public API is
 * preserved from the previous hand-rolled version so callers don't change.
 *
 * Variant mapping (project → PrimeVue Button):
 *   primary   → severity primary  + filled
 *   secondary → severity secondary + outlined
 *   ghost     → variant text
 *   danger    → severity danger + filled
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "md",
  disabled: false,
  type: "button",
});

const variantClass: Record<Variant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-500 active:bg-accent-700",
  secondary: "bg-surface-raised text-foreground border-border hover:bg-surface-sunken",
  ghost: "bg-transparent text-foreground hover:bg-surface-raised",
  danger: "bg-danger text-white hover:opacity-90 active:opacity-80",
};

// Density-aware heights via the per-size `--button-height-*` tokens, which derive
// from `--density-control-height` with fixed offsets (tokens.css) — so a compact app
// gets compact buttons and a spacious one taller buttons, while `sm < md < lg` stays
// distinct in EVERY density (the offsets keep them apart; the earlier bug where `sm`
// matched `md` came from all sizes sharing the single control-height token). Height
// is the `min-h` floor; horizontal padding + font stay per-size for the size character.
const sizeClass: Record<Size, string> = {
  sm: "min-h-[var(--button-height-sm)] px-2.5 text-xs",
  md: "min-h-[var(--button-height-md)] px-3.5 text-sm",
  lg: "min-h-[var(--button-height-lg)] px-5 text-base",
};

const rootClass = computed(() =>
  cn(
    // A 1px transparent border on every variant so the bordered `secondary`
    // isn't 2px taller than the others (auto-height + border-box adds a real
    // border's height; the transparent border equalizes it).
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent font-medium",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[props.variant],
    sizeClass[props.size],
  ),
);
</script>

<template>
  <PvButton
    :type="type"
    :disabled="disabled"
    :pt="{
      root: { class: rootClass },
      label: { class: 'inline-flex items-center gap-1.5' },
    }"
  >
    <slot />
  </PvButton>
</template>
