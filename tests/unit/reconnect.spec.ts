import { describe, expect, it } from "vitest";

import { calculateBackoff } from "@/modules/realtime/reconnect";

describe("realtime/reconnect", () => {
  it("attempt 0 returns at most baseMs with jitter", () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateBackoff(0, { baseMs: 1000, jitter: true });
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(1000);
    }
  });

  it("attempt 0 returns exactly baseMs without jitter", () => {
    expect(calculateBackoff(0, { baseMs: 1000, jitter: false })).toBe(1000);
  });

  it("doubles per attempt without jitter", () => {
    expect(calculateBackoff(0, { jitter: false })).toBe(1000);
    expect(calculateBackoff(1, { jitter: false })).toBe(2000);
    expect(calculateBackoff(2, { jitter: false })).toBe(4000);
    expect(calculateBackoff(3, { jitter: false })).toBe(8000);
  });

  it("caps at maxMs", () => {
    expect(calculateBackoff(100, { jitter: false })).toBe(30_000);
    expect(calculateBackoff(100, { jitter: false, maxMs: 5_000 })).toBe(5_000);
  });

  it("handles negative attempt as 0", () => {
    expect(calculateBackoff(-5, { jitter: false })).toBe(1000);
  });
});
