# Track B — Dockview Windowing & Clean-Panes Model (Design Spec)

> **Internal planning document.** Do not reference from public docs, READMEs, or
> changelogs. Lives under `.internal/` per the project convention for private
> planning. Last updated: 2026-05-31.
>
> Status: **Design approved** (decisions locked with the maintainer, see §2).
> Ready for implementation-plan breakdown (`writing-plans`) once this spec is
> reviewed.
>
> **v2 note:** the "single pinned main window" of v1 is generalized to
> **clean (header-less) panes** — any number, freely arranged — per the
> maintainer's reshape. The status-bar minimize tray is replaced by **floating
> minimized-window bars**. Sections affected: §3, §6.2, §7. Verified dockview
> facts and the tab/context-menu/behavior sections carry over unchanged.

---

## 1. Goal

Bring VS Code-/IDE-style windowing to CommandVue's Dockview surface. Today a
panel tab has **only a close button** — no maximize, minimize, float, or pop-out,
and every group always shows a tab strip (~5–10px) even for primary content. This
track adds:

1. **Clean (header-less) panes** — content groups with **no tab strip**, so the
   map (or any panel) uses the full pane height. One _or many_, arranged freely:
   Cesium right + MapLibre left, two side-by-side, three across with one along the
   bottom — whatever the content wants.
2. Per-tab **close + minimize** on normal (tabbed) panels, and per-group-header
   **maximize / float / pop-out** actions.
3. A **right-click context menu** on tabs (the full superset of actions).
4. The four behaviors: **maximize**, **minimize** (to floating bars), in-window
   **float**, separate-browser-window **pop-out** (theme mirrored into the child).
5. A **"Hide header" / "Show header"** toggle to convert any group between clean
   and tabbed.
6. **Cross-window relocation** — move a panel between the main window and a
   pop-out window via a menu ("Send to window" / "Bring here"), not just by drag.

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

