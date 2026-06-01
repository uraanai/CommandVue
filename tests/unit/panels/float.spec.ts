import { describe, expect, it } from "vitest";

import {
  FLOAT_ALPHA_KEY,
  FLOAT_PREV_HEADERLESS_KEY,
  floatWasHeaderless,
  getFloatAlpha,
  withFloatAlpha,
  withFloatPrevHeaderless,
} from "@/modules/panels/float";

describe("float lifecycle state", () => {
  it("floatWasHeaderless reads the persisted flag", () => {
    expect(floatWasHeaderless(undefined)).toBe(false);
    expect(floatWasHeaderless({})).toBe(false);
    expect(floatWasHeaderless({ [FLOAT_PREV_HEADERLESS_KEY]: true })).toBe(true);
    expect(floatWasHeaderless({ [FLOAT_PREV_HEADERLESS_KEY]: false })).toBe(false);
  });

  it("withFloatPrevHeaderless sets the flag and preserves other keys", () => {
    const next = withFloatPrevHeaderless({ headerless: true }, true);
    expect(next).toEqual({ headerless: true, [FLOAT_PREV_HEADERLESS_KEY]: true });
  });

  it("withFloatPrevHeaderless omits the key when false (default)", () => {
    const next = withFloatPrevHeaderless({ [FLOAT_PREV_HEADERLESS_KEY]: true, other: 1 }, false);
    expect(next).toEqual({ other: 1 });
    expect(FLOAT_PREV_HEADERLESS_KEY in next).toBe(false);
  });

  it("does not mutate the input state", () => {
    const input = { [FLOAT_PREV_HEADERLESS_KEY]: true };
    withFloatPrevHeaderless(input, false);
    expect(input).toEqual({ [FLOAT_PREV_HEADERLESS_KEY]: true });
  });
});

describe("float opacity state", () => {
  it("getFloatAlpha defaults to 1 (solid) and reads valid [0,1] values", () => {
    expect(getFloatAlpha(undefined)).toBe(1);
    expect(getFloatAlpha({})).toBe(1);
    expect(getFloatAlpha({ [FLOAT_ALPHA_KEY]: 0.4 })).toBe(0.4);
    expect(getFloatAlpha({ [FLOAT_ALPHA_KEY]: 0 })).toBe(0);
    // Out-of-range or wrong type falls back to the solid default.
    expect(getFloatAlpha({ [FLOAT_ALPHA_KEY]: 2 })).toBe(1);
    expect(getFloatAlpha({ [FLOAT_ALPHA_KEY]: "x" })).toBe(1);
  });

  it("withFloatAlpha stores a clamped value and omits the solid default", () => {
    expect(withFloatAlpha({}, 0.4)).toEqual({ [FLOAT_ALPHA_KEY]: 0.4 });
    expect(withFloatAlpha({}, -0.5)).toEqual({ [FLOAT_ALPHA_KEY]: 0 }); // clamped to 0
    expect(withFloatAlpha({ [FLOAT_ALPHA_KEY]: 0.4 }, 1)).toEqual({}); // solid -> key omitted
    expect(withFloatAlpha({ [FLOAT_ALPHA_KEY]: 0.4 }, 1.5)).toEqual({}); // clamps to 1 -> omitted
  });

  it("withFloatAlpha preserves other keys and does not mutate input", () => {
    const input = { [FLOAT_PREV_HEADERLESS_KEY]: true };
    const next = withFloatAlpha(input, 0.5);
    expect(next).toEqual({ [FLOAT_PREV_HEADERLESS_KEY]: true, [FLOAT_ALPHA_KEY]: 0.5 });
    expect(input).toEqual({ [FLOAT_PREV_HEADERLESS_KEY]: true });
  });
});
