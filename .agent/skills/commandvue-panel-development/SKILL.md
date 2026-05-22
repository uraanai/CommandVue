---
name: commandvue-panel-development
description: Use when adding, modifying, or testing panel components, working with the Panel Registry, or wiring per-panel state persistence.
when_to_use: |
  - Adding a new panel under src/components/panels/
  - Editing src/modules/panels/ (registry, builtin, unassigned, missing, instances, types)
  - Wiring per-panel state via src/composables/usePanelState.ts
  - Discussing or modifying the three assignmentState values (empty / assigned / configured)
  - Anyone says "add a panel" or "new panel" or "panel registry"
---

# CommandVue Panel Development

## Three things to know first

1. **Dockview-vue 6 resolves panels by string id from Vue's global component registry.** The Panel Registry sits **alongside** `app.component()`, not in place of it.
2. **Panel ids are ULIDs**, generated client-side via `newId()` from `src/modules/storage/ids.ts`. They persist as `panel-states.id` in IDB.
3. **The panel registry's `id` must equal** the string passed to `app.component(id, ...)` AND the `component:` string in `addPanel({ component: id })`. They're three places that all reference the same id; keep them in sync.

## Adding a panel — the four touchpoints

When you add `WeatherRadarPanel.vue`:

1. **Build the component** under `src/components/panels/WeatherRadarPanel.vue`.
2. **Register globally** in `main.ts`:
   ```typescript
   app.component(
     "weather-radar",
     defineAsyncComponent(() => import("@/components/panels/WeatherRadarPanel.vue")),
   );
   ```
3. **Add the definition** to `src/modules/panels/builtin.ts` (or call `panelRegistry.register(...)` from an extension bootstrap).
4. **(Optional) Update `SEED_PANEL_TYPES`** in `src/modules/storage/seed.ts` if it should be in the first-run layout.

A copy-paste template is in [`reference/registration-template.ts`](./reference/registration-template.ts).

## The three `assignmentState` values

| State        | Meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| `empty`      | `panelType: null`. Renders `UnassignedPanel` with the "Assign a component…" dropdown. |
| `assigned`   | Panel type set but no user customization yet.                                         |
| `configured` | User has touched this panel. Default for seeded and explicitly-created panels.        |

`panelStateStore.assignComponent(panelId, type, "configured")` flips empty → configured.

## Synthetic types — DO NOT use these ids for your panels

| Type             | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `__unassigned__` | Renders for panel-states with `panelType: null` and `assignmentState: empty`. |
| `__missing__`    | Fallback when a panel-state references an unregistered type.                  |

Underscore-prefixed ids are reserved by the framework.

## Per-panel state persistence

Use `src/composables/usePanelState.ts`. It owns the debounce, the flush-on-unmount, and the dirty marking. The panel owns serialize + restore.

```typescript
const { save } = usePanelState<MyState>(props.api.id, {
  serialize: () => ({ ... }),
  restore: (state) => { ... },
});
// Then trigger save() from your panel's event handlers (moveend, dataZoom, etc.)
```

State schema design rules: see [`reference/state-schema-rules.md`](./reference/state-schema-rules.md).

## Live instance registry (for preset application)

If your panel should accept presets, register its imperative handle on mount:

```typescript
import { registerPanelInstance, unregisterPanelInstance } from "@/modules/panels/instances";

onMounted(() => {
  if (props.api) registerPanelInstance(props.api.id, myHandle);
});
onBeforeUnmount(() => {
  if (props.api) unregisterPanelInstance(props.api.id);
});
```

`PresetTypeDefinition.applyToPanel(panelId, config)` reads the handle via `getPanelInstance(panelId)`. The registry is intentionally **non-Pinia**, module-scope — non-serializable values must not leak into devtools.

## Testing patterns

See [`reference/testing-patterns.md`](./reference/testing-patterns.md). Test seams:

```typescript
import { panelRegistry } from "@/modules/panels/registry";
import { __unregisterBuiltinPanelsForTests, registerBuiltinPanels } from "@/modules/panels/builtin";

beforeEach(() => {
  __unregisterBuiltinPanelsForTests();
  panelRegistry.__resetForTests();
  // Then register only what your test needs.
});
```

## Common mistakes

- **Forgetting `app.component()`.** Registering with `panelRegistry.register()` alone won't let Dockview render the panel — it walks the Vue global registry.
- **Using underscore-prefixed ids.** Reserved for framework synthetic types.
- **Storing non-serializable values in `panel-state.state`.** That field goes to IDB and Postgres JSONB. Live instances belong in the panel-instance registry.
- **Restoring without defaults.** Older persisted states may be missing fields you added later. Always `state.foo ?? defaultValue`.
- **Saving without debounce.** The composable handles 400ms debounce + flush-on-unmount. Don't roll your own.

## Reference files

- [`reference/registration-template.ts`](./reference/registration-template.ts)
- [`reference/state-schema-rules.md`](./reference/state-schema-rules.md)
- [`reference/testing-patterns.md`](./reference/testing-patterns.md)
