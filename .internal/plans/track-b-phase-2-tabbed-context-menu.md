# Track B Phase 2 — Tabbed-Pane Context Menu + Maximize/Restore Implementation Plan

**REQUIRED SUB-SKILL: superpowers:test-driven-development** — every task writes a failing test against the real `makeFakeApi()` double before any implementation; no production code lands without a red→green cycle. Unit-test session/pure logic; the Vue component is Stage-1 Playwright-verified (no brittle component unit test), consistent with Phase 1.

**Goal.** Right-clicking a **tabbed** dock group opens a context menu with **Close / Close others / Hide header**, completing the clean⇄tabbed round-trip (Hide header is the headline capability — it routes through the existing `toggleHeaderless`, which already flips both ways and persists). Add **Maximize / Restore** to **both** the clean-pane menu and the new tabbed-pane menu, gated to grid-located groups. No floating, pop-out, minimize, or cross-window work (Track B Phases 3–6, deferred).

**Architecture.** The existing `CleanPaneContextMenu.vue` already owns the single dock-root `contextmenu` listener, resolves the closest `.dv-groupview` → dockview group via `api.groups`, and shows a `ui/ContextMenu` at the cursor — but it returns early for any group whose header is _not_ hidden. Phase 2 generalizes that one handler to branch clean-vs-tabbed (rename the file to `DockContextMenu.vue` for accuracy; the clean behavior is preserved verbatim). New iteration/maximize logic lands as small, unit-tested **session store actions** (`closeOthersInGroup`, `toggleMaximize`) operating on the live `DockviewApi`, exactly mirroring the `removePanelGuarded` / `splitCleanNeighbor` pattern (restoring-guarded, `markDirty` where a real user edit occurred). The test double `makeFakeApi()` is extended to model maximize state on both the group API and (modeled-but-unused) container API.

**Tech Stack.** Vue 3 `<script setup>` + TypeScript (strict), Pinia, dockview-vue 6.6.1 (`DockviewApi` / `IDockviewPanel` / `DockviewGroupPanel`; resolves `dockview-core@6.6.1`), PrimeVue `ContextMenu` (unstyled) via `src/components/ui/ContextMenu.vue`, `@lucide/vue` icons, Vitest 4 + `fake-indexeddb`. Test command: `pnpm vitest run <path>` (alias of the `"test": "vitest run"` script).

**Verified dockview maximize APIs** (confirmed against the installed `dockview-core@6.6.1` `.d.ts` + spec §6.1):

- **Panel API (the production path):** `panel.api.maximize()`, `panel.api.isMaximized()`, `panel.api.exitMaximized()` — verified at `dockviewPanelApi.d.ts:42-44`.
- **Panel location gate:** `panel.api.location` is of type `DockviewGroupLocation` (`dockviewPanelApi.d.ts:36`). `DockviewPanelApiImpl.location` returns `this.group.api.location`, so the gate `panel.api.location.type === 'grid'` is equivalent to the spec's `panel.api.group.api.location.type === 'grid'`. The real union is `{ type: 'grid' } | { type: 'floating' } | { type: 'popout'; … } | { type: 'edge'; … }` (`dockviewGroupPanelModel.d.ts:131`) — **four** variants.
- **Container API (modeled in the fake but NOT used by production code):** `api.maximizeGroup(panel: IDockviewPanel)`, `api.hasMaximizedGroup()`, `api.exitMaximizedGroup()`, `get api.onDidMaximizedGroupChange()` — verified at `component.api.d.ts:541-544`. **Note the real `maximizeGroup` takes an `IDockviewPanel`, not a group.** There is **no** `api.isMaximizedGroup(...)` on the public `DockviewApi` — that method exists only on internal classes, so it is **not** modeled in the fake and not referenced anywhere in this plan.

This plan uses the **panel-API maximize methods** (`panel.api.maximize/isMaximized/exitMaximized`) as the **only** production path — they target the panel's own group and read cleanly from the right-clicked panel id, matching how every other session action resolves its target (`api.getPanel(panelId)`). The container-level methods are modeled in the fake only for fidelity (and to mirror dockview's single-maximized invariant); no session action calls them.

---

## File Structure

**Modified**

| File                                                                                                                 | Responsibility (Phase 2 change)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/assets/styles/dockview.css`                                                                                     | **Task 0** — define `--dv-overlay-z-index: 999` on `.dockview-theme-commandvue` so the tab-overflow dropdown popover stacks above panel WebGL canvases (Phase 1-review fix; CSS-only, hit-test-verified).                                                                                                                                                                                                                                                    |
| `src/stores/session.ts`                                                                                              | Add `closeOthersInGroup(panelId)` (iterate the panel's group, remove every other panel, empty-workspace-guarded) and `toggleMaximize(panelId)` (grid-gated `panel.api.maximize()` / `exitMaximized()`); export both.                                                                                                                                                                                                                                         |
| `tests/unit/stores/session.spec.ts`                                                                                  | Extend `makeFakeApi()` to model maximize: per-group `maximized` flag + `api.maximize/exitMaximized/isMaximized` on the panel API, a `location` accessor on the panel API (`{ type: 'grid' }` by default, overridable per group via `locationType` for the off-grid gate), and the modeled-but-unused container methods `maximizeGroup(panel)/exitMaximizedGroup/hasMaximizedGroup` + no-op `onDidMaximizedGroupChange`. Add unit tests for both new actions. |
| `src/components/layout/dock/cleanPaneControls.ts`                                                                    | Docstring-only edit: update the stale `CleanPaneContextMenu.vue` reference to `DockContextMenu.vue` (the file is renamed in Task 4) so the Task 5 "zero matches" grep holds cleanly. No logic change.                                                                                                                                                                                                                                                        |
| `src/components/layout/dock/CleanPaneContextMenu.vue` → **renamed** `src/components/layout/dock/DockContextMenu.vue` | One root `contextmenu` handler that branches clean-vs-tabbed. Clean branch unchanged (Show header / Split / **Maximize·Restore** / Close). New tabbed branch (Close / Close others / Hide header / **Maximize·Restore**). Maximize item is **disabled off-grid** so the affordance matches the action gate. Keeps a `data-testid` (renamed to `dock-context-menu`).                                                                                          |
| `src/components/layout/DockLayout.vue`                                                                               | Update the import + tag to `DockContextMenu` (props `:api`/`:root` unchanged).                                                                                                                                                                                                                                                                                                                                                                               |

**Created**

| File                                                           | Responsibility                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/layout/dock/tabbedPaneControls.ts`             | Pure label/disabled logic for the **tabbed** menu (mirrors `cleanPaneControls.ts`): `Close` disabled when `totalPanels <= 1`; `Close others` disabled when the group holds `<= 1` panel; `Hide header` label/icon; `Maximize`/`Restore` label/icon flip from an `isMaximized` input. Unit-tested without mounting Vue. |
| `tests/unit/components/layout/dock/tabbedPaneControls.spec.ts` | Unit tests for `tabbedPaneControls` (label/disabled matrix). Mirrors the existing `cleanPaneControls` test location convention.                                                                                                                                                                                        |

