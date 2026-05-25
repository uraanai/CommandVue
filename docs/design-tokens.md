# Design tokens

CommandVue's visual system rests on a three-layer design-token architecture. Tokens drive everything: colors, spacing, typography, radii, shadows, motion, z-index, density. Components reference tokens; tokens reference primitives; primitives are constants. Themes (Phase 3.3) override semantic and component tokens — never primitives.

This page is the human-readable reference. The canonical source is `src/assets/styles/tokens.css`.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — COMPONENT TOKENS                                            │
│ Component-specific names (--datatable-header-bg, --tooltip-bg, …)     │
│ Themes override these for component-level polish.                     │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ references
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 2 — SEMANTIC TOKENS                                             │
│ Names with meaning (--color-surface-base, --color-text-primary, …)    │
│ Themes override these for the bulk of visual change.                  │
│ Density tokens here too (--density-row-height, …).                    │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ references
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — PRIMITIVE TOKENS                                            │
│ Raw scales (--color-slate-500, --space-4, --text-sm, --radius-md, …)  │
│ Themes never override these — they are the foundation.                │
│ Defined inside `@theme { … }` so Tailwind generates utility classes.  │
└──────────────────────────────────────────────────────────────────────┘
```

**Why three layers?** A component that wants "the card background" should not reference `--color-slate-50` — that locks the palette and breaks themes. It should reference `--color-surface-raised`. A new theme can then swap `--color-surface-raised` to a different primitive (or a brand-new value) and every card on screen updates without component changes.

## Layer 1 — Primitive tokens

Raw scales. Never reference these from components.

### Color — neutral grayscale

`slate` palette, OKLCH color space, 11 stops (50…950). Mirrors Tailwind v4's `slate-*` defaults. Drives surfaces, borders, text.

```css
--color-slate-50    oklch(98.4% 0.003 247.858)
--color-slate-100   oklch(96.8% 0.007 247.896)
…
--color-slate-950   oklch(12.9% 0.042 264.695)
```

### Color — accent palettes

Six families: `blue`, `teal`, `green`, `amber`, `red`, `violet`. Each with 11 stops. Used for interactive states, status colors, and theme accents.

| Palette    | Role                                    |
| ---------- | --------------------------------------- |
| `blue-*`   | Default interactive accent, info status |
| `teal-*`   | Alternate accent (themes)               |
| `green-*`  | Success status                          |
| `amber-*`  | Warning status                          |
| `red-*`    | Danger status                           |
| `violet-*` | Alternate accent (themes)               |

### Color — backwards-compatibility aliases

`brand-*` aliases `slate-*` and `accent-*` aliases `blue-*`. These are the pre-Phase-3.1 names; many existing components use them as `bg-brand-100`, `text-accent-500`, etc. Don't introduce new usages — prefer semantic tokens.

### Color — PrimeVue surface palette

`--color-p-surface-0…950` is required by `tailwindcss-primeui` for Volt-vendored components. Mirrors `slate-*`. Volt files reference these via `bg-surface-0 dark:bg-surface-900`.

### Spacing

4px-base scale. `--space-0` through `--space-48`.

```
--space-0       0
--space-px      1px
--space-0_5     0.125rem
--space-1       0.25rem
--space-2       0.5rem
--space-3       0.75rem
--space-4       1rem
--space-5       1.25rem
--space-6       1.5rem
--space-8       2rem
--space-10      2.5rem
--space-12      3rem
--space-16      4rem
--space-20      5rem
--space-24      6rem
--space-32      8rem
--space-40      10rem
--space-48      12rem
```

Chrome heights: `--spacing-titlebar: 3rem`, `--spacing-statusbar: 1.75rem`. Surface these as Tailwind utilities `h-titlebar` / `h-statusbar`.

### Typography

```
--font-family-sans     Inter Variable + system fallbacks
--font-family-mono     ui-monospace + JetBrains Mono / Cascadia Code
--font-family-display  alias of sans (themes can override)

--text-xs              0.75rem
--text-sm              0.875rem
--text-base            1rem
--text-lg              1.125rem
--text-xl              1.25rem
--text-2xl             1.5rem
--text-3xl             1.875rem
--text-4xl             2.25rem

--font-weight-regular   400
--font-weight-medium    500
--font-weight-semibold  600
--font-weight-bold      700

--leading-tight    1.25
--leading-normal   1.5
--leading-relaxed  1.625
```

### Border radii

```
--radius-none   0
--radius-sm     0.125rem
--radius-md     0.25rem
--radius-lg     0.5rem
--radius-xl     0.75rem
--radius-2xl    1rem
--radius-full   9999px
```

### Shadows

Neutral, theme-compatible. `--shadow-none`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`. Values use neutral `rgb(0 0 0 / α)` so they look correct against both light and dark surfaces.

