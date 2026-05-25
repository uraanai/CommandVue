<script setup lang="ts">
import PvButton from "primevue/button";
import { computed } from "vue";

import { cn } from "@/utils/cn";

/**
 * IconButton — icon-only Button wrapper over PrimeVue Button.
 * Always sets `aria-label` from the required `label` prop.
 */
type Variant = "ghost" | "solid";
type Size = "sm" | "md" | "lg";

interface Props {
  label: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "ghost",
  size: "md",
  disabled: false,
});

const variantClass: Record<Variant, string> = {
  ghost: "bg-transparent text-foreground hover:bg-surface-raised",
  solid: "bg-surface-raised text-foreground border border-border hover:bg-surface-sunken",
};

// `sm` uses 5px padding (not p-1 = 4px) so the total height — 5 + 14 + 5 = 24px
// — matches the regular `Button` size="sm" (py-1 + text-xs = 8 + 16 = 24px),
// keeping IconButtons aligned next to text Buttons in the chrome bar.
const sizeClass: Record<Size, string> = {
  sm: "p-[5px] [&_svg]:size-3.5",
  md: "p-1.5 [&_svg]:size-4",
  lg: "p-2 [&_svg]:size-5",
};

const rootClass = computed(() =>
  cn(
    "inline-flex items-center justify-center rounded-md transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[props.variant],
    sizeClass[props.size],
  ),
);
</script>

<template>
  <PvButton
    type="button"
    :disabled="disabled"
    :aria-label="label"
    :pt="{
      root: { class: rootClass },
      label: { class: 'inline-flex items-center' },
    }"
  >
    <slot />
  </PvButton>
</template>
