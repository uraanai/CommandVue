# User guide

This page is for the operators using a CommandVue-derived application — not the engineers building it. Engineer-facing docs are at [Architecture](/architecture), [Workspaces](/workspaces), [Panels](/panels), [Presets](/presets), [Chrome](/chrome).

## First launch

On first launch the app creates:

- One **workspace** named **Operations** (the global default — the workspace that opens at app start).
- One **layout** named **Default** inside that workspace.
- Seven panels stacked as tabs: **3D Globe**, **2D Map**, **Entity List**, **Telemetry Chart**, **Live Telemetry**, **Briefing**, **Symbology**.
- One **chrome profile** named **Default** that arranges the menu bar / status bar items.

Drag any tab to split the dock. Drag a tab outside the dock to float it. Everything saves to your browser's storage; reloading the page brings you back to where you were.

## Workspaces and layouts — the mental model

Think of CommandVue as a stack of three things:

1. **Workspace** — a _mode_ or _role_. You might have one for "Operations," one for "Planning," one for "Training."
2. **Layout** — a _named arrangement_ of panels inside a workspace. You can have multiple layouts per workspace (e.g., "Wide displays" vs "Laptop") and switch between them.
3. **Panel** — one tab inside a layout. Each panel is an instance of a component type (Cesium, MapLibre, Entity List, etc.).

The status bar shows your current workspace and layout. The dot next to the layout name (`Layout: Default •`) means you have unsaved changes.

## The menu bar

### File

- **New Workspace…** — opens Manage Workspaces with a "Create" button.
- **New Layout** — adds a new layout named "Untitled" to the current workspace.
- **Save Layout** (Cmd/Ctrl+S) — persists the current dock arrangement to the active layout. Disabled when there's nothing to save.
- **Save Layout As…** (Cmd/Ctrl+Shift+S) — opens a dialog to save the current arrangement as a brand-new layout. Optionally set it as the workspace default.
- **Import Workspace…** — pick a `commandvue-workspace-*.json` file to import. The imported workspace gets a fresh name on conflict and is never set as the global default.
- **Export Workspace…** — downloads the current workspace (layouts, panels, scoped presets, optionally chrome profile) as JSON.

### Edit

- **Rename Layout…** — opens Manage Layouts.
- **Duplicate Layout** — clones the active layout (panels + state + applied presets) under a fresh id.
- **Delete Layout…** — removes the active layout. Refuses if it's the only layout in the workspace.
- **Manage Presets…** — opens the presets dialog with Global / Workspace tabs.

### View

- **Add Component ▸** — cascade menu grouped by category (Maps, Data, Charts, etc.). Click any entry to spawn a new floating panel of that type.
- **Add Empty Panel** — spawns an empty panel; pick a component from the dropdown inside.
- **Components Panel** (Cmd/Ctrl+B) — toggles a floating "Components" browser panel.
- **Discard Changes** — throws away unsaved edits and reloads the persisted layout.

## The workspace switcher

Top-right dropdown. Pick another workspace to switch into. If you have unsaved changes in the current layout, you'll see an Unsaved Changes dialog:

- **Save** — persist edits to the current layout, then switch.
- **Save as new** — open Save Layout As… for the current arrangement, then switch.
- **Discard** — throw away edits, then switch.
- **Cancel** — stay where you are.

## Empty panels and assignment

`View → Add Empty Panel` (or any empty panel left over from import) shows an "Assign a component…" dropdown. Pick a type and click Assign — the empty placeholder is replaced by the chosen component, and any applicable presets become available below it.

The panel's id stays the same across assignment, so cross-references to it (in the layout's panel list, in any preset's `appliedPresetIds`) survive.

## Presets

A **preset** is a saved bundle of visual configuration that can be applied to one or more panels. Three example types ship with the template:

- **Map Style** — applies to MapLibre. Swaps the vector tile style at runtime.
- **Map Overlay** — applies to Cesium and MapLibre. Adds a GeoJSON overlay layer.
- **Chart Theme** — applies to chart panels. Sets the color palette and grid style.

Presets are either **global** (visible in every workspace) or **workspace-scoped** (visible only in the workspace where you created them). Open Edit → Manage Presets… to create, edit, duplicate, promote (workspace → global), or scope (global → workspace) any preset.

To apply a preset:

- **From the Empty Panel dropdown** — pick a preset alongside the component you're assigning.
- **From the Apply Preset dialog** — (planned future entry point) per-panel context menu.

Cascading order: when a panel has multiple presets applied, later ones override earlier ones — like CSS. Re-applying an already-applied preset moves it to the end, raising its precedence.

## The chrome system

The persistent UI surrounding the dock is the **chrome**. You can rearrange it.

### Edit mode

Click the **Edit** button on the right side of the status bar (or pick "Edit Chrome…" from the app-icon right-click menu). In edit mode:

- Each chrome slot shows a dashed border.
- Each item gets a small `×` badge — click to hide it.
- Each slot shows a `+` button — click to add a hidden item back.

Click **Done** (where Edit used to be) or the **Exit edit mode** banner to leave edit mode.

### Hiding the menu bar

In edit mode, hide the menu-bar item from the top-left slot. The app icon's right-click context menu mirrors File / Edit / View, so you keep access to everything.

### Hiding the status bar entirely

Right-click the app icon → "Hide Status Bar". The bottom bar disappears completely. Show it again from the same menu.

## Saving, exporting, importing

### Save vs Save As vs Discard

- **Save** writes the current arrangement onto the loaded layout. The layout name doesn't change. Use this for "I just adjusted the panes a bit."
- **Save As** creates a new layout from the current arrangement and switches to it. Use this for "I want this as a new view I can come back to."
- **Discard** throws away all dock edits since the last load. Use this when you've experimented and want to revert.

### Export

`File → Export Workspace…` downloads a JSON file containing the current workspace, all its layouts, every panel-state in those layouts, every workspace-scoped preset, and (by default) the active chrome profile. **Global presets are not included** — they belong to your user account, not the workspace.

### Import

`File → Import Workspace…` opens a file picker. The imported workspace:

- Gets fresh ids for every layout, panel, and preset.
- Is renamed if its name collides (e.g. `Operations (2)`).
- Is never set as the global default.
- Includes the chrome profile from the file as a new (non-default) profile.

Panel components that the importing build doesn't recognize render as a **missing panel placeholder** — pick a different type to reassign, or remove the panel.

## Keyboard shortcuts

| Combo            | Action                  |
| ---------------- | ----------------------- |
| Cmd/Ctrl+K       | Open command palette    |
| Cmd/Ctrl+S       | Save Layout             |
| Cmd/Ctrl+Shift+S | Save Layout As…         |
| Cmd/Ctrl+B       | Toggle Components Panel |
| Escape           | Deactivate current tool |
| M                | Measure distance tool   |
| P                | Draw polygon tool       |

See [Keyboard shortcuts](/keyboard-shortcuts) for the full list.

## Troubleshooting

- **"This panel is empty" — what happened?** Either you (or someone whose workspace you imported) created the panel without picking a component yet. Pick one from the dropdown.
- **"Panel type is no longer available" — what happened?** The workspace was likely imported from a different build that had a custom panel type your build doesn't know about. Pick a different type to reassign, or remove the panel.
- **Reset everything.** Open browser devtools → Application → IndexedDB → `commandvue-workspaces` → delete the database. Reload the page; the first-run seed re-creates the Operations workspace, Default layout, and Default chrome profile.
