import type { Directive } from "vue";

/**
 * `v-horizontal-wheel` — translate a plain VERTICAL mouse wheel into HORIZONTAL
 * scroll over a one-line overflow strip (dockview-tab style), so the user doesn't
 * have to grab the scrollbar to scroll sideways. Shared by the scrollable Tabs
 * strip (`ui/Tabs.vue`) and the minimized dock tray (`MinimizedDock.vue`).
 *
 * The scrolled VIEWPORT is resolved per element:
 *  - if the directive's element has a `.tab-scroll-thin` descendant, that inner
 *    viewport is scrolled (the Tabs strip attaches the directive to the TabList
 *    root, but the actual scroll container is an inner element);
 *  - otherwise the element itself is scrolled when it overflows horizontally (the
 *    minimized tray attaches the directive directly to its `overflow-x-auto` row).
 *
 * Behavior: only acts on a predominantly-VERTICAL wheel (a genuine horizontal wheel
 * / trackpad swipe is left to the native `overflow-x`); RELEASES at the start/end
 * edge so over-scroll falls through to the page; normalizes Firefox line/page wheel
 * modes; scrolls INSTANTLY (not smooth) for a crisp feel. The listener is NON-passive
 * — it must be able to `preventDefault` the page scroll. No-op when nothing overflows,
 * so it's safe to attach unconditionally.
 */
const handlers = new WeakMap<HTMLElement, (e: WheelEvent) => void>();

function viewportFor(el: HTMLElement): HTMLElement | null {
  const inner = el.querySelector<HTMLElement>(".tab-scroll-thin");
  if (inner) return inner;
  return el.scrollWidth > el.clientWidth ? el : null;
}

export const vHorizontalWheel: Directive<HTMLElement> = {
  mounted(el) {
    const onWheel = (e: WheelEvent): void => {
      const vp = viewportFor(el);
      if (!vp || vp.scrollWidth <= vp.clientWidth) return;
      // Horizontal-dominant intent (tilt wheel / trackpad) → let native scroll it.
      if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      let delta = e.deltaY;
      if (e.deltaMode === 1)
        delta *= 16; // lines → px (Firefox line mode)
      else if (e.deltaMode === 2) delta *= vp.clientWidth; // pages
      const atStart = vp.scrollLeft <= 0;
      const atEnd = Math.ceil(vp.scrollLeft + vp.clientWidth) >= vp.scrollWidth;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return; // release at edges
      vp.scrollBy({ left: delta, behavior: "instant" });
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    handlers.set(el, onWheel);
  },
  unmounted(el) {
    const onWheel = handlers.get(el);
    if (onWheel) {
      el.removeEventListener("wheel", onWheel);
      handlers.delete(el);
    }
  },
};
