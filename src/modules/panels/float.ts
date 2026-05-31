/**
 * Float lifecycle state persisted on `PanelState.state` (mirrors
 * `headerless.ts`). A floating window always shows a header (its drag handle),
 * so floating a CLEAN (header-less) pane strips the `headerless` flag —
 * `FLOAT_PREV_HEADERLESS_KEY` remembers the pre-float value so `dockBack` can
 * restore the pane's clean status. Phase 3b will add the float-opacity key
 * alongside this one.
 *
 * Float position/size is NOT stored here — dockview serializes that natively in
 * `toJSON().floatingGroups[].position`. This module owns only the bit of float
 * state dockview does not persist for us.
 */
export const FLOAT_PREV_HEADERLESS_KEY = "floatPrevHeaderless" as const;

/** Whether the pane was clean (header-less) before it was floated. */
export function floatWasHeaderless(state: Record<string, unknown> | undefined): boolean {
  return state?.[FLOAT_PREV_HEADERLESS_KEY] === true;
}

/**
 * Record (when `value` is true) or clear (when false — the default, omitted like
 * `headerless: false`) the pre-float headerless flag.
 */
export function withFloatPrevHeaderless(
  state: Record<string, unknown> | undefined,
  value: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(state ?? {}) };
  if (value) next[FLOAT_PREV_HEADERLESS_KEY] = true;
  else delete next[FLOAT_PREV_HEADERLESS_KEY];
  return next;
}
