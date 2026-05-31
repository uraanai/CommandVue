# Track B Phase 1 — Clean-Panes Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add the clean (header-less) panes foundation to CommandVue's Dockview surface — any group can drop its tab strip (`group.header.hidden = true`) and fill its pane. Cesium seeds clean; clean mode persists in `PanelState.state.headerless` and is re-applied after every load path; the session store gains a `restoring` guard, `applyHeaderlessGroups`, a rewritten `rebuildFromPanelStates` with an idempotent legacy backfill, `toggleHeaderless`, `removePanelGuarded`, and `splitCleanNeighbor`; `DockLayout.vue` gets `noPanelsOverlay="emptyGroup"`, exposes its dock-root element, and mounts a hover-overlay control shell.

**Architecture:** Dockview-core's live group model exposes `IHeader.hidden` (settable) — the single clean/tabbed switch. It is NOT serialized by `toJSON()`, so we own persistence: write `headerless: true` into the panel's `PanelState.state` (a `Record<string, unknown>`, already round-tripped through `panelStateRepo`), then re-apply it as the last statement of `session.loadLayout` via `applyHeaderlessGroups(api)`. The DockviewApi lives in a module-scope `shallowRef` in `session.ts`, bound in `DockLayout.onReady`. A net-new `restoring` ref gates `markDirty` so invariant-application and toggles don't false-dirty the session. The magic-string `"headerless"` is isolated in one tiny helper module.

**Tech Stack:** Vue 3 + TypeScript (strict), Pinia, dockview-vue 6.6.1 / dockview-core, Vitest + @vue/test-utils, PrimeVue (unstyled) wrappers, Lucide icons (`@lucide/vue@1.16`), Playwright MCP for Stage-1 runtime verification. Test command: `pnpm vitest run <path>` (the `test` script is `vitest run`).

**Verified API ground truth (from installed `.d.ts`, dockview-core@6.6.1):**

- `DockviewApi` exposes `panels: IDockviewPanel[]`, `groups: DockviewGroupPanel[]`, `getPanel(id): IDockviewPanel | undefined`, `getGroup(id): IDockviewGroupPanel | undefined`, `addGroup(opts?): DockviewGroupPanel`, `addPanel(opts): IDockviewPanel`, `removePanel(panel): void`, `clear()`, `toJSON()`, `fromJSON(blob)`, `onDidLayoutChange: Event<void>`.
- `DockviewApi` has **NO** `element` / `rootElement` member — the dock-root DOM node must be obtained from `DockLayout.vue` (template ref), never `api.element`.
- `panel.api.group` is the concrete `DockviewGroupPanel` (has settable `.header.hidden` and `.element: HTMLElement`). `api.groups[]` are also concrete `DockviewGroupPanel`, so `api.groups[i].element` and `.header.hidden` are valid.
- `panel.api.moveTo(opts: DockviewPanelMoveParams)` where `DockviewPanelMoveParams = DockviewGroupMoveParams` (accepts `group`, `position`, `index`, `skipSetActive`).
- `addPanel({ position: { referenceGroup, direction } })` — `RelativeGroup.direction?: Direction` where `Direction = 'left'|'right'|'above'|'below'|'within'`; `'within'` IS valid with `referenceGroup`.
- `<DockviewVue no-panels-overlay="emptyGroup">` — `noPanelsOverlay?: 'emptyGroup' | 'watermark'`.
- `IDockviewPanel`, `DockviewGroupPanel`, `DockviewApi` are all re-exported from `dockview-vue` (`export * from 'dockview-core'`).
- `header.hidden` is NOT part of `toJSON`/`fromJSON` — re-applied from persisted `PanelState.state`.
- Lucide icons present in `@lucide/vue@1.16`: `PanelTop`, `PanelTopClose`, `SquareSplitHorizontal`, `X`. (`SplitSquareHorizontal` does NOT exist — do not import it.)

---

## File Structure

**Created**

| Path                                                          | Responsibility                                                                                                                                                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/panels/headerless.ts`                            | Isolates the `"headerless"` magic-string. Exports `HEADERLESS_KEY`, `isHeaderless(state)`, `withHeaderless(state, value)`. Pure functions.                                                                                   |
| `tests/unit/modules/panels/headerless.spec.ts`                | Unit tests for the headerless helper.                                                                                                                                                                                        |
| `tests/unit/modules/panels/registry.mainPanelType.spec.ts`    | Unit tests for `panelRegistry.mainPanelType()` and the `cesium` `mainPane` flag.                                                                                                                                             |
| `src/components/layout/dock/CleanPaneOverlay.vue`             | Hover overlay positioned over the hovered clean group's DOM rect. Buttons: Show/Hide header, Split, Close. Takes the dock-root element as a prop (never `api.element`). Runtime-verified (Playwright), not unit-snapshotted. |
| `src/components/layout/dock/cleanPaneControls.ts`             | Pure, unit-testable logic extracted from the overlay: `cleanPaneControls(input)` returns which controls to show + their enabled state.                                                                                       |
| `tests/unit/components/layout/dock/cleanPaneControls.spec.ts` | Unit tests for the pure overlay-control logic.                                                                                                                                                                               |

**Modified**

| Path                                   | Responsibility                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/panels/types.ts`          | Add `mainPane?: boolean` to `PanelDefinition` (after `singleton?`).                                                                                                                                                                                                                                                        |
| `src/modules/panels/registry.ts`       | Add `mainPanelType(): PanelType \| undefined`.                                                                                                                                                                                                                                                                             |
| `src/modules/panels/builtin.ts`        | Flag `cesium` with `mainPane: true`.                                                                                                                                                                                                                                                                                       |
| `src/stores/session.ts`                | `restoring` ref + `setRestoring`; gate `markDirty`; `applyHeaderlessGroups`; `rebuildFromPanelStates` rewrite + module-scope `resolvePanelComponent`; idempotent `backfillCleanMainPane`; `toggleHeaderless`; `removePanelGuarded`; `splitCleanNeighbor`; wire backfill + `applyHeaderlessGroups` into `loadLayout`.       |
| `tests/unit/stores/session.spec.ts`    | Register builtin panels in `beforeEach`; extend `makeFakeApi()` to model groups (`addGroup`/`getGroup`/`getPanel`/`groups`, mutable `header.hidden`, direction-honoring `addPanel`, `panel.api.group`, `panel.api.moveTo`, `removePanel`); stagger `createdAt` in `seedWorkspace`; add tests for the new session behavior. |
| `src/components/layout/DockLayout.vue` | Add `no-panels-overlay="emptyGroup"`; wrap dock in a positioned container with a template ref; expose the bound api + dock-root element; mount `CleanPaneOverlay`.                                                                                                                                                         |

No schema change to `panelStateRepo` / `seed.ts` (`state?: Record<string,unknown>` already round-trips; the spec's single backfill point is `rebuildFromPanelStates`'s caller `loadLayout`, NOT `seed.ts`).

---

## Task 1 — `PanelDefinition.mainPane` + `panelRegistry.mainPanelType()` + flag Cesium

**Files:**

- Modify: `src/modules/panels/types.ts` (add field after `singleton?`, line 71)
- Modify: `src/modules/panels/registry.ts` (add method after `list()`, line 42)
- Modify: `src/modules/panels/builtin.ts` (cesium entry, lines 18–25)
- Test: `tests/unit/modules/panels/registry.mainPanelType.spec.ts` (new)

