# Theming

CommandVue ships with **neutral slate-tinted defaults** so downstream
forks can apply their own brand by editing a single block. This guide
walks through the override.

## Where to edit

| File                                                       | What it controls                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/assets/styles/main.css` (`@theme` block)              | Light-theme defaults + the immutable palette (brand, accent, status) |
| `src/assets/styles/tokens.css` (`html[data-theme="dark"]`) | Dark-theme runtime overrides for surface / text / border tokens      |

For most rebrands you only edit the `@theme` block.

## Token vocabulary

```
Palette (fixed across themes)
  --color-brand-50 ... --color-brand-950   slate / neutral
  --color-accent-50 ... --color-accent-900  blue (default)

Semantic surfaces (flipped per theme)
  --color-surface         page background
  --color-surface-raised  cards, headers, hovered chrome
  --color-surface-sunken  inputs, recessed panels, table rows
  --color-foreground      primary text
  --color-muted           secondary text
  --color-faint           tertiary / hint text
  --color-border          panel separators
  --color-border-strong   emphasised separators

Status
  --color-success, --color-warning, --color-danger, --color-info

Typography
  --font-sans   "Inter Variable" by default
  --font-mono   ui-monospace stack

Motion / chrome
  --duration-fast / -normal / -slow
  --ease-out, --ease-in-out
  --spacing-titlebar (3rem), --spacing-statusbar (1.75rem)
```

Tailwind picks each `--color-*` up as a utility (e.g. `bg-surface`,
`text-foreground`, `border-border-strong`).

## Rebranding example — Uraan AI navy / teal

1. Replace the accent palette in `main.css`:

   ```css
   @theme {
     /* ... unchanged neutral palette ... */

     --color-accent-50: #f0fbf7;
     --color-accent-100: #c4f2e4;
     --color-accent-200: #99e9d1;
     --color-accent-300: #6edebc;
     --color-accent-400: #3fd2a8;
     --color-accent-500: #10c4a2;
     --color-accent-600: #0aa78a;
     --color-accent-700: #088971;
     --color-accent-800: #066b58;
     --color-accent-900: #034d40;
   }
   ```

2. Tighten the light-theme surfaces toward navy:

   ```css
   @theme {
     --color-surface: #ffffff;
     --color-surface-raised: #f3f6fb;
     --color-surface-sunken: #e8edf5;
     --color-foreground: #0b1120; /* navy */
     --color-muted: #475569;
     --color-border: #d6dde9;
   }
   ```

3. Adjust the dark-theme override in `tokens.css`:

   ```css
   html[data-theme="dark"] {
     --color-surface: #0b1120; /* navy base */
     --color-surface-raised: #11182a;
     --color-surface-sunken: #060a16;
     --color-foreground: #e2e8f0;
     --color-muted: #94a3b8;
     --color-border: #1e293b;
   }
   ```

That's it. No component code changes. The dock chrome (`dockview.css`),
buttons (`Button.vue`), modals (`Dialog.vue`), and everything in the
panels picks up the new palette through the CSS-variable cascade.

## Light / dark toggle

`useTheme()` (in `src/composables/useTheme.ts`) wraps `@vueuse/core`'s
`useDark` with these options:

- Storage key: `commandvue:theme` in localStorage.
- Selector: `html`.
- Attribute: `data-theme="dark"` or `"light"`.

The default value follows `prefers-color-scheme` until the user makes
an explicit choice. The TitleBar's sun/moon button calls
`useTheme().toggle()`.

To force a theme on first paint (e.g. in a SaaS context where the
backend knows the user's preference), set the attribute in
`index.html` before Vite's bundle loads:

```html
<html lang="en" data-theme="dark"></html>
```

## Font swap

```css
@theme {
  --font-sans: "JetBrains Mono Variable", ui-monospace, monospace;
}
```

If you swap to a non-Fontsource font, drop the `@fontsource-variable/inter`
import in `main.ts` and either link the font from `<head>` or self-host
under `public/fonts/`.

## Brand colors at a glance

The neutral defaults are good for a hand-off — they read as
"professional dashboard". For Uraan AI's branded variant, the codified
recipe lives in `CLAUDE.md`'s **Brand colors** section:

```
Navy: #0B1120
Teal: #10C4A2
```

Drop those into the `@theme` block as `--color-surface` (navy) and
`--color-accent-500` (teal), with derived shades for the rest of the
accent palette.

## Theme Studio information architecture

The **Theme Studio** panel (`src/components/panels/ThemeStudioPanel.vue`) is the
runtime authoring surface. Its layout is locked (Phase C6):

- The **common band** (Start-from · Name · Description) is pinned at the top,
  **outside** the tabs — it applies to the whole theme.
- The controls pane is one **scrollable `ui/Tabs` strip** with five locked tabs,
  in order: **Generate · Tokens · Typography · Panels & Chrome · Effects**
  (`src/components/panels/theme-studio/studioTabs.ts`, guarded by a drift test).
  `Generate` holds the high-level generator inputs; the other four are per-area
  editors (the not-yet-built ones render a "lands in Cx" placeholder).
- A draggable **Splitter** divides the controls pane from the **live preview**
  pane. The preview stays outside the tabs and persists across tab switches;
  switching tabs never re-pushes the app theme. Below ~560px the Splitter stacks
  vertically (controls above preview).

**Density resolution.** The Studio's editor chrome is pinned to a fixed
`comfortable` density regardless of the theme being authored — only the
**live-preview pane** reflects the authored density. A `[data-density="comfortable"]`
wrapper around the controls, plus the matching `[data-density="comfortable"]`
block in `tokens.css`, makes that wrapper win the cascade over an inherited
`<html data-density="…">`, while the preview wrapper binds `:data-density` to the
authored value. So changing the authored density visibly tightens the preview
without re-spacing the editor.

## A note on `dark:` Tailwind utilities

We mapped `dark:` to the `data-theme="dark"` attribute via
`@custom-variant` in `main.css`. So `class="bg-white dark:bg-brand-900"`
works exactly as the Tailwind docs describe — it just runs off our
selector instead of `prefers-color-scheme`.

The semantic tokens (`bg-surface`, etc.) are usually preferable
because they avoid duplicate class declarations and flip uniformly.
