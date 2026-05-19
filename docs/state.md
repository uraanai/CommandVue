# State

CommandVue uses Pinia for application state, plain refs for ephemeral
component state, and `idb` for persistence that must survive reloads.
No Vuex, no global event bus, no Redux-style middleware layer.

## Stores

| Store                | Phase | Concern                                                          |
| -------------------- | ----- | ---------------------------------------------------------------- |
| `useUiStore`         | 4     | App mode (3d/2d/split), sidebar visibility, command-palette flag |
| `useLayoutStore`     | 4     | Persisted Dockview layout JSON (round-trips through idb)         |
| `useEntitiesStore`   | 6     | Mock entity list with NATO-SIDC codes (demo data)                |
| `useTelemetryStore`  | 6     | Rolling buffer of WebSocket messages + synthetic chart signal    |
| `useConnectionStore` | 6     | WS lifecycle status surfaced to StatusBar                        |
| `useToolsStore`      | 7     | Active tool id + 10-entry MRU history                            |
| `useDrawingsStore`   | 7     | Finalized features emitted by tools                              |

Every store is in `src/stores/` and re-exported by `src/stores/index.ts`.

## Composition API style

All stores are composition-style — `defineStore("name", () => { ... })`.
That keeps types inferred naturally and avoids the options-style boilerplate.

```ts
export const useToolsStore = defineStore("tools", () => {
  const activeId = ref<ToolId | null>(null);
  const history = ref<ToolId[]>([]);

  function toggle(id: ToolId): void {
    activeId.value = activeId.value === id ? null : id;
    if (activeId.value) recordHistory(id);
  }

  return { activeId, history, toggle };
});
```

In components, destructure reactive state via `storeToRefs` so it
stays reactive across destructuring:

```vue
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useToolsStore } from "@/stores";

const tools = useToolsStore();
const { activeId, history } = storeToRefs(tools);
const { toggle, deactivate } = tools; // actions don't need storeToRefs
</script>
```

## Architectural rules

1. **Stores hold serializable state only.** No DOM refs, no Cesium
   `Viewer` instances, no MapLibre `Map` instances. The viewers live
   in `shallowRef` inside the composables that own their lifecycle.

2. **Components don't mutate state directly.** Call store actions.
   This keeps the data flow uniform and makes debugging easier (every
   mutation has a name in DevTools).

3. **Use `shallowRef` for any reactive that holds a non-Vue object.**
   Cesium and MapLibre break under deep reactivity proxies; Dockview's
   layout JSON is large enough that deep traversal would hurt
   performance.

4. **One store per concern.** Don't create kitchen-sink stores.
   `useUiStore` doesn't hold tool state; `useTelemetryStore` doesn't
   hold connection state; etc.

5. **Persisted state goes through `idb`.** Use `@/utils/storage`'s
   `idbGet` / `idbSet` / `idbDel`. localStorage is fine for tiny user
   preferences (theme — handled by `useTheme()` via `@vueuse/core`),
   but idb has a much larger quota and an async API that doesn't block
   the main thread.

## Persistence pattern

The Dockview layout is the canonical example:

```ts
export const useLayoutStore = defineStore("layout", () => {
  const layoutJson = shallowRef<unknown>(null);

  async function load(): Promise<unknown> {
    const stored = await idbGet<unknown>("layout:dockview");
    if (stored !== undefined) layoutJson.value = stored;
    return stored ?? null;
  }

  async function save(payload: unknown): Promise<void> {
    layoutJson.value = payload;
    await idbSet("layout:dockview", payload);
  }

  async function reset(): Promise<void> {
    layoutJson.value = null;
    await idbDel("layout:dockview");
  }

  return { layoutJson, load, save, reset };
});
```

The component (`DockLayout.vue`) calls `load()` inside Dockview's
`@ready` event and writes through a 400 ms debounce on
`onDidLayoutChange`.

## Testing stores

Stores are pure logic — just give them a fresh Pinia instance per
test and exercise the actions:

```ts
beforeEach(() => setActivePinia(createPinia()));

it("toggle deactivates when re-called with the same id", () => {
  const store = useToolsStore();
  store.toggle("measure-distance");
  store.toggle("measure-distance");
  expect(store.activeId).toBeNull();
});
```

For stores that hit `@/utils/storage`, mock it:

```ts
vi.mock("@/utils/storage", () => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
  idbDel: vi.fn(),
}));
```

`tests/unit/{tools-store, layout-store, ui-store}.spec.ts` are the
canonical references.
