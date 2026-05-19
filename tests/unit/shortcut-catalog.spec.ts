import { describe, expect, it } from "vitest";

import { findShortcutForAction, formatCombo, SHORTCUTS } from "@/modules/shortcuts/catalog";

describe("shortcut catalog", () => {
  it("declares at least one shortcut for the palette and each built-in tool", () => {
    expect(findShortcutForAction("palette.open")).toBeDefined();
    expect(findShortcutForAction("tool.deactivate")).toBeDefined();
    expect(findShortcutForAction("tool.measure-distance")).toBeDefined();
    expect(findShortcutForAction("tool.draw-polygon")).toBeDefined();
  });

  it("every entry has at least one key combo", () => {
    for (const s of SHORTCUTS) {
      expect(s.keys.length).toBeGreaterThan(0);
    }
  });

  it("uses the platform-conditional `mod` token only for global shortcuts", () => {
    for (const s of SHORTCUTS) {
      const hasMod = s.keys.some((k) => k.toLowerCase().includes("mod"));
      if (hasMod) {
        expect(s.scope).toBe("global");
      }
    }
  });

  describe("formatCombo", () => {
    it("uses Ctrl+K style on non-Mac", () => {
      expect(formatCombo("mod+k", false)).toBe("Ctrl+K");
    });

    it("uses ⌘K style on Mac (no separator)", () => {
      expect(formatCombo("mod+k", true)).toBe("⌘K");
    });

    it("renders single-letter keys uppercase", () => {
      expect(formatCombo("m", false)).toBe("M");
      expect(formatCombo("p", false)).toBe("P");
    });

    it("normalizes Escape and Enter as Esc / ↵", () => {
      expect(formatCombo("escape", false)).toBe("Esc");
      expect(formatCombo("enter", false)).toBe("↵");
    });
  });
});
