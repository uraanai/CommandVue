import { describe, expect, it } from "vitest";

import { panelsThatWillClose } from "@/components/layout/dock/groupCloseControls";

describe("panelsThatWillClose", () => {
  it("closes every panel in the group when other panels exist elsewhere", () => {
    // group of 3, layout of 5 → other groups keep the layout alive → all 3 close.
    expect(panelsThatWillClose(3, 5)).toBe(3);
    expect(panelsThatWillClose(1, 4)).toBe(1);
  });

  it("keeps the last pane when the group is the whole layout (empty-workspace guard)", () => {
    // group of 3 IS the whole layout → guard leaves one → only 2 close.
    expect(panelsThatWillClose(3, 3)).toBe(2);
    expect(panelsThatWillClose(2, 2)).toBe(1);
  });

  it("is zero for a single-pane whole layout (Close All would be a no-op)", () => {
    expect(panelsThatWillClose(1, 1)).toBe(0);
  });

  it("never returns negative for degenerate/empty inputs", () => {
    expect(panelsThatWillClose(0, 0)).toBe(0);
  });
});
