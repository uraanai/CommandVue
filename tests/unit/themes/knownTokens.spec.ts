import { describe, expect, it } from "vitest";

import {
  ALL_KNOWN_TOKEN_NAMES,
  COMPONENT_TOKEN_NAMES,
  DENSITY_TOKEN_NAMES,
  isKnownToken,
  SEMANTIC_TOKEN_NAMES,
  THEMEABLE_PRIMITIVE_TOKEN_NAMES,
  TYPE_SCALE_LINE_HEIGHT_TOKEN_NAMES,
  TYPE_SCALE_TOKEN_NAMES,
} from "@/modules/themes/knownTokens";

describe("knownTokens registry", () => {
  it("declares each token in exactly one *_TOKEN_NAMES array (no duplicate ownership)", () => {
    // Guards the `--font-family-heading` double-declaration footgun: C2 owns it,
    // C3 must not re-add it. A name in two arrays would silently double-count.
    const dupes = ALL_KNOWN_TOKEN_NAMES.filter(
      (name, i) => ALL_KNOWN_TOKEN_NAMES.indexOf(name) !== i,
    );
    expect(dupes, `duplicated token names: ${[...new Set(dupes)].join(", ")}`).toEqual([]);
  });

  it("ALL_KNOWN_TOKEN_NAMES is the union of every source array", () => {
    const union = [
      ...SEMANTIC_TOKEN_NAMES,
      ...COMPONENT_TOKEN_NAMES,
      ...DENSITY_TOKEN_NAMES,
      ...THEMEABLE_PRIMITIVE_TOKEN_NAMES,
      ...TYPE_SCALE_TOKEN_NAMES,
      ...TYPE_SCALE_LINE_HEIGHT_TOKEN_NAMES,
    ];
    expect(new Set(ALL_KNOWN_TOKEN_NAMES)).toEqual(new Set(union));
  });

  it("recognises the C2 typography tokens (sizes, line-heights, heading role)", () => {
    expect(isKnownToken("--text-xs")).toBe(true);
    expect(isKnownToken("--text-4xl")).toBe(true);
    expect(isKnownToken("--text-base--line-height")).toBe(true);
    expect(isKnownToken("--text-4xl--line-height")).toBe(true);
    expect(isKnownToken("--font-family-heading")).toBe(true);
  });

  it("rejects names outside the allowlist", () => {
    expect(isKnownToken("--text-5xl")).toBe(false);
    expect(isKnownToken("--not-a-real-token")).toBe(false);
  });
});