### Motion

```
--motion-duration-fast      100ms
--motion-duration-normal    150ms
--motion-duration-slow      250ms
--motion-easing-standard    cubic-bezier(0.2, 0, 0, 1)
--motion-easing-emphasized  cubic-bezier(0.3, 0, 0, 1)
```

Legacy aliases kept for existing utilities: `--duration-fast` / `--duration-normal` / `--duration-slow`, `--ease-out` / `--ease-in-out`.

### Z-index

Documented stacking order. Never invent new z values in components — pick the named layer.

```
--z-base             0
--z-dropdown         10
--z-sticky           20
--z-fixed            30
--z-modal-backdrop   40
--z-modal            50
--z-popover          60
--z-toast            70
--z-tooltip          80
```

## Layer 2 — Semantic tokens

Names with meaning. Reference primitives only. Light defaults in `:root`; dark overrides under `html[data-theme="dark"]`.

### Surface

| Token                     | Role                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| `--color-surface-base`    | The main canvas (body background).                                  |
| `--color-surface-raised`  | One step up — cards, panel headers, popover backgrounds.            |
| `--color-surface-overlay` | Modal/dialog surfaces — same elevation feel as raised but explicit. |
| `--color-surface-sunken`  | Wells, inset areas, hovered-row backgrounds.                        |

### Border

| Token                    | Role                                   |
| ------------------------ | -------------------------------------- |
| `--color-border-subtle`  | Hairline dividers within a surface.    |
| `--color-border-default` | Standard card / panel borders.         |
| `--color-border-strong`  | Section separators, emphatic dividers. |

### Text

| Token                    | Role                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `--color-text-primary`   | Body copy.                                                  |
| `--color-text-secondary` | Labels, secondary information.                              |
| `--color-text-tertiary`  | De-emphasized supporting text.                              |
| `--color-text-disabled`  | Disabled control labels.                                    |
| `--color-text-inverse`   | On dark fills in light theme; on light fills in dark theme. |

### Interactive

| Token                        | Role                                          |
| ---------------------------- | --------------------------------------------- |
| `--color-interactive`        | Default interactive (links, primary buttons). |
| `--color-interactive-hover`  | Hover state.                                  |
| `--color-interactive-active` | Pressed state.                                |
| `--color-interactive-subtle` | Subtle fill (selected row, badge background). |
| `--color-on-interactive`     | Text/icon on top of `interactive` fills.      |

### Status

`success`, `warning`, `danger`, `info` — each with a `-subtle` companion for low-emphasis backgrounds.

### Focus

`--color-focus-ring` + `--shadow-focus-ring` (`0 0 0 2px var(--color-focus-ring)`).

### Semantic spacing

```
--space-panel-padding   --space-4
--space-panel-gap       --space-2
--space-form-gap        --space-3
--space-inline-gap      --space-2
--space-section-gap     --space-6
```

### Density tokens

Six tokens, three states. The active state is controlled by the `data-density` attribute on `<html>`.

| Token                      | comfortable (default) | compact     | spacious      |
| -------------------------- | --------------------- | ----------- | ------------- |
| `--density-row-height`     | 2.25rem               | 1.75rem     | 2.75rem       |
| `--density-cell-padding-y` | `--space-2`           | `--space-1` | `--space-3`   |
| `--density-cell-padding-x` | `--space-3`           | `--space-2` | `--space-4`   |
| `--density-control-height` | 2rem                  | 1.625rem    | 2.5rem        |
| `--density-icon-size`      | 1rem                  | 0.875rem    | 1.125rem      |
| `--density-font-size`      | `--text-sm`           | `--text-xs` | `--text-base` |

Components that need to react to density read the `--density-*` tokens directly (or component tokens that reference them — DataTable does this).

## Layer 3 — Component tokens

Component-specific names. Reference semantic + density tokens. Themes override these for component-level polish.

### DataTable

```
--datatable-header-bg         var(--color-surface-raised)
--datatable-header-fg         var(--color-text-secondary)
--datatable-row-hover-bg      var(--color-surface-sunken)
--datatable-row-selected-bg   var(--color-interactive-subtle)
--datatable-border            var(--color-border-subtle)
--datatable-cell-padding-y    var(--density-cell-padding-y)
--datatable-cell-padding-x    var(--density-cell-padding-x)
--datatable-row-height        var(--density-row-height)
--datatable-font-size         var(--density-font-size)
```

### DockPanel

