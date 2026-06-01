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

/**
 * Per-window see-through opacity (Track B Phase 3b). `floatAlpha` (0..1) is the
 * BACKGROUND alpha of a floating pane's glass — 1 = solid, 0 = fully transparent
 * (only the content shows; the map reads straight through). Applied at runtime as
 * the `--cv-float-alpha` CSS var on the floating group element, and persisted here
 * so it survives reload (re-applied by the session's `applyFloatAlphas` hook). The
 * solid default (1) is omitted from state, exactly like `headerless: false`.
 */
export const FLOAT_ALPHA_KEY = "floatAlpha" as const;
export const DEFAULT_FLOAT_ALPHA = 1;

/** Read the persisted float alpha, clamped to [0, 1]; defaults to 1 (solid). */
export function getFloatAlpha(state: Record<string, unknown> | undefined): number {
  const v = state?.[FLOAT_ALPHA_KEY];
  return typeof v === "number" && v >= 0 && v <= 1 ? v : DEFAULT_FLOAT_ALPHA;
}

/** Persist a float alpha (clamped to [0, 1]); the solid default (>= 1) is omitted. */
export function withFloatAlpha(
  state: Record<string, unknown> | undefined,
  value: number,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(state ?? {}) };
  const clamped = Math.min(1, Math.max(0, value));
  if (clamped >= 1) delete next[FLOAT_ALPHA_KEY];
  else next[FLOAT_ALPHA_KEY] = clamped;
  return next;
}
