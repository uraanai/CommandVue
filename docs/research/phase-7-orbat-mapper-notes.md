# Phase 7 — Architecture notes from orbat-mapper

> **Status:** research notes, not implementation. Lives on the `phase-7-tools`
> branch alongside the upcoming work. Delete or relocate before merging to
> `main` if you prefer not to ship research alongside template code.

## Context

We are about to implement Phase 7 of the CommandVue scaffold: the tool
registry, drawing / measurement tools on MapLibre, command palette, keyboard
shortcuts, geo utilities, and the common UI primitives. Before writing code
we studied [orbat-mapper](https://github.com/orbat-mapper/orbat-mapper)
(MIT) as a reference implementation of the same problem space.

The reference repo is cloned to `D:\Work\UraanAI\Public\orbat-mapper-reference`
— **outside** the CommandVue tree, not a submodule, not gitignored. CommandVue's
git history does not know it exists. These notes describe the _patterns_ we
intend to mirror; CommandVue's implementation will be our own code.

## Headline findings

| Area                  | The takeaway                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drawing / measurement | **No external drawing library.** orbat-mapper drives MapLibre's native API directly from custom composables. We will do the same — no `terra-draw`, no `@mapbox/mapbox-gl-draw`.                      |
| Geometry rendering    | **Dual-layer pattern.** One temporary GeoJSON source for the in-progress sketch (dashed stroke, low-opacity fill), one persistent source for the finalized feature (solid). The composable owns both. |
| Vertex handles        | **Separate point layer with index properties.** Each handle feature carries the index of the vertex / edge it represents; click-drag uses `queryRenderedFeatures` to identify which one moved.        |
| Tool registry         | **One nullable `activeTool` in a Pinia store + toggle action.** Same-tool click deactivates; different-tool click replaces. No stack, no concurrency.                                                 |
| Tool lifecycle        | **Composables return a `cleanup()` function**, register listeners themselves, and use capture-phase to win over the map's native pan/zoom handlers.                                                   |
| Conflict prevention   | **Suspend / restore callbacks** let a tool temporarily disable `map.dragPan` / `doubleClickZoom` while it owns the canvas.                                                                            |
| Styling               | **Property-bag spec → render factory.** Features carry their style as properties; a factory converts the partial spec to a renderable object on every paint. UI panels mutate properties, not layers. |
| Command palette       | **Prefix-activated search modes** (`@` geo, `#`/`>` actions, `?` help) with per-mode debounced watchers, `fuzzysort` for matching, results grouped by category, headless listbox for keyboard nav.    |
| Keyboard shortcuts    | **Declarative catalog file** for discovery / help, **bind keys at the component or composable** that owns the action.                                                                                 |

## 1. Tool registry and activation

orbat-mapper's tool layer is _distributed_: state in Pinia, behavior in
composables, listeners on the map canvas or `window`. There is no central
"activate this tool object" dispatcher.

**Pattern:**

- Pinia store holds `activeTool: ToolId | null`.
- A `toggleTool(id)` action sets state to `id`, or to `null` if `id` is already
  active. That's the entire activation logic — same-tool click toggles off,
  different-tool click replaces.
- Each tool is a composable that takes the map handle plus configuration and
  returns a `cleanup()` callback. The composable wires its own listeners
  (`map.on('click', …)`, `window.addEventListener('keydown', …, { capture: true })`)
  inside its setup, and removes them in `cleanup()`.
- The map shell watches `activeTool` and (re)creates the matching composable
  when the value changes, invoking the previous cleanup first.
- Tools that conflict with map interaction take `suspend()` and `restore()`
  callbacks from the caller. The caller pauses `dragPan` / `doubleClickZoom`
  in `suspend()` and re-enables them in `restore()`.

**CommandVue design sketch** (not orbat-mapper code — our own contract):

```ts
// src/modules/tools/types.ts
import type { Map as MapLibreMap } from "maplibre-gl";

export type ToolId = "measure-distance" | "draw-polygon" | "select" | string;

export interface ToolContext {
  map: MapLibreMap;
  suspend: () => void;
  restore: () => void;
}

export interface Tool {
  id: ToolId;
  label: string;
  iconKey: string; // resolved by IconButton, not a Vue component
  shortcut?: string; // e.g. "m", "p" — displayed in palette/menu
  setup(ctx: ToolContext): { cleanup: () => void };
}
```

The store stays thin:

```ts
// src/stores/tools.ts (sketch)
export const useToolsStore = defineStore("tools", () => {
  const activeId = ref<ToolId | null>(null);
  function toggle(id: ToolId) {
    activeId.value = activeId.value === id ? null : id;
  }
  function deactivate() {
    activeId.value = null;
  }
  return { activeId, toggle, deactivate };
});
```

Activation lives in a composable that knows the map handle:

```ts
// src/composables/useToolRegistry.ts (sketch)
export function useToolRegistry(map: ShallowRef<MapLibreMap | null>) {
  const tools = ref<Map<ToolId, Tool>>(new Map());
  const store = useToolsStore();
  let currentCleanup: (() => void) | null = null;

  watch([store.activeId, map], ([id, mapInstance]) => {
    currentCleanup?.();
    currentCleanup = null;
    if (!id || !mapInstance) return;
    const tool = tools.value.get(id);
    if (!tool) return;
    const ctx = makeCtx(mapInstance);
    currentCleanup = tool.setup(ctx).cleanup;
  });

  onBeforeUnmount(() => currentCleanup?.());
  return { register: (t: Tool) => tools.value.set(t.id, t) };
}
```

## 2. Drawing and measurement on MapLibre — the core of Phase 7

**Confirmed: orbat-mapper does NOT use a drawing library.** No `terra-draw`,
no `mapbox-gl-draw`. Drawing is a custom composable that:

1. Maintains an `vertices: Lonlat[]` ref as the source of truth.
2. Listens for `click` on the map; appends the click position to `vertices`
   (after a small-distance dedupe — they reject clicks within ~3 m of the
   previous vertex to handle accidental double-clicks).
3. Listens for `mousemove`; computes a rubber-band: `[…vertices, cursor]`
   and re-renders the in-progress geometry every frame.
4. Renders the in-progress geometry to a **temporary** GeoJSON source (dashed
   stroke, 20 % opacity fill).
5. On double-click (or Enter), closes the ring (for polygons), removes the
   temporary source, and emits the finalized feature.
6. Finalized features land in a Pinia store and re-render through a
   **persistent** GeoJSON source with solid styling.
7. Escape clears `vertices`, removes the temporary source, returns to idle.

Measurement is the same shape, with two differences:

- The geometry is always a `LineString` (or `Polygon` if measuring area).
- A **second symbol layer** renders per-segment distance labels at midpoints
  plus a total label at the centroid. Labels use a halo (`text-halo-color`,
  `text-halo-width`) so they read over any basemap.
- Math is `@turf/distance` (for great-circle distance in meters),
  `@turf/length`, `@turf/area`, `@turf/midpoint`, `@turf/center-of-mass`.

**Edit handles after finalization** (this was nicer than I expected):

- A third GeoJSON source renders a circle per vertex (yellow, ~5 px) and per
  midpoint (blue, ~4 px).
- Each handle feature carries a `vertexIndex` or `edgeIndex` property.
- `mousedown` on the handles layer uses `map.queryRenderedFeatures` to find
  the index, sets a `dragging` flag, disables `dragPan`, and listens for
  `mousemove` until `mouseup`.
- Dragging a vertex updates `vertices[i]`; dragging a midpoint inserts a new
  vertex at `i` (so the midpoint becomes a real vertex).
- Each drag tick re-renders the geometry layer AND the handles layer.

**Suspending map interaction during drawing:**

```ts
// inside the composable's setup
map.dragPan.disable();
map.doubleClickZoom.disable();
// in cleanup:
map.dragPan.enable();
map.doubleClickZoom.enable();
```

This is the conflict-prevention pattern from §1, applied at the composable
boundary.

**End-to-end data flow for "user draws a polygon" (CommandVue intent):**

1. User clicks the polygon toolbar button → `toolsStore.toggle('draw-polygon')`.
2. `useToolRegistry` notices `activeId` changed → calls the new tool's
   `setup(ctx)`. Previous tool's `cleanup()` already fired.
3. `setup()` adds a `draft-polygon` GeoJSON source + line / fill / handles
   layers to the map, registers `click` / `mousemove` / `keydown` /
   `dblclick` handlers, and disables `dragPan` + `doubleClickZoom`.
4. User clicks; handler appends to `vertices`; renderer rebuilds the GeoJSON
   from `vertices + cursor` and `setData()`s the draft source.
5. User moves the mouse; `mousemove` handler updates the cursor; re-render.
6. User double-clicks (or presses Enter); handler closes the ring, calls
   `entitiesStore.addFeature(geometry)`, clears `vertices`, removes the draft
   source, restores map interaction, and finally `toolsStore.deactivate()`.
7. The store update re-renders the persistent features source elsewhere on
   the map.

If the user instead presses Escape: clear `vertices`, remove draft source,
restore interaction, `toolsStore.deactivate()`. No feature created.

## 3. Runtime styling of features

orbat-mapper uses a **property-bag spec** plus a **factory function** that
converts the spec to a renderer-specific style object. The spec is the
feature's _data_ (it persists with the feature in the store); the factory
runs on every paint.

For their measurement / drawing layers the styles are mostly fixed (preview
is dashed blue, final is solid blue). The configurable styling is on
**entities** — users can pick a fill color, marker symbol, marker size, line
width, etc. through standard form inputs (`ColorPicker.vue` is a thin wrapper
around a radio group bound to a `string` model).

Two notes for CommandVue:

- Orbat-mapper uses OpenLayers for some layers — their `createSimpleStyle`
  returns an OL `Style`. We don't have OL. The **portable pattern** is:
  "feature carries `{ stroke, fill, strokeWidth, opacity }` properties; a
  function converts to MapLibre data-driven paint expressions".
- In practice MapLibre's data-driven paint is more elegant than a per-feature
  factory: set the layer paint to `['get', 'fill-color']` once, and every
  feature reads its color from its own properties. The factory is then a
  no-op at the layer level; the spec just lives on the feature.

**CommandVue design sketch:**

```ts
// src/modules/styling/spec.ts (sketch — Phase 7 may reorganize)
export interface FeatureStyleSpec {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: number[];
  fill?: string;
  fillOpacity?: number;
}

// Apply once per layer:
//   paint: {
//     'line-color': ['get', 'stroke'],
//     'line-width': ['coalesce', ['get', 'strokeWidth'], 2],
//     'fill-color': ['get', 'fill'],
//     'fill-opacity': ['coalesce', ['get', 'fillOpacity'], 0.25],
//   }
```

milsymbol styling is a separate concern: the SVG itself is immutable, but the
wrapper (color tint, size) is editable. We already render milsymbol via
`renderSidcToSvg`; Phase 7 can add a `style?` argument that flows through to
`new Symbol(sidc, { fillColor, iconColor, size })`. No new dependency.

## 4. Command palette

**Library choice in orbat-mapper:** `fuzzysort` for matching, Reka-ui's
`ListboxRoot` for keyboard navigation. They split search into three
prefix-activated modes:

- Bare query → scenario search (units / features / events / layers),
  debounced 200 ms.
- `@…` → geo / place search, debounced 500 ms.
- `#…` or `>…` → action search, no debounce.
- `?` → help.

Each mode is its own watcher; results are flattened with a `category`
field and grouped via `Map`-based `groupBy` for display. Highlights come
from `fuzzysort.highlight()`.

**CommandVue decisions:**

- **Use `fuzzysort`.** It's already in our locked-stack list (Phase 7
  utilities). Tiny, fast, and the API is dead simple.
