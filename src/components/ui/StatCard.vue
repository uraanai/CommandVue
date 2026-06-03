<script setup lang="ts">
import { computed } from "vue";

/**
 * StatCard — a configurable dashboard KPI / metric tile: a label, a big value,
 * and an optional trend delta. The color treatment is fully prop-driven so the
 * same component covers every dashboard card style without re-styling at the
 * call site:
 *
 *   <StatCard label="Active units" :value="128" delta="+12%" trend="up"
 *             status="success" variant="accent-left" />
 *
 * `status` picks the color from the `--color-status-*` theme tokens (so cards
 * recolor with the theme); `neutral` uses the surface/border tokens instead.
 * `variant` decides where/how that color is applied:
 *   - accent-left / accent-top / accent-bottom — a colored bar on that edge
 *   - border  — a colored hairline on all four sides
 *   - filled  — a translucent status-tinted background (text stays readable)
 *   - plain   — no surface color at all; only the value + delta take the color
 */
type StatStatus = "success" | "info" | "warning" | "danger" | "neutral";
type StatVariant = "accent-left" | "accent-top" | "accent-bottom" | "border" | "filled" | "plain";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    delta?: string;
    trend?: "up" | "down";
    status?: StatStatus;
    variant?: StatVariant;
  }>(),
  { status: "neutral", variant: "accent-left", delta: undefined, trend: undefined },
);

/** Solid status color (accent / border / value), with a neutral fallback. */
const accent = computed(() =>
  props.status === "neutral" ? "var(--color-border-strong)" : `var(--color-status-${props.status})`,
);
/** Translucent tint for the `filled` background, with a neutral fallback. */
const tint = computed(() =>
  props.status === "neutral"
    ? "var(--color-surface-sunken)"
    : `var(--color-status-${props.status}-subtle)`,
);

const rootStyle = computed((): Record<string, string> => {
  switch (props.variant) {
    case "accent-left":
      return { borderInlineStartWidth: "4px", borderInlineStartColor: accent.value };
    case "accent-top":
      return { borderTopWidth: "4px", borderTopColor: accent.value };
    case "accent-bottom":
      return { borderBottomWidth: "4px", borderBottomColor: accent.value };
    case "border":
      return { borderColor: accent.value };
    case "filled":
      return { background: tint.value, borderColor: accent.value };
    case "plain":
    default:
      return {};
  }
});

/** In `plain` the value carries the color; elsewhere it stays foreground. */
const valueStyle = computed(
  (): Record<string, string> => (props.variant === "plain" ? { color: accent.value } : {}),
);
const deltaStyle = computed((): Record<string, string> => ({ color: accent.value }));
</script>

<template>
  <div
    class="border-border bg-surface relative overflow-hidden rounded-lg border p-3"
    :style="rootStyle"
  >
    <div class="text-muted text-xs">{{ label }}</div>
    <div class="text-foreground mt-1 text-2xl font-semibold tabular-nums" :style="valueStyle">
      {{ value }}
    </div>
    <div
      v-if="delta"
      class="mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums"
      :style="deltaStyle"
    >
      <span aria-hidden="true">{{ trend === "down" ? "▼" : "▲" }}</span
      >{{ delta }}
    </div>
  </div>
</template>
