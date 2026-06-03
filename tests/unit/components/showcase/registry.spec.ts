import type { ShowcaseSource } from "@/components/showcase/registry";

import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SHOWCASE_EXCLUDE, SHOWCASE_PRIMITIVES } from "@/components/showcase/registry";

/**
 * Anti-drift guard for the Component Showcase (Track A — A-Showcase). Every
 * primitive under `src/components/ui` and `src/volt` must be either showcased
 * (in `SHOWCASE_PRIMITIVES`) or explicitly excluded (in `SHOWCASE_EXCLUDE`).
 * A new primitive with no entry — or a stale entry whose file was deleted —
 * fails here, so the showcase can't silently fall out of sync with the library.
 *
 * Resolved from the repo root (vitest's cwd); the jsdom env has no `file:` URL.
 */
const DIRS: Record<ShowcaseSource, string> = {
  ui: resolve(process.cwd(), "src/components/ui"),
  volt: resolve(process.cwd(), "src/volt"),
};

const key = (e: { source: ShowcaseSource; id: string }): string => `${e.source}/${e.id}`;

/** Every `.vue` primitive file across both wrapper layers. */
function primitiveFiles(): { source: ShowcaseSource; id: string }[] {
  const out: { source: ShowcaseSource; id: string }[] = [];
  for (const source of ["ui", "volt"] as ShowcaseSource[]) {
    for (const file of readdirSync(DIRS[source])) {
      if (file.endsWith(".vue")) out.push({ source, id: file.replace(/\.vue$/, "") });
    }
  }
  return out;
}

describe("showcase registry coverage", () => {
  const files = primitiveFiles();
  const accountedFor = new Set([...SHOWCASE_PRIMITIVES, ...SHOWCASE_EXCLUDE].map(key));

  it("found primitive files in both wrapper layers (sanity)", () => {
    expect(files.some((f) => f.source === "ui")).toBe(true);
    expect(files.some((f) => f.source === "volt")).toBe(true);
  });

  it("every ui/ and volt/ primitive is showcased or explicitly excluded", () => {
    const missing = files.filter((f) => !accountedFor.has(key(f))).map(key);
    expect(
      missing,
      `add these to SHOWCASE_PRIMITIVES (or SHOWCASE_EXCLUDE with a reason): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("has no stale registry entries (every showcased entry has a file)", () => {
    const present = new Set(files.map(key));
    const stale = SHOWCASE_PRIMITIVES.filter((e) => !present.has(key(e))).map(key);
    expect(stale, `remove these stale SHOWCASE_PRIMITIVES entries: ${stale.join(", ")}`).toEqual(
      [],
    );
  });

  it("has no stale exclusions (every excluded entry has a file)", () => {
    const present = new Set(files.map(key));
    const stale = SHOWCASE_EXCLUDE.filter((e) => !present.has(key(e))).map(key);
    expect(stale, `remove these stale SHOWCASE_EXCLUDE entries: ${stale.join(", ")}`).toEqual([]);
  });

  it("never both showcases and excludes the same primitive", () => {
    const excluded = new Set(SHOWCASE_EXCLUDE.map(key));
    const both = SHOWCASE_PRIMITIVES.filter((e) => excluded.has(key(e))).map(key);
    expect(both).toEqual([]);
  });
});