- **Skip Reka-ui** unless we decide to adopt it later. PrimeVue (already
  installed, unstyled) has `Listbox` and the keyboard surface we need; we
  already use `pt:` passthrough styling. Adding Reka-ui means a second
  headless-component dependency.
  Alternative: hand-roll keyboard navigation with `@vueuse/core`'s
  `useEventListener` + `useMagicKeys`. The palette is maybe 80 lines.
  **Lean toward hand-rolled** since the surface area is small and we avoid
  another dep.
- **Adopt the prefix-mode pattern.** It scales: today we route bare queries
  to tools / panels / theme actions, later contributors can add `@` (geo
  search) and `>` (entities) without refactoring.
- **Result categories for Phase 7:** _Tools_, _Panels_, _Routes_,
  _Theme actions_. _Entities_ and _Places_ are Phase 8+ candidates.

## 5. Keyboard shortcuts

orbat-mapper keeps a **declarative catalog** in
`src/components/keyboardShortcuts.ts` describing every binding (which mode,
which key, what it does) — used by the in-app help dialog. The actual key
binding lives inside whatever composable or component owns the action.

**For CommandVue:**

```ts
// src/modules/shortcuts/catalog.ts (sketch)
export interface ShortcutDef {
  keys: string[]; // e.g. ["mod+k"], ["m"], ["escape"]
  scope: "global" | "map" | "palette";
  label: string;
  action: ShortcutAction; // e.g. "command-palette.open", "tool.measure-distance"
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { keys: ["mod+k"], scope: "global", label: "Open command palette", action: "palette.open" },
  { keys: ["escape"], scope: "map", label: "Deactivate current tool", action: "tool.deactivate" },
  { keys: ["m"], scope: "map", label: "Measure distance", action: "tool.measure-distance" },
  { keys: ["p"], scope: "map", label: "Draw polygon", action: "tool.draw-polygon" },
];
```

