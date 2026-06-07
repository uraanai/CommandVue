/**
 * Owning-window overlay target (Track B — pop-out interactive components).
 *
 * When a dockview panel is "popped out" into its own browser window, dockview
 * MOVES the panel's DOM into the child window — but the panel's Vue code keeps
 * running in the OPENER realm, so the ambient `document` is still the opener's.
 * Any overlay that teleports / `appendTo`s `document.body` therefore mounts in
 * the OPENER window, appearing over the wrong screen.
 *
 * Bind an overlay's mount target to the `target` ref returned here and call
 * `resolve()` when the overlay opens (PrimeVue `@before-show`, a `visible`
 * watch for modals, or the open handler for a hand-rolled `<Teleport>`), so the
 * overlay mounts in the panel's OWN window. The owning document is read at OPEN
 * time on purpose: dockview's DOM relocation fires no reactive signal, so a
 * once-on-mount capture would go stale the moment the panel is popped out.
 *
 * Default (docked, never popped out) resolves to the opener `document.body`, so
 * behavior is unchanged for the common case.
 */

import { ref, type Ref } from "vue";

/** A template ref may hold a raw element or a component instance (`$el`). */
export type ElementLike = HTMLElement | { $el?: unknown } | null | undefined;

/** Coerce a template ref value to its underlying HTMLElement, if any. */
export function toElement(value: ElementLike): HTMLElement | null {
  if (!value) return null;
  if (value instanceof HTMLElement) return value;
  const el = (value as { $el?: unknown }).$el;
  return el instanceof HTMLElement ? el : null;
}

export interface OverlayTarget {
  /** Bind to the overlay's `appendTo` (PrimeVue) or `<Teleport :to>`. */
  target: Ref<HTMLElement>;
  /** Re-resolve the owning-window body. Call when the overlay opens. */
  resolve: () => void;
}

/**
 * @param rootRef a template ref on the component's root element (or the wrapped
 *   PrimeVue component instance — `$el` is unwrapped automatically).
 */
export function useOverlayTarget(rootRef: Ref<ElementLike>): OverlayTarget {
  const target = ref<HTMLElement>(document.body);
  function resolve(): void {
    const body = toElement(rootRef.value)?.ownerDocument.body;
    target.value = body ?? document.body;
  }
  return { target, resolve };
}
