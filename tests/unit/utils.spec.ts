import type { Lonlat } from "@/types";

import { describe, expect, it } from "vitest";

/**
 * Placeholder smoke test. Real utility coverage is added in Phase 6 alongside
 * `@/utils/id.ts`, `@/utils/format.ts`, `@/utils/search.ts`, and `@/utils/cn.ts`.
 */
describe("scaffolding sanity", () => {
  it("runs the Vitest harness", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves shared type aliases via the @/* path alias", () => {
    const point: Lonlat = [70, 30];
    expect(point[0]).toBe(70);
    expect(point[1]).toBe(30);
  });
});
