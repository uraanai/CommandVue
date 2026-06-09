import { beforeEach, describe, expect, it } from "vitest";

import { makeCreatePresetCommand, makeDeletePresetCommand } from "@/modules/history/adapters";
import { getDb } from "@/modules/storage/db";
import { presetRepo } from "@/modules/storage/presetRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useHistoryStore } from "@/stores/history";
import { usePresetStore } from "@/stores/preset";

import { resetForStoreTest } from "../../stores/helpers";

beforeEach(async () => {
  await resetForStoreTest();
});

describe("preset adapter — create", () => {
  it("creates a preset; undo removes it", async () => {
    const history = useHistoryStore();
    const ws = await workspaceRepo.create({ name: "W", isGlobalDefault: true });
    await usePresetStore().loadForWorkspace(ws.id);

    await history.execute(
      makeCreatePresetCommand({
        presetTypeId: "map-style",
        workspaceId: ws.id,
        name: "P",
        config: {},
      }),
    );
    const db = await getDb();
    const created = (await db.getAll("presets")).find((p) => p.name === "P");
    expect(created).toBeDefined();

    await history.undo();
    expect(await db.get("presets", created!.id)).toBeUndefined();
  });
});

describe("preset adapter — delete", () => {
  it("deletes a preset and restores it by id", async () => {
    const history = useHistoryStore();
    const ws = await workspaceRepo.create({ name: "W", isGlobalDefault: true });
    await usePresetStore().loadForWorkspace(ws.id);
    const preset = await presetRepo.create({
      presetTypeId: "map-style",
      workspaceId: ws.id,
      name: "Doomed",
      config: { k: 1 },
    });

    await history.execute(makeDeletePresetCommand(preset.id));
    const db = await getDb();
    expect(await db.get("presets", preset.id)).toBeUndefined();

    await history.undo();
    expect(await db.get("presets", preset.id)).toMatchObject({
      id: preset.id,
      name: "Doomed",
      config: { k: 1 },
    });
  });
});
