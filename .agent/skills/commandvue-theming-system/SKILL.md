---
name: commandvue-theming-system
description: Use when working with design tokens, theming (light/dark/auto), density modes, theme variants, or any visual style change that should propagate across components.
when_to_use: |
  - Editing src/assets/styles/tokens.css
  - Editing src/assets/styles/main.css
  - Touching the useTheme composable, theme store, or theme registry
  - Adding or modifying built-in theme variants (Phase 3.3)
  - A component needs a color/spacing/typography value and you're tempted to hardcode it
  - Adding density-aware behavior to a component
  - Anyone says "theme", "tokens", "design tokens", "dark mode", "light mode", "density", "compact", "spacious"
---

# CommandVue Theming System

> **PrimeVue-first reminder:** components consume tokens via Tailwind utility classes (`bg-surface`, `text-fg`, `border-border-default`) or via PrimeVue/Volt PT passthroughs. Never hardcode hex/OKLCH/rgb values in components. See [`docs/design-tokens.md`](../../../docs/design-tokens.md) for the full catalogue.

## The three things to know first

1. **Three-layer architecture.** Primitive (raw scales) → Semantic (meaning-based) → Component (component-specific). Components consume semantic + component tokens. Themes override semantic + component tokens. **Primitives are off-limits to themes.**

2. **All tokens live in `src/assets/styles/tokens.css`.** Primitives go in `@theme { … }`. Semantic + component go in `:root { … }`. Dark overrides go in `html[data-theme="dark"] { … }`. Density overrides go in `[data-density="compact"] { … }` / `[data-density="spacious"] { … }`.

3. **Tailwind v4 `@theme` bridge in `main.css`** exposes semantic tokens as utility classes. A change to a semantic token in `tokens.css` propagates to every utility consumer without component edits.

## Token vocabulary cheat sheet

| Need                      | Use                                                  |
| ------------------------- | ---------------------------------------------------- |
| Page background           | `bg-surface`                                         |
| Card background           | `bg-surface-raised`                                  |
| Dialog/popover            | `bg-surface-overlay`                                 |
| Hovered row               | `bg-surface-sunken`                                  |
| Body text                 | `text-fg`                                            |
| Secondary text            | `text-fg-muted`                                      |
| Faint text                | `text-fg-faint`                                      |
| Disabled text             | `text-fg-disabled`                                   |
| Primary link/button fill  | `bg-interactive` (`text-on-interactive` on top)      |
| Hover state               | `bg-interactive-hover`                               |
| Subtle selected fill      | `bg-interactive-subtle`                              |
| Card border               | `border border-border-default`                       |
| Hairline divider          | `border-border-subtle`                               |
| Section separator         | `border-border-strong`                               |
| Success badge             | `bg-success-subtle text-success`                     |
| Warning badge             | `bg-warning-subtle text-warning`                     |
| Danger badge              | `bg-danger-subtle text-danger`                       |
| Focus ring                | `focus-visible:ring-2 focus-visible:ring-focus-ring` |
| Inter font (default body) | `font-sans`                                          |
| JetBrains Mono            | `font-mono`                                          |
| Fade-in animation         | `animate-fade-in`                                    |

## Density-aware components

When a component should respond to compact / comfortable / spacious modes, read `--density-*` CSS variables — never tie to a fixed size.

```vue
<template>
  <div
    class="border-border-subtle bg-surface border"
    :style="{ height: 'var(--density-row-height)', fontSize: 'var(--density-font-size)' }"
  >
    Row content
  </div>
</template>
```

For Tailwind-only consumers, the row-height tokens are available as inline `style` references. Density tokens are not (yet) bridged to Tailwind utilities — that's deliberate, because `[data-density]` is dynamic at runtime.

## The dark mode contract

- `useTheme()` (composable, `src/composables/useTheme.ts`) owns `data-theme` on `<html>`.
- Dark overrides live under `html[data-theme="dark"] { … }` in `tokens.css`. They override **semantic + component tokens**, never primitives.
- Tailwind's `dark:` variant resolves on `[data-theme="dark"]` (via `@custom-variant` in `main.css`). `dark:bg-surface-raised` works, but in most cases you don't need it because the semantic token already flips automatically.
- Phase 3.2 (this prompt) extends `useTheme()` with a three-way Light/Dark/Auto toggle and the anti-FOUC inline script.

## Common operations

### "I need a color and I'm tempted to hardcode it"

1. Is there an existing semantic token that fits? (`text-fg`, `bg-surface-raised`, etc.) → use it.
2. Is it status-related? Use `text-success` / `text-warning` / `text-danger`.
3. Is it interactive? Use `bg-interactive` / `bg-interactive-subtle`.
4. None fit? Open `tokens.css`, add a new semantic token referencing the appropriate primitive, bridge it in `main.css`, document it in `docs/design-tokens.md`.

### "I need a one-off accent for a specific use case"

Push back first — is it really one-off, or is it a recurring pattern? If recurring, add a semantic token. If truly one-off, use the primitive directly (`bg-blue-500`, `bg-violet-300`) and add an inline comment explaining why.

### "I need a custom shadow"

Use `shadow-sm` / `shadow-md` / `shadow-lg` / `shadow-xl`. They're neutral-tinted and work in both themes. Custom shadows tied to a brand color rarely look right in both modes.

### "I need to add a new theme variant"

That's Phase 3.3 work. The theme is a JSON file under `src/assets/themes/` that overrides 30–50 semantic + component tokens. See `docs/themes.md` (added in Phase 3.3) for the schema.

## Common mistakes

- **Hardcoding a hex in a component** — bypasses themes, breaks dark mode. Always reach through a token.
- **Referencing primitive tokens from components** — locks the palette. Use semantic tokens (`bg-surface-raised` not `bg-slate-50`).
- **Adding `dark:bg-X dark:text-Y` everywhere** — the semantic tokens already flip on dark mode. Adding `dark:` variants doubles the work and the maintenance.
- **Creating a new primitive scale "just for this theme"** — themes don't override primitives. Add new semantic or component tokens instead.
- **Using `data-density` per-component** — density is a global mode controlled by user preference on `<html>`. Reading `--density-*` is fine; writing `data-density` from a component is wrong.

## Reference files

- [`reference/token-categories.md`](./reference/token-categories.md) — quick map of all token categories and where they live.
- [`reference/component-styling-pattern.md`](./reference/component-styling-pattern.md) — copy-paste patterns for styling new components with tokens.

## References

- Source of truth: `src/assets/styles/tokens.css`
- Tailwind v4 bridge: `src/assets/styles/main.css`
- Full reference: [`docs/design-tokens.md`](../../../docs/design-tokens.md)
- Prompt 3 — design token foundation + Light/Dark/Auto toggle + 6 built-in themes
- Prompt 4 — in-app theme authoring (uses the foundation laid down here)