> No new dependencies. No router/store registration changes beyond the two session exports. `DockLayout.vue` keeps mounting one component with `:api="boundApi" :root="rootEl"`.

---

## TDD Tasks

Ordered by dependency: (0) tab-overflow occlusion CSS fix → (1) pure tabbed-controls logic → (2) fake-extension + `closeOthersInGroup` → (3) fake-extension + `toggleMaximize` → (4) rename + extend the context-menu component (clean Maximize + full tabbed branch) → (5) `DockLayout` rewire → (6) Stage-1 Playwright verification.

---

### Task 0 — Fix tab-overflow dropdown occlusion (CSS)

**Files:** `src/assets/styles/dockview.css`

The Phase 1 review flagged the dock tab-overflow dropdown (the "+N" button shown when tabs overflow the strip) as non-functional — clicking it appeared to do nothing. Root cause (proven by live `document.elementFromPoint` hit-testing): dockview renders the overflow popover with `z-index: var(--dv-overlay-z-index)`, but our hand-rolled `.dockview-theme-commandvue` class omitted that variable. Every dockview **built-in** theme class ships `--dv-overlay-z-index: 999` (confirmed in `dockview-core/dist/styles/dockview.css`); the custom class did not, so the popover painted at `z-index: auto` and was occluded by the panel WebGL canvases (Cesium / MapLibre) beneath the tab strip — present in the DOM, but a hit-test over a popover row returned the `<canvas>`, so the click never reached the tab.

CSS-only (no JS logic), so no unit test; verified in Task 6 via a hit-test assertion (an occlusion check, not a brittle pixel screenshot).

- [ ] **Step 1 — Add the variable.** In `src/assets/styles/dockview.css`, inside `.dockview-theme-commandvue { … }`, after `--dv-tabs-container-scrollbar-color`, add `--dv-overlay-z-index: 999;` with a comment explaining the occlusion failure mode and that built-in dockview themes ship the same value.

- [ ] **Step 2 — Verify live.** With `pnpm dev` running, open a tabbed group that overflows (≥6 tabs in a narrow strip), click the overflow "+N" button (`.dv-tabs-overflow-dropdown-default`), and confirm the hidden-tab list appears and is clickable. Programmatic proof: after opening the popover, `document.elementFromPoint(cx, cy)` over a `.dv-popover-anchor .dv-tab` returns an element whose `.closest('.dv-popover-anchor')` is truthy (pre-fix it returned a bare `<canvas>`).

- [ ] **Step 3 — Commit.**
      `git add src/assets/styles/dockview.css`
      `git commit` → `fix(dock): stack tab-overflow dropdown above panel canvases`

> Status: Step 1 applied and Step 2 hit-test-verified live during planning (overlay var resolves to `999`; `elementFromPoint` over a popover row now returns `.dv-default-tab-content`, not `<canvas>`). Only the commit remains.

---

### Task 1 — Pure tabbed-pane control logic (`tabbedPaneControls.ts`)

**Files:** `src/components/layout/dock/tabbedPaneControls.ts`, `tests/unit/components/layout/dock/tabbedPaneControls.spec.ts`

- [ ] **Step 1 — Failing test.** Create `tests/unit/components/layout/dock/tabbedPaneControls.spec.ts`:

  ```ts
  import { describe, expect, it } from "vitest";

  import { tabbedPaneControls } from "@/components/layout/dock/tabbedPaneControls";

  describe("tabbedPaneControls", () => {
    it("emits close, close-others, hide-header and maximize controls in order", () => {
      const ids = tabbedPaneControls({
        totalPanels: 3,
        panelsInGroup: 2,
        isMaximized: false,
      }).map((c) => c.id);
      expect(ids).toEqual(["close", "close-others", "hide-header", "maximize"]);
    });

    it("disables Close when it would empty the workspace", () => {
      const close = tabbedPaneControls({
        totalPanels: 1,
        panelsInGroup: 1,
        isMaximized: false,
      }).find((c) => c.id === "close")!;
      expect(close.disabled).toBe(true);
      expect(
        tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1, isMaximized: false }).find(
          (c) => c.id === "close",
        )!.disabled,
      ).toBe(false);
    });

    it("disables Close others when the group has one panel", () => {
      const single = tabbedPaneControls({
        totalPanels: 3,
        panelsInGroup: 1,
        isMaximized: false,
      }).find((c) => c.id === "close-others")!;
      expect(single.disabled).toBe(true);
      const many = tabbedPaneControls({
        totalPanels: 3,
        panelsInGroup: 2,
        isMaximized: false,
      }).find((c) => c.id === "close-others")!;
      expect(many.disabled).toBe(false);
    });

    it("flips the maximize control label + icon on isMaximized", () => {
      const off = tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1, isMaximized: false }).find(
        (c) => c.id === "maximize",
      )!;
      expect(off.label).toBe("Maximize");
      expect(off.icon).toBe("Maximize2");
      const on = tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1, isMaximized: true }).find(
        (c) => c.id === "maximize",
      )!;
      expect(on.label).toBe("Restore");
      expect(on.icon).toBe("Minimize2");
    });

    it("labels hide-header constant (tabbed groups always offer Hide header)", () => {
      const hide = tabbedPaneControls({
        totalPanels: 2,
        panelsInGroup: 1,
        isMaximized: false,
      }).find((c) => c.id === "hide-header")!;
      expect(hide.label).toBe("Hide header");
      expect(hide.icon).toBe("PanelTopClose");
    });
  });
  ```

