# Presets

A **preset** is a typed bundle of visual configuration that can be applied to multiple panels across multiple layouts. This page is for engineers building new preset types. For a system-level overview, see [Architecture](/architecture).

## The two layers

| Layer             | What it is                                   | Where it lives                           |
| ----------------- | -------------------------------------------- | ---------------------------------------- |
| **Preset type**   | Schema + how-to-apply for a class of presets | `presetTypeRegistry` (client-side, code) |
| **Preset record** | One user-created instance of a type          | `presets` table in IndexedDB             |

The template ships three example preset types:

| Type ID       | Applies to           | Runtime apply                                                                     |
| ------------- | -------------------- | --------------------------------------------------------------------------------- |
| `map-style`   | `maplibre`           | Fully wired — calls `map.setStyle(styleUrl)`                                      |
| `map-overlay` | `cesium`, `maplibre` | Stub `applyToPanel` (`console.warn`); downstream apps wire the actual layer logic |
| `chart-theme` | `chart`              | Stub `applyToPanel`; ECharts theme application varies per app                     |

## The Preset Type Registry

```typescript
import { presetTypeRegistry } from "@/modules/presets/registry";
import type { PresetTypeDefinition } from "@/modules/presets/types";

const MY_PRESET: PresetTypeDefinition<{ url: string }> = {
  id: "my-overlay",
  title: "My Overlay",
  description: "Adds an overlay layer.",
  icon: "layers",
  applicableTo: ["maplibre", "cesium"],
  defaultConfig: { url: "" },
  editComponent: () => import("@/components/presets/editors/MyOverlayEditor.vue"),
  applyToPanel(panelId, config) {
    const map = getPanelInstance<MapLibreMap>(panelId);
    if (!map) return;
    // Add the overlay layer …
  },
  removeFromPanel(panelId, config) {
    // Optional teardown.
  },
};

presetTypeRegistry.register(MY_PRESET);
presetTypeRegistry.listFor("maplibre"); // → all types applicable to MapLibre panels
```

## The `applyToPanel` contract

```typescript
applyToPanel(panelId: Ulid, config: TConfig) => void | Promise<void>;
```

Three rules:

1. **Be defensive about the panel instance.** `getPanelInstance(panelId)` can return `undefined` (panel still mounting, panel just unmounted, panel never registered an instance). No-op gracefully.
2. **Be idempotent.** Re-applying the same preset with the same config must produce the same visual result. The system re-applies on every `appliedPresetIds` change.
3. **Be additive when there's no `removeFromPanel`.** The default cascade assumes later presets visually override earlier ones; if your preset can be "removed" cleanly, implement `removeFromPanel`.

## Cascading order — CSS semantics

`panel-states.appliedPresetIds` is an **ordered** list. The panel iterates in order and calls each preset type's `applyToPanel`. **Later overrides earlier** (CSS cascade semantics).

Re-applying an already-applied preset moves it to the end of the list, raising its precedence:

```typescript
await panelStateRepo.applyPreset(panelId, "preset-A"); // [A]
await panelStateRepo.applyPreset(panelId, "preset-B"); // [A, B]
await panelStateRepo.applyPreset(panelId, "preset-A"); // [B, A] — A is now on top
```

This is implemented in `panelStateRepo.applyPreset`. Don't reorder `appliedPresetIds` directly.

## Global vs workspace-scoped

A preset record's `workspaceId` field:

- `null` → **global** (visible to every workspace the user owns). Survives workspace deletion.
- `<workspaceId>` → **scoped** (visible only in that workspace). Cascade-deletes with its workspace.

`ManagePresetsDialog` shows both via tabs. Two duplicate actions promote across the boundary:

- **Scope to workspace** — `presetStore.duplicatePreset(id, { workspaceId: currentWorkspaceId })` — creates a workspace-scoped copy of a global preset.
- **Promote to global** — `presetStore.duplicatePreset(id, { workspaceId: null })` — creates a global copy of a workspace-scoped preset.

The original is untouched in both cases — promote/scope is always a copy, never a move.

## The store API

```typescript
import { usePresetStore } from "@/stores/preset";

const presets = usePresetStore();
await presets.loadForWorkspace(workspaceId); // loads global + scoped
presets.presetsForPanel("maplibre", workspaceId); // filtered by applicableTo + workspace scope
await presets.createPreset({
  presetTypeId: "map-style",
  workspaceId: null,
  name: "Satellite",
  config: { styleUrl: "https://example/satellite.json" },
});
await presets.updatePreset(id, { config: { styleUrl: "https://new" } });
// ↑ Automatically re-applies to every panel referencing this preset.
await presets.applyToPanel(panelId, presetId);
await presets.removeFromPanel(panelId, presetId);
await presets.deletePreset(id); // refuses on in-use; pass { force: true } to strip refs + delete
```

## How runtime application reaches the panel

