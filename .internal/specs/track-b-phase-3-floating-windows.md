# Track B Phase 3 — Floating Overlay Windows with Map-See-Through Opacity

**Status:** Spec (design verified; awaiting maintainer decisions §9 + PR #103 merge before implementation).
**Author:** Research-workflow synthesis (6-agent: Osiris UX · dockview API · transparency-over-WebGL · CommandVue integration · synthesis · adversarial critique) curated by Claude.
**Scope:** Pop a docked panel out of the grid into an in-window floating overlay; drag/resize it; control its **background** see-through opacity so the Cesium/MapLibre map shows through (content stays full-color); re-dock by drag or menu. Triggered from the existing right-click dock context menu.
**Out of scope (deferred):** separate-browser-window pop-out (`addPopoutGroup`), minimize-to-tray, cross-window relocation, frosted-glass blur, a continuous opacity slider. Those remain in the broad Track B spec (`track-b-dockview-windowing.md`).

> Raw research briefs (Osiris, dockview, transparency, integration, design, critique) are archived under the session temp dir; this spec is the distilled, correction-applied source of truth.

---

## 1. User flows

1. **Float** — right-click a docked pane → **Float window**. The pane lifts into a draggable/resizable overlay above the grid, keeping a header (drag handle). Session → dirty.
2. **Move / resize** — drag the float's header to move; drag edges/corners to resize. Both native; clamped within the viewport.
3. **Re-dock** — drag the float's header over the grid and drop on a standard drop target (native), **or** right-click the float → **Dock back** (programmatic; docks to a new right-edge grid group).
4. **Set opacity** — right-click a floating pane → **Opacity ▸** → **100 / 75 / 50 / 25 %**. The float's _background_ fades so the map shows through; text/icons/borders stay crisp. Active level shows a check. Session → dirty.
5. **Survive reload** — float position/size restore via dockview's native `toJSON`/`fromJSON`; opacity restores from `PanelState.state` re-applied on load. A layout mixing docked + clean (headerless) + floating-dimmed panes reloads identically.

---

## 2. Native dockview vs custom (verified against installed `dockview-core@6.6.1` `.d.ts` + `.js`)

| Capability                              | Native?                           | API / mechanism                                                                                                                                                                                        |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lift panel → in-window floating overlay | **Native**                        | `api.addFloatingGroup(item, { width, height, x, y, position? })` → returns **void**; re-resolve via `panel.api.group`                                                                                  |
| Drag float around / resize float        | **Native**                        | overlay header drag + resize handles on `.dv-resize-container`                                                                                                                                         |
| Drag float back into grid               | **Native**                        | standard drop targets                                                                                                                                                                                  |
| Programmatic re-dock                    | **Native (traced)**               | `panel.api.group.api.moveTo({ position: "right" })` → internally `addGroup({direction:'right'})` then moves the panel into the new **grid** group (dockviewGroupPanelApi.js:114-128). **C1 resolved.** |
| Detect floating                         | **Native**                        | `panel.api.location.type === "floating"` (`DockviewGroupLocation = grid \| floating \| popout \| edge`)                                                                                                |
| Persist float pos/size                  | **Native**                        | `toJSON().floatingGroups[].position` (`AnchoredBox`); `fromJSON` restores                                                                                                                              |
| React to float↔dock                     | **Native**                        | `panel.api.onDidLocationChange`                                                                                                                                                                        |
| Viewport clamping                       | **Native (layout opt)**           | `floatingGroupBounds: "boundedWithinViewport"` (valid `<DockviewVue>` prop)                                                                                                                            |
| **Background opacity / see-through**    | **CUSTOM**                        | a CSS custom property on the floating group's DOM + one `color-mix` rule                                                                                                                               |
| **Persist opacity**                     | **CUSTOM**                        | one key on `PanelState.state`, mirroring `headerless`                                                                                                                                                  |
| **Context-menu trigger**                | **CUSTOM (reuses existing menu)** | new items in `DockContextMenu.vue`                                                                                                                                                                     |

**Net:** windowing is ~100% native. We build only two trigger actions, the opacity scalar + persistence/re-apply, and ~2 CSS rules. No custom drag/resize/dock engine.

> **Do not "correct" against Context7's hosted dockview docs:** they show a stale `FloatingGroupOptions = { panels, position:{x,y,w,h} }`. The installed 6.6.1 shape is `{ x?, y?, height?, width?, position? }` (top-level). The installed `.d.ts` is authoritative.

---

## 3. Opacity / transparency design

### 3.1 The one rule — translucent **background**, never element `opacity`

Element `opacity` dims the whole subtree (text, icons, borders, focus rings), creates a stacking context that breaks z-layering against the WebGL canvas and `backdrop-filter`, and forces an offscreen composite that degrades text AA. A **background-color alpha** leaves all foreground content 100% opaque — only the painted fill is see-through. This is exactly how Osiris does it (`--bg-panel: rgba(8,10,20,0.88)`, zero `opacity:` on any panel root). **No part of this feature may use element `opacity` for see-through.**

### 3.2 Implementation — a per-group CSS var + one `color-mix` rule

Set `--cv-float-alpha` (0..1) on the floating group's element imperatively from the session action. A CSS rule scoped to dockview's **location-driven `.dv-groupview-floating` class** (critique I1 — dockview toggles this on `group.element` per location; lower coupling than `.dv-resize-container .dv-groupview`) turns the scalar into a translucent background via `color-mix`. Docked panes never carry the class → never affected.

```ts
// src/modules/panels/floatOpacity.ts
export function setGroupFloatAlphaVar(group: DockviewGroupPanel, alpha: number): void {
  group.element.style.setProperty("--cv-float-alpha", String(alpha)); // group.element IS .dv-groupview
}
```

```css
/* src/assets/styles/dockview.css — appended to the .dockview-theme-commandvue scope.
   --cv-float-alpha (0..1) is set per floating group by setGroupFloatAlphaVar(); the
   rule only matches dockview's floating groups, so grid-docked panes stay opaque.
   Background fill is translucent (color-mix), NOT element opacity — content + the
   drag/resize handles stay 100% opaque. */
.dockview-theme-commandvue .dv-groupview-floating {
  background-color: color-mix(
    in oklch,
    var(--cv-float-tint) calc(var(--cv-float-alpha, 1) * 100%),
    transparent
  );
}
/* Header readability floor — never below 85% even when the body is at 25%. */
.dockview-theme-commandvue .dv-groupview-floating .dv-tabs-and-actions-container {
  background-color: color-mix(
    in oklch,
    var(--cv-float-tint) calc(max(var(--cv-float-alpha, 1), 0.85) * 100%),
    transparent
  );
}
/* Windows high-contrast / forced-colors: never see-through (critique M3). */
@media (forced-colors: active) {
  .dockview-theme-commandvue .dv-groupview-floating {
    background-color: Canvas;
  }
}
```

### 3.3 Light-mode "white glass" fix (critique C3) — dedicated tint token

`--color-surface-raised` is `#ffffff` in light mode → a 50%-alpha **white** fill over satellite imagery is washed-out fog, not "tactical glass." **Do not bind the float fill to `--color-surface-raised`.** Introduce a dedicated **`--cv-float-tint`** token in `tokens.css`, set to a dark HUD navy in **both** themes (e.g. `oklch(0.21 0.03 250)` ≈ Osiris `rgb(8,10,20)`), so the see-through glass reads consistently dark over any map in light or dark mode. Light/dark text-on-glass stays the app foreground token (already light enough on a dark tint). This makes the look intentional rather than theme-accidental, and is added to the Stage-2 review with a screenshot in each mode.

### 3.4 Why four discrete levels (not a slider) for Phase 3

A PrimeVue `Slider` inside a dockview-rendered header fights the float's move handle (`@mousedown`) and needs not-yet-built header-actions chrome. A context-menu submenu of preset levels (100/75/50/25) ships on the already-built `DockContextMenu`, is discoverable, and is fully unit-testable. The slider is the better long-term UX → deferred follow-up (§9). 0.25 is the floor (no "invisible" option).

### 3.5 Frosted blur — deferred

`backdrop-filter: blur()` re-blurs **every frame the backdrop repaints**, and Cesium/MapLibre repaint continuously — one of the most expensive compositor ops over a live globe. **Default OFF, not built in Phase 3.** A future `data-frosted` hook is reserved; if shipped, pair with Cesium `scene.requestRenderMode = true` (Cesium-only — does not help MapLibre, critique M5).

---

## 4. Data model + persistence

**Float position/size:** nothing manual — `api.toJSON()` serializes `floatingGroups: [{ data, position: AnchoredBox }]`; `fromJSON` restores. CommandVue already round-trips `SerializedDockview` via IndexedDB.

**Opacity:** custom, persisted like `headerless` — one key on `PanelState.state` (`Record<string, unknown>`), owned by `floatOpacity.ts`. **Zero schema/migration change** — rides the same `structuredClone(source.state)` clone path and re-apply machinery.

```ts
// src/modules/panels/floatOpacity.ts (mirror of headerless.ts)
export const FLOAT_ALPHA_KEY = "floatAlpha" as const;
export const DEFAULT_FLOAT_ALPHA = 1;
export function getFloatAlpha(state: Record<string, unknown> | undefined): number {
  const v = state?.[FLOAT_ALPHA_KEY];
  return typeof v === "number" && v >= 0 && v <= 1 ? v : DEFAULT_FLOAT_ALPHA;
}
export function withFloatAlpha(
  state: Record<string, unknown> | undefined,
  value: number,
): Record<string, unknown> {
  const next = { ...(state ?? {}) };
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped >= 1)
    delete next[FLOAT_ALPHA_KEY]; // default omitted, like headerless:false
  else next[FLOAT_ALPHA_KEY] = clamped;
  return next;
}
```

**Re-apply hook** in `session.ts`, mirroring `applyHeaderlessGroups`, wired into the same post-convergence chokepoint in `loadLayout` — after `backfillCleanMainPane()`, before `loadedLayoutId.value = layoutId`:

```ts
function applyFloatAlphas(api: DockviewApi): void {
  setRestoring(true);
  try {
    const pss = usePanelStateStore();
    for (const ps of pss.listForLayout()) {
      const alpha = getFloatAlpha(ps.state);
      if (alpha >= 1) continue;
      const group = api.getPanel(ps.id)?.api.group;
      if (group) setGroupFloatAlphaVar(group, alpha);
    }
  } finally {
    setRestoring(false);
  }
}
```

**Var-survival (critique I4):** the inline `--cv-float-alpha` style rides `group.element` through `addFloatingGroup` (dockview moves the same node). BUT a panel floated out of a _multi-panel_ grid group gets a _new_ group → always (re-)set the var inside `floatPanel` after re-resolving `panel.api.group`, and re-read `panel.api.group` at every `setFloatAlpha`. Hard-test the "dim → dock-back → save → reload → re-float restores dim" and the "float out of a multi-panel group" cases.

---

## 5. UI surfaces — context-menu placement

Menu skeleton keeps its anchors (header-toggle first → secondary → Maximize → separator → Close last). Float/Dock-back is a group-location op (sibling of Maximize) → slots into the **secondary block, immediately before `maximizeItem`**, in **both** `buildCleanModel` and `buildTabbedModel`. The **Opacity** submenu is gated on `location.type === 'floating'` and included in **both** build models (critique I3: a float whose header the user hides routes through `buildCleanModel`).

```ts
import { PictureInPicture2, PinOff, Contrast, Check } from "@lucide/vue";

function floatItem(panel: IDockviewPanel): DockMenuItem {
  const loc = panel.api.location.type;
  return loc === "floating"
    ? { label: "Dock back", lucide: PinOff, command: () => void session.dockBack(panel.id) }
    : {
        label: "Float window",
        lucide: PictureInPicture2,
        disabled: loc !== "grid",
        command: () => void session.floatPanel(panel.id),
      };
}
function opacitySubmenu(panel: IDockviewPanel): DockMenuItem | null {
  if (panel.api.location.type !== "floating") return null; // gate in BOTH build models
  const current = session.getFloatAlpha(panel.id);
  const level = (pct: number): DockMenuItem => ({
    label: `${pct}%`,
    lucide: Math.round(current * 100) === pct ? Check : undefined,
    command: () => void session.setFloatAlpha(panel.id, pct / 100),
  });
  return {
    label: "Opacity",
    lucide: Contrast,
    items: [level(100), level(75), level(50), level(25)],
  };
}
```

**Resulting menus** (Opacity only when floating):

- **Clean, docked:** `Show header · Float window · Maximize · — · Close`
- **Tabbed, docked:** `Hide header · Close others · Float window · Maximize · — · Close`
- **Floating:** `Hide header · Close others · Dock back · Opacity ▸ · Maximize(disabled) · — · Close`

Pure label/active-level/disabled logic → new `src/components/layout/dock/floatPaneControls.ts` (mirrors `cleanPaneControls.ts` / `tabbedPaneControls.ts`), unit-tested. The component stays Stage-1-Playwright-verified (no unit test). The `#item` submenu rendering (`hasSubmenu`/`ChevronRight`) already exists — Opacity submenu renders for free. Icons are `@lucide/vue` named imports (UI-chrome rule).

**Session actions** (new in `session.ts`, restoring-guarded; **all three `markDirty`** — unlike `toggleMaximize`, they change `toJSON()` geometry or persisted `PanelState.state`):

```ts
async function floatPanel(panelId: Ulid): Promise<boolean> {
  const api = dockviewApi.value;
  if (!api) throw new Error("Dockview API not bound");
  const panel = api.getPanel(panelId);
  if (!panel || panel.api.location.type !== "grid") return false; // grid-only gate
  setRestoring(true);
  try {
    const n = api.groups.filter((g) => g.api.location.type === "floating").length;
    api.addFloatingGroup(panel, { width: 520, height: 360, x: 120 + n * 28, y: 120 + n * 28 }); // cascade — critique I5
    const group = panel.api.group; // re-resolve (returns void)
    const pss = usePanelStateStore();
    const prevHeaderless = isHeaderless(pss.getState(panelId)?.state); // snapshot — critique I2
    group.header.hidden = false; // a float always keeps a drag handle
    await pss.updateState(panelId, {
      state: withFloatPrevHeaderless(
        withHeaderless(pss.getState(panelId)?.state, false),
        prevHeaderless,
      ),
    });
    const alpha = getFloatAlpha(pss.getState(panelId)?.state);
    if (alpha < 1) setGroupFloatAlphaVar(group, alpha); // var survives the new group — critique I4
  } finally {
    setRestoring(false);
  }
  markDirty();
  return true;
}

async function dockBack(panelId: Ulid): Promise<boolean> {
  const api = dockviewApi.value;
  if (!api) throw new Error("Dockview API not bound");
  const panel = api.getPanel(panelId);
  if (!panel || panel.api.location.type !== "floating") return false;
  setRestoring(true);
  try {
    panel.api.group.api.moveTo({ position: "right" }); // C1: creates a new right-edge GRID group
    const pss = usePanelStateStore();
    if (floatPrevHeaderless(pss.getState(panelId)?.state)) {
      // restore clean status — critique I2
      panel.api.group.header.hidden = true;
      await pss.updateState(panelId, { state: withHeaderless(pss.getState(panelId)?.state, true) });
    }
  } finally {
    setRestoring(false);
  }
  markDirty();
  return true;
}

async function setFloatAlpha(panelId: Ulid, value: number): Promise<void> {
  const api = dockviewApi.value;
  if (!api) throw new Error("Dockview API not bound");
  const panel = api.getPanel(panelId);
  if (!panel) return;
  setRestoring(true);
  try {
    setGroupFloatAlphaVar(panel.api.group, value); // always re-read group — critique I4
    const pss = usePanelStateStore();
    await pss.updateState(panelId, { state: withFloatAlpha(pss.getState(panelId)?.state, value) });
  } finally {
    setRestoring(false);
  }
  markDirty();
}

function getFloatAlpha(panelId: Ulid): number {
  // alias the module fn to avoid M1 collision
  return getFloatAlphaFromState(usePanelStateStore().getState(panelId)?.state);
}
```

> `getFloatAlphaFromState` = `import { getFloatAlpha as getFloatAlphaFromState } from "@/modules/panels/floatOpacity"` (critique M1 — module fn vs session method name collision). `withFloatPrevHeaderless`/`floatPrevHeaderless` store the pre-float headerless flag in `PanelState.state` so dock-back can restore clean status (critique I2); if simpler, derive from a single `FLOAT_PREV_HEADERLESS_KEY`.

---

## 6. Map-first risks + mitigations

1. **WebGL canvas survival across the float DOM-move (critique C2 — GATES 3a, runtime-verify):** on float, dockview moves `group.element` wholesale into the overlay, so the panel's `<canvas>` moves with its parent — _should_ preserve the context, but a DOM reparent can lose context on some drivers, and the renderer mode matters. `<DockviewVue>` currently sets no `defaultRenderer`. **Decide + set `defaultRenderer` (likely `'always'` for map panels, or a per-panel `renderer`) and runtime-verify a floated Cesium AND MapLibre panel survives with no `WebGL context lost`** — a hard Stage-1 gate in 3a, before opacity exists. Per CLAUDE.md's mandatory runtime-verification rule this cannot be a paper claim.
2. **`color-mix` background over WebGL (verify in 3b):** a translucent background on `.dv-groupview-floating` is a plain alpha composite (unlike element `opacity`) — the panel's own `<canvas>` composites normally above it. Confirm a floated map panel at 25% still renders.
3. **"Translucent ≠ click-through":** a 25%-alpha float still hit-tests as solid — clicks hit the panel, not the map. **Correct** for an interactive float; we do **not** add `pointer-events:none` (that was Osiris's trick for non-interactive HUD chrome).
4. **Overlay z-index:** already solved — `dockview.css` ships `--dv-overlay-z-index: 999` "for floating / pop-out group overlays." No new z work.
5. **No-reactive-viewer rule (CLAUDE.md §2):** honored — opacity is set on the **group DOM element** via `style.setProperty`, never on the Cesium viewer / MapLibre map (which stay in `shallowRef` panel-instance handles). Store gains only a plain `number` on `PanelState.state`.
6. **Headerless × floating:** `floatPanel` strips `headerless` so a float always has a grab handle; `dockBack` restores the prior flag (critique I2). `applyHeaderlessGroups` and `applyFloatAlphas` are independent passes over the same `listForLayout()` and can't conflict.
7. **Touch/pen drag (critique M2):** dockview float drag uses pointer events → likely works on touch; add an explicit Stage-1 smoke check (ops dashboards may run on touch panels) or scope it out.

---

## 7. Phased plan (one PR each, independently shippable — like Phases 1-2)

### Phase 3a — Float + Dock-back (native dockview) + WebGL-survival gate

- **Scope:** `floatPanel` → `addFloatingGroup` (cascade coords); `dockBack` → `moveTo({position:"right"})`; `floatItem` in `DockContextMenu` (both build models, before `maximizeItem`); `floatPaneControls.ts` (pure logic); strip+restore `headerless` (I2); set `defaultRenderer`/per-panel renderer + `floatingGroupBounds:"boundedWithinViewport"`. **Hard runtime gate: floated Cesium AND MapLibre survive (C2).**
- **Acceptance:** Float lifts a docked pane into an in-window overlay _with a header_; Dock back returns it to a grid group (`location.type==='grid'`); Float disabled off-grid; Maximize disabled on floats; floated map panels render with **no WebGL context loss**; multiple floats cascade (don't stack exactly); float survives Save→reload at position/size; clean→float→dock-back restores clean status; dirty after float, clean after a plain load.

### Phase 3b — Opacity / see-through control

- **Scope:** `floatOpacity.ts` (`FLOAT_ALPHA_KEY`, getters/setters, `setGroupFloatAlphaVar`); `--cv-float-tint` token (§3.3); the `color-mix` CSS rules (`.dv-groupview-floating` body + header-floor + forced-colors); `setFloatAlpha`/`getFloatAlpha` session surface; **Opacity** submenu (100/75/50/25) gated on floating in both build models; active-level logic in `floatPaneControls.ts`.
- **Acceptance:** Opacity submenu only on floats; 50% visibly fades the float's background (content full-color) while docked panes stay opaque; header more opaque than body at 25%; floated Cesium/MapLibre at 25% still renders (no context loss); active level checked; opacity marks dirty; both light + dark render the tinted glass acceptably (Stage-2 screenshots both modes).

### Phase 3c — Persistence hardening + polish

- **Scope:** `applyFloatAlphas` re-apply hook wired into `loadLayout` next to `applyHeaderlessGroups`; round-trip regression for a layout carrying **clean + floating + dimmed** panes through `saveCurrentAsNewLayout` (ULID rewrite must preserve `floatAlpha` + the prev-headerless flag); assert the dim→dock→reload→re-float and float-out-of-multi-panel-group cases (I4); optional cascade/snap polish. Record the Phase-3 re-scope in `track-b-dockview-windowing.md`.
- **Acceptance:** opacity survives `toJSON`→`fromJSON`→reload and `discardChanges`; a clone preserves `headerless` + `floatAlpha` under fresh ULIDs; `applyFloatAlphas` is a no-op when nothing is dimmed; combined layout reloads identically.

---

## 8. Why opacity is NOT a preset type (decided)

The preset system keys `applicableTo` to **panel types** and its runtime path reaches the **panel instance** (Cesium viewer / MapLibre map) via the panel-instance registry. Window opacity is a property of the **group's DOM container**, orthogonal to panel type (every panel can float), with no instance method to call. Modeling it as a preset would force a fake `applicableTo:[every type]`, break the `applyToPanel(panelId, config)` contract, and pollute the Apply-Preset dialog. Core stays out; downstream apps may add a `window-opacity` preset as opt-in sugar.

---

## 9. Open decisions for the maintainer (Majid)

1. **Light-mode glass look (C3):** recommend a dedicated dark **`--cv-float-tint`** (consistent "tactical glass" in both themes) over binding to `--color-surface-raised` (white fog in light mode). _Confirm: dark glass in both themes?_
2. **Opacity control UX:** recommend the **4-level submenu** (100/75/50/25) for v1; queue a continuous slider for when Track B header-actions land. _OK with discrete levels first?_
3. **Frosted blur:** recommend **defer** (perf over a live globe); reserve the `data-frosted` hook. _Confirm._
4. **Default float geometry:** `520×360`, cascading `+28px` per existing float. _OK, or different size / true snap-to-edge in 3c?_
5. **`floatingGroupBounds`:** recommend `"boundedWithinViewport"` (clamp). The `{ minimumWidthWithinViewport, ... }` form allows partial off-screen. _Pick one._
6. **Docked-pane opacity:** decided **no** (a docked pane has nothing to see through; CSS scoped to floats). _Confirm._

**Verification status:** C1 (dock-back `moveTo`) **resolved by source trace**. C2 (WebGL survival + `defaultRenderer`) is a **3a runtime gate**, not yet proven in this repo. All other critique items (C3, I1–I5, M1, M3) are **folded into this spec** above.