`useKeyboardShortcuts()` reads the catalog and wires the bindings via
`@vueuse/core`'s `useMagicKeys`. The help dialog renders the catalog
verbatim. This keeps the source-of-truth single and shippable to docs.

## CommandVue Phase 7 — concrete decisions

### File structure to create

```
src/
  modules/
    tools/
      types.ts                  Tool / ToolContext / ToolId
      registry.ts               in-memory Map<ToolId, Tool>; small helpers
      measure-distance.ts       MapLibre composable; turf math; labels
      draw-polygon.ts           MapLibre composable; vertex array; handles
    geo/
      coords.ts                 MGRS / DMS / DD via mgrs + formatcoords
      measure.ts                turf helpers (distance, area, centroid)
      h3.ts                     h3-js cell helpers
    shortcuts/
      catalog.ts                declarative shortcut definitions
  composables/
    useToolRegistry.ts          single active tool watcher → setup/cleanup
    useKeyboardShortcuts.ts     wires the catalog to useMagicKeys
    useFullscreen.ts            @vueuse/core wrapper
  components/
    common/
      ErrorBoundary.vue
      LoadingSpinner.vue
      EmptyState.vue
    layout/
      CommandPalette.vue        Cmd+K overlay; prefix-routed search
  stores/
    tools.ts                    activeId + toggle/deactivate
```

