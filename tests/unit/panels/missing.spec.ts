import { beforeEach, describe, expect, it } from "vitest";

import {
  __unregisterMissingPanelForTests,
  MISSING_PANEL_TYPE,
  registerMissingPanel,
} from "@/modules/panels/missing";
import { panelRegistry } from "@/modules/panels/registry";

describe("MISSING_PANEL_TYPE registry", () => {
  beforeEach(() => {
    __unregisterMissingPanelForTests();
  });

  it("registers the synthetic missing-panel type", () => {
    registerMissingPanel();
    const def = panelRegistry.get(MISSING_PANEL_TYPE);
    expect(def).toBeDefined();
    expect(def?.id).toBe("__missing__");
    expect(def?.category).toBe("tools");
  });

  it("registration is idempotent", () => {
    registerMissingPanel();
    expect(() => registerMissingPanel()).not.toThrow();
  });

  it("uses underscore-prefixed id to prevent collision with user-registered types", () => {
    expect(MISSING_PANEL_TYPE.startsWith("__")).toBe(true);
  });
});
