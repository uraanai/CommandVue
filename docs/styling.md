# Styling

CommandVue uses Tailwind CSS v4 plus PrimeVue in **unstyled** mode.
Tailwind owns layout / spacing / colors; PrimeVue contributes only the
component logic (focus traps, ARIA, etc.) — every visual surface comes
from our Tailwind classes.

## Where styling lives

```
src/assets/styles/
  tokens.css       Dark-theme runtime overrides (light is in @theme)
  main.css         Tailwind directive + @theme block + base layer
  dockview.css     Dockview's --dv-* variables remapped to project tokens
```

`main.css` is the only file `main.ts` imports for styles. It chain-
imports `tokens.css` and `dockview.css`.

## The `@theme` block

Tailwind v4 generates utility classes from a single `@theme { ... }`
block. We define the full palette there:

```css
@theme {
  --color-brand-50: #f8fafc;
  --color-brand-100: #f1f5f9;
  /* ... */
  --color-accent-500: #3b82f6;

  --color-surface: #ffffff;
  --color-surface-raised: #f8fafc;
  --color-surface-sunken: #f1f5f9;
  --color-foreground: #0f172a;
  --color-muted: #475569;
  --color-border: #e2e8f0;

  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  /* ... */
}
```

A `--color-foo` token automatically generates `bg-foo`, `text-foo`,
`border-foo`, `outline-foo`, `ring-foo`, etc.

## Light → dark cascade

`html[data-theme="dark"]` overrides specific runtime tokens in
`tokens.css`. The brand and accent palettes stay constant; only
surface / text / border colors flip. The `data-theme` attribute is
managed by `useTheme()` (built on `@vueuse/core`'s `useDark`,
persisted to localStorage).

```css
html[data-theme="dark"] {
  --color-surface: #0b1120;
  --color-surface-raised: #0f172a;
  --color-surface-sunken: #050810;
  --color-foreground: #f8fafc;
  --color-muted: #cbd5e1;
  --color-border: #1e293b;
}
```

The selector specificity (`html[data-theme="dark"]` = 0,1,1) beats
`@theme`'s `:root` (0,1,0) regardless of `@import` order, which is
why we don't need to worry about which file is imported when.

## Tailwind's `dark:` variant

We map Tailwind's `dark:` variant to the same attribute via
`@custom-variant`:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

So `class="bg-white dark:bg-brand-900"` works as expected — but using
semantic tokens like `bg-surface` is usually nicer because they flip
automatically through the CSS-variable cascade.

## `cn()` for dynamic classes

`src/utils/cn.ts` exports a helper that combines `clsx` (truthy
filtering, nested arrays) with `tailwind-merge` (last-write-wins on
conflicting utilities). Use it whenever class composition involves a
condition:

```vue
<script setup lang="ts">
import { cn } from "@/utils/cn";

const buttonClass = computed(() =>
  cn(
    "inline-flex items-center rounded-md font-medium",
    isActive.value ? "bg-accent-600 text-white" : "bg-surface-raised text-muted",
    disabled && "cursor-not-allowed opacity-50",
  ),
);
</script>
```

Direct string concatenation works too, but `cn()` resolves cases like
`px-2 px-4` → `px-4` correctly.

## PrimeVue's passthrough (`pt`) API

PrimeVue is registered with `{ unstyled: true }`, so each component
ships without baked-in styles. We wrap the ones we use under
`src/components/ui/*` (`Dialog`, `Toast`, etc.) and inject classes via
the `pt` prop:

```vue
<PvDialog
  :visible="visible"
  :pt="{
    root: { class: cn('rounded-lg border border-border bg-surface-raised shadow-2xl') },
    mask: { class: 'fixed inset-0 z-50 bg-brand-950/70 backdrop-blur-sm' },
    header: { class: 'flex items-center justify-between border-b border-border px-4 py-3' },
    content: { class: 'px-4 py-4 text-sm text-foreground' },
  }"
/>
```

Restyling a primitive means editing the `pt` object in one place —
that's the whole purpose of the unstyled-mode + wrapper pattern.

## Conventions

- **Layout / spacing → Tailwind utilities.** No CSS modules, no
  scoped styles for these concerns.
- **Brand colors → CSS variables in tokens.css.** Don't hardcode hex
  values in components. See `docs/theming.md` for the override
  walkthrough.
- **Class composition → `cn()`.** Especially when conditions are
  involved.
- **Component styling → `pt` on the wrapper.** Not inline overrides
  scattered across consumer call-sites.

## When to write CSS files

Almost never. The only CSS files in `src/assets/styles/` are
`tokens.css` (dark theme), `main.css` (Tailwind directive + tokens),
and `dockview.css` (the third-party variable bridge). Anything else
belongs in a Tailwind utility class or a `pt` block.
