# Component styling patterns

Copy-paste templates for styling new components against the design token system.

## Pattern 1 — simple surface card

```vue
<template>
  <article class="bg-surface-raised border-border-default rounded-md border p-4">
    <h3 class="text-fg font-medium">Card title</h3>
    <p class="text-fg-muted text-sm">Description</p>
  </article>
</template>
```

What the tokens give you:

- `bg-surface-raised` — flips automatically light ↔ dark.
- `text-fg` / `text-fg-muted` — flip automatically.
- `border-border-default` — flips automatically.
- `rounded-md` — uses the `--radius-md` primitive.
- `p-4` — `--space-4` primitive.

No `dark:` variants required.

## Pattern 2 — interactive button (using project wrapper)

Always use `src/components/ui/Button.vue` for buttons. If you need a one-off:

```vue
<template>
  <button
    class="bg-interactive text-on-interactive hover:bg-interactive-hover active:bg-interactive-active focus-visible:ring-focus-ring rounded-md px-3 py-1.5 font-medium focus-visible:ring-2 focus-visible:ring-offset-2"
  >
    Action
  </button>
</template>
```

ESLint will warn (raw `<button>` outside UI-primitive directories) — promote to a wrapper or use the existing one.

## Pattern 3 — status badge

```vue
<template>
  <span
    :class="[
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      statusClass,
    ]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Status = "success" | "warning" | "danger" | "info";
const props = defineProps<{ status: Status }>();

const statusClass = computed(
  () =>
    ({
      success: "bg-success-subtle text-success",
      warning: "bg-warning-subtle text-warning",
      danger: "bg-danger-subtle text-danger",
      info: "bg-info-subtle text-info",
    })[props.status],
);
</script>
```

## Pattern 4 — density-aware row

```vue
<template>
  <div
    class="border-border-subtle flex items-center border-b px-3"
    :style="{
      height: 'var(--density-row-height)',
      fontSize: 'var(--density-font-size)',
      paddingLeft: 'var(--density-cell-padding-x)',
      paddingRight: 'var(--density-cell-padding-x)',
    }"
  >
    <slot />
  </div>
</template>
```

The row reads density tokens directly. No `data-density` attribute on the component — that goes on `<html>`.

## Pattern 5 — focused input

```vue
<template>
  <input
    type="text"
    class="bg-surface border-border-default text-fg focus-visible:ring-focus-ring rounded-md border px-3 py-1.5 focus-visible:ring-2 focus-visible:outline-none"
  />
</template>
```

ESLint will warn (raw `<input>`) — use `src/volt/Input.vue` instead.

## Pattern 6 — PrimeVue passthrough (PT) styling

For PrimeVue/Volt components, style via `:pt` using token-bridged Tailwind classes:

```vue
<template>
  <PvButton
    :pt="{
      root: {
        class:
          'bg-interactive text-on-interactive hover:bg-interactive-hover px-3 py-1.5 rounded-md',
      },
    }"
  >
    Action
  </PvButton>
</template>
```

The `cn()` helper at `src/utils/cn.ts` (which wraps `tailwind-merge`) is useful when composing dynamic class strings.

## Pattern 7 — CSS variable consumption (not Tailwind)

When you need a CSS value (not a Tailwind utility), reference the variable:

```css
.custom-shadow-card {
  background-color: var(--color-surface-overlay);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-panel-padding);
  transition: transform var(--motion-duration-normal) var(--motion-easing-standard);
}
```

This works in plain CSS, scoped Vue styles, or inline `style` bindings.

## Anti-patterns

```vue
<!-- ❌ Hardcoded hex — bypasses themes -->
<div class="bg-[#0f172a] text-[#f8fafc]">

<!-- ❌ Primitive in component code — locks the palette -->
<div class="bg-slate-50 dark:bg-slate-900">

<!-- ❌ Manual dark variant when semantic already flips -->
<div class="bg-surface-raised dark:bg-surface-raised">  <!-- redundant! -->

<!-- ❌ Inline arbitrary spacing -->
<div class="mt-[7px]">

<!-- ❌ Custom shadow with brand colors -->
<div class="shadow-[0_2px_8px_rgba(16,196,162,0.3)]">
```

```vue
<!-- ✓ Semantic — flips automatically -->
<div class="bg-surface-raised text-fg">

<!-- ✓ Standard spacing scale -->
<div class="mt-2">

<!-- ✓ Token-driven shadow -->
<div class="shadow-md">
```