- [ ] **Step 2 — Run (expect FAIL).** `pnpm vitest run tests/unit/components/layout/dock/tabbedPaneControls.spec.ts` → fails: `Failed to resolve import "@/components/layout/dock/tabbedPaneControls"` (module does not exist).

- [ ] **Step 3 — Minimal impl.** Create `src/components/layout/dock/tabbedPaneControls.ts`:

  ```ts
  /**
   * Pure decision-logic for the tabbed-pane context menu. Mirrors
   * `cleanPaneControls.ts` — kept separate from `DockContextMenu.vue` so it can
   * be unit-tested without mounting Vue or dockview (the component itself is
   * Stage-1 Playwright-verified per the CommandVue verification protocol).
   */
  export interface TabbedPaneControlInput {
    /** Total panels in the whole layout (drives the empty-workspace guard). */
    totalPanels: number;
    /** Panels in the right-clicked panel's group (drives "Close others"). */
    panelsInGroup: number;
    /** Whether the right-clicked panel's group is currently maximized. */
    isMaximized: boolean;
  }

  export interface TabbedPaneControl {
    id: "close" | "close-others" | "hide-header" | "maximize";
    label: string;
    /** Lucide component name (must exist in @lucide/vue@1.16). */
    icon: "X" | "Columns2" | "PanelTopClose" | "Maximize2" | "Minimize2";
    disabled: boolean;
  }

  export function tabbedPaneControls(input: TabbedPaneControlInput): TabbedPaneControl[] {
    return [
      {
        id: "close",
        label: "Close",
        icon: "X",
        disabled: input.totalPanels <= 1,
      },
      {
        id: "close-others",
        label: "Close others",
        icon: "Columns2",
        disabled: input.panelsInGroup <= 1,
      },
      {
        id: "hide-header",
        label: "Hide header",
        icon: "PanelTopClose",
        disabled: false,
      },
      {
        id: "maximize",
        label: input.isMaximized ? "Restore" : "Maximize",
        icon: input.isMaximized ? "Minimize2" : "Maximize2",
        disabled: false,
      },
    ];
  }
  ```

  > The `maximize` control's `disabled` is left `false` here because this pure
  > module has no location information. The **component** computes off-grid
  > disabling from the live `panel.api.location.type` (Task 4), keeping this
  > module's contract identical to `cleanPaneControls.ts` (which also never
  > disables non-Close items).

- [ ] **Step 4 — Run (expect PASS).** `pnpm vitest run tests/unit/components/layout/dock/tabbedPaneControls.spec.ts` → all 5 green.

- [ ] **Step 5 — Commit.**
      `git checkout develop && git pull origin develop`
      `git checkout -b feat/track-b-phase-2-tabbed-context-menu`
      `git add src/components/layout/dock/tabbedPaneControls.ts tests/unit/components/layout/dock/tabbedPaneControls.spec.ts`
      `git commit` → `feat(dock): pure control logic for the tabbed-pane context menu`

---

### Task 2 — Extend the test fake + `closeOthersInGroup(panelId)` session action

**Files:** `tests/unit/stores/session.spec.ts`, `src/stores/session.ts`

> **Fake-scope reminder (do not over-model).** The fake models only the surface the **session actions** exercise: `api.getPanel(panelId)`, `target.api.group.panels`, `api.panels`, `api.removePanel`, and the new panel-API maximize/location accessors. The renamed `DockContextMenu.vue` additionally reads `group.activePanel ?? group.panels[0]` and resolves groups via `g.element` / `g.element.contains(...)` — **neither is modeled here**, because the component is exercised by Stage-1 Playwright (Task 6), never by this fake. A future agent must not try to unit-test the menu against this double.

