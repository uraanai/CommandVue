# Concepts walkthrough — screenshot manifest

This file tracks every screenshot embedded in [`docs/concepts.md`](../../concepts.md). Each row records what the screenshot shows, which Playwright steps reproduce it, and the active theme/mode at capture time.

**When the theme system finalizes (Phase 3.3 ships the six built-in variants), all screenshots in this manifest must be re-captured against the chosen "documentation theme" so the docs match the shipping default.**

The current set was captured against the Phase 3.2 default theme (light mode, slate primary, no built-in variant applied yet).

| File                        | Embedded as                   | Theme | Density     | Reproduce by                                |
| --------------------------- | ----------------------------- | ----- | ----------- | ------------------------------------------- |
| `01-overview.png`           | "CommandVue on first launch"  | light | comfortable | Fresh launch on `/` — Symbology tab focused |
| `02-workspace-switcher.png` | "Workspace switcher dropdown" | light | comfortable | Click the Operations switcher (top-right)   |
| `03-chrome-edit-mode.png`   | "Chrome edit mode"            | light | comfortable | Click "Edit" in status bar bottom-right     |
| `04-edit-menu.png`          | "Edit menu open"              | light | comfortable | Click "Edit" in the top menu bar            |
| `05-manage-layouts.png`     | "Manage Layouts dialog"       | light | comfortable | Edit → Manage Layouts…                      |
| `06-manage-workspaces.png`  | "Manage Workspaces dialog"    | light | comfortable | Workspace switcher → Manage workspaces…     |
| `07-components-panel.png`   | "Components panel"            | light | comfortable | View → Components Panel (or `Ctrl+B`)       |
| `08-dark-theme.png`         | "Same dashboard, dark theme"  | dark  | comfortable | Theme toggle (top-right) → Dark             |

## Re-capture protocol

When the documentation theme is finalized:

1. Run `pnpm dev`.
2. Apply the documentation theme via the theme picker.
3. For each row above, follow the "Reproduce by" steps and save the new PNG under `docs/public/concepts/` with the same filename. Overwriting is fine — Git history preserves the previous state.
4. If a UI surface has changed substantially (a new dialog field, a renamed menu entry), update the prose in `docs/concepts.md` in the same commit.
5. Update this manifest's "Theme" / "Density" columns to match the new capture.

## Add a screenshot

When adding a new image to `docs/concepts.md`:

1. Save the PNG to `docs/public/concepts/NN-name.png` (next sequential number).
2. Reference it from the doc as `./public/concepts/NN-name.png`.
3. Add a row to the table above with the reproduction steps.