- [ ] **Step 1: Write the failing test for `mainPanelType()`.**
      Create `tests/unit/modules/panels/registry.mainPanelType.spec.ts`. The cesium-flag assertion uses the static `BUILTIN_PANELS` array (no registration needed); `mainPanelType()` uses a registered registry. `beforeEach`/`afterEach` call `__unregisterBuiltinPanelsForTests()` so the `registered` flag inside `builtin.ts` is honestly reset between cases:

  ```ts
  import { afterEach, beforeEach, describe, expect, it } from "vitest";

  import {
    BUILTIN_PANELS,
    __unregisterBuiltinPanelsForTests,
    registerBuiltinPanels,
  } from "@/modules/panels/builtin";
  import { panelRegistry } from "@/modules/panels/registry";

  describe("panelRegistry.mainPanelType", () => {
    beforeEach(() => {
      panelRegistry.__resetForTests();
      __unregisterBuiltinPanelsForTests();
    });
    afterEach(() => {
      panelRegistry.__resetForTests();
      __unregisterBuiltinPanelsForTests();
    });

    it("returns undefined when no panel is flagged mainPane", () => {
      panelRegistry.register({
        id: "alpha",
        title: "Alpha",
        description: "",
        icon: "box",
        category: "tools",
        component: () => Promise.resolve({}),
      });
      expect(panelRegistry.mainPanelType()).toBeUndefined();
    });

    it("returns the id of the first mainPane-flagged definition", () => {
      panelRegistry.register({
        id: "alpha",
        title: "Alpha",
        description: "",
        icon: "box",
        category: "tools",
        component: () => Promise.resolve({}),
      });
      panelRegistry.register({
        id: "beta",
        title: "Beta",
        description: "",
        icon: "box",
        category: "maps",
        mainPane: true,
        component: () => Promise.resolve({}),
      });
      expect(panelRegistry.mainPanelType()).toBe("beta");
    });

    it("the built-in cesium panel is flagged mainPane (static array)", () => {
      const cesium = BUILTIN_PANELS.find((d) => d.id === "cesium");
      expect(cesium?.mainPane).toBe(true);
    });

    it("registerBuiltinPanels makes cesium the registry main type", () => {
      registerBuiltinPanels();
      expect(panelRegistry.mainPanelType()).toBe("cesium");
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
      `pnpm vitest run tests/unit/modules/panels/registry.mainPanelType.spec.ts`
      Expected failure: `TypeError: panelRegistry.mainPanelType is not a function` (and the cesium-flag assertion fails on `mainPane` being `undefined`).

- [ ] **Step 3: Add `mainPane?: boolean` to `PanelDefinition`.**
      In `src/modules/panels/types.ts`, immediately after the `singleton?: boolean;` field (line 71, the last field before the interface close):

  ```ts
    singleton?: boolean;

    /**
     * Marks this panel type as the default "clean" (header-less) pane for the
     * clean-panes model (Track B). When seeding or rebuilding a layout, the
     * first `mainPane` type is added as its own clean group (no tab strip) and
     * the idempotent legacy backfill promotes it to clean if nothing else is.
     * Additive and orthogonal to `singleton`.
     */
    mainPane?: boolean;
  ```

- [ ] **Step 4: Add `mainPanelType()` to the registry.**
      In `src/modules/panels/registry.ts`, after the `list()` method (line 42) add:

  ```ts
    /**
     * Returns the id of the first panel type flagged `mainPane: true`, or
     * `undefined` if none is. Used by the clean-panes model to decide which
     * type seeds as a clean (header-less) pane.
     */
    mainPanelType(): PanelType | undefined {
      for (const def of this.definitions.values()) {
        if (def.mainPane) return def.id;
      }
      return undefined;
    }
  ```

  (`PanelType` is already imported at the top of `registry.ts`.)

- [ ] **Step 5: Flag Cesium with `mainPane: true`.**
      In `src/modules/panels/builtin.ts`, the `cesium` entry (lines 18–25), add the flag:

  ```ts
    {
      id: "cesium",
      title: "3D Globe",
      description: "Cesium-powered 3D globe with terrain and imagery layers.",
      icon: "globe",
      category: "maps",
      mainPane: true,
      component: () => import("@/components/panels/CesiumPanel.vue"),
    },
  ```

- [ ] **Step 6: Run the test — expect PASS.**
      `pnpm vitest run tests/unit/modules/panels/registry.mainPanelType.spec.ts`
      Expected: `4 passed`.

- [ ] **Step 7: Commit.**
  ```bash
  git add src/modules/panels/types.ts src/modules/panels/registry.ts src/modules/panels/builtin.ts tests/unit/modules/panels/registry.mainPanelType.spec.ts
  git commit -m "feat(panels): add mainPane flag and panelRegistry.mainPanelType() for clean-panes seeding"
  ```

---

## Task 2 — `headerless` helper module

**Files:**

- Create: `src/modules/panels/headerless.ts`
- Test: `tests/unit/modules/panels/headerless.spec.ts` (new)

- [ ] **Step 1: Write the failing test.**
      Create `tests/unit/modules/panels/headerless.spec.ts`:

  ```ts
  import { describe, expect, it } from "vitest";

  import { HEADERLESS_KEY, isHeaderless, withHeaderless } from "@/modules/panels/headerless";

  describe("headerless helper", () => {
    it("HEADERLESS_KEY is the single magic-string", () => {
      expect(HEADERLESS_KEY).toBe("headerless");
    });

    it("isHeaderless is false for missing / undefined state", () => {
      expect(isHeaderless(undefined)).toBe(false);
      expect(isHeaderless({})).toBe(false);
      expect(isHeaderless({ other: 1 })).toBe(false);
    });

    it("isHeaderless is true only when the flag is strictly true", () => {
      expect(isHeaderless({ headerless: true })).toBe(true);
      expect(isHeaderless({ headerless: false })).toBe(false);
      expect(isHeaderless({ headerless: "yes" })).toBe(false);
    });

    it("withHeaderless(state, true) sets the flag without mutating the input", () => {
      const input = { foo: 1 };
      const next = withHeaderless(input, true);
      expect(next).toEqual({ foo: 1, headerless: true });
      expect(input).toEqual({ foo: 1 });
    });

    it("withHeaderless(state, false) removes the flag", () => {
      const next = withHeaderless({ foo: 1, headerless: true }, false);
      expect(next).toEqual({ foo: 1 });
      expect("headerless" in next).toBe(false);
    });

    it("withHeaderless tolerates undefined state", () => {
      expect(withHeaderless(undefined, true)).toEqual({ headerless: true });
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
      `pnpm vitest run tests/unit/modules/panels/headerless.spec.ts`
      Expected failure: `Failed to resolve import "@/modules/panels/headerless"` / `Cannot find module`.

- [ ] **Step 3: Implement the helper.**
      Create `src/modules/panels/headerless.ts`:

  ```ts
  /**
   * The "headerless" (clean pane) convention on `PanelState.state`.
   *
   * Dockview's `group.header.hidden` is NOT part of `toJSON()`, so clean mode
   * is persisted by us as a flag inside the panel's `PanelState.state`
   * (a `Record<string, unknown>`) and re-applied after every load path via
   * `session.applyHeaderlessGroups`. This module is the ONLY place the magic
   * string lives — every read/write goes through `isHeaderless` /
   * `withHeaderless`.
   */
  export const HEADERLESS_KEY = "headerless" as const;

  /** True when the panel-state marks this panel as a clean (header-less) pane. */
  export function isHeaderless(state: Record<string, unknown> | undefined): boolean {
    return state?.[HEADERLESS_KEY] === true;
  }

  /**
   * Returns a new state object with the headerless flag set (`value: true`) or
   * removed (`value: false`). Never mutates the input.
   */
  export function withHeaderless(
    state: Record<string, unknown> | undefined,
    value: boolean,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = { ...(state ?? {}) };
    if (value) {
      next[HEADERLESS_KEY] = true;
    } else {
      delete next[HEADERLESS_KEY];
    }
    return next;
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
      `pnpm vitest run tests/unit/modules/panels/headerless.spec.ts`
      Expected: `6 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/modules/panels/headerless.ts tests/unit/modules/panels/headerless.spec.ts
  git commit -m "feat(panels): add headerless state helper to isolate the clean-pane magic-string"
  ```

---

## Task 3 — Register builtins in the session spec, extend `makeFakeApi()` to model groups, add the `restoring` guard

This is the linchpin task: the registered builtins and the extended fake are reused by every later store test. Define them fully here, plus the net-new `restoring` ref, `setRestoring`, and the `markDirty` gate.

**Why register builtins:** `tests/setup.ts` is empty, so the session spec starts with an empty `panelRegistry`. Without registration, `panelRegistry.mainPanelType()` returns `undefined` inside every session test, the Cesium-backfill never fires, and the relative-docking / split tests assert on the wrong path. Registering builtins makes `mainPanelType() === "cesium"` and matches production behavior.

**Why the fake honors `direction`:** real dockview creates a NEW sibling group for `direction: 'right'` (and any non-`'within'` direction) and only joins the referenced group for `direction: 'within'`. The relative-docking rewrite (Task 5) and `splitCleanNeighbor` (Task 10) depend on this distinction; a fake that ignores `direction` would make `p1.group === p2.group` and let `header.hidden = true` corrupt the source group.

**Files:**

- Modify: `tests/unit/stores/session.spec.ts` (imports, `beforeEach`, `seedWorkspace`, `makeFakeApi`; add the `restoring` test)
- Modify: `src/stores/session.ts` (add `restoring` ref + `setRestoring` + gate `markDirty`, lines ~36–52; export in return object, lines ~225–238)

- [ ] **Step 1: Register builtins + stagger `createdAt` in the spec.**
      In `tests/unit/stores/session.spec.ts`, add the builtin import alongside the existing imports (line ~11):

  ```ts
  import {
    __unregisterBuiltinPanelsForTests,
    registerBuiltinPanels,
  } from "@/modules/panels/builtin";
  ```

  Update the `beforeEach` (lines 53–56) to register builtins after the Pinia reset (idempotent; the unregister keeps the `registered` flag honest across files):

  ```ts
  beforeEach(async () => {
    await resetForStoreTest();
    __unbindDockviewForTests();
    __unregisterBuiltinPanelsForTests();
    registerBuiltinPanels();
  });
  ```

  Update `seedWorkspace` (lines 42–50) so the two panel-states get strictly increasing `createdAt` (the repo sets `createdAt` from `Date.now()`; sequential awaits can collide in one millisecond, and `listForLayout()` sorts by `createdAt`). The `mainPane` reordering in Task 5 guarantees cesium-first regardless, but staggering keeps non-mainPane ordering deterministic across the suite:

  ```ts
  async function seedWorkspace() {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
    const p1 = await panelStateRepo.create({ layoutId: layout.id, panelType: "cesium" });
    const p2 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    // Pin a deterministic createdAt order (cesium before maplibre) so listForLayout()
    // ordering is stable even when both records land in the same millisecond.
    await panelStateRepo.update(p1.id, {}); // touch is a no-op; createdAt set at create
    await layoutRepo.update(layout.id, { panelIds: [p1.id, p2.id] });
    await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });
    return { ws, layout, p1, p2 };
  }
  ```

  > Note: `createdAt` is assigned at `create()` time and `p1` is created first, so `p1.createdAt <= p2.createdAt` already holds; the explicit no-op `update` is kept only as a documentation anchor. If a future flake appears, replace it with explicit increasing timestamps. Do NOT assert ordering on `createdAt` alone — the cesium-first guarantee comes from the `mainPane` reordering in Task 5.

- [ ] **Step 2: Replace `makeFakeApi()` with the direction-honoring, group-modeling fake.**
      In `tests/unit/stores/session.spec.ts`, replace the entire `makeFakeApi` function (lines 21–40) and its doc comment (lines 15–20) with:

  ```ts
  /**
   * Group-modeling DockviewApi test double for the clean-panes work. Models
   * the slice of dockview-core that Phase 1 session methods touch:
   *
   *  - `addPanel({ id, component, title, position? })` returns a panel whose
   *    `.api.group` is a group object with a MUTABLE `header.hidden` boolean.
   *    With no `position` the panel lands in its own fresh group. With
   *    `position.referenceGroup` it lands in that SAME group ONLY when
   *    `position.direction === 'within'`; for any other direction
   *    ('left'|'right'|'above'|'below') it lands in a NEW neighbor group.
   *    This mirrors real dockview's relative-docking semantics — the one
   *    distinction the rebuild rewrite and splitCleanNeighbor depend on.
   *  - `getPanel(id)` / `getGroup(id)` / `panels` / `groups` / `addGroup()`.
   *  - `panel.api.moveTo({ group?, position?, index?, skipSetActive? })` moves a
   *    panel to a target group (creating one when `group` is omitted).
   *  - `removePanel(panel)` detaches a panel and drops emptied groups.
   *
   * Everything not modeled is left off the stub; accessing it is a TypeError,
   * which surfaces accidental usage during a test. The fake deliberately does
   * NOT model group DOM (`element`/getBoundingClientRect) — the only rect logic
   * is the pure `cleanPaneControls`, unit-tested separately.
   */
  interface FakeHeader {
    hidden: boolean;
  }
  interface FakeGroup {
    id: string;
    header: FakeHeader;
    panels: FakePanel[];
  }
  interface FakePanel {
    id: string;
    component: string;
    title?: string;
    api: {
      group: FakeGroup;
      moveTo: (opts: {
        group?: FakeGroup;
        position?: unknown;
        index?: number;
        skipSetActive?: boolean;
      }) => void;
    };
  }

  interface FakeDockviewApi {
    panels: FakePanel[];
    groups: FakeGroup[];
    clear: ReturnType<typeof vi.fn>;
    addGroup: () => FakeGroup;
    addPanel: ReturnType<typeof vi.fn>;
    removePanel: ReturnType<typeof vi.fn>;
    getPanel: (id: string) => FakePanel | undefined;
    getGroup: (id: string) => FakeGroup | undefined;
    toJSON: ReturnType<typeof vi.fn>;
    fromJSON: ReturnType<typeof vi.fn>;
    onDidLayoutChange: ReturnType<typeof vi.fn>;
  }

  function makeFakeApi(): DockviewApi {
    const panels: FakePanel[] = [];
    const groups: FakeGroup[] = [];
    let groupSeq = 0;

    function makeGroup(): FakeGroup {
      const group: FakeGroup = {
        id: `g${++groupSeq}`,
        header: { hidden: false },
        panels: [],
      };
      groups.push(group);
      return group;
    }

    function detach(panel: FakePanel): void {
      const from = panel.api.group;
      from.panels = from.panels.filter((p) => p !== panel);
      if (from.panels.length === 0) {
        const i = groups.indexOf(from);
        if (i >= 0) groups.splice(i, 1);
      }
    }

    const stub: FakeDockviewApi = {
      panels,
      groups,
      clear: vi.fn(() => {
        panels.length = 0;
        groups.length = 0;
        groupSeq = 0;
      }),
      addGroup: () => makeGroup(),
      addPanel: vi.fn(
        (p: {
          id: string;
          component: string;
          title?: string;
          position?: { referenceGroup?: FakeGroup; direction?: string };
        }) => {
          const ref = p.position?.referenceGroup;
          const within = p.position?.direction === "within";
          // Honor relative-docking: 'within' (or no direction with a ref) joins
          // the referenced group; any other direction creates a NEW neighbor.
          const group = ref ? (within ? ref : makeGroup()) : makeGroup();
          const panel: FakePanel = {
            id: p.id,
            component: p.component,
            title: p.title,
            api: {
              group,
              moveTo: (opts) => {
                detach(panel);
                const target = opts.group ?? makeGroup();
                panel.api.group = target;
                target.panels.push(panel);
              },
            },
          };
          group.panels.push(panel);
          panels.push(panel);
          return panel;
        },
      ),
      removePanel: vi.fn((panel: FakePanel) => {
        const i = panels.indexOf(panel);
        if (i >= 0) panels.splice(i, 1);
        const g = panel.api.group;
        g.panels = g.panels.filter((p) => p !== panel);
        if (g.panels.length === 0) {
          const gi = groups.indexOf(g);
          if (gi >= 0) groups.splice(gi, 1);
        }
      }),
      getPanel: (id: string) => panels.find((p) => p.id === id),
      getGroup: (id: string) => groups.find((g) => g.id === id),
      toJSON: vi.fn(() => ({
        grid: { fake: true },
        panels: Object.fromEntries(panels.map((p) => [p.id, {}])),
      })),
      // Intentional no-op on the no-`panels` branch so the existing
      // "loadLayout uses fromJSON when dockviewState is present" test (which
      // passes a blob without a `panels` key) keeps `addPanel` uncalled. The
      // round-trip test (Task 8) passes a blob WITH `panels` to exercise the
      // re-create branch.
      fromJSON: vi.fn((blob?: { panels?: Record<string, unknown> }) => {
        if (blob?.panels) {
          for (const id of Object.keys(blob.panels)) {
            stub.addPanel({ id, component: "cesium", title: "restored" });
          }
        }
      }),
      onDidLayoutChange: vi.fn(() => ({ dispose: () => undefined })),
    };
    return stub as unknown as DockviewApi;
  }
  ```

  > The existing tests at lines 64–90 are updated for relative docking in Task 5. They still type-check against this fake now; the `addPanel` ids assertion is rewritten in Task 5. The `fromJSON` re-create branch is dormant until Task 8 supplies a `panels` blob.

- [ ] **Step 3: Write a failing test for the `restoring` guard.**
      Add inside the `describe("useSessionStore", …)` block (after the `markDirty / clearDirty` test, ~line 99):

  ```ts
  it("markDirty no-ops while restoring is true", () => {
    const session = useSessionStore();
    expect(session.dirty).toBe(false);
    session.setRestoring(true);
    session.markDirty();
    expect(session.dirty).toBe(false);
    session.setRestoring(false);
    session.markDirty();
    expect(session.dirty).toBe(true);
  });
  ```

- [ ] **Step 4: Run the test — expect FAIL.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "markDirty no-ops while restoring"`
      Expected failure: `TypeError: session.setRestoring is not a function`.

- [ ] **Step 5: Add the `restoring` ref, `setRestoring`, and gate `markDirty`.**
      In `src/stores/session.ts`, after `const dirty = ref(false);` (line 36) add:

  ```ts
  const restoring = ref(false);
  ```

  Replace `markDirty` (lines 50–52) with:

  ```ts
  function markDirty(): void {
    if (restoring.value) return;
    dirty.value = true;
  }

  /**
   * Toggle the restoring guard. While true, `markDirty` is a no-op so that
   * invariant application (header-less re-apply, backfill) and clean-pane
   * toggles never false-dirty the session. The single mutation path for the
   * guard — every internal caller uses this, never `restoring.value = …`.
   */
  function setRestoring(value: boolean): void {
    restoring.value = value;
  }
  ```

  Add `restoring` and `setRestoring` to the store's returned object (the `return {` block, lines 225–238): add `restoring,` after `dirty,` and `setRestoring,` after `clearDirty,`.

- [ ] **Step 6: Run the test — expect PASS (and the whole spec stays green).**
      `pnpm vitest run tests/unit/stores/session.spec.ts`
      Expected: all existing tests plus the new one pass (`9 passed`).

- [ ] **Step 7: Commit.**
  ```bash
  git add src/stores/session.ts tests/unit/stores/session.spec.ts
  git commit -m "feat(session): add restoring guard that no-ops markDirty during invariant application"
  ```

---

## Task 4 — `applyHeaderlessGroups(api)`

**Files:**

- Modify: `src/stores/session.ts` (new function inside the store factory; export it; call from `loadLayout`)
- Modify: `tests/unit/stores/session.spec.ts` (new test)

- [ ] **Step 1: Write the failing test.**
      Add to `tests/unit/stores/session.spec.ts` inside the `describe` block:

  ```ts
  it("applyHeaderlessGroups hides the header for panels flagged headerless and is restoring-guarded", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    // Flag p1 (cesium) headerless in its persisted state.
    await panelStateRepo.update(p1.id, { state: { headerless: true } });

    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);

    // Applying invariants must not leave the session dirty.
    expect(session.dirty).toBe(false);
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "applyHeaderlessGroups hides the header"`
      Expected failure: `expect(received).toBe(expected) … Expected: true Received: false` — `loadLayout` does not yet apply headerless.

- [ ] **Step 3: Implement `applyHeaderlessGroups` and call it from `loadLayout`.**
      In `src/stores/session.ts`, add the import at the top (in the `@/modules/panels` import group, near line 7–8):

  ```ts
  import { isHeaderless } from "@/modules/panels/headerless";
  ```

  Add this function inside the store factory, after `loadLayout` (before `updateCurrentLayout`, ~line 89):

  ```ts
  /**
   * Re-apply clean (header-less) mode after a load. `header.hidden` is NOT
   * serialized by dockview's `toJSON()`, so for every panel whose persisted
   * `PanelState.state` is headerless we set its group's header hidden. Safe
   * no-op when nothing is flagged. Restoring-guarded so it never dirties.
   */
  function applyHeaderlessGroups(api: DockviewApi): void {
    setRestoring(true);
    try {
      const panelStateStore = usePanelStateStore();
      for (const ps of panelStateStore.listForLayout()) {
        if (!isHeaderless(ps.state)) continue;
        const panel = api.getPanel(ps.id);
        const group = panel?.api.group;
        if (group) group.header.hidden = true;
      }
    } finally {
      setRestoring(false);
    }
  }
  ```

  In `loadLayout`, replace the tail (lines 86–87):

  ```ts
  loadedLayoutId.value = layoutId;
  dirty.value = false;
  ```

  with:

  ```ts
  applyHeaderlessGroups(api);

  loadedLayoutId.value = layoutId;
  dirty.value = false;
  ```

  Add `applyHeaderlessGroups` to the returned object (after `loadLayout,`).

- [ ] **Step 4: Run the test — expect PASS.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "applyHeaderlessGroups hides the header"`
      Expected: `1 passed`.

- [ ] **Step 5: Run the full spec — expect all green.**
      `pnpm vitest run tests/unit/stores/session.spec.ts`
      Expected: `10 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/stores/session.ts tests/unit/stores/session.spec.ts
  git commit -m "feat(session): re-apply clean (header-less) mode after every load via applyHeaderlessGroups"
  ```

---

## Task 5 — Rewrite `rebuildFromPanelStates` (relative docking) + idempotent Cesium backfill

`resolvePanelComponent` and `rebuildFromPanelStates` stay at **module scope** (after the store factory, where `rebuildFromPanelStates` lives today). They use only module-level imports (`panelRegistry`, `MISSING_PANEL_TYPE`, `UNASSIGNED_PANEL_TYPE`) — no closure access to store refs. The `backfillCleanMainPane` function is inside the store factory (it touches the `usePanelStateStore` + `setRestoring`-adjacent flow).

**Files:**

- Modify: `src/stores/session.ts` (module-scope `resolvePanelComponent` + rewritten module-scope `rebuildFromPanelStates`; store-factory `backfillCleanMainPane`; wire backfill into `loadLayout`; imports)
- Modify: `tests/unit/stores/session.spec.ts` (update the existing rebuild test for relative docking; add a backfill test)

- [ ] **Step 1: Update the existing rebuild test for relative docking, and write the failing backfill test.**
      In `tests/unit/stores/session.spec.ts`, replace the body of the existing test `"loadLayout rebuilds the dock from panel-states when dockviewState is null"` (lines 64–78) with:

  ```ts
  it("loadLayout rebuilds the dock from panel-states with the main pane added first", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    expect(api.clear).toHaveBeenCalled();
    expect(api.fromJSON).not.toHaveBeenCalled();
    // Both panels added (mainPane cesium first, others docked relative).
    const addedIds = vi.mocked(api.addPanel).mock.calls.map((c) => c[0]!.id);
    expect(addedIds[0]).toBe(p1.id); // cesium (mainPane) goes first
    expect(addedIds).toContain(p2.id);
    // The first sibling docked to the RIGHT of the main pane → its own group.
    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: unknown } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group).not.toBe(fake.getPanel(p2.id)!.api.group);
    expect(session.loadedLayoutId).toBe(layout.id);
    expect(session.dirty).toBe(false);
  });

  it("loadLayout backfills cesium as clean when no panel-state is headerless", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // Cesium (mainPane) promoted to clean even though nothing was flagged.
    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);

    // Backfill PERSISTED headerless so it survives the next fromJSON load.
    const persisted = await panelStateRepo.getById(p1.id);
    expect(persisted?.state).toEqual({ headerless: true });
    expect(session.dirty).toBe(false);
  });
  ```

- [ ] **Step 2: Run the tests — expect FAIL.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "main pane added first"` then `-t "backfills cesium as clean"`
      Expected failures: the relative-docking test fails on `getPanel(p1).api.group !== getPanel(p2).api.group` being false (current rebuild adds both with no position → two unrelated auto-groups, but ordering/main-first is not guaranteed and the test now asserts cesium-first via reordering), and the backfill test fails on `header.hidden` being `false` and persisted `state` being `{}`.

