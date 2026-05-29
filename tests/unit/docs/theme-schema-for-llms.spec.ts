import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isKnownToken } from "@/modules/themes/knownTokens";

/**
 * Guards the LLM-facing theme schema doc against drift. The doc tells an LLM
 * which token keys are legal and shows an example envelope; if either falls
 * out of sync with `knownTokens.ts` / the real schema, LLM-generated themes
 * start failing import. These checks keep the doc honest.
 */

// Resolve from the repo root (vitest's cwd) rather than import.meta.url —
// the jsdom test environment doesn't expose a `file:` URL, so fileURLToPath
// would throw "The URL must be of scheme file".
const docPath = resolve(process.cwd(), "docs/theme-schema-for-llms.md");
const doc = readFileSync(docPath, "utf8");

describe("docs/theme-schema-for-llms.md", () => {
  it("has balanced ``` code fences", () => {
    const fenceCount = (doc.match(/```/g) ?? []).length;
    expect(fenceCount % 2, "every opening fence needs a closing fence").toBe(0);
  });

  it("only references token keys that are in the known-token allowlist", () => {
    // Every `--color-*` / `--font-*` style token mentioned anywhere in the doc
    // must be a real overridable token, or an LLM following the doc produces
    // themes the importer rejects.
    const mentioned = new Set(doc.match(/--[a-z][a-z0-9-]+/g) ?? []);
    const unknown = [...mentioned]
      // Drop wildcard stubs like `--color-p-surface-` / `--density-` that the
      // doc uses in prose to refer to a whole scale — real tokens never end
      // in a hyphen, so this can't mask a genuinely wrong key.
      .filter((t) => !t.endsWith("-"))
      .filter((t) => !isKnownToken(t));
    expect(unknown, `doc references unknown tokens: ${unknown.join(", ")}`).toEqual([]);
  });

  it("documents at least the core semantic surface + text + interactive tokens", () => {
    for (const required of [
      "--color-surface-base",
      "--color-text-primary",
      "--color-interactive",
      "--color-on-interactive",
      "--color-status-success",
    ]) {
      expect(doc.includes(required), `doc should mention ${required}`).toBe(true);
    }
  });

  it("the example envelope is valid, parseable JSON with the right shape", () => {
    // Pull the first ```json block (the envelope example) and parse it.
    const match = doc.match(/```json\n([\s\S]*?)```/);
    expect(match, "doc should contain a ```json envelope example").toBeTruthy();
    const jsonBlock = match?.[1] ?? "";
    const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.exportedBy).toBe("commandvue");
    const theme = parsed.theme as Record<string, unknown>;
    expect(theme).toBeTruthy();
    expect(typeof theme.tokens).toBe("object");
    // Every token key in the example must be a known token.
    for (const key of Object.keys(theme.tokens as Record<string, string>)) {
      expect(isKnownToken(key), `example token ${key} must be known`).toBe(true);
    }
  });
});
