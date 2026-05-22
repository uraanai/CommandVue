import type { ChromeItemDefinition } from "@/modules/chrome/types";
import type { ChromeSlot } from "@/types/chrome";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import {
  __unregisterBuiltinChromeItemsForTests,
  BUILTIN_CHROME_ITEMS,
  registerBuiltinChromeItems,
} from "@/modules/chrome/builtin";
import { chromeItemRegistry } from "@/modules/chrome/registry";

function stubDef(overrides: Partial<ChromeItemDefinition> = {}): ChromeItemDefinition {
  return {
    id: overrides.id ?? "test-item",
    title: overrides.title ?? "Test Item",
    description: overrides.description ?? "A test item.",
    icon: overrides.icon ?? "square",
    allowedSlots: overrides.allowedSlots ?? (["top-left"] as readonly ChromeSlot[]),
    component:
      overrides.component ?? (() => Promise.resolve(defineComponent({ render: () => h("div") }))),
    removable: overrides.removable ?? true,
    singleton: overrides.singleton ?? true,
    ...overrides,
  };
}

describe("chromeItemRegistry", () => {
  beforeEach(() => {
    chromeItemRegistry.__resetForTests();
  });

  it("registers a definition and returns it via get()", () => {
    const def = stubDef({ id: "a" });
    chromeItemRegistry.register(def);
    expect(chromeItemRegistry.get("a")).toBe(def);
  });

  it("re-registering an existing id throws", () => {
    chromeItemRegistry.register(stubDef({ id: "a" }));
    expect(() => chromeItemRegistry.register(stubDef({ id: "a" }))).toThrow(/already registered/);
  });

  it("unregister removes a removable item but refuses non-removable ones", () => {
    chromeItemRegistry.register(stubDef({ id: "removable", removable: true }));
    chromeItemRegistry.register(stubDef({ id: "anchor", removable: false }));
    chromeItemRegistry.unregister("removable");
    expect(chromeItemRegistry.get("removable")).toBeUndefined();
    expect(() => chromeItemRegistry.unregister("anchor")).toThrow(/not removable/);
    expect(chromeItemRegistry.get("anchor")).toBeDefined();
  });

  it("listForSlot filters by allowedSlots", () => {
    chromeItemRegistry.register(stubDef({ id: "top-only", allowedSlots: ["top-left"] }));
    chromeItemRegistry.register(
      stubDef({ id: "anywhere", allowedSlots: ["top-left", "status-right"] }),
    );
    expect(
      chromeItemRegistry
        .listForSlot("top-left")
        .map((d) => d.id)
        .sort(),
    ).toEqual(["anywhere", "top-only"]);
    expect(chromeItemRegistry.listForSlot("status-right").map((d) => d.id)).toEqual(["anywhere"]);
  });

  it("subscribe fires immediately and on each change", () => {
    const cb = vi.fn();
    const unsubscribe = chromeItemRegistry.subscribe(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    chromeItemRegistry.register(stubDef({ id: "a" }));
    expect(cb).toHaveBeenCalledTimes(2);
    unsubscribe();
    chromeItemRegistry.register(stubDef({ id: "b" }));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe("registerBuiltinChromeItems", () => {
  beforeEach(() => {
    __unregisterBuiltinChromeItemsForTests();
  });

  it("registers all nine built-in items", () => {
    registerBuiltinChromeItems();
    expect(chromeItemRegistry.list()).toHaveLength(BUILTIN_CHROME_ITEMS.length);
  });

  it("app-icon is registered with removable: false", () => {
    registerBuiltinChromeItems();
    const def = chromeItemRegistry.get("app-icon");
    expect(def?.removable).toBe(false);
    expect(def?.allowedSlots).toEqual(["top-left"]);
  });

  it("is idempotent — calling twice does not throw", () => {
    registerBuiltinChromeItems();
    expect(() => registerBuiltinChromeItems()).not.toThrow();
    expect(chromeItemRegistry.list()).toHaveLength(BUILTIN_CHROME_ITEMS.length);
  });
});
