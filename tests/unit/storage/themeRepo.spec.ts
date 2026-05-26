import type { CreateThemeInput } from "@/modules/storage/themeRepo";

import { beforeEach, describe, expect, it } from "vitest";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";
import { InvariantError } from "@/modules/storage/errors";
import { themeRepo } from "@/modules/storage/themeRepo";

import { resetStorage } from "./helpers";

function validInput(overrides: Partial<CreateThemeInput> = {}): CreateThemeInput {
  return {
    name: "My Theme",
    description: "A test theme",
    author: "tester",
    source: "user",
    mode: "light",
    density: "comfortable",
    tokens: {
      "--color-surface-base": "oklch(0.98 0.005 250)",
      "--color-text-primary": "oklch(0.2 0.04 264)",
    },
    ...overrides,
  };
}

describe("themeRepo", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("creates a theme with valid input, assigning a ULID + timestamps", async () => {
    const theme = await themeRepo.create(validInput());
    expect(theme.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(theme.createdAt).toBeTypeOf("number");
    expect(theme.updatedAt).toBe(theme.createdAt);
    const fetched = await themeRepo.getById(theme.id);
    expect(fetched?.name).toBe("My Theme");
  });

  it("rejects a duplicate name within the same source (case-insensitive)", async () => {
    await themeRepo.create(validInput({ name: "Brand" }));
    await expect(themeRepo.create(validInput({ name: "brand" }))).rejects.toBeInstanceOf(
      InvariantError,
    );
  });

  it("allows the same name across different sources", async () => {
    await themeRepo.create(validInput({ name: "Shared", source: "user" }));
    const imported = await themeRepo.create(validInput({ name: "Shared", source: "imported" }));
    expect(imported.source).toBe("imported");
  });

  it("rejects an unknown token name and lists it", async () => {
    const err = await themeRepo
      .create(validInput({ tokens: { "--color-not-a-token": "#fff" } }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvariantError);
    expect((err as InvariantError).message).toContain("--color-not-a-token");
  });

  it("rejects a <script> injection in a token value", async () => {
    await expect(
      themeRepo.create(
        validInput({ tokens: { "--color-surface-base": "<script>alert(1)</script>" } }),
      ),
    ).rejects.toBeInstanceOf(InvariantError);
  });

  it("rejects source 'built-in'", async () => {
    // `built-in` is a valid ThemeSource at the type level (built-ins are
    // Theme objects too) but the repo refuses to *store* them.
    await expect(themeRepo.create(validInput({ source: "built-in" }))).rejects.toBeInstanceOf(
      InvariantError,
    );
  });

  it("rejects a generated theme missing its generation block", async () => {
    await expect(themeRepo.create(validInput({ source: "generated" }))).rejects.toBeInstanceOf(
      InvariantError,
    );
  });

  it("accepts a generated theme with a valid generation block", async () => {
    const theme = await themeRepo.create(
      validInput({
        source: "generated",
        generation: {
          schemaVersion: 1,
          baseColor: "oklch(0.98 0.005 250)",
          accentColor: "oklch(0.55 0.15 250)",
          contrast: 50,
        },
      }),
    );
    expect(theme.generation?.contrast).toBe(50);
  });

  it("update touches updatedAt and keeps createdAt", async () => {
    const theme = await themeRepo.create(validInput());
    await new Promise((r) => setTimeout(r, 2));
    const updated = await themeRepo.update(theme.id, { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(updated.createdAt).toBe(theme.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(theme.createdAt);
  });

  it("delete removes the theme and any workspace binding pointing at it", async () => {
    const theme = await themeRepo.create(validInput());
    const bindingKey = `commandvue:workspace-theme-WORKSPACE123`;
    await appMetaRepo.set(bindingKey, theme.id);

    await themeRepo.delete(theme.id);

    expect(await themeRepo.getById(theme.id)).toBeNull();
    expect(await appMetaRepo.get(bindingKey)).toBeUndefined();
  });

  it("delete leaves bindings for OTHER themes intact", async () => {
    const a = await themeRepo.create(validInput({ name: "A" }));
    const b = await themeRepo.create(validInput({ name: "B" }));
    await appMetaRepo.set("commandvue:workspace-theme-WS_A", a.id);
    await appMetaRepo.set("commandvue:workspace-theme-WS_B", b.id);

    await themeRepo.delete(a.id);

    expect(await appMetaRepo.get("commandvue:workspace-theme-WS_A")).toBeUndefined();
    expect(await appMetaRepo.get("commandvue:workspace-theme-WS_B")).toBe(b.id);
  });

  it("getAll returns an empty array when nothing is stored", async () => {
    expect(await themeRepo.getAll()).toEqual([]);
  });

  it("exists reflects presence", async () => {
    const theme = await themeRepo.create(validInput());
    expect(await themeRepo.exists(theme.id)).toBe(true);
    expect(await themeRepo.exists("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(false);
  });
});
