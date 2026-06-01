import { describe, expect, it } from "vitest";

import {
  FLOAT_PREV_HEADERLESS_KEY,
  floatWasHeaderless,
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
