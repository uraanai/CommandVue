# Tools

CommandVue ships a tiny tool-registry pattern for things the user
activates on a map: measure distance, draw polygon, future selection
modes, etc. Tools are plain JS objects — not Vue components — that own
their MapLibre lifecycle directly.

## The contract

`src/modules/tools/types.ts` defines the shape:

```ts
export interface Tool {
  id: ToolId;
  label: string;
  shortcut?: string;
  icon?: string;
  setup(ctx: ToolContext): { cleanup: () => void };
}

export interface ToolContext {
  map: MapLibreMap;
  suspend(): void; // pause dragPan + doubleClickZoom
  restore(): void; // re-enable them
  emit(feature: Feature): void; // submit a finalized geometry
}
```

`setup()` is called when the tool is activated and **must** return a
`cleanup` function that removes every listener / source / layer it
added. The contract test in
`tests/unit/tools-measure-distance.spec.ts` enforces this via a fake
MapLibre `Map`.

## Activation flow

```
TitleBar button / CommandPalette / keyboard shortcut
       ↓ store.toggle("measure-distance")
       ↓
useToolsStore.activeId = "measure-distance"
       ↓ watched
useToolRegistry  (mounted by MapLibrePanel)
       ↓ teardown previous, setup new
measure-distance.setup({ map, suspend, restore, emit }):
   1. addSource / addLayer for draft, labels, handles
   2. suspend() — disable map.dragPan + doubleClickZoom
   3. attach click / mousemove / dblclick / keydown listeners
   4. return { cleanup }
       ↓
user clicks → vertices.push → re-render sources
       ↓ Enter or dblclick
emit(feature) → useDrawingsStore.add(feature)
       ↓ reset state, stay active
```

Toggle semantics in `useToolsStore`:

- `toggle(id)` — same id deactivates, different id replaces.
- `activate(id)` — always sets, no toggling. Used by palette /
  shortcut activation where the user picked the tool explicitly.
- `deactivate()` — clears.

## Built-in tools

| Id                 | Implementation                          | Output                                                |
| ------------------ | --------------------------------------- | ----------------------------------------------------- |
| `measure-distance` | `src/modules/tools/measure-distance.ts` | LineString feature with `totalMeters` in properties   |
| `draw-polygon`     | `src/modules/tools/draw-polygon.ts`     | Polygon feature with `areaSquareMeters` in properties |

Both follow the same rendering pattern: a dashed-blue draft source, a
halo'd symbol layer for labels, and a yellow circle layer for vertex
handles. All sources / layers are namespaced as
`commandvue:<tool-id>:*` so a leak in `cleanup()` is detectable.

## Adding a new tool

1. Create `src/modules/tools/my-tool.ts`:

   ```ts
   import type { Tool, ToolContext, ToolSetupResult } from "./types";

   export const myTool: Tool = {
     id: "my-tool",
     label: "My tool",
     shortcut: "y",
     icon: "wand-2",
     setup({ map, suspend, restore, emit }: ToolContext): ToolSetupResult {
       const onClick = (e) => {
         // ...
       };
       map.on("click", onClick);
       suspend();
       return {
         cleanup() {
           map.off("click", onClick);
           restore();
         },
       };
     },
   };
   ```

2. Register it in `src/modules/tools/index.ts`:

   ```ts
   import { myTool } from "./my-tool";
   export const TOOLS = [measureDistanceTool, drawPolygonTool, myTool] as const;
   ```

3. Add a shortcut entry in `src/modules/shortcuts/catalog.ts`:

   ```ts
   { keys: ["y"], scope: "map", label: "My tool", action: "tool.my-tool" },
   ```

4. Add a TitleBar toggle button if you want a chrome surface, mirroring
   the Ruler / Hexagon pattern.

The palette picks the tool up automatically through `TOOLS`.

## What tools must NOT do

- **Don't write to `useToolsStore` directly** — let the host / palette
  / shortcut handler do that. The tool only knows about its map ctx.
- **Don't share sources across tools** — namespace your ids so cleanup
  is local.
- **Don't forget to restore `dragPan` and `doubleClickZoom`** in
  cleanup — `suspend/restore` are idempotent and free to call.
- **Don't capture references to the store inside `setup`** — pass
  finalized features through `ctx.emit()` so the wiring is testable.

## See also

- Architecture notes from the orbat-mapper study that shaped this
  design: `docs/research/phase-7-orbat-mapper-notes.md` (only present
  on the `phase-7-tools` history; safe to relocate).
- Keyboard shortcuts catalog: `src/modules/shortcuts/catalog.ts`.
