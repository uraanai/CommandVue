import { describe, expect, it } from "vitest";

import { tabbedPaneControls } from "@/components/layout/dock/tabbedPaneControls";

describe("tabbedPaneControls", () => {
  it("returns close, close-others and hide-header controls in order", () => {
    const ids = tabbedPaneControls({ totalPanels: 3, panelsInGroup: 2 }).map((c) => c.id);
    expect(ids).toEqual(["close", "close-others", "hide-header"]);
  });

  it("disables Close when it would empty the workspace", () => {
    const close = tabbedPaneControls({ totalPanels: 1, panelsInGroup: 1 }).find(
      (c) => c.id === "close",
    )!;
    expect(close.disabled).toBe(true);
    const enabled = tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1 }).find(
      (c) => c.id === "close",
    )!;
    expect(enabled.disabled).toBe(false);
  });

  it("disables Close others when the group has one panel", () => {
    const single = tabbedPaneControls({ totalPanels: 3, panelsInGroup: 1 }).find(
      (c) => c.id === "close-others",
    )!;
    expect(single.disabled).toBe(true);
    const many = tabbedPaneControls({ totalPanels: 3, panelsInGroup: 2 }).find(
      (c) => c.id === "close-others",
    )!;
    expect(many.disabled).toBe(false);
  });

  it("labels hide-header constant (tabbed groups always offer Hide header)", () => {
    const hide = tabbedPaneControls({ totalPanels: 2, panelsInGroup: 1 }).find(
      (c) => c.id === "hide-header",
    )!;
    expect(hide.label).toBe("Hide header");
    expect(hide.icon).toBe("PanelTopClose");
  });
});
