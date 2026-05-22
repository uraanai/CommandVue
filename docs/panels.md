# Panels

This page is for engineers building or extending panels. For a system-level overview, see [Architecture](/architecture).

## What a panel is

A **panel** is a Vue component hosted in one Dockview tab. Each instance has:

- A **panel id** (ULID) — used by Dockview, by `panelStateStore`, by `panelInstances`, and by preset references.
- A **panel type** (string id, e.g. `"cesium"`) — the class of panel. Registered in `panelRegistry` and as `app.component(id, ...)`.
- A **`PanelState` record** — `{ panelType, assignmentState, state, appliedPresetIds }` persisted in IndexedDB.
- An optional **imperative instance** registered via `registerPanelInstance(panelId, handle)` for preset application to reach.

## The Panel Registry

`src/modules/panels/registry.ts` is the singleton source of truth.

```typescript
import { panelRegistry } from "@/modules/panels/registry";
import type { PanelDefinition } from "@/modules/panels/types";

panelRegistry.register({
  id: "weather-radar",
  title: "Weather Radar",
  description: "Doppler radar overlay panel.",
  icon: "cloud-rain",
  category: "monitoring",
  component: () => import("@/components/panels/WeatherRadarPanel.vue"),
});

panelRegistry.get("weather-radar"); // → PanelDefinition
panelRegistry.list(); // → all defs
panelRegistry.listByCategory(); // → Record<PanelCategory, PanelDefinition[]>

const unsubscribe = panelRegistry.subscribe((defs) => {
  console.log("registry changed", defs.length);
});
```

**Critical:** the registry's `id` must equal the string passed to `app.component(id, ...)` and the `component:` string in `addPanel({ component: ... })`. Dockview-vue 6 resolves panel components from Vue's global registry; the panel registry adds metadata on top.

## Registering a new panel — the four touchpoints

When you add `WeatherRadarPanel.vue`:

1. **Build the component** under `src/components/panels/WeatherRadarPanel.vue`.
2. **Register it globally** in `main.ts`:
   ```typescript
   app.component(
     "weather-radar",
     defineAsyncComponent(() => import("@/components/panels/WeatherRadarPanel.vue")),
   );
   ```
