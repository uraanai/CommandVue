import { describe, expect, it } from "vitest";

import { STUDIO_L1_TABS } from "@/components/panels/theme-studio/studioTabs";

describe("STUDIO_L1_TABS (C6 IA lock)", () => {
  it("has exactly the 5 locked tabs in order", () => {
    expect(STUDIO_L1_TABS.map((t) => t.id)).toEqual([
      "generate",
      "tokens",
      "typography",
      "panels",
      "effects",
    ]);
  });

  it("has unique ids and non-empty labels", () => {
    const ids = STUDIO_L1_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of STUDIO_L1_TABS) expect(t.label.length).toBeGreaterThan(0);
  });
});
