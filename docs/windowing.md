# Windowing & dock panels

This page is for the operators using a CommandVue-derived application. It covers
the **dock** — the panel workspace at the center of the app — and every way you
can arrange, split, float, pop out, minimize, and maximize the panels inside it.

For the bigger picture of workspaces, layouts, and presets, read the
[User guide](/user-guide) and [Concepts](/concepts). For building new panel
types, see [Panels](/panels).

## The dock — mental model

Everything between the menu bar and the status bar is the **dock**. The dock
holds your panels (the 3D globe, the 2D map, tables, charts, briefings, and so
on) and lets you arrange them like windows on a desktop — except they tile and
snap instead of overlapping.

Three ideas are worth holding onto:

- **A panel is one view.** Each panel is a single instance of a component type
  (3D Globe, Entity List, Telemetry Chart, …). A panel always lives somewhere:
  in the grid, in a floating window, in a minimized bar, or in a separate
  browser window.
- **A group is a stack of panels that share a space.** When two or more panels
  occupy the same rectangle, they stack as **tabs** and the group shows a **tab
  strip** across the top. A group with one panel is still a group — just a
  single tab.
- **The grid is the tiled arrangement of groups.** Splitting the dock creates
  side-by-side or stacked groups. The whole grid (plus any floating windows and
  pop-outs) is what gets saved as your **layout**.

Most windowing actions operate on either a **single tab** or a **whole group**,
and the menus make the distinction explicit ("Pop out tab" vs "Pop out group",
"Minimize tab" vs "Minimize group").

## Adding and removing panels

### Add a panel

- **View → Add Component ▸** — a cascade menu grouped by category (Maps, Data,
  Charts, …). Click any entry to spawn a new panel of that type. New panels open
  as a small **floating window** so they don't disturb your current grid; drag
  one into the grid to dock it.
- **View → Components Panel** (`Ctrl/Cmd+B`) — opens the **Components** browser, a
  floating panel showing a card grid of every registered panel type. Click a card
  to spawn that panel. Press the same shortcut again to close the browser.
- **View → Add Empty Panel** — spawns a placeholder panel; pick a component from
  the "Assign a component…" dropdown inside it.

### Remove a panel

- **Per-tab close** — the `×` on a tab closes that one panel.
- **Right-click → Close** — closes the panel you right-clicked.
- **Close all (group header)** — the `×` button on the **far right of a group's
  header** closes every panel in that group at once, after a short confirmation.

CommandVue never lets you close the **last** remaining panel — the dock always
keeps at least one. The Close items disable when only one panel is left.

## Rearranging — drag, split, and tabs

You arrange the dock by dragging tabs:

- **Reorder within a group** — drag a tab left or right along its tab strip.
- **Move to another group** — drag a tab onto another group's tab strip to stack
  it there.
- **Split** — drag a tab to the **edge** of a group (top, bottom, left, or right).
  A drop zone highlights, and releasing splits the group, placing the panel in a
  new group beside the old one. This is how you build 2-up, 3-up, or "3 + 1"
  arrangements — for example the 3D globe and the 2D map side by side.
- **Resize** — drag the gutter between two groups to change their split ratio.

There is no separate "split" command — splitting is the drag-to-edge gesture
plus **View → Add Component**, which together cover every arrangement.

## The right-click menu

