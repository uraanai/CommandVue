import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Pinia bootstrap smoke test. Real store coverage is added in Phase 4 (layout,
 * ui) and Phase 6 (entities, telemetry, connection).
 */
describe("pinia bootstrap", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("creates and activates a Pinia instance without throwing", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    expect(pinia).toBeTruthy();
  });
});
