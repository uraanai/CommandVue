import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { isModalCapturing, popModalCapture, pushModalCapture } from "@/modules/shortcuts/modalGate";

/** Dispatch a bare Escape keydown on window (a registered shortcut → tool.deactivate). */
function pressEscape(): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
}

describe("useKeyboardShortcuts × modal gate", () => {
  let scope: ReturnType<typeof effectScope> | null = null;

  afterEach(() => {
    scope?.stop();
    scope = null;
    // Defensively drain the global gate so a failed assertion can't leak across tests.
    while (isModalCapturing()) popModalCapture();
  });

  it("dispatches a matching shortcut when no modal is capturing", () => {
    const onAction = vi.fn();
    scope = effectScope();
    scope.run(() => useKeyboardShortcuts({ onAction }));

    pressEscape();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("suppresses shortcuts while a modal is capturing the keyboard, then resumes", () => {
    const onAction = vi.fn();
    scope = effectScope();
    scope.run(() => useKeyboardShortcuts({ onAction }));

    pushModalCapture();
    pressEscape();
    expect(onAction).not.toHaveBeenCalled();

    popModalCapture();
    pressEscape();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("only resumes once the LAST overlapping modal pops (counter, not boolean)", () => {
    const onAction = vi.fn();
    scope = effectScope();
    scope.run(() => useKeyboardShortcuts({ onAction }));

    pushModalCapture();
    pushModalCapture();
    popModalCapture();
    pressEscape();
    expect(onAction).not.toHaveBeenCalled(); // one modal still open

    popModalCapture();
    pressEscape();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
