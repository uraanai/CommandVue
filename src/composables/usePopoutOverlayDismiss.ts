/**
 * Pop-out outside-click dismissal for PrimeVue overlay components
 * (Select / MultiSelect / AutoComplete — Track B, pop-out interactive components).
 *
 * PrimeVue closes these overlays with a `document.addEventListener('click', …)`
 * where `document` is the module-global OPENER document — verified in primevue
 * 4.5.5 `select` / `multiselect` / `autocomplete` `bindOutsideClickListener`, and
 * not redirectable via any prop or PassThrough hook. When a dockview panel is
 * popped out, dockview moves the trigger + overlay into the CHILD window, so a
 * click there never reaches that listener: the overlay only closes when the
 * trigger itself is clicked again (PrimeVue's `onContainerClick` is a direct
 * `@click` on the trigger, which does live in the child window).
 *
 * Wire `onShow` / `onHide` to the component's `@show` / `@hide`. On show, when the
 * component currently lives in a pop-out window, this arms a capture-phase
 * `pointerdown` listener on THAT window and calls the component's own `hide()`
 * when the click lands outside the trigger (`$el`) and the overlay panel
 * (`overlay`) — the exact condition PrimeVue uses. Docked, PrimeVue's native
 * listener already works, so this stays inert (it only arms when the owning
 * window differs from the opener). It reuses the instance's own API; no patching.
 *
 * Mirrors the open-side fix in `useOverlayTarget`: read the owning window at open
 * time, because dockview's DOM relocation fires no reactive signal.
 */

import type { Ref } from "vue";

/** The slice of a PrimeVue overlay instance this composable relies on. */
interface OverlayInstance {
  $el?: HTMLElement;
  overlay?: HTMLElement | null;
  overlayVisible?: boolean;
  hide?: (isFocus?: boolean) => void;
}

export interface PopoutOverlayDismiss {
  /** Bind to the component's `@show`. */
  onShow: () => void;
  /** Bind to the component's `@hide`. */
  onHide: () => void;
}

/**
 * @param instanceRef a template ref pointing at the wrapped PrimeVue component
 *   instance (e.g. the `ref` already used for `useOverlayTarget`).
 */
export function usePopoutOverlayDismiss<T>(instanceRef: Ref<T>): PopoutOverlayDismiss {
  let boundWindow: Window | null = null;

  function onOutsidePointer(event: Event): void {
    const inst = instanceRef.value as unknown as OverlayInstance | null | undefined;
    if (!inst?.overlayVisible || !inst.overlay || !inst.$el) return;
    const path = event.composedPath();
    if (!path.includes(inst.$el) && !path.includes(inst.overlay)) inst.hide?.();
  }

  function onShow(): void {
    const inst = instanceRef.value as unknown as OverlayInstance | null | undefined;
    const win = inst?.$el?.ownerDocument.defaultView ?? null;
    // Only arm in a pop-out window — docked, PrimeVue's own listener handles it.
    if (!win || win === window) return;
    boundWindow = win;
    win.addEventListener("pointerdown", onOutsidePointer, true);
  }

  function onHide(): void {
    boundWindow?.removeEventListener("pointerdown", onOutsidePointer, true);
    boundWindow = null;
  }

  return { onShow, onHide };
}
