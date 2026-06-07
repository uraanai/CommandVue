import { describe, expect, it } from "vitest";

import { floatPaneControl } from "@/components/layout/dock/floatPaneControls";

describe("floatPaneControl", () => {
  it("a grid pane offers Float window, enabled", () => {
    const c = floatPaneControl({ location: "grid" });
    expect(c.id).toBe("float");
    expect(c.label).toBe("Float window");
    expect(c.icon).toBe("PictureInPicture2");
    expect(c.disabled).toBe(false);
  });

  it("a floating pane offers Dock back, enabled", () => {
    const c = floatPaneControl({ location: "floating" });
    expect(c.id).toBe("dock-back");
    expect(c.label).toBe("Dock back");
    expect(c.icon).toBe("PinOff");
    expect(c.disabled).toBe(false);
  });

  it("disables Float window off-grid (popout / edge)", () => {
    expect(floatPaneControl({ location: "popout" }).disabled).toBe(true);
    expect(floatPaneControl({ location: "popout" }).id).toBe("float");
    expect(floatPaneControl({ location: "edge" }).disabled).toBe(true);
  });
});