3. **Add the definition** to `src/modules/panels/builtin.ts` (or call `panelRegistry.register(...)` from your own extension's bootstrap).
4. **(Optional) Update `SEED_PANEL_TYPES`** in `src/modules/storage/seed.ts` if you want the panel in the first-run default layout.

## Categories

Pick the closest match; don't invent new ones without updating the type union in `src/modules/panels/types.ts`.

| Category     | Examples                             |
| ------------ | ------------------------------------ |
| `maps`       | Cesium, MapLibre                     |
| `data`       | EntityList, table views              |
| `charts`     | ECharts panels                       |
| `docs`       | Markdown briefing, ComponentsBrowser |
| `monitoring` | Live telemetry, log tails            |
| `tools`      | Symbology reference, calculators     |

## Lifecycle

Dockview-vue 6 calls your panel component with these props:

```typescript
interface DockviewPanelProps {
  params: Record<string, unknown>;
  api: DockviewPanelApi;
  containerApi: DockviewApi;
}
```

Access the panel id via `props.api.id`. Use it to read the panel-state, register your instance, and watch for preset changes:

```vue
<script setup lang="ts">
import type { DockviewPanelApi } from "dockview-vue";
import { onBeforeUnmount, onMounted } from "vue";

import { registerPanelInstance, unregisterPanelInstance } from "@/modules/panels/instances";

const props = defineProps<{ api?: DockviewPanelApi }>();

onMounted(() => {
  if (props.api) registerPanelInstance(props.api.id, myImperativeHandle);
});

onBeforeUnmount(() => {
  if (props.api) unregisterPanelInstance(props.api.id);
});
</script>
```

## Per-panel state persistence

`src/composables/usePanelState.ts` handles serialize / restore. Opt in by passing `{ serialize, restore }`:

```vue
<script setup lang="ts">
import type { DockviewPanelApi } from "dockview-vue";
import { ref, watch } from "vue";

import { usePanelState } from "@/composables/usePanelState";

interface MyState extends Record<string, unknown> {
  zoom: number;
  filter: string;
}

const props = defineProps<{ api?: DockviewPanelApi }>();
const zoom = ref(1);
const filter = ref("");

if (props.api) {
  const { save } = usePanelState<MyState>(props.api.id, {
    serialize: () => ({ zoom: zoom.value, filter: filter.value }),
    restore: (state) => {
      zoom.value = state.zoom ?? 1;
      filter.value = state.filter ?? "";
    },
  });

  // Save when user input changes — debounced (400ms) and flushed on unmount.
  watch([zoom, filter], save);
}
</script>
```

The composable:

- Reads the persisted state on mount and calls `restore()`.
- Debounces writes via `save()` (400 ms default; override via `debounceMs`).
- Marks `session.dirty` on each successful save so the chrome's "Unsaved" indicator lights up.
- Flushes on unmount so close-then-reopen doesn't lose the last edit.

## State schema design rules

- **JSON-serializable only.** No DOM refs, no class instances, no functions. The state field lands in IndexedDB and (post-migration) Postgres JSONB.
- **Tolerate older shapes on restore.** When you bump your schema, `restore()` should handle a missing or renamed key gracefully — the persisted state might be older than the code.
- **Keep state small.** The state field travels with portable JSON exports and is loaded eagerly. Large blobs belong in their own panel-specific cache / table.
- **Don't store derived values.** If `displayName` is `${first} ${last}`, don't persist `displayName` — persist the parts.

## The three `assignmentState` values

| State        | Meaning                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `empty`      | `panelType: null`. Renders `UnassignedPanel` with the "Assign a component…" dropdown.                |
| `assigned`   | Panel type set but no user customization yet. Defaults to `configured` once the user persists state. |
| `configured` | Default state for seeded and explicitly-created panels. Indicates the user has touched this panel.   |

`panelStateStore.assignComponent(panelId, type, "configured")` is the canonical way to flip from empty to configured.

## The `applicableTo` contract (for presets)

Preset types declare which panel types they apply to via `applicableTo: ["maplibre", "cesium"]`. If your panel should accept presets, make sure your panel type id is included in the relevant preset type definitions.

When you add a new panel that should accept an existing preset type (e.g. a new map type that wants `map-style` presets), edit the preset type's `applicableTo` array in `src/modules/presets/builtin.ts` or register your own preset type with the new panel id.

## Handling unregistered types

If a panel-state record references a `panelType` not in the registry (common after importing a workspace from a different build), `session.rebuildFromPanelStates` falls back to `MissingPanelPlaceholder` — the user can Reassign (keeps panel id intact, preserves preset refs) or Remove.

Don't reach for the `__missing__` type from app code; it's reserved by the framework.

## Synthetic types — reserved

| Type             | Purpose                                                                       | Removable from registry? |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------ |
| `__unassigned__` | Renders for panel-states with `panelType: null` and `assignmentState: empty`. | No (registered at boot)  |
| `__missing__`    | Fallback when a panel-state references an unregistered type.                  | No (registered at boot)  |

Underscore-prefixed ids are reserved by the framework. Don't use them for your own panels.

## Testing patterns

```typescript
// tests/unit/panels/my-panel.spec.ts
import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import { panelRegistry } from "@/modules/panels/registry";
import MyPanel from "@/components/panels/MyPanel.vue";

describe("MyPanel", () => {
  beforeEach(() => {
    panelRegistry.__resetForTests();
    panelRegistry.register({
      id: "my-panel",
      title: "My Panel",
      description: "Test",
      icon: "square",
      category: "tools",
      component: () => Promise.resolve(MyPanel),
    });
  });

  it("renders default state when no api prop is passed", () => {
    const wrapper = mount(MyPanel);
    expect(wrapper.text()).toContain("…");
  });
});
```

For panels that interact with `panelStateStore` / `usePanelState`, use the helpers in `tests/unit/stores/helpers.ts` (`resetForStoreTest` which wraps `resetStorage` + fresh Pinia).

## Worked example — building "Weather Radar"

Goal: a panel that fetches doppler radar imagery, overlays it on a MapLibre map, and lets the user pick a timestamp.

### 1. State schema

```typescript
interface WeatherRadarState extends Record<string, unknown> {
  productId: string; // e.g. "reflectivity"
  timestampMs: number;
  opacity: number;
}
```

### 2. Component

```vue
<!-- src/components/panels/WeatherRadarPanel.vue -->
<script setup lang="ts">
import type { DockviewPanelApi } from "dockview-vue";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { usePanelState } from "@/composables/usePanelState";
import { registerPanelInstance, unregisterPanelInstance } from "@/modules/panels/instances";

interface WeatherRadarState extends Record<string, unknown> {
  productId: string;
  timestampMs: number;
  opacity: number;
}

const props = defineProps<{ api?: DockviewPanelApi }>();

const productId = ref("reflectivity");
const timestampMs = ref(Date.now());
const opacity = ref(0.7);

const handle = {
  setProduct: (id: string) => (productId.value = id),
  setTimestamp: (ms: number) => (timestampMs.value = ms),
};

onMounted(() => {
  if (!props.api) return;
  registerPanelInstance(props.api.id, handle);
  const { save } = usePanelState<WeatherRadarState>(props.api.id, {
    serialize: () => ({
      productId: productId.value,
      timestampMs: timestampMs.value,
      opacity: opacity.value,
    }),
    restore: (state) => {
      productId.value = state.productId ?? "reflectivity";
      timestampMs.value = state.timestampMs ?? Date.now();
      opacity.value = state.opacity ?? 0.7;
    },
  });
  watch([productId, timestampMs, opacity], save);
});

onBeforeUnmount(() => {
  if (props.api) unregisterPanelInstance(props.api.id);
});
</script>

<template>
  <div class="bg-surface h-full w-full">
    <!-- render the radar -->
  </div>
</template>
```

### 3. Register

```typescript
// src/modules/panels/builtin.ts
{
  id: "weather-radar",
  title: "Weather Radar",
  description: "Doppler radar overlay.",
  icon: "cloud-rain",
  category: "monitoring",
  component: () => import("@/components/panels/WeatherRadarPanel.vue"),
}

// src/main.ts
app.component(
  "weather-radar",
  defineAsyncComponent(() => import("@/components/panels/WeatherRadarPanel.vue")),
);
```

### 4. (Optional) Add a preset type

```typescript
// src/modules/presets/builtin.ts
export const RADAR_PRODUCT_PRESET: PresetTypeDefinition<{ productId: string; opacity: number }> = {
  id: "radar-product",
  title: "Radar Product",
  description: "Pre-configured radar product + opacity.",
  icon: "cloud-rain",
  applicableTo: ["weather-radar"],
  defaultConfig: { productId: "reflectivity", opacity: 0.7 },
  editComponent: () => import("@/components/presets/editors/RadarProductPresetEditor.vue"),
  applyToPanel(panelId, config) {
    const handle = getPanelInstance<{ setProduct: (id: string) => void }>(panelId);
    if (!handle) return;
    handle.setProduct(config.productId);
  },
};
```

That's it — the new panel is now available in View → Add Component → Monitoring → Weather Radar, accepts `radar-product` presets, persists its state, and survives portable workspace import/export.
