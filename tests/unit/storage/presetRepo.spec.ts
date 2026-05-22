import { beforeEach, describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/modules/storage/errors";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { presetRepo } from "@/modules/storage/presetRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

import { resetStorage } from "./helpers";

describe("presetRepo", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("creates a global preset (workspaceId: null)", async () => {
    const preset = await presetRepo.create({
      presetTypeId: "map-style",
      workspaceId: null,
      name: "G",
      config: { styleUrl: "https://example/style.json" },
    });
    expect(preset.workspaceId).toBeNull();
  });

  it("creates a workspace-scoped preset", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const preset = await presetRepo.create({
      presetTypeId: "map-style",
      workspaceId: ws.id,
      name: "S",
      config: {},
    });
    expect(preset.workspaceId).toBe(ws.id);
  });

  it("listGlobal filters out workspace-scoped presets", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    await presetRepo.create({ presetTypeId: "t", workspaceId: null, name: "G", config: {} });
    await presetRepo.create({ presetTypeId: "t", workspaceId: ws.id, name: "S", config: {} });
    const globals = await presetRepo.listGlobal();
    expect(globals).toHaveLength(1);
    expect(globals[0]?.workspaceId).toBeNull();
  });

  it("listForWorkspace returns only that workspace's scoped presets", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });
    await presetRepo.create({ presetTypeId: "t", workspaceId: a.id, name: "A1", config: {} });
    await presetRepo.create({ presetTypeId: "t", workspaceId: b.id, name: "B1", config: {} });
    await presetRepo.create({ presetTypeId: "t", workspaceId: null, name: "G", config: {} });

    const aOnly = await presetRepo.listForWorkspace(a.id);
    expect(aOnly).toHaveLength(1);
    expect(aOnly[0]?.name).toBe("A1");
  });

  it("list with presetTypeId filter narrows by type", async () => {
    await presetRepo.create({
      presetTypeId: "map-style",
      workspaceId: null,
      name: "1",
      config: {},
    });
    await presetRepo.create({
      presetTypeId: "chart-theme",
      workspaceId: null,
      name: "2",
      config: {},
    });
    const styles = await presetRepo.list({ presetTypeId: "map-style" });
    expect(styles).toHaveLength(1);
    expect(styles[0]?.name).toBe("1");
  });

  it("update merges fields", async () => {
    const preset = await presetRepo.create({
      presetTypeId: "t",
      workspaceId: null,
      name: "Old",
      config: { a: 1 },
    });
    const updated = await presetRepo.update(preset.id, { name: "New", config: { a: 2 } });
    expect(updated.name).toBe("New");
    expect(updated.config).toEqual({ a: 2 });
  });

  it("update throws NotFoundError on missing id", async () => {
    await expect(presetRepo.update("nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("delete refuses when a panel references the preset", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
    const preset = await presetRepo.create({
      presetTypeId: "t",
      workspaceId: null,
      name: "p",
      config: {},
    });
    await panelStateRepo.create({
      layoutId: layout.id,
      panelType: "x",
      appliedPresetIds: [preset.id],
    });

    await expect(presetRepo.delete(preset.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("delete with force: true strips refs and removes the preset", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
    const preset = await presetRepo.create({
      presetTypeId: "t",
      workspaceId: null,
      name: "p",
      config: {},
    });
    const panel = await panelStateRepo.create({
      layoutId: layout.id,
      panelType: "x",
      appliedPresetIds: [preset.id, "other"],
    });

    await presetRepo.delete(preset.id, { force: true });

    expect(await presetRepo.getById(preset.id)).toBeUndefined();
    const afterPanel = await panelStateRepo.getById(panel.id);
    expect(afterPanel?.appliedPresetIds).toEqual(["other"]);
  });

  it("duplicate deep-clones config and assigns a new name+id", async () => {
    const source = await presetRepo.create({
      presetTypeId: "map-overlay",
      workspaceId: null,
      name: "S",
      config: { nested: { value: 1 } },
    });
    const dup = await presetRepo.duplicate(source.id);
    expect(dup.id).not.toBe(source.id);
    expect(dup.name).toBe("S (copy)");
    expect(dup.config).toEqual(source.config);
    // mutate source — dup must not change
    await presetRepo.update(source.id, { config: { nested: { value: 99 } } });
    const dupAfter = await presetRepo.getById(dup.id);
    const dupConfig = dupAfter!.config as { nested: { value: number } };
    expect(dupConfig.nested.value).toBe(1);
  });

  it("duplicate accepts a workspaceId override (promote global ↔ scoped)", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const global = await presetRepo.create({
      presetTypeId: "t",
      workspaceId: null,
      name: "G",
      config: {},
    });
    const scoped = await presetRepo.duplicate(global.id, { workspaceId: ws.id });
    expect(scoped.workspaceId).toBe(ws.id);
  });
});
