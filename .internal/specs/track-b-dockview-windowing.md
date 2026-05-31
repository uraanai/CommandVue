# Track B — Dockview Windowing & Main-Window Model (Design Spec)

> **Internal planning document.** Do not reference from public docs, READMEs, or
> changelogs. Lives under `.internal/` per the project convention for private
> planning. Last updated: 2026-05-31.
>
> Status: **Design approved** (4 decisions locked with the maintainer, see
> §2). Ready for implementation-plan breakdown (`writing-plans`) once this spec
> is reviewed.

---

## 1. Goal

Bring VS Code-/IDE-style windowing to CommandVue's Dockview surface. Today a
panel tab has **only a close button** — no maximize, minimize, float, or pop-out,
and there is no notion of a pinned central "main window." This track adds:

1. A **pinned, tab-less central "main window"** (a promoted map panel) that the
   other dock panels surround on the sides / top / bottom.
2. Per-tab **close + minimize** buttons, and per-group-header **maximize / float
   / pop-out** actions.
3. A **right-click context menu** on tabs (the full superset of actions).
4. The four behaviors: **maximize**, **minimize-to-tray**, **in-window float**,
   **separate-browser-window pop-out** (with the theme mirrored into the child
   window).
5. A **switch** affordance to swap a dock panel into the central area and back.
6. A cross-screen **"Pin Main Window here"** content swap that relocates the main
   _view_ onto a popped-out panel's monitor.

**Why this track is sequenced first:** the Theme Studio (Track A) is delivered
_as a dock panel that can be popped out to another monitor and live-recolor every
open window_. That depends on this track's pop-out + theme-mirroring machinery.
Track B is a hard prerequisite for Track A, not just an ordering preference.

> **Verification note.** Every load-bearing API below was verified against the
> installed `dockview-core@6.6.1` source and the actual CommandVue files. An
> adversarial review caught three critical API errors in the first draft
> (tab-registration prop names, pop-out options key, float options shape) and a
> false premise about theming; all are corrected here. Per CLAUDE.md, every phase
> ends with **Stage-1 Playwright runtime verification** before its PR — static
> checks will not catch the pop-out style seam, the WebGL-context move, or the
> gesture/popup path.

---

## 2. Locked decisions