Right-click a tab or anywhere inside a pane to open the dock context menu. The
menu adapts to where you clicked: items that don't apply in the current location
appear **disabled** rather than missing, so the menu always looks the same. Inside
a [pop-out window](#pop-out-to-a-separate-browser-window) the same menu opens (not
the browser's native one), with the window items collapsed to a single **Dock
back**.

The items you may see:

| Item                                  | What it does                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hide header** / **Show header**     | Toggle [clean (header-less) mode](#clean-header-less-panes) for the group.                                                                                         |
| **Close others**                      | Close every other tab in the group, keeping the one you clicked. Disabled when the group has one tab.                                                              |
| **Float window**                      | Lift the pane into an [in-window floating window](#floating-windows). Disabled when it can't apply (already floating, popped out, etc.).                           |
| **Dock back**                         | Return a floating window or pop-out to the grid. Replaces "Float window" once the pane is floating, and replaces the "Pop out" items inside a pop-out.             |
| **Pop out tab** / **Pop out group**   | Open the single tab, or the whole group, in a [separate browser window](#pop-out-to-a-separate-browser-window). A single-tab group shows just **Pop out**.         |
| **Maximize** / **Restore**            | [Fill the dock](#maximize-and-restore) with this group, or revert. The label flips to **Restore** while maximized.                                                 |
| **Minimize tab** / **Minimize group** | Collapse the tab, or the whole group, to the [bottom-left tray](#minimize-to-the-tray). A single-tab group shows just **Minimize**.                                |
| **Send to window ▸**                  | [Move this panel into another open window](#send-a-panel-to-another-window) — the main window or any pop-out. Only appears when there's somewhere else to send it. |
| **Close**                             | Close the panel you right-clicked. Disabled when it's the last panel in the dock.                                                                                  |

## Clean (header-less) panes

A normal group shows a tab strip across its top. For a map or globe you often
want that space back — every pixel for the content.

- **Hide the header** — right-click the pane → **Hide header**. The tab strip
  disappears and the panel content fills the whole pane. This is a **clean pane**.
- **Show it again** — right-click the (now strip-less) pane → **Show header**.

Notes:

- **Clean panes hold one panel.** If you hide the header on a group that has
  several tabs, the active tab splits off into its **own** clean pane beside the
  others, which keep their tab strip. Each clean pane is a single view.
- **Splits inherit clean mode** — arranging two clean panes side by side keeps
  both header-less, so you can run, say, the 3D globe and the 2D map edge to edge
  with no chrome between them.
- **Clean state is saved** with the layout, so a clean pane comes back clean after
  a reload.

## Maximize and Restore

Maximize blows one group up to fill the entire dock area, hiding the rest — handy
when you want to focus on the map or read a dense table.

- **Maximize** — right-click the pane → **Maximize**. The group fills the dock.
- **Restore** — right-click → **Restore** (the same item, relabeled), or press
  **Esc**. The grid returns to exactly how it was.

Maximize is a view-only state: it doesn't count as an unsaved change, and it only
applies to panes in the **grid** (it's disabled for pop-outs). Floating windows
have their own maximize — see below.

## Floating windows

A **floating window** is a panel lifted out of the tiled grid into a draggable
window that sits on top of the dock — perfect for a tactical overlay that hovers
above the map.

- **Float a pane** — right-click → **Float window**. The group lifts off the grid
  into a floating window you can **drag** by its header and **resize** from its
  edges. Floating windows stay within the app window; they can't be dragged
  off-screen.
- **Dock it back** — right-click → **Dock back**, or drag the window back into the
  grid. It returns to its original spot when that spot still exists, otherwise it
  docks to the right edge.

### The floating-window header controls

A floating window's header carries its own row of controls, from left to right:

- **Opacity (eye icon)** — click the eye to reveal a **see-through opacity
  slider**. Drag it from **0 % (fully transparent background)** to **100 % (solid)**.
  The _content_ stays full-color — only the window's **background** becomes
  translucent — so a floating panel's glass lets the map underneath show through.
  Opacity applies to the whole window, so a multi-tab floating window dims
  uniformly. The level is saved with the layout.
- **Maximize / Restore** — fills the dock area with the floating window, or
  restores it to its previous size and position. (This is separate from the
  grid's Maximize.)
- **Minimize** — collapses the floating window to the [tray](#minimize-to-the-tray).
- **Close** — closes the window.

## Minimize to the tray

Minimizing tucks a panel or group away without closing it, so you can clear space
and bring it back later exactly where it was.

- **Minimize a group** — right-click → **Minimize group** (or **Minimize** for a
  single-tab group), or click the **Minimize** button in the group header. The
  whole group collapses into a single labelled **bar**.
- **Minimize one tab** — right-click → **Minimize tab**. Only that tab collapses;
  the rest of the group stays docked.

Minimized bars live in a **tray docked to the bottom-left**, just above the status
bar. Multiple minimized windows stack left to right.

- **The tray collapses behind a handle.** By default the tray is tucked away
  behind a small **handle at the left edge** showing a count of how many windows
  are minimized. Click the handle — or press **`Ctrl/Cmd + /`** — to slide the
  bars in and out.
- **Restore** — click a bar's title (or its **⤢** button) to bring the window
  back. It returns to its original position — a minimized tab re-joins its
  original group at its original tab index; a floating window re-floats at its old
  size. A bar that held several tabs shows a **+N** badge.
- **Discard** — the **×** on a bar drops it without restoring (the panels were
  already removed from the dock when you minimized).

The tray is **session-only**: switching layouts or workspaces, or reloading the
page, empties it and the panels come back from your saved layout.

## Pop out to a separate browser window

Pop-out moves a panel or group into a **separate browser window** — drag it to a
second monitor, or run the map full-screen on one display while the rest of the
dashboard stays on another.

- **Pop out a tab** — right-click → **Pop out tab**. Just that one tab opens in a
  new window; its group keeps the rest.
- **Pop out a group** — right-click → **Pop out group** (or **Pop out** for a
  single-tab group). Every tab in the group moves to the new window together.

What to expect:

- **It looks like the app.** The current theme — light/dark, density, and any
  custom theme colors — is **mirrored** into the pop-out window and stays in sync
  if you change the theme afterward.
- **Right-click still works.** Right-clicking inside a pop-out shows the same
  CommandVue dock menu — not the browser's native menu — with the window items
  collapsed to a single **Dock back**.
- **Dock it back** — right-click → **Dock back**, or simply **close the pop-out
  window**. Either way the content returns to the main window.
- **Maps survive the move.** The 3D globe and 2D map keep their live rendering
  (and camera/zoom) across the pop-out — there's no reload or reset.

> Your browser may ask permission to open the window the first time, and pop-out
> must be triggered by your click (browsers block windows opened any other way).

## Send a panel to another window

Once you have one or more pop-outs open, you can shuffle a panel between windows
without docking it back first.

- Right-click the panel → **Send to window ▸**, then choose a destination:
  - **Main window** — when the panel is currently in a pop-out.
  - **Any open pop-out** — listed by the title of its active panel.

The panel moves straight to the chosen window, keeping its live state (maps keep
rendering, with camera and zoom intact). The **Send to window** item only appears
when there's actually another window to send it to.

## Maps and 3D in panels

The map panels are full WebGL surfaces, and windowing keeps them alive:

- **Minimize → restore** preserves the 3D globe's camera position and zoom — you
  come back exactly where you were looking.
- **Pop-out and cross-window moves** keep the map's live rendering intact; the
  WebGL view survives the move with its camera and zoom preserved. No reload, no
  re-centering.

## Saving your arrangement

Your dock arrangement — the grid splits, which panes are clean, floating windows
(including their position, size, and opacity), maximized state, and any pop-outs —
is part of the **layout**. Save it with **File → Save Layout** (`Ctrl/Cmd+S`), or
**Save Layout As…** (`Ctrl/Cmd+Shift+S`) to keep it as a new named layout. The
status bar shows a dot beside the layout name while you have unsaved changes.

The **minimized tray is the one exception** — it's session-only and is not saved;
restore or discard those bars before you leave.

See [Saving, exporting, importing](/user-guide#saving-exporting-importing) for the
full Save / Save As / Discard model.

## Windowing keyboard shortcuts

| Combo        | Action                                   |
| ------------ | ---------------------------------------- |
| `Ctrl/Cmd+B` | Toggle the Components panel (add panels) |
| `Ctrl/Cmd+/` | Show/hide the minimized-window tray      |
| `Esc`        | Restore a maximized pane                 |
| `Ctrl/Cmd+S` | Save Layout (persists the arrangement)   |

See [Keyboard shortcuts](/keyboard-shortcuts) for the complete list.
