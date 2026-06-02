# Track B Phase 4 — Group header actions (Close All · Float Maximize · Minimize‑to‑tray)

> Status: **4a (Close All) shipped — #109. 4b (Float Maximize) shipped — #110.**
> **4c (Minimize‑to‑tray) in progress — this PR** (completes Phase 4).
> Supersedes/realizes the Phase 4 notes in
> [`track-b-dockview-windowing.md`](./track-b-dockview-windowing.md) (Decision
> **D6**, §6.2) and the roadmap "Tab‑group header actions" task. Builds on Phase
> 3a/3b (#105/#107).

## 1. Scope

Per‑group **header‑action buttons**, rendered in dockview's per‑group
right‑header‑actions slot, branched by the group's `location.type`:

| Location        | Buttons (left→right)                                       | Sub‑phase |
| --------------- | ---------------------------------------------------------- | --------- |
| `floating`      | eye/opacity (3b) · **Maximize** · **Minimize** · **Close** | 4b/4c¹    |
| `grid` (tabbed) | **Minimize** · **Close All**                               | 4a/4c¹    |

¹ Order revised post‑review (4c feedback round 2): a uniform **Close rightmost,
Minimize immediately to its left** convention across both branches — see the "4c
feedback round 2" note in §4. (Float opacity also became a GROUP property then.)

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

### As shipped (4b — this PR)

- **`float.ts`:** `FLOAT_MAXIMIZED_KEY` + `FLOAT_PREV_BOX_KEY` with `get/withFloatMaximized`,
  `get/withFloatPrevBox` (default‑omitted, like the alpha/headerless keys) + a local
  `FloatBox` type (dockview‑core does not export `AnchoredBox`).
- **`session.ts`:** `findFloatingGroup` (the as‑cast shim → a module‑scope
  `FloatingGroupHandle` type), `toggleFloatMaximize`, `getFloatMaximized`, and
  `applyFloatMaximize` (wired into `loadLayout` next to `applyFloatAlphas`).
- **`applyFloatMaximize` 0×0 guard:** a maximized float serializes its FILLED box,
  so it reloads maximized; the hook re‑fills it to the CURRENT `api.width/height`
  (corrects a between‑session viewport resize) but **skips when the dock isn't sized
  yet** (`api.width/height <= 0`) — the serialized box is the safe fallback, never 0×0.
- **`floatPanel` clears stale maximize state** on every fresh float (a prior
  maximize → dock‑back / reload‑without‑save could leave the flag set); `dockBack`
  clears it too (symmetry).
- **Context‑menu parity:** the dock context menu's **Maximize/Restore** item now
  drives the SAME custom action for floating groups (`toggleFloatMaximize`, label
  from `getFloatMaximized`) — previously greyed (dockview maximize is grid‑only).
  Grid groups keep dockview‑native maximize; pop‑out/edge stay disabled. The menu
  and the header icon stay in sync (both read the persisted flag; the menu is
  rebuilt fresh on each right‑click).
- **Verified (Stage 1, Playwright):** float header row eye·maximize·close; maximize
  fills the dock exactly (929×915); restore returns to the exact prior box; icon/label
  flip; **Cesium WebGL survives** (`glLost: false`, canvas resized 520→929); Close
  removes the floated pane; **maximize → save → reload loads maximized + Restore uses
  the persisted prev box.** Unit: `toggleFloatMaximize` (fill/restore, grid no‑op,
  floatPanel‑clears‑stale) + the `float.ts` maximize helpers.

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

### As shipped (4c — this PR)

- **Decisive simplification:** removing a panel/group from dockview does NOT delete
  its `PanelState` record (no removal→delete watcher exists). So minimize =
  capture the group's structure + `api.removePanel` each panel; restore = re‑add
  **by original id**, and every re‑mounted panel re‑runs its own restore hook +
  preset cascade from the intact record. No manual per‑panel state re‑drive needed.
- **Store/session split:** `stores/minimized.ts` holds only the serializable
  `MinimizedEntry[]` (CLAUDE.md rule 4); the dockview work lives in two session
  actions — `minimizeGroup(panelId): MinimizedEntry | null` (capture + remove) and
  `restoreMinimized(entry): boolean` (re‑add). The two stores reference each other
  lazily inside actions.
- **Group‑level, multi‑panel:** captures every panel in tab order + the active id;
  restore opens the first panel beside a best‑effort anchor (a surviving panel,
  default `right`; fresh group if gone) and stacks the rest `within`. A clean
  single pane re‑hides its header; a float re‑floats at its captured box (alpha
  re‑applied). The bar shows the active title + a `+N` tab count.
- **Dirty‑neutral (important):** dockview fires `onDidLayoutChange` via
  `queueMicrotask` (an `AsapEvent`), so it lands AFTER the sync `setRestoring`
  guard resets and would dirty a clean layout. Minimize/restore capture `wasDirty`
  and, only when the layout was clean, re‑`clearDirty()` on a microtask queued
  after dockview's (FIFO) — so an ephemeral minimize never makes the layout
  savable, while a real pre‑existing dirty flag is preserved. (Verified at runtime.)
- **Tray:** `MinimizedDock.vue` overlay in `AppShell`'s `<main>` (made `relative`),
  `pointer-events-none absolute bottom-0 left-0 z-30`; each `MinimizedBar.vue` is
  `pointer-events-auto`. Empty ⇒ renders nothing. `clear()` from `loadLayout`.
- **Known v1 limitation:** explicitly Saving the layout WHILE a group is minimized
  serializes the dock without it (the panel‑state record persists but is orphaned).
  Since minimize is now dirty‑neutral, a clean layout isn't nudged to save, and a
  reload restores the minimized groups to the dock from the (unchanged) layout.
- **Verified (Stage 1, Playwright):** Minimize buttons on grid (Close All ·
  Minimize) + float (eye · minimize · maximize · close); minimize a float → bar →
  restore (Cesium WebGL survives the re‑mount); minimize a 5‑tab group → "Briefing
  +4" bar → restore all tabs; bottom‑left placement above the status bar; minimize
  is dirty‑neutral (clean stays clean, real dirty preserved); reload clears the
  tray and restores the group. Unit: `minimizeGroup`/`restoreMinimized`
  (single + multi‑panel + float round‑trip, ephemeral, unknown‑id null, the store
  round‑trip, `loadLayout` clears the tray).

#### Feedback round (post‑review on #111)

- **Context‑menu minimize.** `DockContextMenu.vue` now offers Minimize from the
  right‑click menu (grid + float), just after Maximize: a multi‑tab group shows
  **Minimize tab** (`minimizePanel`) + **Minimize group** (`minimizeGroup`); a
  single/clean pane shows one **Minimize**. The header buttons stay group‑level.
- **Per‑tab minimize.** New `session.minimizePanel(panelId)` captures a SINGLE
  tab and anchors it `direction: "within"` a surviving sibling, so
  `restoreMinimized` re‑joins the **same group wherever it then lives** (grid OR
  float) — no float box needed. It delegates to `minimizeGroup` when the tab is
  its group's sole member. `originAnchor.direction` gained `"within"`, and the
  clean‑pane header‑re‑hide in restore is skipped for a within‑restore (else it
  would hide the host group's header). A shared `capturePanel()` backs both paths.
- **Bar buttons.** `MinimizedBar.vue` now has two explicit buttons — **⤢ restore**
  (`Maximize2`) and **× close** (label "Close `<title>`") — alongside the
  still‑clickable title. Both the title and ⤢ restore; × discards.
- **Verified (Stage 1, Playwright):** both menu shapes (clean → one Minimize;
  multi‑tab → tab + group); Minimize tab on the active tab of a 7‑tab group keeps
  the other 6 and adds a `within` bar; restore via the ⤢ button re‑joins the same
  group, clears the tray, stays `dirty=false`; Minimize group → "Empty +6" bar; the
  × discards it. Unit: +4 `minimizePanel` tests (12 minimize tests total; 415 all‑up).

#### Feedback round 2 (header icon order + group opacity)

- **Uniform icon order.** `CommandVueHeaderActions.vue` — **Close is always
  rightmost, Minimize immediately to its left**, in BOTH branches: float =
  `eye · maximize · minimize · close`; grid = `minimize · close`. (Supersedes the
  table at the top of this doc.)
- **Float opacity is a GROUP property.** Was stored per‑panel but applied to the
  shared group element (`--cv-float-alpha`), so a multi‑tab float desynced on tab
  switch (control snapped to 100% while the glass persisted). Now:
  `setFloatAlpha` writes the same alpha to EVERY panel in the group (parallel) +
  sets the var; a new `syncActiveFloatAlpha` (called by the header on float
  active‑panel change) reads the applied var and adopts it onto the active tab
  (a dragged‑in tab takes the group's look; a torn‑off lone float keeps its own
  dim). It is dirty‑neutral with **no `restoring` guard** (so it can't swallow the
  tab‑drag's own `markDirty`) but commits durably. `applyFloatAlphas` is now
  group‑aware (one alpha per group, the active tab's) so a divergent group reloads
  deterministically rather than last‑writer‑wins.
- **Adversarial review:** 3 diverse‑lens reviewers (alpha‑correctness,
  regressions, icon/UX) → approve(‑with‑fixes); the two IMPORTANT findings (sync
  guard, applyFloatAlphas last‑writer‑wins) and the tear‑off minor are fixed above.
- **Verified (Stage 1, Playwright):** grid order `minimize·close`, float order
  `eye·maximize·minimize·close`; a 2‑tab float at 0.4 → both tabs read 40% and the
  glass stays on tab switch (no 100% snap). Unit: +4 float‑alpha tests
  (group‑wide write, drag‑in adopt, no‑op, tear‑off inherit).

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
- **4b (this PR):** `float.ts` (max keys + `FloatBox` + helpers) · `session.ts`
  (`findFloatingGroup`, `toggleFloatMaximize`, `getFloatMaximized`,
  `applyFloatMaximize` + `loadLayout` wiring + `floatPanel` clear) ·
  `CommandVueHeaderActions.vue` (float Maximize/Restore + Close) · tests
  (`session.spec.ts`, `float.spec.ts`) · this spec · roadmap.
- **4c (this PR):** `stores/minimized.ts` (store + `MinimizedEntry`/`CapturedPanel`;
  `minimizeGroup` + `minimizePanel`) · `components/layout/MinimizedDock.vue` +
  `MinimizedBar.vue` (⤢ restore + × close) · `AppShell.vue` (mount, `<main>`
  relative) · `CommandVueHeaderActions.vue` (Minimize on both branches) ·
  `dock/DockContextMenu.vue` (Minimize tab / Minimize group) · `session.ts`
  (`minimizeGroup` + `minimizePanel` + `restoreMinimized` + `componentFor` +
  `capturePanel` + the `within` anchor + `loadLayout` clear + the deferred‑dirty
  fix) · `session.spec.ts` (12 minimize tests) · this spec · roadmap.
