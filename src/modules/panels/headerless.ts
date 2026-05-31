/**
 * The "headerless" (clean pane) convention on `PanelState.state`.
 *
 * Dockview's `group.header.hidden` is NOT part of `toJSON()`, so clean mode
 * is persisted by us as a flag inside the panel's `PanelState.state`
 * (a `Record<string, unknown>`) and re-applied after every load path via
 * `session.applyHeaderlessGroups`. This module is the ONLY place the magic
 * string lives — every read/write goes through `isHeaderless` /
 * `withHeaderless`.
 */
export const HEADERLESS_KEY = "headerless" as const;

/** True when the panel-state marks this panel as a clean (header-less) pane. */
export function isHeaderless(state: Record<string, unknown> | undefined): boolean {
  return state?.[HEADERLESS_KEY] === true;
}

/**
 * Returns a new state object with the headerless flag set (`value: true`) or
 * removed (`value: false`). Never mutates the input.
 */
export function withHeaderless(
  state: Record<string, unknown> | undefined,
  value: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(state ?? {}) };
  if (value) {
    next[HEADERLESS_KEY] = true;
  } else {
    delete next[HEADERLESS_KEY];
  }
  return next;
}