| #   | Decision                            | Choice                                                                                                                                                                                                        |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Central model                       | **Clean (header-less) panes**, any number, freely arranged. No single privileged "main window."                                                                                                               |
| D2  | Clean-pane mechanism                | **Per-group `header.hidden` toggle** ("Hide header"); splits inherit clean mode; controls via a **hover overlay**.                                                                                            |
| D3  | Default clean content               | **Cesium (3D Globe)** is seeded as the first clean pane. `maplibre` is the obvious second pane.                                                                                                               |
| D4  | Tab buttons (tabbed groups)         | **Close + minimize on every tab**, hover-revealed.                                                                                                                                                            |
| D5  | Float / Pop-out reach               | **Both** the group-header / pane-overlay actions **and** the right-click menu.                                                                                                                                |
| D6  | Minimize UX                         | **Floating minimized-window bars** stacked **bottom-left, just above the status bar** (title + restore + maximize + close). **Not** a status-bar tray. In-memory for v1 (cleared on layout/workspace switch). |
| D7  | Cross-screen "pin"                  | Generalized to **cross-window relocation** ("Send this view to that window") — content move + GL re-init. Phase 6, gated. True window-role transfer remains infeasible (§7).                                  |
| D8  | Pop-out context-menu                | **Build the popout-local menu fallback** in Phase 5 (PrimeVue ContextMenu otherwise teleports to the opener's monitor).                                                                                       |
| D9  | Cross-window map snapshot           | Capture **camera/center/zoom + applied presets + active tool/selection** before the move; re-init GL + re-apply after.                                                                                        |
| D10 | Clean panes are **not** hard-locked | Freely arrangeable/splittable (the user builds the 2-up / 3+1 layouts). A guard keeps the workspace from going fully empty.                                                                                   |

---

## 3. The clean-panes model

Dockview 6.6.1 has **no first-class "editor area" / center** concept and no
"main window." Instead, **any group can be in one of two modes**, toggled live:

- **Clean** — `group.header.hidden = true`. No tab strip; the panel fills the
  pane. Controls come from a **hover overlay** (§3.3). A clean group holds exactly
  **one** panel (with no tabs there's no way to switch within it).
- **Tabbed** — normal group with a tab strip, per-tab close + minimize (§4), and
  the right-click context menu (§5).

`group.header.hidden` is `IHeader.hidden` — **verified settable** on the live
group model. This single property is the whole clean/tabbed switch.

### 3.1 Creating & arranging clean panes (D1, D2, D10)

- **Toggle:** a "Hide header" action sets the active panel's group clean; "Show
  header" reverts it. If the group has >1 panel, the action first splits the
  active panel into its own group (a clean pane is single-panel), then hides the
  header.
- **Splits inherit:** splitting a clean pane via its overlay **"Split"** control
  creates the new neighbor clean too. (Native drag-to-split makes a _tabbed_
  group; we best-effort inherit via `onDidAddGroup` when the source was clean,
  else the user toggles it — a Phase-1 detail to validate, not a correctness
  risk.)
- **Free arrangement:** clean panes are **not** locked or force-constrained (D10)
  — the user drags/splits them into 2-up, 3-up, 3+1, Cesium-right + MapLibre-left,
  etc. (v1 of the spec locked a single main; that lock is dropped.)
- **Seed:** `cesium` is seeded as one clean pane (D3); everything else seeds
  tabbed. Optional registry hint `mainPane?: boolean` on `PanelDefinition` marks
  the default-clean type for seeding and "add as clean pane" UX.

### 3.2 Persisting clean mode (the #1 silent breakage)

`header.hidden` is **not** in `toJSON()` (only grid/floating/popout/edge geometry

- panels serialize). So clean mode must be **persisted by us and re-applied after
  every load path**:

* Persist `headerless: true` in the panel's `PanelState.state`
  (`Record<string, unknown>`, verified writable) when a pane is made clean.
* New `applyHeaderlessGroups(api)`: for every panel whose state is `headerless`,
  set `panel.group.header.hidden = true`. Call it as the **last statement of
  `session.loadLayout` after all branches converge** (right before
  `loadedLayoutId.value = layoutId`). `loadLayout` fans out (try-`fromJSON` /
  catch→rebuild / else→rebuild) and is reached transitively by `switchWorkspace`,
  `discardChanges`, and `saveCurrentAsNewLayout`; the single post-convergence
  chokepoint covers them all. A regression test asserts clean mode survives a
  `toJSON`→`fromJSON` round-trip.

### 3.3 Clean-pane controls (hover overlay)

A clean pane has no header to host buttons, so controls appear as a **hover
overlay** (top-right of the pane), revealed on `group-hover`, invisible at rest
(max content space). Buttons: **minimize · maximize/restore · float · pop-out ·
split · show-header · close**.

Implementation: a lightweight overlay positioned over the hovered clean group via
its DOM rect (`group.element`), so it works for **any** clean pane regardless of
panel type — no per-panel opt-in. (Phase-1/2 detail to validate; fallback is a
shared `<CleanPaneControls>` mounted by panels that can be clean.)

### 3.4 `restoring` guard — false-dirty prevention

`DockLayout.vue` subscribes `onDidLayoutChange(() => session.markDirty())` in
`onReady`, **before** the first `loadLayout`. Applying `header.hidden`, toggling
clean mode, and the cross-window moves all mutate the layout and would fire a
false `markDirty`. Add a **net-new** `restoring` flag to the session store; gate
`markDirty` on `!restoring`; set it around invariant application and multi-move
orchestrations. (`loadLayout` ends with `dirty.value = false`, which masks
first-boot but **not** later toggles/moves.)

### 3.5 `rebuildFromPanelStates` rewrite + backward compat

Today it loops `api.addPanel({ id, component, title })` with no position in
arbitrary order. Rewrite to: add panels (reading an optional `dockHint` side from
`PanelState.state`, default `'right'`), then `applyHeaderlessGroups`. Seeded/old
layouts (no `headerless`, no Cesium-clean) get Cesium promoted to a clean pane at
a **single idempotent insertion point** (not in both `seed.ts` and `loadLayout`).
`applyHeaderlessGroups` is a safe no-op when nothing is flagged headerless.

### 3.6 `noPanelsOverlay`

Add `noPanelsOverlay='emptyGroup'` to `<DockviewVue>` so a pane region persists
during mid-move empty moments; render an in-panel empty state.

---

## 4. Tab UI & controls (tabbed groups)

### 4.1 Registration (corrected prop names)

On `<DockviewVue>` (currently a bare single line in `DockLayout.vue`):

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

> **Corrected from v1 draft:** the tab map prop is `tabComponents`, the
> default-tab prop is `defaultTabComponent` (there is **no** `defaultTabRenderer`),
> and `components` is the panel/header map (separate). Wiring the tab via
> `:components` + `:defaultTabRenderer` does nothing.

### 4.2 Component split

- **Per-panel tab** — `src/components/layout/dock/CommandVueTab.vue` (hand-rolled;
  `DockviewDefaultTab` is React-only). Receives
  `IDockviewPanelHeaderProps = IGroupPanelBaseProps & { tabLocation }`; reach the
  group via `api.group` (no `group` field). Owns per-tab **close** (`api.close()`)
  and per-tab **minimize** (§6.2).
- **Per-group header actions** — `src/components/layout/dock/CommandVueHeaderActions.vue`
  (`IDockviewHeaderActionsProps`: group `api` with `location`, `containerApi`,
  `group`, `panels`, `activePanel`, `isGroupActive`). Owns **maximize/restore,
  float, pop-out, hide-header** (convert to clean), and conditional re-dock.

**Rule:** per-panel (close, minimize) → tab; per-group (maximize, float, pop-out,
hide-header) → header; context menu → full superset. Clean panes route everything
through the hover overlay (§3.3).

### 4.3 Close + minimize placement (D4)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▸ Telemetry – ✕ │  Entities – ✕ │  Briefing – ✕ │       · ⤢ ⧉ ↗ ⊟ · │
└──────────────────────────────────────────────────────────────────────┘
   per-tab minimize(–) + close(✕), hover-revealed   header: max·float·popout·hide-header
```

Hover-reveal via `opacity-0 group-hover/tab:opacity-100` keeps a dense, many-tab
strip clean. `IconButton` forces `aria-label` from its required `label`.

### 4.4 Interference rules (load-bearing)

- Buttons use `@mousedown.stop` (dockview begins drag on mousedown) +
  `stopPropagation()`. Add `@pointerdown.stop` **iff** runtime-verify shows
  dockview binds pointerdown (confirm in `pnpm dev`).
- **Never** `stopPropagation` on the tab root's left-click (breaks activate +
  drag). Only the buttons and `@contextmenu` stop propagation.

---

## 5. Tab context menu

### 5.1 Primitive — reuse the existing wrapper (no new install)

Use `src/components/ui/ContextMenu.vue` (hand-rolled PrimeVue `ContextMenu`,
unstyled, `show(event)` / `hide()`, density-tokened, already used by
`AppIconItem.vue`). **Do not** `npx volt-vue add ContextMenu` (Volt has no
ContextMenu; the project ships its own). Library-first, zero new dependency.

### 5.2 One hoisted menu, re-targeted per right-click

A dense dashboard has many tabs; one `<ContextMenu>` per tab is wasteful. Hoist a
**single** `<ContextMenu ref="cm" :model="menuItems">` into `DockLayout.vue`,
`provide()` an `openTabMenu(event, items)` via a new `tabMenuKey` in
`src/components/layout/keys.ts`. Each `CommandVueTab` builds its `MenuItem[]` in a
`useTabContextMenu(props)` composable and calls the injected opener. In
`onContextMenu`: `preventDefault()` + `stopPropagation()` then `openTabMenu`.

### 5.3 Menu model + verified API routing

| Item                       | Visible / disabled                                     | Call                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hide header (make clean)   | tabbed grid groups                                     | split active panel to its own group → `group.header.hidden = true`; persist `headerless`                                                                        |
| Pop out to external window | always                                                 | `containerApi.addPopoutGroup(api.group, { position: { left, top, width, height }, popoutUrl: '/popout.html', onDidOpen, onWillClose })` — key is **`position`** |
| Float in window            | disabled when `api.group.api.location.type !== 'grid'` | `containerApi.addFloatingGroup(api.group, { x, y, width, height })` — **top-level** coords                                                                      |
| Maximize / Restore         | disabled off-grid; label flips on `api.isMaximized()`  | `api.maximize()` / `api.exitMaximized()`                                                                                                                        |
| Minimize                   | always                                                 | `minimizedStore.minimizePanel(api.id)`                                                                                                                          |
| Send to window…            | when ≥1 pop-out exists                                 | cross-window relocation (§7)                                                                                                                                    |
| Close                      | always                                                 | `api.close()`                                                                                                                                                   |
| Close others in group      | always                                                 | iterate `api.group.panels`, `containerApi.removePanel(p)`                                                                                                       |

Gating uses `DockviewGroupLocation = { type: 'grid' | 'floating' | 'popout' }` on
`api.group.api.location.type`. Clean panes expose the same set from their hover
overlay plus "Show header."

### 5.4 Pop-out monitor bug (D8)

PrimeVue `ContextMenu` defaults `appendTo` to the opener's `<body>`, so inside a
pop-out document the menu teleports to the **opener's** monitor. Build a
**popout-local ContextMenu instance** inside the pop-out group's panel (scoped
into Phase 5). Runtime-verify in `pnpm build` preview.

---

## 6. The four behaviors

### 6.1 Maximize — native

Group-header action (tabbed) / overlay (clean) + context menu. Header:
`props.api.isMaximized() ? props.api.exitMaximized() : props.api.maximize()`.
Restore-all via `api.exitMaximizedGroup()` / `api.hasMaximizedGroup()`. Subscribe
`onDidMaximizedGroupChange` to flip the icon (`Maximize2` ↔ `Minimize2`). Gate to
`location.type === 'grid'` (no-op off-grid).

### 6.2 Minimize → floating minimized-window bars (D6)

Dockview has **no** native minimize. A minimized panel (clean or tabbed) collapses
to a small **floating title bar**, classic-Windows style.

- **Where:** an app-shell overlay anchored **bottom-left, just above the status
  bar** (`position: absolute; left: 0; bottom: var(--density-statusbar-height)`),
  stacking bars horizontally; z above the dock, below modals. **Not** a Chrome
  status-bar item — the status bar stays the app's, uncluttered.
- **Each bar:** panel icon + title + **restore** + **maximize** + **close**.
  Clicking the title or restore re-opens the panel near its origin; maximize =
  restore-then-maximize; close discards.
- **Store:** new Pinia `src/stores/minimized.ts` — `entries: MinimizedEntry[]`,
  `minimizePanel(id)`, `restorePanel(id)`, `discard(id)`, `clear()`.
  `MinimizedEntry { panelId, panelType, title, icon, wasClean, capturedState, originGroupId?, originIndex? }`.
- **Capture:** read `panelStateStore.getState(id)` + the live handle via the
  panel-instance registry (`src/modules/panels/instances.ts`) + origin group/index
  - `wasClean`, then `api.removePanel(panel)`.
- **Restore:** `api.addPanel(... position near origin if the group survives ...)`,
  re-apply `headerless` if `wasClean`, run the panel's `restore` hook, write back
  `appliedPresetIds` (re-runs the preset cascade).
- **Render:** new `src/components/layout/MinimizedDock.vue` (the bottom-left
  overlay) + `MinimizedBar.vue`, mounted in `AppShell`. Reads the `minimized`
  store.
- **Leak fix:** `minimizedStore.clear()` inside `loadLayout` (D6, in-memory v1).

```
                                              … dock content …
┌───────────────┐ ┌───────────────┐
│ ▦ Telemetry  ⤢ ✕ │ │ ▦ Briefing  ⤢ ✕ │      ← floating minimized bars
└───────────────┘ └───────────────┘
[───────────────── status bar (full width, untouched) ─────────────────]
```

### 6.3 Float in-window — native (corrected shape)

`api.addFloatingGroup(group, { x: 120, y: 120, width: 520, height: 360 })` —
`x/y/width/height` are **top-level**; the optional `position` is an
`AnchorPosition` enum, **not** a coordinate box. (v1 draft nested
`{ position: { x, y, … } }` — wrong.) Re-dock via a conditional button (visible
when `location.type === 'floating'`) → `group.api.moveTo({ position: 'right' })`.
Floating groups **serialize** in `toJSON/fromJSON`, so they round-trip into
IndexedDB for free.

### 6.4 Pop-out separate browser window — native (corrected key)

`containerApi.addPopoutGroup(api.group, { position: { left, top, width, height }, popoutUrl: '/popout.html', onDidOpen, onWillClose }): Promise<boolean>` — the
key is **`position`** typed as `Box = { left, top, width, height }` (**not**
`box`). Must fire from a **real user gesture** (handle a `false`/blocked return).

- **`public/popout.html`** — new same-origin minimal blank page (required;
  dockview rejects cross-origin / `data:` / `blob:` URLs).
- Live DOM is **relocated** (`appendChild`) into the child window — not a second
  Vue app — so panel-instance handles stay valid. **But** map panels risk WebGL
  context loss on the move (see §7.2); handle there.
- **Theme mirroring (corrected):** `applyTheme()` writes **every** token via
  `root.style.setProperty(...)` plus `data-theme-id`, `data-theme`, `data-density`
  on the main `<html>`; `useTheme.applyResolved` writes `data-theme` separately.
  So mirroring must copy `data-theme` + `data-theme-id` + `data-density` + **all**
  inline `--*` custom properties into each pop-out root, and **re-sync on every
  theme change** while a pop-out is open. Hook **both** chokepoints (`applyTheme`
  and `applyResolved`). Mirroring only the attributes leaves the pop-out on
  default tokens — broken theming. (v1's "no inline props" premise was false.) New
  `usePopoutThemeSync` holds a `Set<Window>`, tears down on close. **This is the
  same theme machinery Track A's pop-outable Theme Studio rides.**
- **Reload:** pop-outs are in `toJSON` but the non-gesture `window.open` is
  browser-blocked, so on reload content returns **docked**; re-pop-out is explicit.

---

## 7. Cross-window relocation ("Send this view to that window")

### 7.1 Honest verdict

A true **window-role transfer** is **infeasible** — the opener owns the single
`DockviewComponent`/`DockviewApi`; pop-outs are child **render targets**, not
independent instances. What ships (generalized from the v1 "Pin Main Window
here"): a **menu-driven content move** between the main window and an existing
pop-out window — "Send to window N" from a panel's menu, or "Bring here" from
inside a pop-out. Cross-document `moveTo`/`addPopoutGroup` do **true live-DOM
relocation** (`appendChild`), no component re-instantiation.

```ts
// "Send panel X to popout group G" (both share the opener's api)
restoring = true;
const api = session.getDockviewApi()!;
const panel = api.getPanel(panelId)!;
panel.api.moveTo({ group: api.getGroup(targetGroupId)! }); // re-resolve, never cache
restoring = false;
```

### 7.2 Load-bearing risk — WebGL context loss (D9)

Cross-**document** re-parenting fires disconnected/connectedCallback and, on most
browsers, **drops the WebGL context** for Cesium / MapLibre canvases. ("Panel
handles stay valid" is true; "the renderer keeps working" is **not** until it
re-inits.) Mitigation: snapshot camera/center/zoom + applied presets + active
tool/selection via the panel-instance registry **before** the move; on the panel's
post-move mount, if the GL context was lost, **re-init the viewer** (held in
`shallowRef` per CLAUDE.md rule 2) and re-apply the snapshot. **This same risk
hits Phase 5 pop-out**, so it must be solved there first.

### 7.3 Other mitigations

- Re-fetch groups via `api.getGroup(id)` between **every** step (stale refs
  auto-remove).
- `skipSetActive: true` on intermediate moves + the `restoring` guard suppress
  false-dirty churn.
- Closing the opener window destroys the dockview instance **and** all pop-outs —
  state this limitation in UX copy.

### 7.4 UX framing

Surface as "Send to [window]" in a panel's tab/overlay menu and "Bring to this
window" inside a pop-out. Do **not** promise a pop-out becomes a standalone
independent app window.

---

## 8. User flows

**Make a clean pane** — Right-click a tabbed panel → "Hide header" (or header
"hide-header" icon) → its group loses the tab strip; the panel fills the pane;
`headerless` persisted. "Show header" reverts. Split a clean pane via its overlay
**Split** → the neighbor is clean too.

**Maximize / restore** — Header/overlay maximize (or right-click → Maximize) →
`api.maximize()` fills the dock; `onDidMaximizedGroupChange` flips the icon →
restore / Esc. Off-grid groups show it disabled.

**Minimize / restore** — Tab minimize (–) / overlay minimize → captures state +
handle + origin + `wasClean`, `removePanel`, adds a **floating bar bottom-left
above the status bar** → click the bar / restore → `addPanel` near origin,
re-apply clean if needed, `restore` re-hydrates, presets re-run. Maximize on the
bar = restore-then-maximize; ✕ discards. Bars clear on layout/workspace switch.

**Float / redock** — Right-click tab / overlay → Float →
`addFloatingGroup(group, { x, y, width, height })` lifts it → conditional redock
(`location==='floating'`) → `moveTo({ position: 'right' })`. Persists across
save/reload.

**Pop-out to monitor / redock** — Right-click tab / overlay → Pop out (real
click) → `addPopoutGroup(group, { position: {…}, popoutUrl, onDidOpen })` opens a
child window; `onDidOpen` mirrors theme + tokens; watch GL-context-loss on maps →
drag to monitor 2 → redock (`location==='popout'`) or close the child window → on
full reload, content returns **docked**.

**Tab context menu** — Right-click any tab → native menu suppressed, PrimeVue menu
at cursor → items per §5.3 → in a pop-out document, the menu renders on the
pop-out's monitor (Phase 5 fallback).

**Cross-window relocation** — With a pop-out open: panel menu → "Send to
[window]" moves the panel into that pop-out's group; from inside the pop-out,
"Bring to this window" pulls a panel across. Map/3D panels snapshot → move →
re-init GL if lost → re-apply snapshot.

---

## 9. Data-model & persistence changes

**`src/stores/session.ts`**

- New `restoring` flag; gate `markDirty` on `!restoring`.
- New `applyHeaderlessGroups(api)` — called once as the **last** statement of
  `loadLayout` after all branches converge.
- New `toggleHeaderless(panelId)` (split-to-own-group if needed, flip
  `header.hidden`, persist `headerless` in `PanelState.state`).
- New `sendPanelToWindow(panelId, targetGroupId)` (§7) + `removePanelGuarded` (a
  guard so the workspace can't be emptied of all panels).
- New `minimizedStore.clear()` call inside `loadLayout`.
- `rebuildFromPanelStates` rewritten (relative docking via `dockHint`,
  `applyHeaderlessGroups`, idempotent Cesium-clean backfill for old layouts).

**`layoutRepo` toJSON/fromJSON** — no schema change; `floatingGroups` /
`popoutGroups` / `edgeGroups` round-trip via `api.toJSON()`. Clean mode is
**code-applied** from persisted `PanelState.state.headerless` after `fromJSON`,
never serialized into the dockview blob. Add a regression test for a layout with a
clean pane + a floating group + a pop-out group through `saveCurrentAsNewLayout`
(the id-rewrite `split/join` is ULID-safe but test it).

**`panelRegistry`** — `PanelDefinition` gains optional `mainPane?: boolean`
(Cesium set true — seeds as clean). Additive, safe alongside `singleton?`.

**`src/stores/minimized.ts`** — new session/layout-scoped store (§6.2); in-memory
v1, cleared on `loadLayout`.

**Theme mirroring** — `usePopoutThemeSync` mirrors `data-theme` + `data-theme-id`

- `data-density` + all inline `--*` into each pop-out root, re-syncing on both
  `applyTheme` and `applyResolved` (§6.4).

---

## 10. Feasibility verdict (per feature)

| Feature                                  | Verdict                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Clean (header-less) panes, any number    | **App-built** on dockview (`header.hidden` per group, verified settable; persisted + re-applied)         |
| Per-tab close                            | **Native** (`api.close()`) via custom tab                                                                |
| Per-tab/overlay minimize → floating bars | **App-built** (no native minimize)                                                                       |
| Maximize                                 | **Native**                                                                                               |
| Float in-window                          | **Native** (top-level `{x,y,width,height}`)                                                              |
| Pop-out to monitor                       | **Native**, **needs-compromise**: reload returns docked; theme must be mirrored; WebGL-loss risk on maps |
| Hide/Show header toggle                  | **App-built** (`header.hidden` toggle + persist)                                                         |
| Right-click context menu                 | **Native primitive reused**; pop-out-monitor fallback in Phase 5                                         |
| Cross-window relocation                  | **App-built** on native `moveTo`; needs GL re-init for maps                                              |
| True window-role transfer                | **Infeasible** → reframed as cross-window content move, gated                                            |

---

## 11. Phased plan (6 PRs, each runtime-verified before its PR)

Each phase is one independently-shippable PR to `develop`, ending with Stage-1
Playwright verification. Screenshots to `.verification-screenshots/<branch>/`.

1. **Clean-panes foundation.** `mainPane?` flag; Cesium seeded clean; session
   `restoring` / `applyHeaderlessGroups` (post-convergence) / `toggleHeaderless` /
   `removePanelGuarded`; `headerless` persisted in `PanelState.state`;
   `rebuildFromPanelStates` rewrite + idempotent legacy backfill; hover-overlay
   control shell (show/hide-header + close + split); `noPanelsOverlay='emptyGroup'`.
   **Verify:** a clean pane has no tab strip; Hide/Show header toggles; split makes
   a second clean pane; Cesium-right + MapLibre-left arrangement holds across
   reload; session **not** dirty after a clean load.
2. **Tabbed tab controls + header actions + context menu.** Corrected
   `tabComponents` / `defaultTabComponent` wiring; `CommandVueTab` (close +
   minimize, hover-reveal, `@mousedown.stop`); `CommandVueHeaderActions`;
   `useTabContextMenu`; `tabMenuKey`; hoisted `ui/ContextMenu`. **Verify:**
   right-click opens at cursor; buttons don't start a drag; off-grid items
   disabled.
3. **Maximize + Float.** Corrected float shape; maximize icon-flip via
   `onDidMaximizedGroupChange`; both tab-header and clean-overlay surfaces.
   **Verify:** maximize fills/restores; float lifts/redocks; floating survives
   save/reload.
4. **Minimize → floating bars.** `minimized` store + `MinimizedDock`/`MinimizedBar`
   (bottom-left above status bar) + capture/restore (incl. `wasClean`) + `clear()`
   on `loadLayout`. **Verify:** minimize removes + adds a bar; restore re-mounts +
   re-applies clean/state/presets; bars clear on workspace switch; status bar
   unaffected.
5. **Pop-out + theme mirroring.** Corrected `position` key; `public/popout.html`;
   `usePopoutThemeSync` (both chokepoints); pop-out-local context-menu fallback;
   blocked-popup handling; **WebGL re-init for maps**. **Verify in `pnpm build`
   preview:** child window themed incl. tokens; toggle re-syncs; map renders (no
   GL-context-lost in console); close redocks; reload returns docked; menu on the
   pop-out's monitor.
6. **Cross-window relocation** (riskiest; depends on 5). "Send to window" / "Bring
   here"; map/3D snapshot→move→re-init GL. Gated on D7 (accepted) **and** Phase 5's
   WebGL re-init proving out for **both** Cesium and MapLibre. **Verify in
   `pnpm build` preview:** relocation moves content across windows; Cesium +
   MapLibre re-init without a frozen canvas; group refs re-resolved; no orphaned
   panes.

---

## 12. Open items to confirm at spec review

- **Clean-pane controls overlay** — the hover-overlay-over-group-rect approach
  (§3.3) vs a shared `<CleanPaneControls>` mounted by clean-capable panels.
  Validated in Phase 1.
- **Splits inherit clean** — overlay "Split" inherits reliably; native
  drag-to-split best-effort via `onDidAddGroup`. Confirm that "native drag makes a
  tabbed group you then toggle" is acceptable.
- **Esc-to-restore** for a maximized pane — Phase 3 or defer.
- **Empty-workspace guard** — confirm a workspace must keep ≥1 panel (so it never
  goes fully blank).