- [ ] **Step 1 — Extend the fake (no assertion change yet).** In `tests/unit/stores/session.spec.ts`, widen the fake group/panel model so it can express "many panels in one group" and (Task 3) maximize state. Make these surgical edits:

  Add a `maximized` flag + a `locationType` to `FakeGroup`, and a `location` accessor + maximize methods to the panel API in the interfaces. The `locationType` union includes all four real `DockviewGroupLocation` variants for fidelity, even though only `grid` + one off-grid value are exercised by the gate tests:

  ```ts
  interface FakeGroup {
    id: string;
    header: FakeHeader;
    panels: FakePanel[];
    maximized: boolean;
    /** Off-grid override for the maximize gate; defaults to "grid".
     *  Mirrors the real DockviewGroupLocation union (grid|floating|popout|edge). */
    locationType: "grid" | "floating" | "popout" | "edge";
  }
  interface FakePanel {
    id: string;
    component: string;
    title?: string;
    api: {
      group: FakeGroup;
      location: { type: "grid" | "floating" | "popout" | "edge" };
      moveTo: (opts: {
        group?: FakeGroup;
        position?: unknown;
        index?: number;
        skipSetActive?: boolean;
      }) => void;
      maximize: () => void;
      exitMaximized: () => void;
      isMaximized: () => boolean;
    };
  }
  ```

  In `makeFakeApi`, set `maximized: false` and `locationType: "grid"` when building a group:

  ```ts
  function makeGroup(): FakeGroup {
    const group: FakeGroup = {
      id: `g${++groupSeq}`,
      header: { hidden: false },
      panels: [],
      maximized: false,
      locationType: "grid",
    };
    groups.push(group);
    return group;
  }
  ```

  In `addPanelImpl`, give the panel API a `location` getter and the maximize trio, plus keep `group` reassignable on `moveTo`. Replace the `api:` block of the created `panel` with:

  ```ts
  const panel: FakePanel = {
    id: p.id,
    component: p.component,
    title: p.title,
    api: {
      group,
      // Self-reference is SAFE: the getter body runs only when invoked later,
      // never during construction — identical to the existing `moveTo` pattern.
      get location() {
        return { type: panel.api.group.locationType };
      },
      moveTo: (opts) => {
        detach(panel);
        const target = opts.group ?? makeGroup();
        panel.api.group = target;
        target.panels.push(panel);
      },
      // Maximize is group-scoped in dockview; model it as a single-maximized
      // invariant: maximizing this panel's group clears every other group's
      // flag (mirrors real dockview — at most one maximized group).
      maximize: () => {
        for (const g of groups) g.maximized = g === panel.api.group;
      },
      exitMaximized: () => {
        if (panel.api.group.maximized) panel.api.group.maximized = false;
      },
      isMaximized: () => panel.api.group.maximized,
    },
  };
  ```

  Add the **modeled-but-unused** container-level maximize methods to the `stub` object (after `removePanel`), plus a no-op `onDidMaximizedGroupChange`. These mirror the real `DockviewApi` 6.6.1 surface exactly — note `maximizeGroup` takes a **panel** (real signature `maximizeGroup(panel: IDockviewPanel)`), and there is **no** `isMaximizedGroup` on `DockviewApi`, so it is deliberately absent. Production session actions never call any of these; they exist only so the double does not misrepresent the real contract:

  ```ts
    // Container-level maximize surface — modeled for fidelity but NOT exercised
    // by any session action (the production path uses panel.api.maximize()).
    // Real DockviewApi.maximizeGroup takes an IDockviewPanel, not a group.
    maximizeGroup: vi.fn((panel: FakePanel) => {
      for (const g of groups) g.maximized = g === panel.api.group;
    }),
    exitMaximizedGroup: vi.fn(() => {
      for (const g of groups) g.maximized = false;
    }),
    hasMaximizedGroup: vi.fn(() => groups.some((g) => g.maximized)),
    onDidMaximizedGroupChange: vi.fn(() => ({ dispose: () => undefined })),
  ```

  And extend the `FakeDockviewApi` interface to declare them (no `isMaximizedGroup` — it is not part of the real `DockviewApi`):

  ```ts
  maximizeGroup: ReturnType<typeof vi.fn>;
  exitMaximizedGroup: ReturnType<typeof vi.fn>;
  hasMaximizedGroup: ReturnType<typeof vi.fn>;
  onDidMaximizedGroupChange: ReturnType<typeof vi.fn>;
  ```

  > These edits are additive — every existing Phase-1 test keeps passing (the new fields default to non-maximized / grid and are never read by Phase-1 paths). Confirm with a full run in Step 4.

- [ ] **Step 2 — Failing test for `closeOthersInGroup`.** Add to the `describe("useSessionStore", …)` block:

  ```ts
  it("closeOthersInGroup removes every other panel in the target's group, keeping the target", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { panels: { id: string }[] } } } | undefined;
    };
    // Force p1 and p2 into the SAME (tabbed) group, then add a third tab.
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup as never });
    const p3 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    (api as unknown as DockviewApi).addPanel({
      id: p3.id,
      component: "maplibre",
      title: "third",
      position: { referenceGroup: targetGroup as never, direction: "within" },
    });
    expect(
      fake
        .getPanel(p2.id)!
        .api.group.panels.map((p) => p.id)
        .sort(),
    ).toEqual([p1.id, p2.id, p3.id].sort());

    const closed = await session.closeOthersInGroup(p2.id);
    expect(closed).toBe(true);
    // Only the target survives in that group; the layout still has it.
    expect(fake.getPanel(p2.id)!.api.group.panels.map((p) => p.id)).toEqual([p2.id]);
    expect((api as unknown as DockviewApi).getPanel(p1.id)).toBeUndefined();
    expect((api as unknown as DockviewApi).getPanel(p3.id)).toBeUndefined();
    expect(session.dirty).toBe(true);
  });

  it("closeOthersInGroup is a no-op (returns false) when the group has only the target", async () => {
    const { layout, p1 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    // p1 (cesium) is clean and alone in its group after load.
    const closed = await session.closeOthersInGroup(p1.id);
    expect(closed).toBe(false);
  });

  it("closeOthersInGroup never empties the workspace (respects the guard)", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { panels: { id: string }[] } } } | undefined;
    };
    // Both panels in one group; closing "others" relative to p2 must not be
    // allowed to drop the workspace below one panel — here it removes p1 only,
    // leaving p2, which is fine; assert the guard never removes the last panel.
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup as never });

    await session.closeOthersInGroup(p2.id);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p2.id]);
  });
  ```

- [ ] **Step 3 — Run (expect FAIL).** `pnpm vitest run tests/unit/stores/session.spec.ts` → fails: `session.closeOthersInGroup is not a function`.

- [ ] **Step 4 — Minimal impl.** In `src/stores/session.ts`, add the action after `removePanelGuarded` (it reuses the same guard semantics and `markDirty`):

  ```ts
  /**
   * Close every OTHER panel in the right-clicked panel's group, keeping the
   * target. Iterates a stable snapshot of `group.panels` (removing while
   * iterating the live array skips entries). Honors the empty-workspace guard:
   * a removal that would drop the layout to zero panels is skipped. Returns
   * `false` when nothing was eligible (group held only the target). Restoring-
   * guarded around the structural mutations; marks dirty when it removed at
   * least one panel (a real user edit, matching removePanelGuarded).
   */
  async function closeOthersInGroup(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const target = api.getPanel(panelId);
    if (!target) return false;

    const others = target.api.group.panels.filter((p) => p.id !== panelId);
    if (others.length === 0) return false;

    let removedAny = false;
    setRestoring(true);
    try {
      for (const other of others) {
        if (api.panels.length <= 1) break; // empty-workspace guard
        const panel = api.getPanel(other.id);
        if (!panel) continue;
        api.removePanel(panel);
        removedAny = true;
      }
    } finally {
      setRestoring(false);
    }
    if (removedAny) markDirty();
    return removedAny;
  }
  ```

  Export it in the store's returned object (add next to `removePanelGuarded`):

  ```ts
      removePanelGuarded,
      closeOthersInGroup,
  ```

