import { ref } from "vue";

/**
 * Global "a modal/confirm owns the keyboard" gate.
 *
 * While the count is > 0, the keyboard-shortcut binder (`useKeyboardShortcuts`)
 * skips ALL combos, so an open modal's keys — Escape especially — belong to the
 * modal and never reach global shortcuts like `tool.deactivate`.
 *
 * Why a gate instead of `stopPropagation` in the modal: the shortcut listener
 * and a modal's own keydown listener both sit on `window` in the CAPTURE phase,
 * and the shortcut one is registered first (at app start). `stopPropagation` /
 * `stopImmediatePropagation` only affect listeners reached AFTER the current one
 * on the same target — they cannot suppress an earlier-registered same-target
 * listener. So a modal opts the keyboard out via this shared counter instead.
 *
 * Overlays push on open and pop on close (and on unmount as a backstop). It is a
 * counter, not a boolean, so nested/overlapping modals compose correctly.
 */
const openModalCount = ref(0);

export function pushModalCapture(): void {
  openModalCount.value += 1;
}

export function popModalCapture(): void {
  openModalCount.value = Math.max(0, openModalCount.value - 1);
}

export function isModalCapturing(): boolean {
  return openModalCount.value > 0;
}
