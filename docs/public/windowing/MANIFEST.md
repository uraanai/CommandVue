# Windowing — screenshot manifest

This file tracks every screenshot embedded in [`docs/windowing.md`](../../windowing.md). Each row records what the screenshot shows, which steps reproduce it, and the active theme/mode at capture time. Images are WebP (re-encoded from full-resolution PNG captures for size).

Captured against the default theme (`compact-light`, compact density) on the seeded demo workspace (3D Globe, 2D Map, Entity List, Telemetry Chart, Live Telemetry, Briefing).

| File                     | Embedded as                                      | Theme | Density | Reproduce by                                                            |
| ------------------------ | ------------------------------------------------ | ----- | ------- | ----------------------------------------------------------------------- |
| `01-overview.webp`       | "The CommandVue dock…"                           | light | compact | Telemetry-Chart tab active in a tabbed group, beside a clean globe pane |
| `02-context-menu.webp`   | "The dock right-click menu open on a tab"        | light | compact | Right-click a tab in a multi-tab group                                  |
| `03-clean-pane.webp`     | "A clean (header-less) 3D-globe pane…"           | light | compact | Right-click the globe pane → Hide header                                |
| `04-maximize.webp`       | "A panel maximized to fill the dock"             | light | compact | Right-click a grid pane → Maximize                                      |
| `05-float.webp`          | "A floating window with its background opacity…" | light | compact | Float a panel → lower its opacity slider so the dock shows through      |
| `06-minimize-tray.webp`  | "Minimized panels as bars in the bottom-left…"   | light | compact | Minimize two tabs → expand the tray handle (`Ctrl/Cmd + /`)             |
| `07-popout.webp`         | "The 3D globe popped out…"                       | light | compact | Right-click the globe → Pop out → the separate window                   |
| `08-send-to-window.webp` | "The \"Send to window\" submenu…"                | light | compact | With a pop-out open, right-click a panel → hover **Send to window**     |

## Re-capture protocol

If the default documentation theme changes, re-capture all of these against it so the docs match the shipping default. Run `pnpm dev`, recreate each state above (the in-app menus/gestures, or the session-store actions), screenshot the viewport, and re-encode PNG → WebP (quality ~82).