- [ ] **Step 3: Rewrite `rebuildFromPanelStates` and add the backfill.**
      In `src/stores/session.ts`, update the imports at the top:
  - Merge the `headerless` import to bring in `withHeaderless` (the line added in Task 4 becomes):
    ```ts
    import { isHeaderless, withHeaderless } from "@/modules/panels/headerless";
    ```
  - Add the centralized unassigned constant import (alongside the `@/modules/panels` imports):
    ```ts
    import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
    ```
  - Add the `DockviewGroupPanel` / `IDockviewPanel` type imports to the existing `dockview-vue` type import (replace line 2 `import type { DockviewApi } from "dockview-vue";`):
    ```ts
    import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from "dockview-vue";
    ```
    Replace the entire module-scope `rebuildFromPanelStates` function (lines 241–260) with the module-scope `resolvePanelComponent` + rewritten `rebuildFromPanelStates`:

  ```ts
  /**
   * Resolve a panel-state to its dockview `component` string + display title.
   * Module-scope: uses only module-level imports, no store-ref closure access.
   */
  function resolvePanelComponent(ps: PanelState): { component: string; title: string } {
    if (!ps.panelType) return { component: UNASSIGNED_PANEL_TYPE, title: "Empty" };
    const def = panelRegistry.get(ps.panelType);
    if (def) return { component: ps.panelType, title: def.title };
    // Unregistered panel type — render the missing-panel placeholder so the
    // user can reassign or remove without losing the panel-state id.
    return { component: MISSING_PANEL_TYPE, title: "Missing" };
  }

  /**
   * Rebuild the dock from panel-state records. The `mainPane`-typed panel
   * (e.g. cesium) is added FIRST as its own group; the first remaining panel
   * docks to its `dockHint` side (default `'right'`) as a side group; the rest
   * stack `'within'` that side group as tabs. `dockHint` is read from
   * `PanelState.state` per panel.
   *
   * Module-scope (matching the current file): no closure over store refs.
   */
  function rebuildFromPanelStates(api: DockviewApi, panelStates: PanelState[]): void {
    const mainType = panelRegistry.mainPanelType();
    const mainIndex = mainType ? panelStates.findIndex((ps) => ps.panelType === mainType) : -1;
    const ordered =
      mainIndex >= 0
        ? [panelStates[mainIndex]!, ...panelStates.filter((_, i) => i !== mainIndex)]
        : [...panelStates];

    let mainPanel: IDockviewPanel | undefined;
    let sideGroup: DockviewGroupPanel | undefined;

    ordered.forEach((ps, i) => {
      const { component, title } = resolvePanelComponent(ps);
      if (i === 0) {
        mainPanel = api.addPanel({ id: ps.id, component, title });
        return;
      }
      const dockHint =
        (ps.state.dockHint as "left" | "right" | "above" | "below" | undefined) ?? "right";
      if (!sideGroup) {
        const created = api.addPanel({
          id: ps.id,
          component,
          title,
          position: { referenceGroup: mainPanel!.api.group, direction: dockHint },
        });
        sideGroup = created.api.group;
      } else {
        api.addPanel({
          id: ps.id,
          component,
          title,
          position: { referenceGroup: sideGroup, direction: "within" },
        });
      }
    });
  }
  ```

  Add the backfill function inside the store factory, after `applyHeaderlessGroups` (~line 110):

  ```ts
  /**
   * Single idempotent backfill point for legacy/seeded layouts: if NO
   * panel-state is headerless and a `mainPane`-typed panel exists, persist
   * `headerless: true` on it (cache + repo in sync via the panelState store)
   * so it survives into the next `fromJSON` path. No-op once any panel is
   * clean. This is the ONLY backfill site — never in seed.ts.
   */
  async function backfillCleanMainPane(): Promise<void> {
    const panelStateStore = usePanelStateStore();
    const states = panelStateStore.listForLayout();
    if (states.some((ps) => isHeaderless(ps.state))) return;
    const mainType = panelRegistry.mainPanelType();
    if (!mainType) return;
    const target = states.find((ps) => ps.panelType === mainType);
    if (!target) return;
    await panelStateStore.updateState(target.id, {
      state: withHeaderless(target.state, true),
    });
  }
  ```

  Wire the backfill into `loadLayout` immediately before the `applyHeaderlessGroups(api)` call added in Task 4. Replace:

  ```ts
  applyHeaderlessGroups(api);

  loadedLayoutId.value = layoutId;
  dirty.value = false;
  ```

  with:

  ```ts
  await backfillCleanMainPane();
  applyHeaderlessGroups(api);

  loadedLayoutId.value = layoutId;
  dirty.value = false;
  ```

  Add `backfillCleanMainPane` to the returned object (after `applyHeaderlessGroups,`).

