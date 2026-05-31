import { describe, expect, it } from "vitest";

import { tabbedPaneControls } from "@/components/layout/dock/tabbedPaneControls";

describe("tabbedPaneControls", () => {
  it("emits close, close-others, hide-header and maximize controls in order", () => {
    const ids = tabbedPaneControls({
      totalPanels: 3,
      panelsInGroup: 2,
      isMaximized: false,
    }).map((c) => c.id);
    expect(ids).toEqual(["close", "close-others", "hide-header", "maximize"]);
  });

  it("disables Close when it would empty the workspace", () => {
    const close = tabbedPaneControls({
      totalPanels: 1,
      panelsInGroup: 1,
      isMaximized: false,
    }).find((c) => c.id === "close")!;
    expect(close.disabled).toBe(true);
    expect(
      tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1, isMaximized: false }).find(
        (c) => c.id === "close",
      )!.disabled,
    ).toBe(false);
  });

  it("disables Close others when the group has one panel", () => {
    const single = tabbedPaneControls({
      totalPanels: 3,
      panelsInGroup: 1,
      isMaximized: false,
    }).find((c) => c.id === "close-others")!;
    expect(single.disabled).toBe(true);
    const many = tabbedPaneControls({
      totalPanels: 3,
      panelsInGroup: 2,
      isMaximized: false,
    }).find((c) => c.id === "close-others")!;
    expect(many.disabled).toBe(false);
  });

  it("flips the maximize control label + icon on isMaximized", () => {
    const off = tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1, isMaximized: false }).find(
      (c) => c.id === "maximize",
    )!;
    expect(off.label).toBe("Maximize");
    expect(off.icon).toBe("Maximize2");
    const on = tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1, isMaximized: true }).find(
      (c) => c.id === "maximize",
    )!;
    expect(on.label).toBe("Restore");
    expect(on.icon).toBe("Minimize2");
  });

  it("labels hide-header constant (tabbed groups always offer Hide header)", () => {
    const hide = tabbedPaneControls({
      totalPanels: 2,
      panelsInGroup: 1,
      isMaximized: false,
    }).find((c) => c.id === "hide-header")!;
    expect(hide.label).toBe("Hide header");
    expect(hide.icon).toBe("PanelTopClose");
  });
});
