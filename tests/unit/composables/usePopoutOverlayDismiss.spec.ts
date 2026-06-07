import { describe, expect, it, vi } from "vitest";
import { shallowRef } from "vue";

import { usePopoutOverlayDismiss } from "@/composables/usePopoutOverlayDismiss";

/** Minimal stand-in for a pop-out Window that records + replays its listeners. */
function makeFakeWindow() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: vi.fn((type: string, cb: EventListener) => {
      let set = listeners.get(type);
      if (!set) listeners.set(type, (set = new Set()));
      set.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: EventListener) => {
      listeners.get(type)?.delete(cb);
    }),
    fire(type: string, event: Partial<Event>) {
      listeners.get(type)?.forEach((cb) => cb(event as Event));
    },
  };
}

/** A PrimeVue-overlay-instance shape whose owning window is `win`. shallowRef so
 *  the nested $el/overlay keep their identity (template refs hold raw nodes). */
function makeInstance(win: unknown, overlayVisible = true) {
  const $el = { ownerDocument: { defaultView: win } } as unknown as HTMLElement;
  const overlay = {} as unknown as HTMLElement;
  const hide = vi.fn();
  return { $el, overlay, hide, ref: shallowRef({ $el, overlay, overlayVisible, hide }) };
}

describe("usePopoutOverlayDismiss", () => {
  it("arms a pointer listener on the pop-out window and hides on an outside click", () => {
    const win = makeFakeWindow();
    const inst = makeInstance(win);
    const { onShow } = usePopoutOverlayDismiss(inst.ref);

    onShow();
    expect(win.addEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);

    win.fire("pointerdown", { composedPath: () => [] }); // outside trigger + overlay
    expect(inst.hide).toHaveBeenCalledTimes(1);
  });

  it("does not hide when the click is inside the trigger or the overlay", () => {
    const win = makeFakeWindow();
    const inst = makeInstance(win);
    usePopoutOverlayDismiss(inst.ref).onShow();

    win.fire("pointerdown", { composedPath: () => [inst.$el] });
    win.fire("pointerdown", { composedPath: () => [inst.overlay] });
    expect(inst.hide).not.toHaveBeenCalled();
  });

  it("unbinds the listener on hide", () => {
    const win = makeFakeWindow();
    const inst = makeInstance(win);
    const { onShow, onHide } = usePopoutOverlayDismiss(inst.ref);

    onShow();
    onHide();
    expect(win.removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);

    win.fire("pointerdown", { composedPath: () => [] });
    expect(inst.hide).not.toHaveBeenCalled();
  });

  it("stays inert when docked (owning window === opener)", () => {
    const inst = makeInstance(window); // owning window is the opener
    const spy = vi.spyOn(window, "addEventListener");
    usePopoutOverlayDismiss(inst.ref).onShow();
    expect(spy).not.toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    spy.mockRestore();
  });
});