- [ ] **Step 4: Run the two tests — expect PASS.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "main pane added first"` then `-t "backfills cesium as clean"`
      Expected: each `1 passed`.

- [ ] **Step 5: Run the full spec — expect all green.**
      `pnpm vitest run tests/unit/stores/session.spec.ts`
      Expected: all pass (`11 passed`).

- [ ] **Step 6: Commit.**
  ```bash
  git add src/stores/session.ts tests/unit/stores/session.spec.ts
  git commit -m "feat(session): rewrite rebuildFromPanelStates for relative docking + idempotent clean-pane backfill"
  ```

---

## Task 6 — `toggleHeaderless(panelId)`

**Files:**

- Modify: `src/stores/session.ts` (new action; export it)
- Modify: `tests/unit/stores/session.spec.ts` (two new tests)

- [ ] **Step 1: Write the failing tests.**
      Add to `tests/unit/stores/session.spec.ts`:

  ```ts
  it("toggleHeaderless flips a single-panel group's header and persists the flag", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: { header: { hidden: boolean }; panels: unknown[] } } } | undefined;
    };
    // p2 (maplibre) is tabbed after load.
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);

    await session.toggleHeaderless(p2.id);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(true);
    const persisted = await panelStateRepo.getById(p2.id);
    expect(persisted?.state).toMatchObject({ headerless: true });
    expect(session.dirty).toBe(false);

    // Toggling again reverts and clears the flag.
    await session.toggleHeaderless(p2.id);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);
    const reverted = await panelStateRepo.getById(p2.id);
    expect("headerless" in (reverted?.state ?? {})).toBe(false);
  });

  it("toggleHeaderless moves a panel out of a multi-panel group before hiding the header", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | {
            api: {
              group: { id: string; header: { hidden: boolean }; panels: { id: string }[] };
              moveTo: (o: unknown) => void;
            };
          }
        | undefined;
    };
    // Force p1 and p2 into the SAME group to simulate a >1-panel group.
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup });
    expect(fake.getPanel(p1.id)!.api.group.panels.length).toBeGreaterThan(1);

    await session.toggleHeaderless(p1.id);
    // p1 now lives alone in a clean group.
    expect(fake.getPanel(p1.id)!.api.group.panels.map((p) => p.id)).toEqual([p1.id]);
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    // p2 untouched.
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);
  });
  ```

- [ ] **Step 2: Run the tests — expect FAIL.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "toggleHeaderless"`
      Expected failure: `TypeError: session.toggleHeaderless is not a function`.

