# Live-app fixes after the Volt dialog migration (PR #76)

- **Date:** 2026-05-25
- **PR being extended:** #76 (`refactor(dialogs)`)
- **Status:** Approved, in progress

## Context

After Playwright-driven smoke testing of PR #76, five UI defects surfaced that the static gates didn't catch:

1. Modal mask applies a dim + blur to the entire viewport by default. CommandVue is a map app — users need to keep the map visible while dialogs are open.
2. Dialog body appears partially transparent in some surfaces.
3. The View → Add Component nested submenu opens _at_ the menubar level instead of beside its parent menuitem, hiding the rest of the parent dropdown.
4. The Dockview tab header always renders dark even when the theme toggle is set to light.
5. A general request to audit other surfaces and fix any visual issue exposed by the Volt swap.

## Decisions

### 1. Default mask: no dim, no blur

Volt's `Dialog.vue` gains a `blurBackdrop?: boolean` prop, default `false`.

- `blurBackdrop = false` (default): mask is `p-modal:fixed p-modal:inset-0`. Fully transparent. Still catches the click-outside event but the map stays at 100% color.
- `blurBackdrop = true`: mask becomes `p-modal:fixed p-modal:inset-0 p-modal:bg-brand-950/60 p-modal:backdrop-blur-sm`. For modals where focus is wanted.

This is a small, additive divergence from upstream Volt. Documented in the file header. Existing consumers don't need to pass anything — they get the new no-dim default automatically.

### 2. Dialog body opacity

Hypothesis: `bg-surface-0` resolves to a real color via `tailwindcss-primeui`'s `colors.css`, but one of the PT slots (`content` / `header`) doesn't paint its own background, so layered transparency can show through.

Action: investigate via Playwright (`getComputedStyle` on root + header + content), then patch whichever slot lacks a solid bg. Decision deferred to investigation.

### 3. Menubar nested submenu positioning

Root cause: `:pt={ submenu: { class: 'absolute top-full left-0 ...' }}` in `src/components/layout/MenuBar.vue` applies to every submenu — first-level dropdowns AND nested fly-outs — forcing them all to position at top:0 left:0 of their immediate parent.

Fix: drop `top-full left-0` from the PT class so PrimeVue's default-styled positioning handles both root and nested cases. If PrimeVue's default look isn't right, add a global rule in `main.css` targeting nested submenus only:

```css
[data-pc-section="submenu"] [data-pc-section="submenu"] {
  left: 100%;
  top: 0;
}
```

### 4. Dockview tab header theme

Dockview-vue ships its own CSS variables (`--dv-tab-header-background-color`, etc.). Currently we apply a fixed theme; toggling CommandVue's `data-theme` attribute doesn't propagate.

Fix: override Dockview's CSS variables in our existing token files so they bind to project tokens. Light-theme defaults go in `main.css`'s `@theme` block (or its `:root` declarations); dark-theme overrides go in `tokens.css`'s `html[data-theme="dark"]` block. Same pattern the rest of the project uses for surface / foreground / border.

Concretely:

- `--dv-tab-header-background-color` → `var(--color-surface-raised)`
- `--dv-tab-active-background-color` → `var(--color-surface)`
- `--dv-tab-divider-color` → `var(--color-border)`
- `--dv-tab-foreground-color` → `var(--color-muted)`
- `--dv-tab-active-foreground-color` → `var(--color-foreground)`

Exact variable list confirmed against Dockview's published variable names during implementation.

### 5. General audit

After 1–4: walk every dialog / menu / panel surface with Playwright. Note any anomaly. Apply small targeted fixes. Capture before/after screenshots.

Surfaces to re-check at minimum: Manage Workspaces, Manage Layouts, Manage Presets, Apply Preset, Edit Preset, Save Layout As, Unsaved Changes; File / Edit / View dropdowns including View → Add Component nested submenu; Workspace switcher dropdown; Components Panel (tile grid); Symbology Panel (Fieldset + Tag) in both light and dark themes.

## Execution order

1. Fix 1 (mask opt-in) — definite root cause, smallest change.
2. Fix 3 (nested submenu) — definite root cause, drop the over-eager PT positioning.
3. Fix 4 (Dockview theming) — bind variables to project tokens.
4. Fix 2 (dialog opacity) — investigate first with Playwright, then patch.
5. Fix 5 (general audit) — Playwright walk-through.
6. Quality gates (lint / type-check / tests / spell / build).
7. Single commit + push to PR #76.

## Non-goals

- Not changing dialog widths beyond what was already set.
- Not migrating panels (PR 4) — that's a separate phase.
- Not bringing Tooltip into the audit unless something visible breaks.
- Not adjusting the Volt source for any component except `Dialog` (and only the mask + prop addition there).