### Dependencies to add (production)

- `@turf/distance`, `@turf/length`, `@turf/area`, `@turf/midpoint`,
  `@turf/centroid` (or `@turf/center-of-mass`), `@turf/bearing`,
  `@turf/destination`, `@turf/great-circle`, `@turf/bbox`
- `mgrs`
- `formatcoords`
- `h3-js`
- `fuzzysort`
- `@atlaskit/pragmatic-drag-and-drop` and
  `@atlaskit/pragmatic-drag-and-drop-hitbox` (locked-stack mandate; used in
  the command palette for reorderable history, or deferred to a later phase
  if not needed in Phase 7 itself)

No drawing library — confirmed by the analysis.

### Contracts (what we'll lock down before writing tool code)

1. `Tool.setup(ctx) → { cleanup }`. Cleanup is mandatory and must remove
   every listener and source/layer the tool added.
2. `ToolContext` exposes `map`, `suspend()`, `restore()`. `suspend` disables
   `dragPan` + `doubleClickZoom`; `restore` re-enables them. Idempotent.
3. Tools own their MapLibre sources / layers under a namespaced id
   (`commandvue:draft-polygon`, `commandvue:measure-line`, etc.) so we can
   detect leaks in tests.
4. Tools dispatch finalized features through a callback in `ToolContext`
   (not directly to the store) so we can swap consumers in tests.

### Implementation order (so each step verifies the previous)

1. `modules/tools/types.ts` + `stores/tools.ts` + `useToolRegistry.ts`.
   Verify with a unit test of `toggle()` and a smoke test of register/setup/
   cleanup using a fake `Map` interface.
2. `modules/geo/coords.ts` + a coord spec covering MGRS round-trips.
3. `modules/tools/measure-distance.ts` end-to-end on MapLibre, with the
   coordinate readout we shelved in Phase 4.
4. `modules/tools/draw-polygon.ts` with edit handles.
5. `composables/useKeyboardShortcuts.ts` + `modules/shortcuts/catalog.ts`.
6. `components/layout/CommandPalette.vue` driven by the catalog +
   `fuzzysort`. Hand-rolled keyboard navigation, no Reka-ui.
7. `components/common/{ErrorBoundary,LoadingSpinner,EmptyState}.vue` to
   front the async panels we already lazy-load.
8. Run the gauntlet, fix what shakes loose, commit Phase 7.

## Open questions / things to confirm before we start

- **PrimeVue vs hand-rolled palette listbox.** Recommendation: hand-rolled
  with `@vueuse/core`. Want to confirm.
- **Pragmatic drag-and-drop scope.** The spec mandates it in the stack,
  but Phase 7 doesn't strictly need it (no reorderable panels yet). OK to
  install and leave dormant, or defer until a feature uses it?
- **Edit handles after finalization.** orbat-mapper renders them by default.
  For a generic template, probably toggle-on (off by default) since
  drag-edit can surprise users who just want to read the measurement. OK?
- **Where do finalized drawings live?** orbat-mapper has dedicated scenario
  state. For CommandVue, simplest is `entitiesStore` with a discriminator
  (`kind: "drawn" | "measurement" | …`). Or a new `drawingsStore`.
  Recommendation: new `drawingsStore` — keeps `entitiesStore` clean as the
  receiver of operational data.

Once those are answered, the first commit of Phase 7 implements step 1 of
the order above (tools types + store + registry + tests), then progresses.
