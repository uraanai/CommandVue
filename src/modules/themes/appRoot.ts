/**
 * The top window's root element, captured once at module load (Track A A2a).
 *
 * Theme preview/apply code must target THIS captured root, never the ambient
 * `document.documentElement`. The reason is the Theme Studio panel (A2a): when
 * it is popped out into a child browser window, its code runs in the child
 * realm whose ambient `document` is the *child's*. Writing draft tokens to the
 * child root would not recolor the main window or the other pop-outs. Writing
 * them to the captured **top-realm** root does — `usePopoutThemeSync`'s observer
 * mirrors the opener's `<html>` to every pop-out, so a single write fans out
 * everywhere.
 *
 * Captured at first import — which happens in the **opener (top) realm** during
 * app boot, because the theme store imports it and the store is instantiated long
 * before any pop-out window can exist (a pop-out requires a user-driven panel
 * drag). So `document.documentElement` here is always the top window's root, and
 * a later child-realm consumer (a popped-out Studio) gets that same captured root
 * rather than its own child `document`.
 */
export const APP_ROOT: HTMLElement = document.documentElement;