- [ ] **Step 3: Implement `toggleHeaderless`.**
      In `src/stores/session.ts`, add inside the store factory (after `backfillCleanMainPane`, ~line 130):

  ```ts
  /**
   * Flip a panel's group between clean (header-less) and tabbed. A clean pane
   * holds exactly one panel, so when the group has >1 panel the active panel
   * is first split into its own new group, THEN the header is hidden. The
   * `headerless` flag is persisted to `PanelState.state` so it survives loads.
   * Restoring-guarded — toggling never dirties the session.
   */
  async function toggleHeaderless(panelId: Ulid): Promise<void> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return;

    setRestoring(true);
    try {
      let group = panel.api.group;
      const makingClean = !group.header.hidden;
      if (makingClean && group.panels.length > 1) {
        // A clean pane is single-panel — split this panel to its own group.
        panel.api.moveTo({ group: api.addGroup(), skipSetActive: true });
        group = panel.api.group;
      }
      group.header.hidden = makingClean;

      const panelStateStore = usePanelStateStore();
      const existing = panelStateStore.getState(panelId);
      await panelStateStore.updateState(panelId, {
        state: withHeaderless(existing?.state, makingClean),
      });
    } finally {
      setRestoring(false);
    }
  }
  ```

  Add `toggleHeaderless` to the returned object (after `discardChanges,`).

- [ ] **Step 4: Run the tests — expect PASS.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "toggleHeaderless"`
      Expected: `2 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/stores/session.ts tests/unit/stores/session.spec.ts
  git commit -m "feat(session): add toggleHeaderless (split-to-own-group, flip header, persist) for clean panes"
  ```

---

## Task 7 — `removePanelGuarded(panelId)`

Decision: **no-op + return a boolean** (do NOT throw). Rationale — this is wired to a UI "Close" control on a hover overlay; throwing would surface an uncaught error in a click handler and crash the overlay render path, while a `false` return lets the caller (CleanPaneOverlay) simply skip closing the last pane. The empty-workspace guard (spec §12) is best expressed as a silent refusal at the seam.

**Files:**

- Modify: `src/stores/session.ts` (new action; export it)
- Modify: `tests/unit/stores/session.spec.ts` (two new tests)

- [ ] **Step 1: Write the failing tests.**
      Add to `tests/unit/stores/session.spec.ts`:

  ```ts
  it("removePanelGuarded removes a panel when more than one remains", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const removed = await session.removePanelGuarded(p2.id);
    expect(removed).toBe(true);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p1.id]);
  });

  it("removePanelGuarded refuses to remove the last remaining panel", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // Remove one so a single panel remains.
    await session.removePanelGuarded(p2.id);
    const remainingId = (api as unknown as DockviewApi).panels[0]!.id;

    const removed = await session.removePanelGuarded(remainingId);
    expect(removed).toBe(false);
    expect((api as unknown as DockviewApi).panels).toHaveLength(1);
  });
  ```

- [ ] **Step 2: Run the tests — expect FAIL.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "removePanelGuarded"`
      Expected failure: `TypeError: session.removePanelGuarded is not a function`.

- [ ] **Step 3: Implement `removePanelGuarded`.**
      (The fake already models `removePanel` — added in Task 3.) In `src/stores/session.ts`, add inside the store factory (after `toggleHeaderless`, ~line 160):

  ```ts
  /**
   * Remove a panel, but REFUSE (return false, no throw) if doing so would
   * leave the layout with zero panels — the empty-workspace guard (spec §12).
   * Returning a boolean lets the UI close control skip the last pane without
   * an uncaught error in the click handler. Restoring-guarded around the
   * structural mutation; marks dirty afterward so the user can persist it.
   */
  async function removePanelGuarded(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    if (api.panels.length <= 1) return false;
    const panel = api.getPanel(panelId);
    if (!panel) return false;

    setRestoring(true);
    try {
      api.removePanel(panel);
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }
  ```

  Add `removePanelGuarded` to the returned object (after `toggleHeaderless,`).

