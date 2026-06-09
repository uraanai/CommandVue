import { beforeEach, describe, expect, it } from "vitest";

import {
  makeCreateWorkspaceCommand,
  makeDeleteWorkspaceCommand,
  makeRenameWorkspaceCommand,
} from "@/modules/history/adapters";
import { getDb } from "@/modules/storage/db";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { presetRepo } from "@/modules/storage/presetRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useHistoryStore } from "@/stores/history";

import { resetForStoreTest } from "../../stores/helpers";

beforeEach(async () => {
  await resetForStoreTest();
});

describe("workspace adapter — cascade delete", () => {
  it("removes workspace + layouts + panel-states + scoped presets as ONE undo step, restoring every record by its original id", async () => {
    const history = useHistoryStore();

    const keep = await workspaceRepo.create({ name: "Keep", isGlobalDefault: true });
    await layoutRepo.create({ workspaceId: keep.id, name: "K1" });

    const doomed = await workspaceRepo.create({ name: "Doomed" });
    const l1 = await layoutRepo.create({ workspaceId: doomed.id, name: "L1" });
    const l2 = await layoutRepo.create({ workspaceId: doomed.id, name: "L2" });
    const panel = await panelStateRepo.create({
      layoutId: l1.id,
      panelType: "maplibre",
      state: { a: 1 },
    });
    const preset = await presetRepo.create({
      presetTypeId: "map-style",
      workspaceId: doomed.id,
      name: "Scoped",
      config: {},
    });

    await history.execute(makeDeleteWorkspaceCommand(doomed.id));

    const db = await getDb();
    expect(await db.get("workspaces", doomed.id)).toBeUndefined();
    expect(await db.get("layouts", l1.id)).toBeUndefined();
    expect(await db.get("layouts", l2.id)).toBeUndefined();
    expect(await db.get("panel-states", panel.id)).toBeUndefined();
    expect(await db.get("presets", preset.id)).toBeUndefined();
    // the sibling workspace is untouched
    expect(await db.get("workspaces", keep.id)).toBeDefined();
    expect(history.canUndo).toBe(true);
    expect(history.undoLabel).toBe("Delete workspace");

    await history.undo();

    expect(await db.get("workspaces", doomed.id)).toMatchObject({ id: doomed.id, name: "Doomed" });
    expect(await db.get("layouts", l1.id)).toMatchObject({ id: l1.id, name: "L1" });
    expect(await db.get("layouts", l2.id)).toMatchObject({ id: l2.id, name: "L2" });
    expect(await db.get("panel-states", panel.id)).toMatchObject({ id: panel.id, state: { a: 1 } });
    expect(await db.get("presets", preset.id)).toMatchObject({ id: preset.id, name: "Scoped" });
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });
});

describe("workspace adapter — create / rename", () => {
  it("create makes a workspace + default layout; undo deletes both", async () => {
    const history = useHistoryStore();
    // seed an existing workspace so the new one is never the last (delete invariant)
    const existing = await workspaceRepo.create({ name: "Existing", isGlobalDefault: true });
    await layoutRepo.create({ workspaceId: existing.id, name: "E1" });

    await history.execute(makeCreateWorkspaceCommand("New WS"));

    const db = await getDb();
    const created = (await db.getAll("workspaces")).find((w) => w.name === "New WS");
    expect(created).toBeDefined();
    const createdId = created!.id;
    expect((await db.getAllFromIndex("layouts", "by-workspace", createdId)).length).toBe(1);

    await history.undo();
    expect(await db.get("workspaces", createdId)).toBeUndefined();
    expect((await db.getAllFromIndex("layouts", "by-workspace", createdId)).length).toBe(0);
  });

  it("rename round-trips the workspace name", async () => {
    const history = useHistoryStore();
    const ws = await workspaceRepo.create({ name: "Before", isGlobalDefault: true });

    await history.execute(makeRenameWorkspaceCommand(ws.id, "After"));
    const db = await getDb();
    expect((await db.get("workspaces", ws.id))?.name).toBe("After");

    await history.undo();
    expect((await db.get("workspaces", ws.id))?.name).toBe("Before");

    await history.redo();
    expect((await db.get("workspaces", ws.id))?.name).toBe("After");
  });
});