- [ ] **Step 5 — Run (expect PASS).** `pnpm vitest run tests/unit/stores/session.spec.ts` → the three new tests green **and** all pre-existing session tests still green (fake extension was additive).

- [ ] **Step 6 — Commit.**
      `git add src/stores/session.ts tests/unit/stores/session.spec.ts`
      `git commit` → `feat(session): closeOthersInGroup action + maximize-modeling test fake`

---

### Task 3 — `toggleMaximize(panelId)` session action (grid-gated)

**Files:** `tests/unit/stores/session.spec.ts`, `src/stores/session.ts`

- [ ] **Step 1 — Failing test.** Add to `describe("useSessionStore", …)`:

  ```ts
  it("toggleMaximize maximizes a grid group, then restores it on second call", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { isMaximized: () => boolean } } | undefined;
    };
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(false);

    const max = await session.toggleMaximize(p2.id);
    expect(max).toBe(true);
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(true);

    const restored = await session.toggleMaximize(p2.id);
    expect(restored).toBe(true);
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(false);
  });

  it("toggleMaximize is a no-op (returns false) for an off-grid group", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: { locationType: string }; isMaximized: () => boolean } } | undefined;
    };
    // Simulate a floating group (Phase 2 has no float UI yet, but the gate
    // must still hold).
    fake.getPanel(p2.id)!.api.group.locationType = "floating";

    const result = await session.toggleMaximize(p2.id);
    expect(result).toBe(false);
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(false);
  });

  it("toggleMaximize does not dirty the session (view-only state, not persisted)", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.toggleMaximize(p2.id);
    expect(session.dirty).toBe(false);
  });
  ```

- [ ] **Step 2 — Run (expect FAIL).** `pnpm vitest run tests/unit/stores/session.spec.ts` → fails: `session.toggleMaximize is not a function`.

- [ ] **Step 3 — Minimal impl.** In `src/stores/session.ts`, add after `closeOthersInGroup`:

  ```ts
  /**
   * Maximize the right-clicked panel's group, or restore it if already
   * maximized. Maximize is view-only state — dockview does NOT serialize it
   * into toJSON, so this does NOT mark the session dirty (matching the
   * restoring-guarded invariant style). Gated to grid-located groups: floating,
   * pop-out, and edge groups have no maximize concept, so the action is a no-op
   * there (Phase 2 ships no float/pop-out UI yet, but the gate is coded now).
   * `panel.api.location` resolves to `panel.api.group.api.location` in
   * dockview-core 6.6.1, so this gate is equivalent to spec §6.1's
   * `panel.api.group.api.location.type === 'grid'`. Returns whether a
   * maximize/restore was performed.
   */
  async function toggleMaximize(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return false;
    if (panel.api.location.type !== "grid") return false;

    setRestoring(true);
    try {
      if (panel.api.isMaximized()) {
        panel.api.exitMaximized();
      } else {
        panel.api.maximize();
      }
    } finally {
      setRestoring(false);
    }
    return true;
  }
  ```

  Export it next to `closeOthersInGroup`:

  ```ts
      closeOthersInGroup,
      toggleMaximize,
  ```

  > Note `async`/`await` is retained for call-site symmetry (every menu command
  > in the component does `void session.<action>(…)`); the body has no awaits but
  > the signature matches the existing guarded-action shape and keeps the
  > component handlers uniform. This is verified safe against the repo's ESLint
  > config — `@typescript-eslint/require-await` is **not** enabled
  > (`@vue/eslint-config-typescript` recommended, no type-aware rules). Step 4
  > runs `pnpm lint` to confirm before commit; if a future config change ever
  > enables `require-await`, drop `async` and return the boolean directly (call
  > sites already use `void session.toggleMaximize(...)`).

- [ ] **Step 4 — Run (expect PASS) + lint gate.**
      `pnpm vitest run tests/unit/stores/session.spec.ts` → new tests green + all prior green.
      `pnpm lint` → clean (confirms the async-no-await signature does not trip `require-await` under the real config; if it ever does, apply the fallback noted above and re-run).

- [ ] **Step 5 — Commit.**
      `git add src/stores/session.ts tests/unit/stores/session.spec.ts`
      `git commit` → `feat(session): grid-gated toggleMaximize action`

---

### Task 4 — Rename to `DockContextMenu.vue` and add the tabbed branch + Maximize

**Files:** rename `src/components/layout/dock/CleanPaneContextMenu.vue` → `src/components/layout/dock/DockContextMenu.vue`; docstring edit to `src/components/layout/dock/cleanPaneControls.ts`

This is the component task — Stage-1 Playwright-verified (Task 6), no brittle component unit test, consistent with Phase 1's note in the component docstring.

- [ ] **Step 1 — Pure rename first (preserves blame), as its own commit.** Keep this commit content-free so git detects it at ~100% similarity and blame continuity survives:
      `git mv src/components/layout/dock/CleanPaneContextMenu.vue src/components/layout/dock/DockContextMenu.vue`
      `git commit` → `refactor(dock): rename CleanPaneContextMenu to DockContextMenu`

  > Rationale for splitting: a `git mv` immediately followed by a wholesale
  > content rewrite drops similarity below git's rename-detection threshold, so
  > blame continuity would be lost. Committing the pure rename first preserves it.

