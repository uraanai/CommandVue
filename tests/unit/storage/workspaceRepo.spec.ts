import { beforeEach, describe, expect, it } from "vitest";

import { InvariantError, NotFoundError } from "@/modules/storage/errors";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { presetRepo } from "@/modules/storage/presetRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

import { resetStorage } from "./helpers";

describe("workspaceRepo", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("creates a workspace and returns it", async () => {
    const ws = await workspaceRepo.create({ name: "A" });
    expect(ws.name).toBe("A");
    expect(ws.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(ws.isGlobalDefault).toBe(false);
    expect(ws.defaultLayoutId).toBeNull();
  });

  it("setting isGlobalDefault on create flips any prior default off", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B", isGlobalDefault: true });

    const a2 = await workspaceRepo.getById(a.id);
    expect(a2?.isGlobalDefault).toBe(false);
    expect(b.isGlobalDefault).toBe(true);
  });

  it("getGlobalDefault returns the current default", async () => {
    await workspaceRepo.create({ name: "A" });
    const b = await workspaceRepo.create({ name: "B", isGlobalDefault: true });
    const got = await workspaceRepo.getGlobalDefault();
    expect(got?.id).toBe(b.id);
  });

  it("setGlobalDefault is atomic — exactly one workspace ends with the flag", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });
    const c = await workspaceRepo.create({ name: "C" });

    await workspaceRepo.setGlobalDefault(c.id);

    const all = await workspaceRepo.list();
    const defaults = all.filter((w) => w.isGlobalDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe(c.id);
    // and the previous one is now false
    const a2 = await workspaceRepo.getById(a.id);
    expect(a2?.isGlobalDefault).toBe(false);
    const b2 = await workspaceRepo.getById(b.id);
    expect(b2?.isGlobalDefault).toBe(false);
  });

  it("update merges fields and bumps updatedAt", async () => {
    const ws = await workspaceRepo.create({ name: "Old" });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await workspaceRepo.update(ws.id, { name: "New" });
    expect(updated.name).toBe("New");
    expect(updated.updatedAt).toBeGreaterThan(ws.updatedAt);
  });

  it("update throws NotFoundError on missing id", async () => {
    await expect(workspaceRepo.update("nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("list returns workspaces sorted by createdAt", async () => {
    const a = await workspaceRepo.create({ name: "A" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await workspaceRepo.create({ name: "B" });
    const list = await workspaceRepo.list();
    expect(list.map((w) => w.id)).toEqual([a.id, b.id]);
  });

  it("delete refuses to remove the last workspace", async () => {
    const ws = await workspaceRepo.create({ name: "Solo", isGlobalDefault: true });
    await expect(workspaceRepo.delete(ws.id)).rejects.toBeInstanceOf(InvariantError);
  });

  it("delete cascades layouts, panel-states, and workspace-scoped presets", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });

    const layoutA = await layoutRepo.create({ workspaceId: a.id, name: "L-A" });
    const layoutB = await layoutRepo.create({ workspaceId: b.id, name: "L-B" });
    const panelA = await panelStateRepo.create({ layoutId: layoutA.id, panelType: "x" });
    const panelB = await panelStateRepo.create({ layoutId: layoutB.id, panelType: "y" });

    const presetA = await presetRepo.create({
      presetTypeId: "test",
      workspaceId: a.id,
      name: "scoped-A",
      config: {},
    });
    const globalPreset = await presetRepo.create({
      presetTypeId: "test",
      workspaceId: null,
      name: "global",
      config: {},
    });

    await workspaceRepo.delete(b.id);

    expect(await workspaceRepo.getById(b.id)).toBeUndefined();
    expect(await layoutRepo.getById(layoutB.id)).toBeUndefined();
    expect(await panelStateRepo.getById(panelB.id)).toBeUndefined();
    // sibling workspace untouched
    expect(await workspaceRepo.getById(a.id)).toBeDefined();
    expect(await layoutRepo.getById(layoutA.id)).toBeDefined();
    expect(await panelStateRepo.getById(panelA.id)).toBeDefined();
    expect(await presetRepo.getById(presetA.id)).toBeDefined();
    expect(await presetRepo.getById(globalPreset.id)).toBeDefined();
  });

  it("delete promotes a survivor to global default if the deleted one was default", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });

    await workspaceRepo.delete(a.id);
    const survivor = await workspaceRepo.getById(b.id);
    expect(survivor?.isGlobalDefault).toBe(true);
  });

  it("delete throws NotFoundError on missing id", async () => {
    await workspaceRepo.create({ name: "A" });
    await workspaceRepo.create({ name: "B" });
    await expect(workspaceRepo.delete("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
