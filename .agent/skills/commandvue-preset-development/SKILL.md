---
name: commandvue-preset-development
description: Use when adding or modifying preset types, working with the preset store, or wiring runtime preset application to panels.
when_to_use: |
  - Editing src/modules/presets/{types,registry,builtin}.ts
  - Editing src/stores/preset.ts
  - Adding a new preset type or per-type editor
  - Wiring runtime application (applyToPanel / removeFromPanel)
  - Anyone says "preset", "overlay preset", "theme preset", or "applicableTo"
---

# CommandVue Preset Development

> **Library-first reminder:** preset _editor_ components (`src/components/presets/editors/*.vue`) must use PrimeVue form controls: `ColorPicker` for color fields, `Slider` for ranges, `Checkbox` for booleans, `Select` for enums, `Textarea` for multi-line text. Never use raw `<input type=color/range/checkbox>` or `<select>` — they look out-of-place next to the rest of the app and miss out on accessibility. See [`CLAUDE.md → Library-first rule`](../../../CLAUDE.md).

A **preset** is a typed bundle of visual configuration applied to panels at runtime. Two layers:

| Layer             | What it is                                   | Where it lives                          |
| ----------------- | -------------------------------------------- | --------------------------------------- |
| **Preset type**   | Schema + how-to-apply for a class of presets | `presetTypeRegistry` (client-side code) |
| **Preset record** | One user-created instance of a type          | `presets` table in IndexedDB            |

Three example types ship with the template:

| Type ID       | Applies to           | Runtime apply                                  |
| ------------- | -------------------- | ---------------------------------------------- |
| `map-style`   | `maplibre`           | Fully wired: `map.setStyle(styleUrl)`          |
| `map-overlay` | `cesium`, `maplibre` | Stub (`console.warn`); downstream wires actual |
| `chart-theme` | `chart`              | Stub; ECharts theme is per-app                 |

## The `PresetTypeDefinition` contract

```typescript
interface PresetTypeDefinition<TConfig extends Record<string, unknown>> {
  id: PresetTypeId;
  title: string;
  description: string;
  icon: string;
  applicableTo: readonly PanelType[];
  defaultConfig: TConfig;
  editComponent: () => Promise<Component>;
  applyToPanel: (panelId: Ulid, config: TConfig) => Promise<void> | void;
  removeFromPanel?: (panelId: Ulid, config: TConfig) => Promise<void> | void;
}
```

Three rules for `applyToPanel`:

1. **Be defensive about the panel instance.** `getPanelInstance(panelId)` can return `undefined`. No-op gracefully.
2. **Be idempotent.** Re-applying the same preset with the same config must produce the same visual result. The system re-applies on every `appliedPresetIds` change.
3. **Be additive when there's no `removeFromPanel`.** The default cascade assumes later presets visually override earlier ones; implement `removeFromPanel` when removal needs explicit teardown.

## Cascading order — CSS semantics

`panel-states.appliedPresetIds` is an **ordered** list. The panel iterates in order and calls each preset type's `applyToPanel`. **Later overrides earlier.**

Re-applying an already-applied preset moves it to the end (raising precedence). This is enforced by `panelStateRepo.applyPreset`. **Don't reorder `appliedPresetIds` directly.**

See [`reference/cascading-rules.md`](./reference/cascading-rules.md) for details.

## Global vs workspace-scoped

| `workspaceId`   | Scope                                             | Cascade behavior                   |
| --------------- | ------------------------------------------------- | ---------------------------------- |
| `null`          | Global (visible in every workspace the user owns) | Survives workspace deletion        |
| `<workspaceId>` | Scoped (visible only in that workspace)           | Cascade-deletes with its workspace |

`presetStore.duplicatePreset(id, { workspaceId })` is the move:

- Promote workspace → global: `{ workspaceId: null }`.
- Scope global → workspace: `{ workspaceId: currentWorkspaceId }`.

## Adding a new preset type — copy-paste template

See [`reference/preset-type-template.ts`](./reference/preset-type-template.ts).

The four touchpoints:

1. Define the `TConfig` interface and the `PresetTypeDefinition<TConfig>` constant.
2. Build the editor component under `src/components/presets/editors/`.
3. Register via `presetTypeRegistry.register(YOUR_PRESET)` (or add to `BUILTIN_PRESET_TYPES` for built-ins).
4. The panel(s) listed in `applicableTo` must register their imperative handle via `registerPanelInstance`.

## How runtime application reaches the panel

The preset type's `applyToPanel(panelId, config)` reaches the live panel instance via the **panel-instance registry** (`src/modules/panels/instances.ts`):

```typescript
applyToPanel(panelId, config) {
  const map = getPanelInstance<MapLibreMap>(panelId);
  if (!map) return; // panel not mounted yet
  map.setStyle(config.styleUrl);
}
```

The panel component registers the instance on mount and unregisters on unmount.

## Store API

```typescript
const presets = usePresetStore();
await presets.loadForWorkspace(workspaceId);
presets.presetsForPanel("maplibre", workspaceId); // filtered by applicableTo + scope
await presets.applyToPanel(panelId, presetId); // writes panel-state + calls applyToPanel
await presets.updatePreset(id, { config }); // re-applies to every referencing panel
await presets.removeFromPanel(panelId, presetId);
await presets.deletePreset(id); // refuses on in-use; { force: true } strips refs
```

## Common mistakes

- **Generics widening fails at registration.** `PresetTypeDefinition<TConfig>` doesn't unify back to `PresetTypeDefinition<Record<string, unknown>>` because of generic variance. `registerBuiltinPresetTypes()` uses `as unknown as PresetTypeDefinition` inline; you can too.
- **Storing per-instance state in the preset.** Presets are shared configuration. Per-panel zoom / filter / scroll goes in `panel-state.state` via `usePanelState`, not in a preset.
- **Forgetting `removeFromPanel`.** If your preset adds something (layer, source, listener), implement `removeFromPanel` so removing the preset cleans up.
- **Calling `applyToPanel` directly from app code.** Use `presetStore.applyToPanel(panelId, presetId)` — it writes the panel-state ref AND runs the apply. Direct calls skip the persistence.
- **Stale registry on test re-run.** `presetTypeRegistry.__resetForTests()` + `registerBuiltinPresetTypes()` in `beforeEach` prevents test cross-talk.

## Reference files

- [`reference/preset-type-template.ts`](./reference/preset-type-template.ts)
- [`reference/cascading-rules.md`](./reference/cascading-rules.md)
