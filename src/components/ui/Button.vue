<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/utils/cn";

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
  secondary: "bg-surface-raised text-foreground border border-border hover:bg-surface-sunken",
  ghost: "bg-transparent text-foreground hover:bg-surface-raised",
  danger: "bg-danger text-white hover:opacity-90 active:opacity-80",
};

const sizeClass: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const classes = computed(() =>
  cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[props.variant],
    sizeClass[props.size],
  ),
);
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled">
    <slot />
  </button>
</template>