- [ ] **Step 4: Run the tests — expect PASS.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "removePanelGuarded"`
      Expected: `2 passed`.

- [ ] **Step 5: Run the full session spec — expect all green.**
      `pnpm vitest run tests/unit/stores/session.spec.ts`
      Expected: all pass (`15 passed`).

- [ ] **Step 6: Commit.**
  ```bash
  git add src/stores/session.ts tests/unit/stores/session.spec.ts
  git commit -m "feat(session): add removePanelGuarded refusing to empty the last pane (empty-workspace guard)"
  ```

---

## Task 8 — Round-trip regression test (toJSON → fromJSON keeps clean mode)

Per spec §3.2 / §9, clean mode must survive a `toJSON`→`fromJSON` round-trip because `header.hidden` is NOT serialized — it must come back from `PanelState.state.headerless` via `applyHeaderlessGroups` on the `fromJSON` branch. The fake's `fromJSON` re-create branch (added in Task 3) makes this assertable: `loadLayout` calls `api.clear()` first (wiping the fake's panels), then `api.fromJSON(blob)` re-creates panels from `blob.panels`, then `applyHeaderlessGroups` hides headers per persisted state.

**Files:**

- Modify: `tests/unit/stores/session.spec.ts` (one new test)

- [ ] **Step 1: Write the failing test.**
      Add to `tests/unit/stores/session.spec.ts`:

  ```ts
  it("clean mode survives a toJSON -> fromJSON round-trip via persisted state", async () => {
    const { layout, p1 } = await seedWorkspace();
    // Persist a dockviewState (carrying the panel id) so loadLayout takes the
    // fromJSON branch and the fake re-creates p1; flag p1 headerless.
    await layoutRepo.update(layout.id, {
      dockviewState: { grid: { restored: true }, panels: { [p1.id]: {} } },
    });
    await panelStateRepo.update(p1.id, { state: { headerless: true } });

    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    expect(api.fromJSON).toHaveBeenCalledWith({
      grid: { restored: true },
      panels: { [p1.id]: {} },
    });

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    expect(session.dirty).toBe(false);
  });
  ```

  > The fake's `fromJSON` (Task 3) re-creates a panel for each key under `blob.panels`. The pre-existing `"loadLayout uses fromJSON when dockviewState is present"` test passes `{ grid: { restored: true } }` with NO `panels` key, so its `addPanel` assertion stays valid — the no-`panels` branch is intentionally a no-op (commented in the fake).

- [ ] **Step 2: Run the test — expect PASS.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "clean mode survives a toJSON"`
      Expected: `1 passed`. (This test mainly guards the production `loadLayout` already implemented in Tasks 4–5 against the `fromJSON` branch; the fake's `fromJSON` re-create branch was added in Task 3, so no further fake change is needed here.)

- [ ] **Step 3: Run the full spec — expect all green.**
      `pnpm vitest run tests/unit/stores/session.spec.ts`
      Expected: all pass (`16 passed`).

- [ ] **Step 4: Commit.**
  ```bash
  git add tests/unit/stores/session.spec.ts
  git commit -m "test(session): assert clean mode survives toJSON->fromJSON via persisted PanelState.state"
  ```

---

## Task 9 — Pure clean-pane control logic (`cleanPaneControls.ts`)

Extract the testable decision-logic out of the Vue component (unit-test the pure logic, Playwright the visual bits). The Split control uses the Lucide icon `SquareSplitHorizontal` (verified present in `@lucide/vue@1.16`; `SplitSquareHorizontal` does not exist).

**Files:**

- Create: `src/components/layout/dock/cleanPaneControls.ts`
- Test: `tests/unit/components/layout/dock/cleanPaneControls.spec.ts` (new)

- [ ] **Step 1: Write the failing test.**
      Create `tests/unit/components/layout/dock/cleanPaneControls.spec.ts`:

  ```ts
  import { describe, expect, it } from "vitest";

  import { cleanPaneControls } from "@/components/layout/dock/cleanPaneControls";

  describe("cleanPaneControls", () => {
    it("a clean pane shows Show-header, Split, and Close", () => {
      const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 3 });
      expect(ctrl.map((c) => c.id)).toEqual(["toggle-header", "split", "close"]);
      const toggle = ctrl.find((c) => c.id === "toggle-header")!;
      expect(toggle.label).toBe("Show header");
      expect(toggle.icon).toBe("PanelTop");
    });

    it("a tabbed pane shows Hide-header instead of Show-header", () => {
      const ctrl = cleanPaneControls({ isHeaderless: false, totalPanels: 3 });
      const toggle = ctrl.find((c) => c.id === "toggle-header")!;
      expect(toggle.label).toBe("Hide header");
      expect(toggle.icon).toBe("PanelTopClose");
    });

    it("the Split control uses the SquareSplitHorizontal icon", () => {
      const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 3 });
      const split = ctrl.find((c) => c.id === "split")!;
      expect(split.icon).toBe("SquareSplitHorizontal");
      expect(split.disabled).toBe(false);
    });

    it("Close is disabled when it is the last pane (empty-workspace guard)", () => {
      const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 1 });
      const close = ctrl.find((c) => c.id === "close")!;
      expect(close.disabled).toBe(true);
    });

    it("Close is enabled when more than one pane exists", () => {
      const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 2 });
      const close = ctrl.find((c) => c.id === "close")!;
      expect(close.disabled).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.**
      `pnpm vitest run tests/unit/components/layout/dock/cleanPaneControls.spec.ts`
      Expected failure: `Failed to resolve import "@/components/layout/dock/cleanPaneControls"`.

- [ ] **Step 3: Implement the pure logic.**
      Create `src/components/layout/dock/cleanPaneControls.ts`:

  ```ts
  /**
   * Pure decision-logic for the clean-pane hover overlay. Kept separate from
   * `CleanPaneOverlay.vue` so it can be unit-tested without mounting Vue or
   * dockview (the component itself is Stage-1 Playwright-verified per the
   * CommandVue verification protocol).
   */
  export interface CleanPaneControlInput {
    /** Whether the hovered group is currently clean (header hidden). */
    isHeaderless: boolean;
    /** Total panels in the whole layout (drives the empty-workspace guard). */
    totalPanels: number;
  }

  export interface CleanPaneControl {
    id: "toggle-header" | "split" | "close";
    label: string;
    /** Lucide component name (must exist in @lucide/vue@1.16). */
    icon: "PanelTop" | "PanelTopClose" | "SquareSplitHorizontal" | "X";
    disabled: boolean;
  }

  export function cleanPaneControls(input: CleanPaneControlInput): CleanPaneControl[] {
    return [
      {
        id: "toggle-header",
        label: input.isHeaderless ? "Show header" : "Hide header",
        icon: input.isHeaderless ? "PanelTop" : "PanelTopClose",
        disabled: false,
      },
      {
        id: "split",
        label: "Split",
        icon: "SquareSplitHorizontal",
        disabled: false,
      },
      {
        id: "close",
        label: "Close",
        icon: "X",
        disabled: input.totalPanels <= 1,
      },
    ];
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.**
      `pnpm vitest run tests/unit/components/layout/dock/cleanPaneControls.spec.ts`
      Expected: `5 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/components/layout/dock/cleanPaneControls.ts tests/unit/components/layout/dock/cleanPaneControls.spec.ts
  git commit -m "feat(dock): add pure clean-pane control logic (which overlay buttons to show)"
  ```

---

## Task 10 — `splitCleanNeighbor` session action + `CleanPaneOverlay.vue` + `DockLayout.vue` wiring

`splitCleanNeighbor` is a NET-NEW session action that the overlay's Split control calls — it creates a fresh `PanelState` record (via `panelStateStore.createPanel`) for a brand-new clean neighbor pane. It is the only Phase-1 path that creates a new persisted panel record. The spec (§3.1/§8) names a "Split" overlay control but does not specify the record semantics; this plan creates a NEW record (not a duplicate of the source). Surface this to the maintainer if duplicate-vs-new matters.

The overlay is a Vue component — runtime-verified (Task 11), not unit-snapshotted. It consumes the pure logic from Task 9 and the session actions from Tasks 6, 7, and this task. It takes the **dock-root element as a prop** from `DockLayout.vue` — never `api.element` (which does not exist on `DockviewApi`).

**Files:**

- Modify: `src/stores/session.ts` (new `splitCleanNeighbor` action; export it)
- Modify: `tests/unit/stores/session.spec.ts` (one new test for `splitCleanNeighbor`)
- Create: `src/components/layout/dock/CleanPaneOverlay.vue`
- Modify: `src/components/layout/DockLayout.vue` (positioned container + dock-root ref, `no-panels-overlay`, mount overlay)

- [ ] **Step 1: Write the failing test for `splitCleanNeighbor`.**
      Add to `tests/unit/stores/session.spec.ts`:

  ```ts
  it("splitCleanNeighbor adds the main pane type as a new clean neighbor", async () => {
    const { layout, p1 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const sourceGroup = (
      api as unknown as {
        getPanel: (id: string) => { api: { group: { header: { hidden: boolean } } } } | undefined;
      }
    ).getPanel(p1.id)!.api.group;
    const before = (api as unknown as DockviewApi).panels.length;

    const newId = await session.splitCleanNeighbor(p1.id);
    expect(newId).toBeTruthy();
    expect((api as unknown as DockviewApi).panels.length).toBe(before + 1);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { component: string; api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    // New pane is clean and a DIFFERENT group than the source (registered
    // mainPane === cesium, so it resolves to the cesium component).
    const created = fake.getPanel(newId!)!;
    expect(created.api.group.header.hidden).toBe(true);
    expect(created.api.group).not.toBe(sourceGroup);
    expect(created.component).toBe("cesium");
    // Source pane untouched.
    expect(sourceGroup.header.hidden).toBe(false);

    // The new pane has a persisted, headerless panel-state record.
    const persisted = await panelStateRepo.getById(newId!);
    expect(persisted?.panelType).toBe("cesium");
    expect(persisted?.state).toEqual({ headerless: true });
  });
  ```

  > This test asserts the registered-`mainPanelType()` branch (component `"cesium"`), which is the path production actually takes — possible only because Task 3 registers builtins in the spec.

- [ ] **Step 2: Run the test — expect FAIL.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "splitCleanNeighbor"`
      Expected failure: `TypeError: session.splitCleanNeighbor is not a function`.

- [ ] **Step 3: Implement `splitCleanNeighbor`.**
      In `src/stores/session.ts`, add inside the store factory (after `removePanelGuarded`, ~line 180):

  ```ts
  /**
   * Split a clean pane: add a new panel (of the registry's main pane type,
   * falling back to the source panel's type) as a NEW clean neighbor to the
   * right of the source group. Creates a fresh panel-state record so the new
   * pane round-trips. Returns the new panel id. Restoring-guarded.
   */
  async function splitCleanNeighbor(sourcePanelId: Ulid): Promise<Ulid | null> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    if (!loadedLayoutId.value) return null;
    const source = api.getPanel(sourcePanelId);
    if (!source) return null;

    const panelStateStore = usePanelStateStore();
    const sourceState = panelStateStore.getState(sourcePanelId);
    const panelType = panelRegistry.mainPanelType() ?? sourceState?.panelType ?? null;

    setRestoring(true);
    try {
      const created = await panelStateStore.createPanel({
        layoutId: loadedLayoutId.value,
        panelType,
        assignmentState: panelType ? "assigned" : "empty",
        state: withHeaderless({}, true),
      });
      const def = panelType ? panelRegistry.get(panelType) : undefined;
      const added = api.addPanel({
        id: created.id,
        component: panelType ?? UNASSIGNED_PANEL_TYPE,
        title: def?.title ?? "Empty",
        position: { referenceGroup: source.api.group, direction: "right" },
      });
      added.api.group.header.hidden = true;
      return created.id;
    } finally {
      setRestoring(false);
    }
  }
  ```

  Add `splitCleanNeighbor` to the returned object (after `removePanelGuarded,`).

  > `createPanel` only updates the in-memory cache when `loadedLayoutId.value === input.layoutId` (verified in `panelState.ts`); since we pass the loaded layout id, the cache stays in sync.

- [ ] **Step 4: Run the test — expect PASS, then the full spec.**
      `pnpm vitest run tests/unit/stores/session.spec.ts -t "splitCleanNeighbor"`
      Expected: `1 passed`. Then `pnpm vitest run tests/unit/stores/session.spec.ts` → all pass (`17 passed`).

- [ ] **Step 5: Create `CleanPaneOverlay.vue`.**
      Create `src/components/layout/dock/CleanPaneOverlay.vue`. The dock-root DOM node is supplied via the `root` prop from `DockLayout.vue`; group rects come from `api.groups[].element.getBoundingClientRect()` (concrete `DockviewGroupPanel.element`). No `api.element` access (it does not exist). No `isHeaderless` import (liveness is read directly from `group.header.hidden`):

  ```vue
  <script setup lang="ts">
  /**
   * Clean-pane hover overlay.
   *
   * A clean (header-less) pane has no tab strip to host buttons, so its
   * controls live in a hover overlay positioned over the hovered group's DOM
   * rect (`group.element.getBoundingClientRect()`). This works for ANY clean
   * pane regardless of panel type — no per-panel opt-in.
   *
   * The dock-root element is passed in as a prop from DockLayout.vue (the
   * DockviewApi exposes NO `element`/`rootElement` member, so pointer listeners
   * MUST attach to a DOM node supplied by the host, not to the api). Group
   * rects come from `api.groups[].element`, which IS a real getter on the
   * concrete DockviewGroupPanel.
   *
   * Custom (not a PrimeVue component) because it must position itself over an
   * arbitrary dockview group rect and react to dockview's `onDidLayoutChange`;
   * the library-first scan (PrimeVue Popover / OverlayPanel) found no fit for a
   * free-floating, rect-anchored, hover-revealed control cluster — documented
   * here so future agents don't re-evaluate.
   *
   * Buttons (Phase 1 scope): Hide/Show header, Split, Close. Maximize / float /
   * pop-out / minimize land in later Track-B phases. After any structural
   * change the overlay clears and re-anchors on the next pointerover (Phase 1
   * accepts the clear-and-rehover behavior; smoother re-anchoring is a Stage-2
   * polish item).
   */
  import { PanelTop, PanelTopClose, SquareSplitHorizontal, X } from "@lucide/vue";
  import type { DockviewApi, IDockviewPanel } from "dockview-vue";
  import { computed, onUnmounted, ref, shallowRef, watch, type Component } from "vue";

  import IconButton from "@/components/ui/IconButton.vue";
  import { useSessionStore } from "@/stores/session";

  import { cleanPaneControls } from "./cleanPaneControls";

  const props = defineProps<{ api: DockviewApi | null; root: HTMLElement | null }>();

  const session = useSessionStore();

  const hoveredGroupId = ref<string | null>(null);
  const rect = ref<{ top: number; left: number; width: number } | null>(null);
  const hoveredPanel = shallowRef<IDockviewPanel | null>(null);
  const disposers: Array<() => void> = [];

  const iconMap: Record<string, Component> = {
    PanelTop,
    PanelTopClose,
    SquareSplitHorizontal,
    X,
  };

  const visible = computed(() => Boolean(hoveredGroupId.value && rect.value && hoveredPanel.value));

  const controls = computed(() => {
    const api = props.api;
    const panel = hoveredPanel.value;
    if (!api || !panel) return [];
    return cleanPaneControls({
      isHeaderless: panel.api.group.header.hidden,
      totalPanels: api.panels.length,
    });
  });

  function clearHover(): void {
    hoveredGroupId.value = null;
    hoveredPanel.value = null;
    rect.value = null;
  }

  function onPointerOver(event: PointerEvent): void {
    const api = props.api;
    if (!api) return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dv-groupview");
    const group = api.groups.find((g) => g.element === el || g.element.contains(el as Node));
    // Only clean groups get the overlay (tabbed groups use the header strip).
    if (!group || !group.header.hidden) {
      clearHover();
      return;
    }
    const r = group.element.getBoundingClientRect();
    hoveredGroupId.value = group.id;
    hoveredPanel.value = group.panels[0] ?? null;
    rect.value = { top: r.top, left: r.left, width: r.width };
  }

  async function run(id: string): Promise<void> {
    const panel = hoveredPanel.value;
    if (!panel) return;
    if (id === "toggle-header") {
      await session.toggleHeaderless(panel.id);
    } else if (id === "close") {
      await session.removePanelGuarded(panel.id);
    } else if (id === "split") {
      await session.splitCleanNeighbor(panel.id);
    }
    // Re-resolve geometry on the next pointerover after a structural change.
    clearHover();
  }

  watch(
    () => [props.api, props.root] as const,
    ([api, root]) => {
      for (const d of disposers.splice(0)) d();
      if (!api || !root) return;
      root.addEventListener("pointerover", onPointerOver as EventListener);
      root.addEventListener("pointerleave", clearHover);
      disposers.push(() => root.removeEventListener("pointerover", onPointerOver as EventListener));
      disposers.push(() => root.removeEventListener("pointerleave", clearHover));
      const sub = api.onDidLayoutChange(() => clearHover());
      disposers.push(() => sub.dispose());
    },
    { immediate: true },
  );

  onUnmounted(() => {
    for (const d of disposers.splice(0)) d();
  });

  const overlayStyle = computed(() =>
    rect.value
      ? {
          top: `${rect.value.top + 6}px`,
          left: `${rect.value.left + rect.value.width - 6}px`,
          transform: "translateX(-100%)",
        }
      : {},
  );

  function iconFor(name: string): Component {
    return iconMap[name] ?? X;
  }
  </script>

  <template>
    <Teleport to="body">
      <div
        v-if="visible"
        class="border-border bg-surface-raised pointer-events-auto fixed z-40 flex items-center gap-1 rounded-md border p-1 opacity-0 shadow-xl transition-opacity duration-150 hover:opacity-100 [&:has(*)]:opacity-100"
        :style="overlayStyle"
        data-testid="clean-pane-overlay"
      >
        <IconButton
          v-for="c in controls"
          :key="c.id"
          :label="c.label"
          :disabled="c.disabled"
          :data-control="c.id"
          @mousedown.stop
          @click.stop="run(c.id)"
        >
          <component :is="iconFor(c.icon)" :size="16" />
        </IconButton>
      </div>
    </Teleport>
  </template>
  ```

- [ ] **Step 6: Wire `DockLayout.vue`.**
      In `src/components/layout/DockLayout.vue`, replace the `<template>` (lines 73–75) with a positioned container, the `no-panels-overlay` option, a template-ref host, and the mounted overlay:

  ```vue
  <template>
    <div ref="rootEl" class="relative h-full w-full">
      <DockviewVue
        :theme="commandvueTheme"
        no-panels-overlay="emptyGroup"
        class="h-full w-full"
        @ready="onReady"
      />
      <CleanPaneOverlay :api="boundApi" :root="rootEl" />
    </div>
  </template>
  ```

  In the `<script setup>`, extend the Vue import (line 12 `import { onUnmounted, provide } from "vue";`) to add `ref` and `shallowRef`:

  ```ts
  import { onUnmounted, provide, ref, shallowRef } from "vue";
  ```

  Add the overlay import alongside the existing local imports:

  ```ts
  import CleanPaneOverlay from "./dock/CleanPaneOverlay.vue";
  ```

  After `const layoutStore = useLayoutStore();` (line 24) add the refs:

  ```ts
  const rootEl = ref<HTMLElement | null>(null);
  const boundApi = shallowRef<DockviewApi | null>(null);
  ```

  In `onReady`, right after `session.bindDockview(event.api);` (line 27) add:

  ```ts
  boundApi.value = event.api;
  ```

  > The `restoring` guard added in Task 3 already makes the existing `event.api.onDidLayoutChange(() => session.markDirty())` subscription safe: `loadLayout`, the backfill, `applyHeaderlessGroups`, and all overlay-driven actions wrap their mutations in `setRestoring(true/false)`, so first-load and toggle-driven layout changes no longer false-dirty. No change to that subscription line is needed.

- [ ] **Step 7: Type-check + lint the new code.**
      `pnpm vitest run tests/unit/stores/session.spec.ts tests/unit/components/layout/dock/cleanPaneControls.spec.ts`
      Expected: all pass. Then `pnpm type-check` — expected `0 errors`. Then `pnpm lint` (auto-fixes import ordering via `eslint --fix`) — expected clean (no unused imports; the overlay imports only icons it renders, `cleanPaneControls`, `IconButton`, `useSessionStore`, and the two dockview types it annotates).

- [ ] **Step 8: Commit.**
  ```bash
  git add src/components/layout/dock/CleanPaneOverlay.vue src/components/layout/DockLayout.vue src/stores/session.ts tests/unit/stores/session.spec.ts
  git commit -m "feat(dock): clean-pane hover overlay + splitCleanNeighbor + noPanelsOverlay emptyGroup wiring"
  ```

---

## Task 11 — Stage-1 Playwright runtime verification

Per CLAUDE.md, no PR until Stage-1 is green. Probe for `mcp__plugin_playwright_playwright__*`; if unavailable, run `ToolSearch` with `query: "playwright browser"`. If still unavailable, fall back to a manual smoke-test checklist, state this explicitly in the PR description, and do not embed Stage-1 results. Screenshots to `.verification-screenshots/<branch>/` (gitignored). Branch name from `git branch --show-current`.

The Verify list from spec §11.1: (a) a clean pane has no tab strip; (b) Hide/Show header toggles; (c) Split makes a second clean pane; (d) Cesium-right + MapLibre-left arrangement holds (as separate groups) across reload; (e) session NOT dirty after a clean load.

- [ ] **Step 1: Start the dev server.**
      Run in background: `pnpm dev` (predev copies Cesium assets). Wait for the Vite "ready" line; note the local URL (typically `http://localhost:5173`).

- [ ] **Step 2: A1 — clean pane has no tab strip + not dirty after load.**
      `browser_navigate` to the dev URL. `browser_wait_for` the dock to mount. `browser_evaluate`:

  ```js
  () => {
    const groups = Array.from(document.querySelectorAll(".dv-groupview"));
    const cleanGroups = groups.filter((g) => {
      const tabs = g.querySelector(".dv-tabs-and-actions-container, .dv-tabs-container");
      return !tabs || getComputedStyle(tabs).display === "none" || tabs.offsetHeight === 0;
    });
    return { totalGroups: groups.length, cleanGroups: cleanGroups.length };
  };
  ```

  Assert `cleanGroups >= 1` (Cesium seeded clean). Screenshot `01-clean-load.png`. For dirtiness, read `session.dirty` directly rather than relying on an unverified DOM indicator: `browser_evaluate` against an exposed store handle (e.g. a dev-only `window.__cv_session` set in `main.ts` for verification, or `window.__pinia` if exposed). If no such handle exists, add a dev-only exposure in `main.ts` guarded by `import.meta.env.DEV` as part of this task, assert `session.dirty === false`, and note it in the PR. Console-error count must be the pre-existing baseline (no NEW errors from clean-pane code).

- [ ] **Step 3: A2 — Hide/Show header toggles.**
      Hover the Cesium clean pane (`browser_hover` over its group rect) to reveal `[data-testid="clean-pane-overlay"]`. `browser_click` the `[data-control="toggle-header"]` button (label "Show header") → the tab strip appears. Screenshot `02-show-header.png`. Re-hover, click again (now "Hide header") → strip disappears. Screenshot `03-hide-header.png`. `browser_evaluate` confirms the group's tab strip toggles `offsetHeight` 0 ↔ >0 across the two clicks.

- [ ] **Step 4: A3 — Split makes a second clean pane.**
      Hover the clean Cesium pane, click `[data-control="split"]`. `browser_evaluate` re-counts `cleanGroups` and asserts it increased by 1 and the new group has no tab strip. Screenshot `04-split-clean.png`.

- [ ] **Step 5: A4 — Cesium-right + MapLibre-left holds (separate groups) across reload.**
      Using the overlay/drag, arrange Cesium and MapLibre side-by-side (Cesium right, MapLibre left). Trigger a save (Cmd/Ctrl+S if wired, else `session.updateCurrentLayout()` via `browser_evaluate` on the exposed store) so `dockviewState` persists. `browser_navigate` reload. `browser_evaluate` reads the two map panels' bounding rects and asserts MapLibre's `left` < Cesium's `left`, AND that they live in TWO DISTINCT `.dv-groupview` elements (proving the relative-docking `'right'` => new group semantics confirmed at runtime, not just in the fake), AND both remain clean (no tab strips). Screenshot `05-arrangement-reload.png`.

- [ ] **Step 6: A5 — session not dirty after a clean load.**
      Immediately after the reload in Step 5 (before any user edit), `browser_evaluate` the exposed store handle and assert `session.dirty === false`, and `browser_console_messages` shows no `markDirty`-triggered warnings. Screenshot `06-not-dirty-after-load.png`.

- [ ] **Step 7: Assemble the Stage-1 result table.**
      Build the Markdown table (assertion id, description, result PASS/FAIL, screenshot path) for the PR body, plus console-error count, console-warning count, and a PASS/FAIL summary line. If any assertion fails, fix the underlying code and re-run from Step 2 — do NOT embed failing results. Stop the background `pnpm dev` when done.

- [ ] **Step 8: Final full-suite gate before handing off for PR.**
      `pnpm vitest run` (full unit suite) — expected all green. `pnpm type-check` — `0 errors`. `pnpm lint` and `pnpm spell` — clean (add any new term — e.g. `headerless` — to `dictionaries/tech.txt` if CSpell flags it, never to `cspell.json`). Commit any lint/spell fixes:
  ```bash
  git add -A
  git commit -m "chore(dock): lint + spell fixes for clean-panes foundation"
  ```
  Leave branching, push, and PR to the human per GitFlow.

---

## Self-Review — spec coverage

- **§11.1 / §9 — `mainPane?` flag:** Task 1 adds `PanelDefinition.mainPane` (after `singleton?`), flags `cesium`, and adds `panelRegistry.mainPanelType(): PanelType | undefined`. The cesium-flag test reads the static `BUILTIN_PANELS` array; `mainPanelType()` is tested against a registered registry with `__unregisterBuiltinPanelsForTests` keeping the `registered` flag honest. ✅
- **§3.2 — typed `headerless` convention:** Task 2 adds `src/modules/panels/headerless.ts` (`HEADERLESS_KEY`, `isHeaderless`, `withHeaderless`) — the single magic-string site; no schema change to `panelStateRepo` (it already accepts `state?: Record<string,unknown>`). ✅
- **§3.4 / §9 — `restoring` ref + `setRestoring` + `markDirty` gate:** Task 3, with the session spec now registering builtins in `beforeEach` (so `mainPanelType()` resolves) and the direction-honoring group-modeling `makeFakeApi` (mutable `header.hidden`, `getPanel`/`getGroup`/`groups`/`addGroup`/`removePanel`, `panel.api.group`, `panel.api.moveTo`, and a `direction`-aware `addPanel` that creates a new group for non-`'within'`) defined fully and reused by every later store test. A single guard-mutation path (`setRestoring`) is used everywhere, including inside `applyHeaderlessGroups`. ✅
- **§3.2 / §11.1 — `applyHeaderlessGroups(api)` as last statement of `loadLayout`:** Task 4 — wrapped via `setRestoring`, called after all branches converge, right before `loadedLayoutId.value = layoutId`. ✅
- **§3.5 — `rebuildFromPanelStates` rewrite + idempotent Cesium backfill:** Task 5 — module-scope `resolvePanelComponent` + `rebuildFromPanelStates`; mainPane added first as its own group, first sibling docked `direction:'right'` (a new neighbor group — confirmed at unit level by the direction-honoring fake and at runtime by Task 11 A4), rest `'within'` as tabs, `dockHint` read from non-optional `ps.state` (default right); single backfill point in `loadLayout` via store-factory `backfillCleanMainPane` using `panelStateStore.updateState` (cache + repo sync), NOT `seed.ts`. Uses centralized `UNASSIGNED_PANEL_TYPE` / `MISSING_PANEL_TYPE` constants, not bare strings. Type annotations use imported `DockviewGroupPanel` / `IDockviewPanel` (re-exported from `dockview-vue`), not nested `ReturnType`/`NonNullable`. ✅
- **§3.1 / §8 — `toggleHeaderless(panelId)`:** Task 6 — splits to own group when >1 panel, flips `header.hidden`, persists via `withHeaderless` + `panelStateStore.updateState`, restoring-guarded. ✅
- **§12 — `removePanelGuarded(panelId)`:** Task 7 — no-op + `false` return (justified vs throw: it is wired to a click handler), refuses to empty the last pane; the fake's `removePanel` was added in Task 3. ✅
- **§3.2 / §9 — round-trip regression test:** Task 8 — clean mode survives `toJSON`→`fromJSON` via persisted `PanelState.state.headerless`; the fake's `fromJSON` re-creates panels from `blob.panels` (no-op on the no-`panels` branch to preserve the pre-existing fromJSON test). ✅
- **§3.3 / §11.1 — hover overlay + pure logic extraction + Split action:** Task 9 (`cleanPaneControls.ts`, unit-tested: which controls + enabled state + `SquareSplitHorizontal` icon) and Task 10 (`splitCleanNeighbor` session action creating a NEW headerless panel-state record — surfaced in the File Structure and tested against the registered-`mainPanelType` path; `CleanPaneOverlay.vue` rect-anchored via `group.element`, dock-root supplied by `DockLayout` prop NOT `api.element`, Lucide icons that exist in 1.16, `ui/IconButton` with required `label`, `@mousedown.stop` + `@click.stop`). ✅
- **§3.6 / §11.1 — `noPanelsOverlay='emptyGroup'` + mount overlay + restoring guard prevents first-load false-dirty:** Task 10 — `DockLayout.vue` wraps the dock in a positioned container with a template ref, gets `no-panels-overlay="emptyGroup"`, mounts `CleanPaneOverlay` with the bound api and the dock-root element; the existing `onDidLayoutChange → markDirty` subscription is now safe because all clean-pane mutations are restoring-guarded. ✅
- **§11.1 Verify list — Stage-1 Playwright:** Task 11 covers all five assertions (no tab strip; Hide/Show toggle; split → second clean pane; Cesium-right/MapLibre-left as separate groups across reload; not dirty after clean load via a direct `session.dirty` store read, not an unverified DOM attribute), screenshots to `.verification-screenshots/<branch>/`, with the embedded result-table requirement and the Playwright-unavailable fallback stated. ✅

Verified dockview APIs used exactly as specified against the installed `dockview-core@6.6.1` `.d.ts`: `panel.api.group` (concrete `DockviewGroupPanel`), `group.header.hidden` (settable `IHeader.hidden`), `group.element` (via `BasePanelView.get element(): HTMLElement`), `api.getPanel`/`getGroup`/`panels`/`groups`/`addGroup`, `api.addPanel({ position: { referenceGroup, direction } })` where `RelativeGroup.direction?: Direction` includes `'within'` and returns `IDockviewPanel`, `panel.api.moveTo({ group, skipSetActive })` (`DockviewPanelMoveParams = DockviewGroupMoveParams`), `api.removePanel(panel)`, `api.onDidLayoutChange`, `<DockviewVue no-panels-overlay="emptyGroup">` (`'emptyGroup' | 'watermark'`), the absence of any `element`/`rootElement` on `DockviewApi` (dock-root sourced from the DockLayout template ref), the re-export of `DockviewGroupPanel` / `IDockviewPanel` from `dockview-vue` (`export * from 'dockview-core'`), and that `header.hidden` is NOT serialized by `toJSON`/`fromJSON` (re-applied from persisted state). Store/repo APIs verified: `usePanelStateStore.getState/updateState/listForLayout/loadForLayout/createPanel` (cache-syncs when `loadedLayoutId === input.layoutId`), `CreatePanelStateInput`/`UpdatePanelStateInput.state?: Record<string,unknown>`, `panelStateRepo.getById/update/create`, `layoutRepo.update/getById` (accepts `dockviewState`), `PanelState.state` non-optional `Record<string,unknown>`, `panelType: PanelType | null`, `MISSING_PANEL_TYPE`, `UNASSIGNED_PANEL_TYPE`, `IconButton`'s required `label` prop + `data-*`/`@click` fall-through. Lucide icons (`PanelTop`, `PanelTopClose`, `SquareSplitHorizontal`, `X`) confirmed present in `@lucide/vue@1.16`; `SplitSquareHorizontal` confirmed absent and not used. `tests/setup.ts` is empty (`export {}`), so the session spec registers builtins itself. Test command `pnpm vitest run <path>` matches `package.json`'s `test: "vitest run"`. No placeholders; every referenced type/function/method is either defined in a task or exists in the read files.
