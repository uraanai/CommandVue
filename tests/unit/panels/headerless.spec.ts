import { describe, expect, it } from "vitest";

import { HEADERLESS_KEY, isHeaderless, withHeaderless } from "@/modules/panels/headerless";

describe("headerless helper", () => {
  it("HEADERLESS_KEY is the single magic-string", () => {
    expect(HEADERLESS_KEY).toBe("headerless");
  });

  it("isHeaderless is false for missing / undefined state", () => {
    expect(isHeaderless(undefined)).toBe(false);
    expect(isHeaderless({})).toBe(false);
    expect(isHeaderless({ other: 1 })).toBe(false);
  });

  it("isHeaderless is true only when the flag is strictly true", () => {
    expect(isHeaderless({ headerless: true })).toBe(true);
    expect(isHeaderless({ headerless: false })).toBe(false);
    expect(isHeaderless({ headerless: "yes" })).toBe(false);
  });

  it("withHeaderless(state, true) sets the flag without mutating the input", () => {
    const input = { foo: 1 };
    const next = withHeaderless(input, true);
    expect(next).toEqual({ foo: 1, headerless: true });
    expect(input).toEqual({ foo: 1 });
  });

  it("withHeaderless(state, false) removes the flag", () => {
    const next = withHeaderless({ foo: 1, headerless: true }, false);
    expect(next).toEqual({ foo: 1 });
    expect("headerless" in next).toBe(false);
  });

  it("withHeaderless tolerates undefined state", () => {
    expect(withHeaderless(undefined, true)).toEqual({ headerless: true });
  });
});
