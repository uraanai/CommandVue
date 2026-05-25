# Token categories — quick map

A flat reference for "what kind of token is this, where does it live."

## By category

| Category                                                          | Layer             | Where defined                                                   |
| ----------------------------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| Slate scale (neutral)                                             | Primitive         | `tokens.css` → `@theme`                                         |
| Blue / Teal / Green / Amber / Red / Violet scales                 | Primitive         | `tokens.css` → `@theme`                                         |
| `brand-*` aliases (= slate)                                       | Primitive (alias) | `tokens.css` → `@theme`                                         |
| `accent-*` aliases (= blue)                                       | Primitive (alias) | `tokens.css` → `@theme`                                         |
| `p-surface-*` (PrimeVue/Volt requirement)                         | Primitive         | `tokens.css` → `@theme` + `:root` in `main.css`                 |
| Spacing scale (`--space-*`)                                       | Primitive         | `tokens.css` → `@theme`                                         |
| Chrome spacing (`--spacing-titlebar`, `--spacing-statusbar`)      | Primitive         | `tokens.css` → `@theme`                                         |
| Typography scale (`--text-*`, `--font-weight-*`, `--leading-*`)   | Primitive         | `tokens.css` → `@theme`                                         |
| Font families                                                     | Primitive         | `tokens.css` → `@theme`                                         |
| Border radii (`--radius-*`)                                       | Primitive         | `tokens.css` → `@theme`                                         |
| Shadows (`--shadow-*`)                                            | Primitive         | `tokens.css` → `@theme`                                         |
| Motion (`--motion-duration-*`, `--motion-easing-*`)               | Primitive         | `tokens.css` → `@theme`                                         |
| Z-index (`--z-*`)                                                 | Primitive         | `tokens.css` → `@theme`                                         |
| Surface (`--color-surface-base/raised/overlay/sunken`)            | Semantic          | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Border (`--color-border-subtle/default/strong`)                   | Semantic          | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Text (`--color-text-primary/secondary/tertiary/disabled/inverse`) | Semantic          | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Interactive (`--color-interactive*`)                              | Semantic          | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Status (`--color-status-*`)                                       | Semantic          | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Focus (`--color-focus-ring`, `--shadow-focus-ring`)               | Semantic          | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Semantic spacing (`--space-panel-padding`, etc.)                  | Semantic          | `tokens.css` → `:root`                                          |
| Semantic typography (`--font-family-body`)                        | Semantic          | `tokens.css` → `:root`                                          |
| Density (`--density-*`)                                           | Semantic          | `tokens.css` → `:root` + `[data-density="*"]`                   |
| DataTable component tokens                                        | Component         | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| DockPanel component tokens                                        | Component         | `tokens.css` → `:root`                                          |
| MenuBar component tokens                                          | Component         | `tokens.css` → `:root`                                          |
| StatusBar component tokens                                        | Component         | `tokens.css` → `:root`                                          |
| Dialog component tokens                                           | Component         | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Tooltip component tokens                                          | Component         | `tokens.css` → `:root` (+ `[data-theme="dark"]`)                |
| Button component tokens                                           | Component         | `tokens.css` → `:root`                                          |
| Tailwind utility bridge                                           | Bridge            | `main.css` → `@theme` (references semantic tokens via `var(…)`) |
| PrimeVue runtime palette (`--p-surface-*`, `--p-primary-*`)       | Plumbing          | `main.css` → `:root`                                            |

## By naming convention

```
--color-*       — colors of any kind
--space-*       — spacing scale (primitive) + semantic spacing aliases
--spacing-*     — Tailwind-named spacing tokens (legacy compat)
--text-*        — font sizes
--font-family-* — font stacks
--font-weight-* — weights
--leading-*     — line heights
--radius-*      — border radii
--shadow-*      — box-shadow values
--motion-*      — durations + easings (primitive)
--duration-*    — durations (legacy alias)
--ease-*        — easings (legacy alias)
--z-*           — z-index scale
--density-*     — density-driven tokens (compact/comfortable/spacious)
--{component}-* — component tokens (datatable-, dockpanel-, menubar-, …)
```

## Override scope

Where each `var(…)` resolves depends on the closest scope that defines it.

```
html[data-theme="dark"] [data-density="compact"] …
       │                      │
       │                      └── density tokens (compact set)
       │
       └── dark semantic + component overrides

:root                                   ← light defaults
@theme                                  ← primitives (constant)
```
