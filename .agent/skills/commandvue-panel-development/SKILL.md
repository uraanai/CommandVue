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

> **Library-first reminder:** UI inside a panel uses PrimeVue components — never hand-rolled equivalents. Dropdowns → `Select`, textareas → `Textarea`, color/range/checkbox → `ColorPicker` / `Slider` / `Checkbox`, section grouping → `Fieldset`, badges → `Tag`. Charts use `vue-echarts`; maps use `cesium` / `maplibre-gl`; symbology uses `milsymbol`. **Tables are the one governed exception** — tabular data uses the project's `<DataTable>` wrapper at `src/components/ui/DataTable.vue` (TanStack-based default; `primevue/datatable` is the documented escape valve, see [ADR 0001](../../../docs/decisions/0001-datatable-library.md)). See [`CLAUDE.md → Library-first rule`](../../../CLAUDE.md) and [`workflows/library-first.md`](../../workflows/library-first.md).

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

## Data tables

When a panel displays tabular data:

1. **Default:** import the `<DataTable>` wrapper from `@/components/ui/DataTable.vue`. Define columns with `createColumnHelper<TData>()` from `@/components/ui/datatable/columnHelpers`.
2. **Wire serialization:** the panel state should typically include `sorting`, `filterText`, `visibility`, and `density` (see `EntityListPanel.vue` for the canonical pattern). Trigger `usePanelState`'s `save()` from the wrapper's `@sort-change`, `@global-filter-change`, and `@column-visibility-change` emits.
3. **Density:** default to `compact` for high-density data feeds, `comfortable` for general lists. Surface a `Select` in the wrapper's `#toolbar` slot if users should be able to switch.
4. **Virtualization:** auto-activates above 100 rows. Tune `estimatedRowHeight` (28 / 36 / 44 for the three densities) for accuracy.
5. **Sticky first column** is appropriate when the leftmost column is a small visual key (icon, badge, id). Combine with `stickyHeader` (on by default).
6. **Do NOT use `primevue/datatable`** without a justification in your PR. The repo's labeler auto-applies `governance: primevue-datatable` and ESLint emits a warn-level `no-restricted-imports` notice. The escape valve is reserved for cases where PrimeVue's TreeTable or row-edit-in-place materially reduces code volume.

Reference implementation: `src/components/panels/EntityListPanel.vue`. Full reference: [`docs/datatable.md`](../../../docs/datatable.md). Policy rationale: [`docs/decisions/0001-datatable-library.md`](../../../docs/decisions/0001-datatable-library.md).

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