- [ ] **Step 2 — Rewrite the component.** Replace the full contents of `src/components/layout/dock/DockContextMenu.vue` with the generalized handler. The clean branch keeps Show header / Split / Close verbatim and **gains** a Maximize/Restore item; the new tabbed branch adds Close / Close others / Hide header / Maximize. The single root `contextmenu` listener now branches on `group.header.hidden`. The shared `maximizeItem` is **disabled when the group is off-grid** so the menu affordance matches the action gate (`toggleMaximize` no-ops off-grid):

  ```vue
  <script setup lang="ts">
  import type { DockviewApi, IDockviewPanel } from "dockview-vue";
  import type { MenuItem } from "primevue/menuitem";

  import {
    ChevronRight,
    Columns2,
    Maximize2,
    Minimize2,
    PanelTop,
    PanelTopClose,
    SquareSplitHorizontal,
    X,
  } from "@lucide/vue";
  import { onUnmounted, ref, watch, type Component } from "vue";

  import ContextMenu from "@/components/ui/ContextMenu.vue";
  import { MISSING_PANEL_TYPE } from "@/modules/panels/missing";
  import { panelRegistry } from "@/modules/panels/registry";
  import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
  import { useSessionStore } from "@/stores/session";

  import { cleanPaneControls } from "./cleanPaneControls";
  import { tabbedPaneControls } from "./tabbedPaneControls";

  /**
   * Right-click context menu for BOTH dock pane types.
   *
   * CUSTOM by necessity: dockview exposes no slot to inject per-group chrome on
   * a header-hidden group, and the maintainer wants ZERO persistent chrome over
   * the map. So instead of an always-mounted overlay we attach a single
   * `contextmenu` listener to the dock root (supplied via the `root` PROP —
   * `DockviewApi` itself has no `.element`) and open a PrimeVue `ContextMenu`
   * at the cursor with a model that depends on the right-clicked group's mode:
   *
   *  - CLEAN group (`header.hidden === true`): Show header / Split / Maximize /
   *    Close — the Phase-1 clean-pane menu, now with Maximize.
   *  - TABBED group (`header.hidden === false`): Close / Close others /
   *    Hide header / Maximize. "Hide header" routes through the same
   *    `session.toggleHeaderless`, completing the clean⇄tabbed round-trip.
   *
   * The Maximize/Restore label is always read fresh from `panel.api.isMaximized()`
   * at menu-open time, and the model is rebuilt on every right-click — so we do
   * NOT subscribe to `api.onDidMaximizedGroupChange`. There is no persistent
   * always-mounted control whose label could go stale; a subscription would be
   * dead weight. (The event is still modeled as a no-op in the test fake.)
   *
   * Pure label/disabled logic lives in `cleanPaneControls.ts` /
   * `tabbedPaneControls.ts` (unit-tested); iteration + maximize logic lives in
   * unit-tested session actions (`closeOthersInGroup`, `toggleMaximize`). This
   * component is Stage-1 Playwright-verified per the CommandVue verification
   * protocol — no unit test.
   */
  const props = defineProps<{ api: DockviewApi | null; root: HTMLElement | null }>();
  const session = useSessionStore();

  /** Menu item shape with the Lucide component attached for the `#item` slot. */
  type DockMenuItem = MenuItem & { lucide?: Component };

  const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null);
  const model = ref<DockMenuItem[]>([]);
  const disposers: Array<() => void> = [];

  /**
   * Registered panel types eligible as a split target — the synthetic
   * `__unassigned__` and `__missing__` placeholder types and the
   * components-browser shell are filtered out, mirroring MenuBar's
   * Add-Component picker.
   */
  function panelChoices() {
    return panelRegistry
      .list()
      .filter(
        (d) =>
          d.id !== UNASSIGNED_PANEL_TYPE &&
          d.id !== MISSING_PANEL_TYPE &&
          d.id !== "components-browser",
      );
  }

  /**
   * Maximize/Restore item shared by both menus. Label + icon flip on live state;
   * disabled off-grid so the affordance matches `session.toggleMaximize`'s
   * grid-only gate (floating / pop-out / edge groups have no maximize concept —
   * none ship in Phase 2, but the gate is coded now).
   */
  function maximizeItem(panel: IDockviewPanel): DockMenuItem {
    const maximized = panel.api.isMaximized();
    const onGrid = panel.api.location.type === "grid";
    return {
      label: maximized ? "Restore" : "Maximize",
      lucide: maximized ? Minimize2 : Maximize2,
      disabled: !onGrid,
      command: () => void session.toggleMaximize(panel.id),
    };
  }

  /**
   * CLEAN pane menu (group.header.hidden === true). Phase-1 items + Maximize.
   * `totalPanels` drives the Close empty-workspace guard; the group is always
   * clean here, so Show-header is derived with `isHeaderless: true`.
   */
  function buildCleanModel(panel: IDockviewPanel, totalPanels: number): DockMenuItem[] {
    const controls = cleanPaneControls({ isHeaderless: true, totalPanels });
    const showHeader = controls.find((c) => c.id === "toggle-header");
    const close = controls.find((c) => c.id === "close");

    return [
      {
        label: showHeader?.label ?? "Show header",
        lucide: PanelTop,
        command: () => void session.toggleHeaderless(panel.id),
      },
      {
        label: "Split",
        lucide: SquareSplitHorizontal,
        items: panelChoices().map((def) => ({
          label: def.title,
          command: () => void session.splitCleanNeighbor(panel.id, def.id),
        })),
      },
      maximizeItem(panel),
      { separator: true },
      {
        label: "Close",
        lucide: X,
        disabled: close?.disabled ?? false,
        command: () => void session.removePanelGuarded(panel.id),
      },
    ];
  }

  /**
   * TABBED pane menu (group.header.hidden === false). Close / Close others /
   * Hide header / Maximize. `panelsInGroup` drives the Close-others guard;
   * `totalPanels` drives the Close empty-workspace guard.
   */
  function buildTabbedModel(
    panel: IDockviewPanel,
    panelsInGroup: number,
    totalPanels: number,
  ): DockMenuItem[] {
    const controls = tabbedPaneControls({
      totalPanels,
      panelsInGroup,
      isMaximized: panel.api.isMaximized(),
    });
    const close = controls.find((c) => c.id === "close")!;
    const closeOthers = controls.find((c) => c.id === "close-others")!;

    return [
      {
        label: close.label,
        lucide: X,
        disabled: close.disabled,
        command: () => void session.removePanelGuarded(panel.id),
      },
      {
        label: closeOthers.label,
        lucide: Columns2,
        disabled: closeOthers.disabled,
        command: () => void session.closeOthersInGroup(panel.id),
      },
      {
        label: "Hide header",
        lucide: PanelTopClose,
        command: () => void session.toggleHeaderless(panel.id),
      },
      { separator: true },
      maximizeItem(panel),
    ];
  }

  function onContextMenu(event: MouseEvent): void {
    const api = props.api;
    if (!api) return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dv-groupview");
    const group = api.groups.find((g) => g.element === el || g.element.contains(el as Node));
    // Over a gutter or no group at all: do nothing, let the event bubble.
    if (!group) return;

    const panel = group.activePanel ?? group.panels[0];
    if (!panel) return;

    event.preventDefault();
    event.stopPropagation();
    model.value = group.header.hidden
      ? buildCleanModel(panel, api.panels.length)
      : buildTabbedModel(panel, group.panels.length, api.panels.length);
    contextMenuRef.value?.show(event);
  }

  watch(
    () => props.root,
    (root) => {
      for (const d of disposers.splice(0)) d();
      if (!root) return;
      root.addEventListener("contextmenu", onContextMenu);
      disposers.push(() => root.removeEventListener("contextmenu", onContextMenu));
    },
    { immediate: true },
  );

  onUnmounted(() => {
    for (const d of disposers.splice(0)) d();
  });
  </script>

  <template>
    <ContextMenu ref="contextMenuRef" :model="model" data-testid="dock-context-menu">
      <template #item="{ item, props: itemProps, hasSubmenu }">
        <a
          v-bind="itemProps.action"
          :class="[
            'flex w-full items-center gap-2 text-[length:var(--density-font-size)]',
            (item as DockMenuItem).disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
          ]"
        >
          <component
            :is="(item as DockMenuItem).lucide"
            v-if="(item as DockMenuItem).lucide"
            class="text-muted size-3.5"
          />
          <span class="flex-1">{{ item.label }}</span>
          <ChevronRight v-if="hasSubmenu" class="text-faint size-3.5" />
        </a>
      </template>
    </ContextMenu>
  </template>
  ```

  > `data-testid` changes from `clean-pane-context-menu` to `dock-context-menu` (the menu now serves both pane types). Task 6's Playwright assertions target the new id.

- [ ] **Step 3 — Fix the stale docstring reference in `cleanPaneControls.ts`.** The pure module's header still names the renamed file. Update line 3 so the Task 5 "zero matches" grep holds:

  ```ts
  // before:
  //  * Pure decision-logic for the clean-pane controls. Kept separate from
  //  * `CleanPaneContextMenu.vue` so it can be unit-tested without mounting Vue or
  // after:
  //  * Pure decision-logic for the clean-pane controls. Kept separate from
  //  * `DockContextMenu.vue` so it can be unit-tested without mounting Vue or
  ```

- [ ] **Step 4 — Verify icon imports resolve.** `Maximize2`, `Minimize2`, `PanelTopClose`, `Columns2` must exist in `@lucide/vue@1.16`. Confirm with a type-check (this is the cheapest gate before Playwright): `pnpm type-check`. Expected: clean compile. If any icon name is missing from the installed Lucide version, substitute the nearest available name in BOTH `tabbedPaneControls.ts`'s `icon` union and the component import (e.g., `Columns2` → `Columns` if 1.16 lacks the numbered variant) and re-run.

- [ ] **Step 5 — Commit.**
      `git add src/components/layout/dock/DockContextMenu.vue src/components/layout/dock/cleanPaneControls.ts`
      `git commit` → `feat(dock): tabbed-pane context menu + Maximize on both pane types`

---

### Task 5 — Rewire `DockLayout.vue` to the renamed component

**Files:** `src/components/layout/DockLayout.vue`

- [ ] **Step 1 — Update the import.** Replace:

  ```ts
  import CleanPaneContextMenu from "./dock/CleanPaneContextMenu.vue";
  ```

  with:

  ```ts
  import DockContextMenu from "./dock/DockContextMenu.vue";
  ```

- [ ] **Step 2 — Update the template tag.** Replace:

  ```html
  <CleanPaneContextMenu :api="boundApi" :root="rootEl" />
  ```

  with:

  ```html
  <DockContextMenu :api="boundApi" :root="rootEl" />
  ```

- [ ] **Step 3 — Run the full unit suite + type-check + grep for stragglers.**
      `pnpm vitest run` → all green (no test references the old component name).
      `pnpm type-check` → clean.
      Use Grep for `CleanPaneContextMenu` across `src/` and `tests/` → expect **zero** matches (the rename is complete; the `cleanPaneControls.ts` docstring was updated in Task 4 Step 3, so the only remaining `cleanPaneControls` references are the still-valid pure module + its spec, which is correct).

- [ ] **Step 4 — Commit.**
      `git add src/components/layout/DockLayout.vue`
      `git commit` → `refactor(dock): mount unified DockContextMenu in DockLayout`

---

### Task 6 — Stage-1 Playwright runtime verification

**Files:** none (verification only; screenshots to `.verification-screenshots/feat-track-b-phase-2-tabbed-context-menu/`, gitignored)

Probe for `mcp__plugin_playwright_playwright__*`. If unavailable, run `ToolSearch` with `query: "playwright browser"` to load them; if still unavailable, fall back to a manual smoke-test checklist and state so explicitly in the PR description (do not embed Stage-1 results).

- [ ] **Step 1 — Boot.** `pnpm dev` (background); `browser_navigate` to the dev URL. `browser_console_messages` baseline capture (record error/warning counts).

- [ ] **Step 2 — Tabbed pane menu opens at cursor.** Right-click a **tabbed** group's tab/body (e.g., the maplibre/entities side group). Assert: native menu suppressed; `[data-testid="dock-context-menu"]` visible at the cursor; rows read **Close**, **Close others**, **Hide header**, **Maximize** (in order). Screenshot `tabbed-menu-open.png`.

- [ ] **Step 3 — Close others.** With ≥2 panels in the group, click **Close others**. Assert the group collapses to a single tab (the right-clicked one); other panels gone; layout not emptied. Screenshot `tabbed-close-others.png`.

- [ ] **Step 4 — Hide header → clean (headline).** Right-click the remaining tabbed pane → **Hide header**. Assert the group loses its tab strip (no `.dv-tabs-container` rendered for that group / `header.hidden` true) and the panel fills the pane. Right-click the now-clean pane → assert the menu now shows **Show header / Split / Maximize / Close** (clean branch). Screenshot `hide-header-roundtrip.png`.

- [ ] **Step 5 — Maximize / Restore (both pane types).** On a **clean** pane: right-click → **Maximize** → assert the group fills the dock (sibling panes hidden); right-click → label now **Restore** → click → layout returns. Repeat on a **tabbed** pane. Screenshots `maximize-clean.png`, `maximize-tabbed.png`, `restore.png`.

- [ ] **Step 6 — Clean pane menu still intact.** Right-click the seeded Cesium clean pane → assert **Show header / Split / Maximize / Close** present and the Split submenu lists registered panel types. Screenshot `clean-menu-intact.png`.

- [ ] **Step 6b — Tab-overflow dropdown clickable (Task 0 regression).** Narrow a group so its tab strip overflows (≥6 tabs), click the overflow "+N" button (`.dv-tabs-overflow-dropdown-default`), and assert the popover lists the hidden tabs AND is hit-testable: `document.elementFromPoint(cx, cy)` over a `.dv-popover-anchor .dv-tab` returns an element inside `.dv-popover-anchor` (pre-fix it returned a bare `<canvas>`). Click a hidden tab and assert it activates. Screenshot `overflow-dropdown.png`.

- [ ] **Step 7 — Console clean + dirty sanity.** `browser_console_messages`: assert zero **new** errors and no new warnings from the menu interactions. Confirm Hide header / Maximize did not produce spurious behavior (Maximize is view-only; Hide header persists). Record final error/warning counts.

- [ ] **Step 8 — Assemble the Stage-1 result table** (assertion id · description · result · screenshot) + console-error/-warning counts + PASS/FAIL summary, for the PR description. If any assertion fails, fix the root cause and re-run from Step 1 — do not open the PR until fully green.

> No commit in this task (verification only). The PR is opened after Stage 1 is green: `git push -u origin feat/track-b-phase-2-tabbed-context-menu` then `gh pr create --base develop` with the Stage-1 table embedded and a Stage-2 (human design review) checklist. **Stop and wait for the user to merge.**

---

## Self-Review — Phase 2 scope coverage

- **Tabbed-pane right-click context menu** — Task 4 adds the tabbed branch to the unified `DockContextMenu.vue` (renamed from `CleanPaneContextMenu.vue` via a dedicated pure-rename commit so blame survives, then content-rewritten; clean behavior unchanged), branching on `group.header.hidden` inside the existing single root `contextmenu` handler with `preventDefault()` + `stopPropagation()`. ✅
  - **Close** → `session.removePanelGuarded(panel.id)` (existing; last-pane guard). ✅
  - **Close others** → new unit-tested `session.closeOthersInGroup(panelId)` (Task 2) — iterates a stable snapshot of `group.panels`, removes each other panel, respects the empty-workspace guard, marks dirty only when it removed something. Done as a small session action (not inline) per the brief's preference. ✅
  - **Hide header** → `session.toggleHeaderless(panel.id)` (existing; flips both ways, splits multi-panel groups, persists `headerless`). The headline clean⇄tabbed round-trip. ✅
- **Clean-pane menu preserved + gains Maximize** — `buildCleanModel` keeps Show header / Split / Close verbatim and inserts the shared `maximizeItem`. ✅
- **Maximize / Restore for both pane types** — shared `maximizeItem(panel)` in both menus; backed by new unit-tested `session.toggleMaximize(panelId)` (Task 3) using the **verified** `panel.api.maximize/isMaximized/exitMaximized` (`dockviewPanelApi.d.ts:42-44`), **gated to `panel.api.location.type === 'grid'`** (no-op on floating/popout/edge — coded now even though Phase 2 ships no float/pop-out), view-only so it never dirties. The menu item is **disabled off-grid** so the affordance matches the gate. ✅
- **Same primitive + one handler** — reuses `src/components/ui/ContextMenu.vue`; one root `contextmenu` listener branches clean-vs-tabbed; `data-testid="dock-context-menu"` for verification. ✅
- **Test fake extended for maximize** — Task 2 adds per-group `maximized` + `locationType` (full 4-variant `grid|floating|popout|edge` union), panel-API `maximize/exitMaximized/isMaximized` + `location` getter, and the **modeled-but-unused** container methods `maximizeGroup(panel)/exitMaximizedGroup/hasMaximizedGroup` + no-op `onDidMaximizedGroupChange`. The fake mirrors the real `DockviewApi` 6.6.1 surface exactly — `maximizeGroup` takes a **panel** (not a group), and `isMaximizedGroup` is **deliberately absent** because it does not exist on the public `DockviewApi`. Additive, so all Phase-1 tests stay green. New session actions unit-tested with the fake; the component is Stage-1 Playwright-verified (no brittle unit test), consistent with Phase 1. The fake intentionally does NOT model `group.activePanel` / `group.element` (the menu's group resolution) — those are Playwright-only. ✅
- **Verified APIs** — panel-API maximize trio confirmed at `dockview-core@6.6.1/dockviewPanelApi.d.ts:42-44`; container surface confirmed at `component.api.d.ts:541-544` (`maximizeGroup(panel)/hasMaximizedGroup/exitMaximizedGroup/onDidMaximizedGroupChange`, no `isMaximizedGroup`); `DockviewGroupLocation` 4-variant union confirmed at `dockviewGroupPanelModel.d.ts:131` for the grid gate. ✅
- **Deferred correctly** — no in-window float, pop-out, minimize-to-tray, cross-window relocation, custom tab component, or per-tab persistent buttons. Dockview's default tab + close button is untouched. The container-level maximize methods are modeled but never wired to production. ✅
- **Task ordering** — pure tabbed logic → fake-extension + `closeOthersInGroup` → `toggleMaximize` → component rename(+docstring fix)/extension → `DockLayout` rewire → Stage-1 Playwright. Each session/pure step is red→green→commit before the component depends on it. ✅
- **GitFlow** — feature branch `feat/track-b-phase-2-tabbed-context-menu` off `develop`; Conventional-Commit messages per task (including a standalone `refactor(dock): rename …` commit); no push/PR until Stage-1 is green; user merges. ✅

Plan file path: `D:\Work\UraanAI\Public\CommandVue\.internal\specs\track-b-phase-2-implementation-plan.md` (saved under `.internal/` per the project convention).
