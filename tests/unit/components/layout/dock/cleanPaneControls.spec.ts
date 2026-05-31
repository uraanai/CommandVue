import { describe, expect, it } from "vitest";

import { cleanPaneControls } from "@/components/layout/dock/cleanPaneControls";

describe("cleanPaneControls", () => {
  it("a clean pane shows Show-header, Split, and Close", () => {
    const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 3 });
    expect(ctrl.map((c) => c.id)).toEqual(["toggle-header", "split", "close"]);
    const toggle = ctrl.find((c) => c.id === "toggle-header")!;
    expect(toggle.label).toBe("Show header");
    expect(toggle.icon).toBe("PanelTop");
  });

  it("a tabbed pane shows Hide-header instead of Show-header", () => {
    const ctrl = cleanPaneControls({ isHeaderless: false, totalPanels: 3 });
    const toggle = ctrl.find((c) => c.id === "toggle-header")!;
    expect(toggle.label).toBe("Hide header");
    expect(toggle.icon).toBe("PanelTopClose");
  });

  it("the Split control uses the SquareSplitHorizontal icon", () => {
    const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 3 });
    const split = ctrl.find((c) => c.id === "split")!;
    expect(split.icon).toBe("SquareSplitHorizontal");
    expect(split.disabled).toBe(false);
  });

  it("Close is disabled when it is the last pane (empty-workspace guard)", () => {
    const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 1 });
    const close = ctrl.find((c) => c.id === "close")!;
    expect(close.disabled).toBe(true);
  });

  it("Close is enabled when more than one pane exists", () => {
    const ctrl = cleanPaneControls({ isHeaderless: true, totalPanels: 2 });
    const close = ctrl.find((c) => c.id === "close")!;
    expect(close.disabled).toBe(false);
  });
});