`PresetTypeDefinition.applyToPanel` needs the live panel instance. It reads from the **panel-instance registry**:

```typescript
// src/modules/panels/instances.ts
import { getPanelInstance, registerPanelInstance } from "@/modules/panels/instances";

// In a panel component:
onMounted(() => {
  registerPanelInstance(props.api.id, myImperativeHandle);
});
onBeforeUnmount(() => {
  unregisterPanelInstance(props.api.id);
});

// In a preset type's applyToPanel:
const handle = getPanelInstance<MyHandleType>(panelId);
if (!handle) return; // panel not mounted (yet)
handle.doSomething(config);
```

The registry is intentionally **non-Pinia**, module-scope. Same reasoning as the DockviewApi in the session store — non-serializable values must not leak into devtools / persistence / Supabase Realtime.

## Worked example — building a `unit-symbology-palette` preset type

Goal: a preset that swaps the SIDC affiliation color palette for an entity panel.

### 1. Define the config shape

```typescript
export interface UnitSymbologyPaletteConfig extends Record<string, unknown> {
  friendly: string;
  hostile: string;
  neutral: string;
  unknown: string;
}
```

### 2. Build the editor component

```vue
<!-- src/components/presets/editors/UnitSymbologyPaletteEditor.vue -->
<script setup lang="ts">
import type { UnitSymbologyPaletteConfig } from "@/modules/presets/builtin";

interface Props {
  modelValue: UnitSymbologyPaletteConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: UnitSymbologyPaletteConfig] }>();

function update<K extends keyof UnitSymbologyPaletteConfig>(
  key: K,
  value: UnitSymbologyPaletteConfig[K],
): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label v-for="aff in ['friendly', 'hostile', 'neutral', 'unknown']" :key="aff">
      <span class="text-faint text-[10px] uppercase">{{ aff }}</span>
      <input
        :value="(modelValue as any)[aff]"
        type="color"
        class="border-border h-8 w-full rounded border"
        @input="
          (e) =>
            update(aff as keyof UnitSymbologyPaletteConfig, (e.target as HTMLInputElement).value)
        "
      />
    </label>
  </div>
</template>
```

### 3. Register the preset type

```typescript
// src/modules/presets/builtin.ts (or your extension bootstrap)
import type { PresetTypeDefinition } from "./types";

export const UNIT_SYMBOLOGY_PALETTE_PRESET: PresetTypeDefinition<UnitSymbologyPaletteConfig> = {
  id: "unit-symbology-palette",
  title: "Unit Symbology Palette",
  description: "Override the SIDC affiliation colors on the entity list.",
  icon: "palette",
  applicableTo: ["entities"],
  defaultConfig: {
    friendly: "#3B82F6",
    hostile: "#EF4444",
    neutral: "#10B981",
    unknown: "#F59E0B",
  },
  editComponent: () => import("@/components/presets/editors/UnitSymbologyPaletteEditor.vue"),
  applyToPanel(panelId, config) {
    const list = getPanelInstance<EntityListHandle>(panelId);
    if (!list) return;
    list.setAffiliationPalette(config);
  },
};
```

### 4. Register the panel-instance handle

In `EntityListPanel.vue`:

```typescript
const handle = {
  setAffiliationPalette: (palette: UnitSymbologyPaletteConfig) => {
    // mutate your local palette ref; trigger re-render
  },
};

onMounted(() => {
  if (props.api) registerPanelInstance(props.api.id, handle);
});
```

That's it — the new preset type appears in Manage Presets, can be created globally or workspace-scoped, applies to entity panels, and re-applies live when edited.

## Don't store user-input-driven state in the preset

Presets are **shared configuration** applied to potentially many panels. A panel's per-instance state (zoom, current filter, scroll position) goes in `panel-states.state` via `usePanelState`, NOT in a preset. Presets answer "how should this panel look across every layout that uses it"; per-panel state answers "where is this specific panel pointed right now."

## Test seam

```typescript
import { presetTypeRegistry } from "@/modules/presets/registry";
import {
  __unregisterBuiltinPresetTypesForTests,
  registerBuiltinPresetTypes,
} from "@/modules/presets/builtin";

beforeEach(() => {
  __unregisterBuiltinPresetTypesForTests();
  registerBuiltinPresetTypes();
});
```

Spies on `presetTypeRegistry.get(id).applyToPanel` after `registerBuiltinPresetTypes()` let you verify the apply path without rendering a real panel:

```typescript
const spy = vi.fn();
const original = presetTypeRegistry.get("map-style")!.applyToPanel;
presetTypeRegistry.get("map-style")!.applyToPanel = spy;
try {
  await presetStore.applyToPanel(panelId, presetId);
} finally {
  presetTypeRegistry.get("map-style")!.applyToPanel = original;
}
expect(spy).toHaveBeenCalledWith(panelId, expect.any(Object));
```

See `tests/unit/presets/store.spec.ts` for the full pattern.
