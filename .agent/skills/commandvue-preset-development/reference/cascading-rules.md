# Cascading rules

`panel-states.appliedPresetIds` is an ordered array. The panel iterates in order and calls each preset type's `applyToPanel`. **Later in the array overrides earlier** — CSS cascade semantics.

## Re-applying raises precedence

`panelStateRepo.applyPreset(panelId, presetId)`:

1. Filters `presetId` out of `appliedPresetIds`.
2. Appends `presetId` to the end.

Result: re-applying an already-applied preset moves it to the most-precedent slot.

```typescript
// Initial: []
await panelStateRepo.applyPreset(panel.id, "A"); // [A]
await panelStateRepo.applyPreset(panel.id, "B"); // [A, B]  — B overrides A
await panelStateRepo.applyPreset(panel.id, "A"); // [B, A]  — A now overrides B
```

This is the **only** intentional ordering primitive. Don't reorder `appliedPresetIds` directly via `updateState`.

## When the panel re-applies

Panel components watch their `appliedPresetIds` reactively:

```typescript
watch(
  () => panelStateStore.getState(props.api.id)?.appliedPresetIds,
  () => applyAppliedPresets(),
  { deep: true },
);
```

`applyAppliedPresets()` iterates in order and calls each preset type's `applyToPanel`. This handles:

- User picks a new preset → array changes → re-apply.
- User edits a preset's config → `presetStore.updatePreset` re-applies to all consumers (separate code path).
- (Future) Supabase Realtime sends a `presets UPDATE` event → re-apply.

## Idempotency requirement

Every `applyToPanel` must be safe to call multiple times with the same config without compounding effects. Test pattern:

```typescript
def.applyToPanel(panelId, config);
def.applyToPanel(panelId, config); // ← visual result must equal the first call
```

If your apply adds a DOM node or a Cesium entity, **either**:

- Make the operation set-based (replace, don't append), OR
- Implement `removeFromPanel` and call it from the panel's re-apply path before re-applying.

The MapStyle preset is naturally idempotent because `map.setStyle` replaces the style. The MapOverlay preset is **not** naturally idempotent — its stub `applyToPanel` is intentionally a no-op until a downstream app implements proper layer management.

## Cross-preset interaction

When two presets target the same visual property (e.g., two map-style presets), the last-applied wins. There's no merge semantics — preset types should be tight enough that meaningful stacking is intentional.

If your preset interacts with another (e.g., MapOverlay adds layers that a MapStyle wipes out via `setStyle`), document the ordering requirement in the preset type's `description`. The system gives users the controls; the types document the conventions.
