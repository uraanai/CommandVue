/**
 * Float lifecycle state persisted on `PanelState.state` (mirrors
 * `headerless.ts`). A floating window always shows a header (its drag handle),
 * so floating a CLEAN (header-less) pane strips the `headerless` flag —
 * `FLOAT_PREV_HEADERLESS_KEY` remembers the pre-float value so `dockBack` can
 * restore the pane's clean status. Phase 3b adds the float-opacity key
 * (`FLOAT_ALPHA_KEY`) below.
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

/**
 * Float maximize ⇄ restore (Track B Phase 4b). A floating window can fill the
 * dock area and toggle back to its prior size/position — a CUSTOM behavior, since
 * dockview's native maximize is grid-only. `floatMaximized` (default false,
 * omitted) records the toggle state; `floatPrevBox` remembers the pre-maximize
 * box so Restore returns the float exactly where it was.
 *
 * `FloatBox` mirrors dockview-core's `AnchoredBox` (width/height + ONE corner
 * anchor) — modeled locally because dockview-core does not export the type. It is
 * obtained from a floating group's `overlay.toJSON()` and passed back to its
 * `position()`.
 */
export type FloatBox = {
  width: number;
  height: number;
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
};

export const FLOAT_MAXIMIZED_KEY = "floatMaximized" as const;
export const FLOAT_PREV_BOX_KEY = "floatPrevBox" as const;

/** Whether the floating window is currently maximized (fills the dock area). */
export function getFloatMaximized(state: Record<string, unknown> | undefined): boolean {
  return state?.[FLOAT_MAXIMIZED_KEY] === true;
}

/** Record (true) or clear (false — the default, omitted) the maximized flag. */
export function withFloatMaximized(
  state: Record<string, unknown> | undefined,
  value: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(state ?? {}) };
  if (value) next[FLOAT_MAXIMIZED_KEY] = true;
  else delete next[FLOAT_MAXIMIZED_KEY];
  return next;
}

/** The pre-maximize box to restore to, or undefined when not maximized. */
export function getFloatPrevBox(state: Record<string, unknown> | undefined): FloatBox | undefined {
  return isFloatBox(state?.[FLOAT_PREV_BOX_KEY])
    ? (state[FLOAT_PREV_BOX_KEY] as FloatBox)
    : undefined;
}

/** Store (or clear, when `box` is undefined) the pre-maximize box. */
export function withFloatPrevBox(
  state: Record<string, unknown> | undefined,
  box: FloatBox | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(state ?? {}) };
  if (box) next[FLOAT_PREV_BOX_KEY] = box;
  else delete next[FLOAT_PREV_BOX_KEY];
  return next;
}

function isFloatBox(v: unknown): v is FloatBox {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).width === "number" &&
    typeof (v as Record<string, unknown>).height === "number"
  );
}
