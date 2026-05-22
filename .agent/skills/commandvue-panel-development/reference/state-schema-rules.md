# Panel state schema rules

`panel-states.state` is a `Record<string, unknown>` blob. The panel owns its shape via `usePanelState<T>` generic.

## Hard rules

1. **JSON-serializable only.** No DOM refs, no class instances, no functions. The state field lands in IDB and (post-migration) Postgres JSONB.
2. **Tolerate older shapes on restore.** Persisted states may predate your current schema by months. Always `state.foo ?? defaultValue`.
3. **Keep it small.** State travels in portable JSON exports and is loaded eagerly. Anything > ~10 KB belongs in its own panel-specific cache / table.
4. **Don't store derived values.** Persist the inputs; recompute the derivations.
5. **Use stable JSON-safe types.** `string`, `number`, `boolean`, `null`, arrays of the above, plain objects. Coordinate tuples are arrays-of-numbers (`[lng, lat]`), not custom classes.

## Tolerating older shapes

```typescript
restore: (state) => {
  // Defensive defaults for every field:
  zoom.value = state.zoom ?? 1;
  filter.value = state.filter ?? "";

  // For renamed fields, accept both:
  const legacyZoom = (state as { z?: number }).z;
  if (legacyZoom !== undefined && state.zoom === undefined) {
    zoom.value = legacyZoom;
  }

  // For dropped fields, just ignore extras.
};
```

## Don't do this

```typescript
// ❌ Function — not JSON-serializable
serialize: () => ({ onChange: () => {} });

// ❌ DOM ref — not JSON-serializable
serialize: () => ({ container: containerRef.value });

// ❌ Vue ref — wraps a value, but the .value is what should persist
serialize: () => ({ zoom: zoom }); // should be: zoom.value

// ❌ Derived — recompute on restore instead
serialize: () => ({ first, last, displayName: `${first} ${last}` });
```

## When in doubt

If you're about to persist something non-serializable, register it in the panel-instance registry instead. The instance registry is where Cesium viewers, MapLibre maps, and ECharts charts live — see `src/modules/panels/instances.ts`.