| #   | Decision                  | Choice                                                                                                                                                                                         |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | "Pin to this" model       | **Content swap** ("Pin Main Window here"). True window-role transfer is verified infeasible (see §8). Ships as Phase 7, gated.                                                                 |
| D2  | Main-window content       | **Promote an existing map panel** via a `mainPanel` flag. Default: `cesium` (3D Globe); `maplibre` is a one-flag alternative. The main is a _movable designation_, not a new shell panel type. |
| D3  | Tab buttons               | **Close + minimize on every tab**, hover-revealed.                                                                                                                                             |
| D4  | Float / Pop-out reach     | **Both** the group-header actions **and** the right-click context menu.                                                                                                                        |
| D5  | Minimized persistence     | **In-memory for v1** (cleared on layout/workspace switch). Persist into the `Layout` later.                                                                                                    |
| D6  | Pop-out context-menu      | **Build the popout-local menu fallback** in Phase 5 (PrimeVue ContextMenu otherwise teleports to the opener's monitor).                                                                        |
| D7  | Cross-window map snapshot | Capture **camera/center/zoom + applied presets + active tool/selection** before the move; re-init GL + re-apply after.                                                                         |

---

## 3. The main-window model

Dockview 6.6.1 has **no first-class "editor area" / center** concept. The main
window is **emulated** from three verified, settable live-UI properties applied
to whichever group currently holds the designated main panel:

- `group.header.hidden = true` — removes the tab strip **and** its header-action
  slots (`IHeader.hidden`, verified settable).
- `group.locked = 'no-drop-target'` — blocks drag-drop into/out of the center;
  **programmatic `moveTo` still works** (verified). The center can't be
  drag-rearranged, but our switch/pin code can still move content in and out.
- `group.api.setConstraints({ minimumWidth, minimumHeight })` — anchors the
  center at a large min-size so the splitview shrinks the _neighbors_ first. Full
  key names required (`minWidth` shorthand is rejected).

### 3.1 Main as a movable designation (D2)

There is **no reserved `main-window` panel type**. Instead:

- `PanelDefinition` gains an additive `mainPanel?: boolean` flag
  (`src/modules/panels/types.ts`, alongside the existing `singleton?`).
- The built-in `cesium` panel is flagged `mainPanel: true` (default center).
  `maplibre` could carry it instead — a one-line change. Both maps remain normal,
  dockable panels; whichever currently sits in the center is "the main window."
- The session store tracks the **current** main panel instance id:
  `session.mainPanelId` (a ref). It is seeded from the `mainPanel` registry flag
  on first build, and re-pointed by the switch (§7) and pin (§8) flows.
- `panelRegistry.mainPanelType()` returns the default-main type id for seeding.

### 3.2 Docking around the center

No "anchor" flag exists; siblings are always added **relative** to the center
group:

```ts
api.addPanel({
  id,
  component,
  title,
  position: { referenceGroup: centerGroup, direction: "left" | "right" | "above" | "below" },
});
```

The center's large min-size keeps it dominant while neighbors shrink.

### 3.3 The center's controls live in an overlay toolbar

Because `header.hidden` removes the header-action slots, the center **cannot** use
`rightHeaderActionsComponent`. Its controls (switch view, maximize, pop-out-main)
render as a **slim floating overlay toolbar inside `MainWindow`** (the promoted
map panel renders this shell). There is no tab fallback for the center — every
center action must be reachable from this toolbar.

### 3.4 Non-serialized invariants — the #1 silent breakage

`header.hidden`, `locked`, and `setConstraints` are **not** in `toJSON()` (only
grid/floating/popout/edge geometry + panels serialize). They must be re-applied
after **every** rebuild path via a single function `applyCenterInvariants(api)`,
called as the **last statement of `session.loadLayout` after all branches
converge** (right before `loadedLayoutId.value = layoutId`). `loadLayout` fans
out (try-`fromJSON` / catch→rebuild / else→rebuild) and is reached transitively
by `switchWorkspace`, `discardChanges`, and `saveCurrentAsNewLayout`; the single
post-convergence chokepoint covers all of them. A regression test must assert the
invariants hold after a `toJSON`→`fromJSON` round-trip.

### 3.5 `restoring` guard — false-dirty prevention

`DockLayout.vue` subscribes `onDidLayoutChange(() => session.markDirty())` in
`onReady`, **before** the first `loadLayout`. Applying the invariants (and the
multi-move swaps in §7/§8) mutates the layout and would fire an instant false
`markDirty`. Add a **net-new** `restoring` flag to the session store; gate
`markDirty` on `!restoring`; set `restoring = true` around invariant application
and every multi-move orchestration. (`loadLayout` already ends with
`dirty.value = false`, which masks first-boot, but **not** later swaps.)

### 3.6 `rebuildFromPanelStates` rewrite

Today it loops `api.addPanel({ id, component, title })` with no position in
arbitrary repo order. Rewrite to:

1. Partition the designated-main panel-state **first**, add it, capture
   `centerPanel.group`.
2. Add the rest with `position: { referenceGroup: centerGroup, direction }`,
   reading an optional `dockHint` (side) from `PanelState.state`
   (`Record<string, unknown>`, verified). Absent hint → `'right'`.
3. **Duplicate-id guard:** if a main panel already exists, do not synthesize a
   second (adding the same id twice throws).

### 3.7 Backward compatibility (seeded / old layouts)

Seeded layouts have `dockviewState: null` and panel-states with no main
designation. On load, `rebuildFromPanelStates` promotes the `mainPanel`-typed
panel (or, if absent, synthesizes one from `panelRegistry.mainPanelType()`) as the
center and docks the rest around it. Do the synthesis at a **single idempotent
insertion point** (not in both `seed.ts` and `loadLayout`). `applyCenterInvariants`
is a safe no-op when no main panel is present.

### 3.8 `noPanelsOverlay`

Add `noPanelsOverlay='emptyGroup'` to `<DockviewVue>` so the center region
persists during mid-swap empty moments; `MainWindow` renders an in-panel empty
state.

---

## 4. Tab UI & controls

### 4.1 Registration (corrected prop names)

On `<DockviewVue>` (currently a bare single line in
`src/components/layout/DockLayout.vue`):

```html
<DockviewVue
  :theme="commandvueTheme"
  :tabComponents="{ CommandVueTab }"
  :defaultTabComponent="'CommandVueTab'"
  rightHeaderActionsComponent="CommandVueHeaderActions"
  :components="{ CommandVueHeaderActions }"
  noPanelsOverlay="emptyGroup"
  class="h-full w-full"
  @ready="onReady"
/>
```

> **Corrected from the first draft:** the tab map prop is `tabComponents`, the
> default-tab prop is `defaultTabComponent` (there is **no** `defaultTabRenderer`),
> and `components` is the _panel/header_ map (separate). Wiring the tab via
> `:components` + `:defaultTabRenderer` (the first draft) does nothing.

### 4.2 Component split

- **Per-panel tab** — `src/components/layout/dock/CommandVueTab.vue` (hand-rolled;
  `DockviewDefaultTab` is React-only). Receives
  `IDockviewPanelHeaderProps = IGroupPanelBaseProps & { tabLocation }`. It does
  **not** carry a `group` field — reach the group via `api.group`. Owns per-tab
  **close** (`api.close()`) and per-tab **minimize** (app-built tray, §6.2).
- **Per-group header actions** — `src/components/layout/dock/CommandVueHeaderActions.vue`.
  Receives `IDockviewHeaderActionsProps` (group `api` with `location`,
  `containerApi`, `group`, `panels`, `activePanel`, `isGroupActive`). Owns
  **maximize/restore, float, pop-out**, and the conditional **re-dock / switch**
  buttons.

**Rule:** per-panel (close, minimize) → tab; per-group (maximize, float, pop-out,
switch) → header; context menu → full superset.

### 4.3 Close + minimize placement (D3)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▸ Map  – ✕ │  Telemetry – ✕ │  Entities – ✕ │            · ⤢  ⧉  ↗ · │
└──────────────────────────────────────────────────────────────────────┘
   per-tab minimize(–) + close(✕), hover-revealed   header: max · float · popout
```

Hover-reveal via `opacity-0 group-hover/tab:opacity-100` keeps a dense, many-tab
strip clean. `IconButton` forces `aria-label` from its required `label`, so the
hover utilities are safe.

### 4.4 The center has no tab

The header-less central group has **no tab**, therefore no per-tab close/minimize
and no tab context menu. All center actions route exclusively through the
`MainWindow` overlay toolbar (§3.3).

### 4.5 Interference rules (load-bearing)

- Buttons use `@mousedown.stop` (dockview begins drag on mousedown) +
  `stopPropagation()` in handlers. Add `@pointerdown.stop` **iff** runtime-verify
  shows dockview binds pointerdown (confirm in `pnpm dev`).
- **Never** `stopPropagation` on the tab root's left-click (breaks activate +
  drag). Only the buttons and `@contextmenu` stop propagation.

---

## 5. Tab context menu

### 5.1 Primitive — reuse the existing wrapper (no new install)

Use the existing `src/components/ui/ContextMenu.vue` (hand-rolled PrimeVue
`ContextMenu`, unstyled, exposes `show(event)` / `hide()`, density-tokened,
already used by `AppIconItem.vue`). **Do not** `npx volt-vue add ContextMenu`
(Volt has no ContextMenu; the project ships its own). Library-first, zero new
dependency.

### 5.2 One hoisted menu, re-targeted per right-click

A dense dashboard has 30+ tabs; one `<ContextMenu>` per tab is wasteful. Hoist a
**single** `<ContextMenu ref="cm" :model="menuItems">` into `DockLayout.vue`,
`provide()` an `openTabMenu(event, items)` via a new `tabMenuKey` in
`src/components/layout/keys.ts`. Each `CommandVueTab` builds its `MenuItem[]` in a
`useTabContextMenu(props)` composable and calls the injected opener. In
`onContextMenu`: `preventDefault()` + `stopPropagation()` then `openTabMenu`.

### 5.3 Menu model + verified API routing

| Item                       | Visible / disabled                                     | Call                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pop out to external window | always                                                 | `containerApi.addPopoutGroup(api.group, { position: { left, top, width, height }, popoutUrl: '/popout.html', onDidOpen, onWillClose })` — key is **`position`** |
| Float in window            | disabled when `api.group.api.location.type !== 'grid'` | `containerApi.addFloatingGroup(api.group, { x, y, width, height })` — **top-level** coords                                                                      |
| Maximize / Restore         | disabled off-grid; label flips on `api.isMaximized()`  | `api.maximize()` / `api.exitMaximized()`                                                                                                                        |
| Minimize                   | always                                                 | `minimizedStore.minimizePanel(api.id)`                                                                                                                          |
| Switch with Main Window    | non-main grid panels only                              | `session.promoteToMain(api.id)`                                                                                                                                 |
| Pin Main Window here       | only in a popout doc **and** a main exists             | app-orchestrated content swap (§8)                                                                                                                              |
| Close                      | disabled for the current main panel                    | `api.close()`                                                                                                                                                   |
| Close others in group      | always                                                 | iterate `api.group.panels`, skip the main, `containerApi.removePanel(p)`                                                                                        |

Gating uses `DockviewGroupLocation = { type: 'grid' | 'floating' | 'popout' }` on
`api.group.api.location.type`.

### 5.4 Popout monitor bug (D6)

PrimeVue `ContextMenu` defaults `appendTo` to the opener's `<body>`, so inside a
popout document the menu teleports to the **opener's** monitor. Build a
**popout-local ContextMenu instance** inside the popout group's panel (scoped into
Phase 5). Must runtime-verify in `pnpm build` preview.

---

## 6. The four behaviors

### 6.1 Maximize — native

Group header action + context menu (center uses its overlay toolbar). Header:
`props.api.isMaximized() ? props.api.exitMaximized() : props.api.maximize()`.
Restore-all via `api.exitMaximizedGroup()` / `api.hasMaximizedGroup()`. Subscribe
`onDidMaximizedGroupChange` to flip the icon (`Maximize2` ↔ `Minimize2`). Gate to
`location.type === 'grid'` (no-op off-grid).

### 6.2 Minimize-to-tray — app-built (D5)

Dockview has **no** native minimize.

- **New Pinia store** `src/stores/minimized.ts`: `entries: MinimizedEntry[]`,
  `minimizePanel(id)`, `restorePanel(id)`, `discard(id)`, `clear()`.
  `MinimizedEntry { panelId, panelType, title, icon, capturedState, originGroupId?, originIndex? }`.
- **Capture:** read `panelStateStore.getState(id)` (panelType, appliedPresetIds,
  state) + the live handle via the panel-instance registry
  (`src/modules/panels/instances.ts`), plus origin group id + tab index. Then
  `api.removePanel(panel)`.
- **Restore:** `api.addPanel({ id, component: panelType, title, position: origin-relative if the group survives else default })`, run the panel's `restore`
  lifecycle hook, write back `appliedPresetIds` (the panel already watches it, so
  the preset cascade re-runs).
- **Tray as a Chrome item:** register `ChromeItemDefinition { id: 'minimized-tray', allowedSlots: ['status-left','status-center','status-right'], defaultSlot: 'status-center', removable: true }` in `BUILTIN_CHROME_ITEMS` +
  `DEFAULT_CHROME_SLOT_ASSIGNMENTS`, and add
  `ensureItemPresent('minimized-tray','status-center')` to `loadProfiles` in
  `src/stores/chrome.ts` (mirrors the existing `theme-toggle` pattern). The
  item's slot placement persists via chrome-profile; the _list_ is session-scoped.
- **Leak fix:** call `minimizedStore.clear()` inside `loadLayout` so entries don't
  survive a workspace switch (an id from workspace A would fail to re-add in B).

### 6.3 Float in-window — native (corrected shape)

`api.addFloatingGroup(group, { x: 120, y: 120, width: 520, height: 360 })` —
`x/y/width/height` are **top-level**; the optional `position` is an
`AnchorPosition` enum (TopLeft/…), **not** a coordinate box. (First draft nested
`{ position: { x, y, width, height } }` — wrong.) Re-dock via a header button
(visible when `location.type === 'floating'`) calling
`group.api.moveTo({ position: 'right' })`. Floating groups **serialize** in
`toJSON/fromJSON`, so they round-trip into IndexedDB for free.

### 6.4 Pop-out separate browser window — native (corrected key)

`containerApi.addPopoutGroup(api.group, { position: { left, top, width, height }, popoutUrl: '/popout.html', onDidOpen, onWillClose }): Promise<boolean>` — the
key is **`position`** typed as `Box = { left, top, width, height }` (**not**
`box`). Must fire from a **real user gesture** (handle a `false`/blocked return).

- **`public/popout.html`** — a new same-origin minimal blank page (required;
  dockview rejects cross-origin / `data:` / `blob:` URLs).
- Live DOM is **relocated** (`appendChild`) into the child window — not a second
  Vue app — so panel-instance handles stay valid. **But** map panels risk WebGL
  context loss on the move (see §8.2); handle there.
- **Theme mirroring (corrected):** `applyTheme()` writes **every** token via
  `root.style.setProperty(...)` plus `data-theme-id`, `data-theme`, `data-density`
  on the main `<html>` — and `useTheme.applyResolved` writes `data-theme`
  separately. So mirroring must copy `data-theme` + `data-theme-id` +
  `data-density` + **all** inline `--*` custom properties into each popout root,
  and **re-sync on every theme change** while a popout is open. Hook **both**
  chokepoints (`applyTheme` and `applyResolved`). Mirroring only the attributes
  leaves the popout on default tokens — broken theming. (The first draft's "no
  inline props" premise was false.) New `usePopoutThemeSync` holds a
  `Set<Window>` and tears down on close.
- **Reload:** popouts are in `toJSON` but the non-gesture `window.open` is
  browser-blocked, so on reload content returns **docked**; re-popout is an
  explicit user action.

---

## 7. Switch button (main ↔ dock swap)

`session.promoteToMain(panelId)` — app-orchestrated (no atomic swap exists):

```ts
async function promoteToMain(panelId) {
  restoring = true;
  const api = getDockviewApi()!;
  let centerGroup = api.getGroup(centerGroupId)!; // re-resolve, never cache
  const incoming = api.getPanel(panelId)!;
  const incomingOldGroup = incoming.api.group; // park destination
  const currentMain = api.getPanel(mainPanelId.value);
  currentMain?.api.moveTo({ group: incomingOldGroup, position: "center", skipSetActive: true });
  incoming.api.moveTo({ group: centerGroup, position: "center" }); // lock blocks DRAG only
  mainPanelId.value = panelId;
  redesignateMain(api.getGroup(centerGroupId)!); // re-apply invariants to new center,
  // and clear them from the group that left
  restoring = false;
}
```

`moveTo({ group, position, skipSetActive })` matches `DockviewGroupMoveParams`;
`position: 'center' | 'right'` are valid. **Re-resolve groups between each move**
— single-panel source groups auto-remove mid-move; if `incomingOldGroup` is gone,
fall back to `currentMain.api.moveTo({ group: api.addGroup() })`. Never self-swap
the current main.

**Where it lives:** dock side — a button in `CommandVueHeaderActions` + a "Switch
with Main Window" context-menu item (non-main grid panels only). Main side — a
"Switch view" `Select`/`Menu` in the `MainWindow` overlay toolbar listing other
panels.

---

## 8. Cross-screen "Pin Main Window here" (content swap)

### 8.1 Honest verdict

A true **window-role transfer** ("make this popout the real main window") is
**infeasible** — the opener owns the single `DockviewComponent`/`DockviewApi`;
popouts are child **render targets**, not independent instances. What ships is a
**content swap**: the on-screen-1 popout displays what was central, and the center
on screen 2 shows the panel that was popped out. The `mainPanelId` designation
re-points so the role follows the content semantically, even though the dockview
instance stays on the opener. Cross-document `moveTo`/`addPopoutGroup` do **true
live-DOM relocation** (`appendChild`), no component re-instantiation.

```ts
restoring = true;
const api = session.getDockviewApi()!; // popout shares the opener's api
const popoutGroup = group; // this tab's popout group
const stash = api.addGroup();
popoutGroup.api.moveTo({ group: stash, skipSetActive: true }); // park popout content
api.getGroup(centerGroupId)!.api.moveTo({ group: popoutGroup, skipSetActive: true }); // center → popout
stash.api.moveTo({ group: api.getGroup(centerGroupId)! }); // stashed → now-empty center
session.redesignateMain(/* group now central */); // re-apply invariants on the new center
restoring = false;
```

### 8.2 Load-bearing risk — WebGL context loss

Cross-**document** re-parenting fires disconnected/connectedCallback and, on most
browsers, **drops the WebGL context** for Cesium / MapLibre canvases. ("Panel
handles stay valid" is true; "the renderer keeps working" is **not** until it
re-inits — the GL context underneath is lost.) Mitigation (D7): snapshot
camera/center/zoom + applied presets + active tool/selection via the
panel-instance registry **before** the move; on the panel's post-move mount, if
the GL context was lost, **re-init the viewer** (held in `shallowRef` per
CLAUDE.md rule 2) and re-apply the snapshot. **This same risk hits Phase 5
pop-out** (re-parenting into a popout document is the same operation), so it must
be solved there first.

### 8.3 Other mitigations

- Re-fetch groups via `api.getGroup(id)` between **every** step (stale refs
  auto-remove).
- `skipSetActive: true` on intermediate moves + the `restoring` guard suppress
  false-dirty churn.
- `noPanelsOverlay='emptyGroup'` + `MainWindow` empty state cover the mid-swap
  flicker.
- Closing the opener window destroys the dockview instance **and** all popouts —
  state this limitation in UX copy.

### 8.4 UX framing

Surface as "Pin Main Window here" in the popout tab's context menu (+ a popout
header button). Tooltip: "Move the main view onto this screen." Do **not** promise
the popout becomes a standalone main window.

---

## 9. User flows

**Maximize / restore** — Header maximize (or right-click → Maximize) → fills the
dock; `onDidMaximizedGroupChange` flips the icon → restore / Esc. Off-grid groups
show it disabled. Center uses its overlay-toolbar maximize.

**Minimize / restore** — Hover a tab → minimize (–) → captures state + handle +
origin, `removePanel`, pushes a tray chip in the status bar → click chip →
`addPanel` near origin, `restore` re-hydrates, presets re-run. Chip `×` discards.
Entries clear on layout/workspace switch.

**Float / redock** — Right-click tab → Float (or header icon) →
`addFloatingGroup(group, { x, y, width, height })` lifts it → header redock button
(`location==='floating'`) → `moveTo({ position: 'right' })`. Persists across save/reload.

**Pop-out to monitor / redock** — Right-click tab → Pop out (real click) →
`addPopoutGroup(group, { position: {…}, popoutUrl, onDidOpen })` opens a child
window; `onDidOpen` mirrors theme + tokens; watch GL-context-loss on maps → drag
to monitor 2 → redock via header (`location==='popout'`) or close the child window
→ on full reload, content returns **docked**.

**Tab context menu** — Right-click any tab → native menu suppressed, PrimeVue menu
at cursor → items per §5.3 → in a popout document, the menu renders on the popout's
monitor (Phase 5 fallback).

**Switch main ↔ dock** — Dock header "Switch" / tab menu → `promoteToMain` parks
center into the panel's old group, moves the panel into the locked center,
`redesignateMain` re-applies invariants, the group that left center regains its
header. Reverse via switch again or the main overlay "Switch view" menu.

**Cross-screen "Pin Main Window here"** (popout on screen 1, main on screen 2) —
Right-click the popped-out panel's tab → "Pin Main Window here" (popout location +
main exists) → snapshot map/3D → temp-stash popout content → move center content
into the popout group on screen 1 → drop stashed content into the now-empty center
on screen 2 → `redesignateMain` → maps re-init GL if lost and re-apply snapshot.
The dockview instance still lives on the opener (content moved, role didn't).

---

## 10. Data-model & persistence changes

**`src/stores/session.ts`**

- New `mainPanelId` ref (current main panel instance id) + `centerGroupId`
  tracking; `panelRegistry.mainPanelType()` seeds it.
- New `restoring` flag; gate `markDirty` on `!restoring`.
- New `applyCenterInvariants(api)` — called once as the **last** statement of
  `loadLayout` after all branches converge.
- New `promoteToMain(panelId)`, `redesignateMain(group)`, `removePanelGuarded(id)`
  (refuses the current main).
- New `minimizedStore.clear()` call inside `loadLayout`.
- `rebuildFromPanelStates` rewritten (main first, relative docking, `dockHint`,
  duplicate-id guard).

**`layoutRepo` toJSON/fromJSON** — no schema change; `floatingGroups` /
`popoutGroups` / `edgeGroups` round-trip via `api.toJSON()`. Invariants are
**code-applied** after `fromJSON`, never serialized. Add a regression test for a
layout containing a popout group through `saveCurrentAsNewLayout` (the id-rewrite
`split/join` is safe for ULIDs but test it rather than assume).

**`panelRegistry`** — `PanelDefinition` gains `mainPanel?: boolean`; `cesium`
flagged `mainPanel: true`; add `panelRegistry.mainPanelType()`.

**`src/stores/minimized.ts`** — new session/layout-scoped store (§6.2); in-memory
v1, cleared on `loadLayout`.

**Theme mirroring** — `usePopoutThemeSync` mirrors `data-theme` + `data-theme-id`

- `data-density` + all inline `--*` into each popout root, re-syncing on both
  `applyTheme` and `applyResolved` (§6.4).

---

## 11. Feasibility verdict (per feature)

| Feature                               | Verdict                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Tab-less central main window          | **App-built** on dockview (`header.hidden` + `locked` + `setConstraints`, all verified settable)         |
| Per-tab close                         | **Native** (`api.close()`) via custom tab                                                                |
| Per-tab minimize → tray               | **App-built** (no native minimize)                                                                       |
| Maximize                              | **Native**                                                                                               |
| Float in-window                       | **Native** (top-level `{x,y,width,height}`)                                                              |
| Pop-out to monitor                    | **Native**, **needs-compromise**: reload returns docked; theme must be mirrored; WebGL-loss risk on maps |
| Switch main ↔ dock                    | **App-built** (non-atomic two-`moveTo`)                                                                  |
| Right-click context menu              | **Native primitive reused**; popout-monitor fallback in Phase 5                                          |
| "Pin to this" as window-role transfer | **Infeasible** → reframed as content swap, gated                                                         |

---

## 12. Phased plan (7 PRs, each runtime-verified before its PR)

Each phase is one independently-shippable PR to `develop`, ending with Stage-1
Playwright verification. Screenshots to `.verification-screenshots/<branch>/`.

1. **Central main-window model + invariants.** `mainPanel?` flag; `cesium` flagged;
   `MainWindow` overlay shell + in-panel empty state; session `mainPanelId` /
   `restoring` / `applyCenterInvariants` (post-convergence) / `removePanelGuarded`;
   `rebuildFromPanelStates` rewrite + idempotent legacy backfill;
   `noPanelsOverlay='emptyGroup'`. **Verify:** center has no tab strip; nothing
   drags in; min-size holds; reload re-applies invariants; legacy layout
   backfills; session **not** dirty after a clean load.
2. **Custom tab + header actions + context menu.** Corrected `tabComponents` /
   `defaultTabComponent` wiring; `CommandVueTab` (close + minimize, hover-reveal,
   `@mousedown.stop`); `CommandVueHeaderActions`; `useTabContextMenu`; `tabMenuKey`;
   hoisted `ui/ContextMenu`. **Verify:** right-click opens at cursor; buttons don't
   start a drag; off-grid items disabled; Close disabled on main.
3. **Maximize + Float.** Corrected float shape; maximize icon-flip via
   `onDidMaximizedGroupChange`. **Verify:** maximize fills/restores; float
   lifts/redocks; floating survives save/reload.
4. **Minimize-to-tray** (independent of 3). `minimized` store + tray Chrome item +
   capture/restore + `clear()` on `loadLayout`. **Verify:** minimize removes +
   chips; restore re-mounts + re-applies presets; clears on workspace switch.
5. **Pop-out + theme mirroring.** Corrected `position` key; `public/popout.html`;
   `usePopoutThemeSync` (both chokepoints); popout-local context-menu fallback;
   blocked-popup handling; **WebGL re-init for maps**. **Verify in `pnpm build`
   preview:** child window themed incl. tokens; toggle re-syncs; map renders (no
   GL-context-lost in console); close redocks; reload returns docked; menu on the
   right monitor.
6. **Switch button.** `promoteToMain` + `redesignateMain`; header button + tab
   menu + main overlay "Switch view". **Verify:** content swaps into/out of center;
   invariants re-apply; old center regains header.
7. **Cross-screen "Pin Main Window here"** (riskiest; depends on 5 + 6). Gated on
   D1 (accepted) **and** Phase 5's WebGL re-init proving out for **both** Cesium
   and MapLibre. Two-move swap; snapshot→move→restore with GL re-init. **Verify in
   `pnpm build` preview:** pin swaps content across windows; Cesium + MapLibre
   re-init without a frozen canvas; group refs re-resolved; no orphaned center.

---

## 13. Open items to confirm at spec review

- **Default main panel:** `cesium` (3D Globe) vs `maplibre` (2D Map). Spec assumes
  `cesium`; `maplibre` is lighter for the Phase-7 GL move. One-flag change.
- **Minimized-tray default slot:** `status-center` assumed; confirm vs
  `status-left`/`status-right`.
- **Esc-to-restore** for maximize: include in Phase 3 or defer.
