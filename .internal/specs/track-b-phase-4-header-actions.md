# Track B Phase 4 — Group header actions (Close All · Float Maximize · Minimize‑to‑tray)

> Status: **4a (Close All) in progress — this PR.** 4b (Float Maximize) and 4c
> (Minimize‑to‑tray) are sequenced after, each its own PR.
> Supersedes/realizes the Phase 4 notes in
> [`track-b-dockview-windowing.md`](./track-b-dockview-windowing.md) (Decision
> **D6**, §6.2) and the roadmap "Tab‑group header actions" task. Builds on Phase
> 3a/3b (#105/#107).

## 1. Scope

Per‑group **header‑action buttons**, rendered in dockview's per‑group
right‑header‑actions slot, branched by the group's `location.type`:

| Location        | Buttons (left→right)                                | Sub‑phase |
| --------------- | --------------------------------------------------- | --------- |
| `floating`      | eye/opacity (shipped 3b) · **Maximize** · **Close** | 4b        |
| `grid` (tabbed) | **Close All** · **Minimize**                        | 4a · 4c   |

`popout` / `edge` groups get neither (mirrors the existing maximize/float
grid‑gating).

### Locked maintainer decisions (this phase)

- **Minimize persistence: EPHEMERAL.** Minimized windows are in‑memory working
  state, cleared on reload / `loadLayout` / workspace switch. Matches D6 ("in‑
  memory for v1"); avoids the unstable‑group‑id problem entirely. (NOT persisted
  to `PanelState.state`.)
- **Sub‑phase order: 4a → 4b → 4c.** Close All first (near‑native, low‑risk, and
  it consolidates the header‑actions component the others extend); float Maximize
  second; the custom minimize tray last.
- **One unified component, branched on `location.type`.** dockview accepts exactly
  one `right-header-actions-component` string, and the float component already
  solves the `updateLocation` fast‑path reactivity quirk — so a second component
  would only duplicate that. The Phase 3b `FloatOpacityControl.vue` is renamed to
  the spec's `CommandVueHeaderActions.vue` (registered `commandvue-header-actions`).
  NB: the master spec's `:components={ CommandVueHeaderActions }` registration is
  **pre‑dockview‑vue‑6**; v6 dropped that prop, so registration is the global
  `app.component()` + string‑ref path (same as panels and the 3b control).

---

## 2. Sub‑phase 4a — Close All (this PR)

Group‑level complement to per‑tab close: one button on the far right of a tabbed
grid group's header closes every panel in that group.

- **Session action** `closeAllInGroup(panelId): Promise<boolean>` (`session.ts`),
  modeled byte‑for‑byte on `closeOthersInGroup` minus the keep‑the‑target filter:
  snapshots `target.api.group.panels` (removing while iterating the live array
  skips entries), removes each via `api.removePanel`, honors the empty‑workspace
  guard `if (api.panels.length <= 1) break` (so Close All on the only group leaves
  its last pane), restoring‑guarded, `markDirty()` iff it removed ≥1. Returns
  whether anything was removed.
- **Component** `CommandVueHeaderActions.vue`: adds `isGrid` (same dual‑read as
  `isFloating`, surviving the `updateLocation` fast‑path) and a `v-else-if="isGrid"`
  branch with one `IconButton` — the **plain close `X`** (Lucide `X`) sized to
  **14px** so it reads like the dockview per‑tab close (11px) but a touch larger
  (maintainer feedback: the boxed `SquareX` looked off). `panelId` comes from the
  cached `activePanel.id`; any member of the group resolves the whole group, so a
  fast‑path‑stale‑but‑in‑group id is still correct. `@pointerdown.stop`/
  `@mousedown.stop` so clicking never starts a group drag.
- **Group‑scoped confirm** `GroupCloseConfirm.vue`: Close All opens a confirm
  centered **within the clicked group only** (not viewport‑wide, not on other
  groups) — a documented library‑first exception, since PrimeVue `ConfirmDialog`
  teleports to `<body>` and masks the whole screen. It `Teleport`s into the
  group's own `.dv-groupview` (anchored via `closest`); `.dv-groupview` is
  `position: static` but its parent `.dv-view` is `absolute` with identical
  bounds, so `absolute inset-0` sizes exactly to the group. Mask uses the project
  Dialog convention (`bg-brand-950/60`). Cancel / Escape / backdrop‑click dismiss;
  "Close all" calls `session.closeAllInGroup`. The message pluralizes off the live
  tab count.
- **Registration:** `commandvue-header-actions` in `main.ts` + the
  `right-header-actions-component` attr in `DockLayout.vue` (renamed in lockstep).
- **Why the button stays enabled on the last pane:** the guard makes the action a
  silent no‑op (returns `false`) rather than disabling — robust against the
  fast‑path (no reliable live total‑panel count in the stripped `params`), and
  consistent with the context menu's Close.
- **Tests:** `closeAllInGroup` — removes all in a group when others exist; leaves
  the last pane when the group is the whole layout (guard); no‑ops on a
  single‑panel layout. Component is Stage‑1 Playwright‑verified (no unit test).
- **Not in 4a:** the context menu gains no "Close all" item (header‑only per the
  roadmap); a Minimize button (4c).

---

## 3. Sub‑phase 4b — Float Maximize (fill‑screen + restore) + Close

Floating windows get **Maximize** (custom fill‑viewport ⇄ restore, the maintainer's
choice over dockview's grid‑only maximize) and **Close** in the eye row.

- **Maximize mechanism (dockview INTERNAL API — no public equivalent):**
  `const fg = (api as any).component.floatingGroups.find(f => f.group === panel.api.group)`.
  - Snapshot: `const prev = fg.overlay.toJSON()` → an `AnchoredBox`
    (`{ width, height } & (TopLeft|TopRight|BottomLeft|BottomRight)`).
  - Fill: `fg.position({ top: 0, left: 0, width: W, height: H })` — with
    `floating-group-bounds="boundedWithinViewport"` the overlay's min‑in‑viewport
    is `undefined` so `getMinimumWidth/Height()` return 0 and the box is **not**
    clamped → exact fill. `W/H` from the float's parent rect / `api.width/height`
    (confirm the parent is `_floatingOverlayHost ?? gridview.element` at runtime,
    not `rootEl`).
  - Restore: `fg.position(prev)` (verbatim — a bottom/right‑anchored float
    round‑trips its own anchor).
  - **Do NOT** remove+re‑add the float to resize — that churns the DOM and risks
    WebGL context loss for Cesium/MapLibre floats. `position()` keeps the element.
- **Persistence:** add `FLOAT_MAXIMIZED_KEY` + `FLOAT_PREV_BOX_KEY` to
  `float.ts` (mirroring `FLOAT_ALPHA_KEY`/`FLOAT_PREV_HEADERLESS_KEY`, default
  omitted). A filled float's `toJSON().floatingGroups[].position` serializes the
  FILLED box, so the pre‑max box must persist separately; re‑apply on load like
  `applyFloatAlphas`. Action `toggleFloatMaximize(panelId)`: floating‑gated,
  restoring‑guarded (the fill changes `toJSON` → would otherwise false‑dirty),
  `markDirty` (consistent with `setFloatAlpha`).
- **Close:** routes through `removePanelGuarded` (a last‑pane float closed raw
  would empty the workspace).
- **Risks:** `api.component.floatingGroups` / `overlay` / `position` are private
  dockview internals — brittle on a dockview bump (CLAUDE.md mandates Context7 +
  runtime re‑verify on bumps). Needs an `as`‑cast shim + a test fake exposing a
  `floatingGroups` stub (`group`, `position()`, `overlay.toJSON()`). **Heavy
  Stage‑1 runtime verification required:** exact fill, restore fidelity across all
  four anchors, WebGL survival, persistence across reload.

---

## 4. Sub‑phase 4c — Minimize‑to‑tray (the custom piece, D6 / §6.2)

Collapse a whole group (grid or float) into a labelled bar in a bottom‑left tray
above the status bar; click to restore to its prior place. **Ephemeral** (this
phase's decision) — in‑memory, cleared on `loadLayout`.

- **Store** `src/stores/minimized.ts` — `entries: MinimizedEntry[]` plus
  `minimizeGroup` / `restore` / `clear`. `MinimizedEntry` carries the group's
  panel ids + types + titles + each panel's captured `PanelState` + a best‑effort
  restore anchor (origin side, default `right`). `clear()` is called from
  `session.loadLayout`.
- **Capture:** read `panelStateStore.getState(id)` + the live handle from
  `getPanelInstance(id)` for every panel in `api.group.panels`, snapshot a float's
  `overlay.toJSON()` box if floating, then `api.removeGroup`/`removePanel`
  (restoring‑guarded so it doesn't false‑dirty).
- **Restore:** re‑add the panels near the saved anchor (`api.addPanel` with a
  `referenceGroup`/`direction`, or re‑`addFloatingGroup` with the saved box for a
  float), re‑apply headerless if the pane was clean, run the panel restore hook,
  write back `appliedPresetIds` to re‑run the preset cascade. Group refs are
  unstable across removal → treat the origin as best‑effort, fall back to the
  default dock side.
- **Render** `src/components/layout/MinimizedDock.vue` (overlay) +
  `MinimizedBar.vue` (one bar), mounted in **`AppShell.vue`** as the last child of
  `<main>` (make `main` `relative`); container
  `pointer-events-none absolute bottom-0 left-0 z-30 flex items-end gap-2 p-2`,
  each bar `pointer-events-auto`. `bottom-0` of the now‑relative `main` sits flush
  above the status bar (its flex sibling) — density‑proof; do **not** copy the
  spec's literal `bottom: var(--density-statusbar-height)` (that assumed shell‑root
  scope and would double‑offset). NOT a chrome status‑bar item (D6). Empty tray ⇒
  renders nothing (`v-if entries.length`) ⇒ zero layout cost.
- **Bar UI:** hand‑rolled token‑styled div (`bg-surface-raised border-border`),
  panel icon (from `panelRegistry`), title (active panel title, `truncate`),
  click‑to‑restore, plus small `IconButton`s; optional `Tag` count badge for a
  multi‑panel group. `z-30` (above dock + floats, below `z-50` modals / `z-[100]`
  Select).
- **Minimize buttons:** add a Minimize `IconButton` (Lucide `Minus`) to BOTH the
  grid branch (beside Close All) and the float branch of `CommandVueHeaderActions`,
  → `minimizedStore.minimizeGroup(panelId)`.
- **Open design items to settle in 4c:** multi‑panel tabbed‑group capture/restore
  fidelity; restore when the origin group was emptied by the minimize; confirming
  the session `restoring` flag gates `markDirty` around capture/restore (it
  exists — `setRestoring`).

---

## 5. Files

- **4a (this PR):** `session.ts` (`closeAllInGroup` + export) ·
  `CommandVueHeaderActions.vue` (renamed from `FloatOpacityControl.vue`, grid
  branch, plain‑`X` icon, guard‑aware confirm count) ·
  `GroupCloseConfirm.vue` (group‑scoped confirm; focus‑on‑open + restore;
  `role="alertdialog"` without `aria-modal` since other groups stay interactive) ·
  `groupCloseControls.ts` (`panelsThatWillClose` — guard‑aware count) ·
  `modules/shortcuts/modalGate.ts` + `useKeyboardShortcuts.ts` (a modal‑capture
  gate so the confirm's Escape can't also fire the global `tool.deactivate`) ·
  `main.ts` (registration) · `DockLayout.vue` (prop) · tests (`session.spec.ts`,
  `groupCloseControls.spec.ts`, `useKeyboardShortcuts.spec.ts`) · this spec · roadmap.
- **4b:** `float.ts` (max keys) · `session.ts` (`toggleFloatMaximize` + re‑apply) ·
  `CommandVueHeaderActions.vue` (float Maximize/Close) · tests.
- **4c:** `stores/minimized.ts` · `MinimizedDock.vue` + `MinimizedBar.vue` ·
  `AppShell.vue` (mount) · `CommandVueHeaderActions.vue` (Minimize) ·
  `session.ts` (`loadLayout` clear) · tests.
