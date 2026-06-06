import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { CURATED_OFFLINE_FAMILIES } from "@/composables/useFontLoader";
import {
  __clearCatalogCacheForTests,
  curatedOfflineFamilies,
  getCatalogEntry,
  loadFontCatalog,
  searchFamilies,
} from "@/modules/themes/fontCatalog";

beforeEach(() => __clearCatalogCacheForTests());

/** "Source Sans 3" → "source-sans-3" (the @fontsource package slug). */
function slug(family: string): string {
  return family.toLowerCase().replace(/\s+/g, "-");
}

describe("fontCatalog", () => {
  it("lazily loads the bundled snapshot", async () => {
    const cat = await loadFontCatalog();
    expect(cat.version).toBeGreaterThanOrEqual(1);
    expect(cat.families.length).toBeGreaterThan(50);
  });

  it("indexes by exact (trimmed) family name", async () => {
    expect((await getCatalogEntry("Roboto"))?.category).toBe("sans-serif");
    expect((await getCatalogEntry("  Roboto  "))?.family).toBe("Roboto");
    expect(await getCatalogEntry("Nonexistent Font")).toBeUndefined();
  });

  it("searchFamilies fuzzy-matches by name; empty query lists up to the limit", async () => {
    const r = await searchFamilies("robo", 10);
    expect(r.some((e) => e.family === "Roboto")).toBe(true);
    expect((await searchFamilies("", 5)).length).toBe(5);
  });

  it("curatedOfflineFamilies set-equals CURATED_OFFLINE_FAMILIES (hardcoded-set ↔ catalog drift guard)", async () => {
    const curated = await curatedOfflineFamilies();
    for (const e of curated) expect(e.offline).toBe(true);
    expect(new Set(curated.map((e) => e.family))).toEqual(new Set(CURATED_OFFLINE_FAMILIES));
  });

  it("every curated family except Inter has a @fontsource face in local-fonts.css", () => {
    const css = readFileSync(resolve(process.cwd(), "src/assets/fonts/local-fonts.css"), "utf8");
    for (const family of CURATED_OFFLINE_FAMILIES) {
      if (family === "Inter") {
        // Inter ships via @fontsource-variable/inter; must NOT be redeclared here.
        expect(css).not.toContain("@fontsource/inter/");
        continue;
      }
      expect(css).toContain(`@fontsource/${slug(family)}/`);
    }
  });
});
