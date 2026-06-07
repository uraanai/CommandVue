import { describe, expect, it } from "vitest";

import { ALL_KNOWN_TOKEN_NAMES } from "@/modules/themes/knownTokens";
import {
  getTokenManifestEntry,
  populatedSections,
  TOKEN_MANIFEST,
  TOKEN_MANIFEST_LIST,
  TOKEN_SECTION_LABELS,
  TOKEN_SECTIONS,
  tokenEntriesForSection,
  type TokenKind,
} from "@/modules/themes/tokenManifest";

const KIND_SET = new Set<TokenKind>([
  "color",
  "length",
  "number",
  "font-stack",
  "shadow",
  "duration",
]);

describe("tokenManifest (C1 drift guard)", () => {
  it("covers exactly ALL_KNOWN_TOKEN_NAMES — no orphan entries, no un-annotated tokens", () => {
    // Set-equality, NO numeric literal: auto-tracks any future knownTokens growth.
    expect(new Set(Object.keys(TOKEN_MANIFEST))).toEqual(new Set(ALL_KNOWN_TOKEN_NAMES));
  });

  it("list/record parity: same length, unique names, all present in the record", () => {
    expect(TOKEN_MANIFEST_LIST.length).toBe(ALL_KNOWN_TOKEN_NAMES.length);
    const names = TOKEN_MANIFEST_LIST.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length); // unique
    for (const e of TOKEN_MANIFEST_LIST) expect(TOKEN_MANIFEST[e.name]).toBe(e);
  });

  it("every kind is valid; the dormant `duration` kind has zero entries", () => {
    for (const e of TOKEN_MANIFEST_LIST) expect(KIND_SET.has(e.kind)).toBe(true);
    expect(TOKEN_MANIFEST_LIST.filter((e) => e.kind === "duration")).toHaveLength(0);
  });

  it("every section is valid and labelled", () => {
    const sectionSet = new Set<string>(TOKEN_SECTIONS);
    for (const e of TOKEN_MANIFEST_LIST) expect(sectionSet.has(e.section)).toBe(true);
    for (const s of TOKEN_SECTIONS) expect(TOKEN_SECTION_LABELS[s].length).toBeGreaterThan(0);
  });

  it("populatedSections() is a subsequence of TOKEN_SECTIONS (same relative order)", () => {
    const populated = populatedSections();
    let i = 0;
    for (const s of TOKEN_SECTIONS) {
      if (s === populated[i]) i++;
    }
    expect(i).toBe(populated.length);
  });

  it("contrastAgainst is a valid, distinct, color partner on a color entry", () => {
    for (const e of TOKEN_MANIFEST_LIST) {
      if (e.contrastAgainst === undefined) continue;
      expect(ALL_KNOWN_TOKEN_NAMES).toContain(e.contrastAgainst); // (a) known token
      expect(TOKEN_MANIFEST[e.contrastAgainst].kind).toBe("color"); // (b) partner is color
      expect(e.contrastAgainst).not.toBe(e.name); // (c) not itself
      expect(e.kind).toBe("color"); // (d) the entry itself is color
    }
  });

  it("every label is a non-empty trimmed string, <= 40 chars", () => {
    for (const e of TOKEN_MANIFEST_LIST) {
      expect(e.label).toBe(e.label.trim());
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.label.length).toBeLessThanOrEqual(40);
    }
  });

  it("all 9 density tokens are length + section density", () => {
    const density = tokenEntriesForSection("density");
    expect(density).toHaveLength(9);
    for (const e of density) expect(e.kind).toBe("length");
  });

  it("accessors resolve known + reject unknown", () => {
    expect(getTokenManifestEntry("--color-interactive")?.kind).toBe("color");
    expect(getTokenManifestEntry("__nope__")).toBeUndefined();
    const status = tokenEntriesForSection("status").map((e) => e.name);
    expect(status).toContain("--color-toast-bg");
    expect(status).toContain("--color-status-success");
  });
});