```
--dockpanel-bg                var(--color-surface-base)
--dockpanel-tab-bg            var(--color-surface-raised)
--dockpanel-tab-active-bg     var(--color-surface-base)
--dockpanel-tab-border        var(--color-border-subtle)
--dockpanel-padding           var(--space-panel-padding)
```

### MenuBar / StatusBar / Dialog / Tooltip / Button

See `src/assets/styles/tokens.css` for the full set.

## Usage rules

1. **Components never reference primitive tokens directly.** Use semantic or component tokens.
2. **Themes never override primitive tokens.** They override semantic and component tokens.
3. **Don't hardcode hex / OKLCH / rgb values in components.** Always reach through a token.
4. **Density is controlled by `data-density` on `<html>`** — never per-component. The three values are `compact`, `comfortable`, `spacious`.
5. **Dark theme is controlled by `data-theme="dark"` on `<html>`** — managed by `useTheme()`. Phase 3.2 ships the full Light/Dark/Auto toggle.

## Tailwind class examples

Most semantic tokens are exposed as Tailwind v4 utilities via the `@theme` bridge in `main.css`.

```vue
<!-- Surface -->
<div class="bg-surface text-fg">Body background</div>
<div class="bg-surface-raised text-fg">Card</div>
<div class="bg-surface-sunken">Hovered row</div>

<!-- Borders -->
<div class="border-border-default rounded-md border">Card</div>
<div class="divide-border-subtle divide-y">List</div>

<!-- Text -->
<p class="text-fg">Body</p>
<p class="text-fg-muted text-xs">Label</p>
<p class="text-fg-faint">Hint</p>

<!-- Interactive -->
<button class="bg-interactive hover:bg-interactive-hover text-white">Primary</button>
<span class="bg-interactive-subtle text-interactive">Selected badge</span>

<!-- Status -->
<span class="bg-success-subtle text-success">OK</span>
<span class="bg-warning-subtle text-warning">Caution</span>
<span class="bg-danger-subtle text-danger">Error</span>

<!-- Focus -->
<button class="focus-visible:ring-focus-ring focus-visible:ring-2">Action</button>

<!-- Animation -->
<div class="animate-fade-in">Lazy-mounted content</div>
```

Primitive Tailwind utilities like `bg-slate-50`, `bg-blue-600`, `bg-brand-100`, `bg-accent-500` still work for backwards compatibility — but avoid them in new code unless you specifically need to lock in a primitive value.

## Adding a new token

1. **Decide which layer.**
   - Raw value, no existing scale fits? Add to Layer 1 (`@theme { … }`) — but extend the scale, don't add one-off names.
   - Component-specific behavior? Add to Layer 3.
   - Otherwise: Layer 2 (semantic).
2. **Pick a name** following the convention `--{category}-{element}-{variant?}` (e.g. `--color-surface-overlay`, `--datatable-row-height`).
3. **Reference primitives only from Layer 2.** Reference primitives + semantic + density from Layer 3.
4. **If the token should be exposed as a Tailwind utility**, add a bridge entry in `main.css`'s `@theme { … }` block.
5. **Document it here** in the relevant layer's table.
6. **If dark-theme overrides apply**, add them to `html[data-theme="dark"]` in `tokens.css`.

## Migration guidance

When you encounter a hardcoded value in a component:

- `bg-[#0f172a]` → `bg-surface-base` (or pick the matching semantic surface)
- `text-[#475569]` → `text-fg-muted`
- `border-[#e2e8f0]` → `border-border-default`
- `bg-slate-50` → `bg-surface-raised` (or `bg-slate-50` for backwards compatibility — see "do I need a literal slate value here?")
- `transition-duration: 200ms` → `transition-duration: var(--motion-duration-normal)`
- Inline shadows → reference `--shadow-md` etc.

Use judgment. The goal is "no obviously hardcoded values," not "every literal is a token." A `mt-2` is fine; a `mt-[7px]` should become `--space-N`-aligned.

## Density mode quick reference

```html
<!-- Set on <html> by user preference / workspace default -->
<html data-density="compact">
  …
</html>
<html data-density="comfortable">
  …
</html>
<!-- default -->
<html data-density="spacious">
  …
</html>
```

The three modes affect every component that consumes `--density-*` tokens. DataTable in particular has all six density tokens wired through.

## References

- Source of truth: `src/assets/styles/tokens.css`
- Tailwind v4 bridge: `src/assets/styles/main.css`
- Tailwind v4 docs (OKLCH defaults): https://tailwindcss.com/docs/colors
- Phase 3.2 (this prompt) — Light/Dark/Auto toggle hooks into `data-theme`
- Phase 3.3 (this prompt) — six built-in theme variants extend the semantic + component layers
- `.agent/skills/commandvue-theming-system` — agent skill for working in this area
