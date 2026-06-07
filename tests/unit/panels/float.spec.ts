import { describe, expect, it } from "vitest";

import {
  FLOAT_ALPHA_KEY,
  FLOAT_MAXIMIZED_KEY,
  FLOAT_PREV_BOX_KEY,
  FLOAT_PREV_HEADERLESS_KEY,
  floatWasHeaderless,
  getFloatAlpha,
  getFloatMaximized,
  getFloatPrevBox,
  withFloatAlpha,
  withFloatMaximized,
  withFloatPrevBox,
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

describe("float maximize state", () => {
  const box = { top: 0, left: 0, width: 1000, height: 800 };

  it("getFloatMaximized reads the flag (default false)", () => {
    expect(getFloatMaximized(undefined)).toBe(false);
    expect(getFloatMaximized({})).toBe(false);
    expect(getFloatMaximized({ [FLOAT_MAXIMIZED_KEY]: true })).toBe(true);
    expect(getFloatMaximized({ [FLOAT_MAXIMIZED_KEY]: false })).toBe(false);
  });

  it("withFloatMaximized sets the flag and omits it when false (default)", () => {
    expect(withFloatMaximized({ other: 1 }, true)).toEqual({
      other: 1,
      [FLOAT_MAXIMIZED_KEY]: true,
    });
    expect(withFloatMaximized({ [FLOAT_MAXIMIZED_KEY]: true, other: 1 }, false)).toEqual({
      other: 1,
    });
  });

  it("getFloatPrevBox reads a valid box and rejects malformed values", () => {
    expect(getFloatPrevBox(undefined)).toBeUndefined();
    expect(getFloatPrevBox({ [FLOAT_PREV_BOX_KEY]: box })).toEqual(box);
    // Missing width/height → not a box.
    expect(getFloatPrevBox({ [FLOAT_PREV_BOX_KEY]: { top: 0, left: 0 } })).toBeUndefined();
    expect(getFloatPrevBox({ [FLOAT_PREV_BOX_KEY]: "nope" })).toBeUndefined();
  });

  it("withFloatPrevBox stores a box and clears it when undefined", () => {
    expect(withFloatPrevBox({}, box)).toEqual({ [FLOAT_PREV_BOX_KEY]: box });
    expect(withFloatPrevBox({ [FLOAT_PREV_BOX_KEY]: box, other: 1 }, undefined)).toEqual({
      other: 1,
    });
  });

  it("does not mutate the input state", () => {
    const input = { [FLOAT_MAXIMIZED_KEY]: true, [FLOAT_PREV_BOX_KEY]: box };
    withFloatMaximized(input, false);
    withFloatPrevBox(input, undefined);
    expect(input).toEqual({ [FLOAT_MAXIMIZED_KEY]: true, [FLOAT_PREV_BOX_KEY]: box });
  });
});
