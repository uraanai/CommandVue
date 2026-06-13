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
import { useWorkspaceStore } from "@/stores/workspace";

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

    // Redo re-deletes the whole cascade. `redo()` re-snapshots and re-deletes by
    // the freshly-restored ids, so a SECOND undo must restore everything again —
    // proving redo re-captured the restored ids rather than reusing a stale snapshot.
    await history.redo();
    expect(await db.get("workspaces", doomed.id)).toBeUndefined();
    expect(await db.get("layouts", l2.id)).toBeUndefined();
    expect(await db.get("panel-states", panel.id)).toBeUndefined();
    expect(await db.get("presets", preset.id)).toBeUndefined();
    expect(history.canUndo).toBe(true);

    await history.undo();
    expect(await db.get("workspaces", doomed.id)).toMatchObject({ id: doomed.id, name: "Doomed" });
    expect(await db.get("layouts", l2.id)).toMatchObject({ id: l2.id, name: "L2" });
    expect(await db.get("panel-states", panel.id)).toMatchObject({ id: panel.id, state: { a: 1 } });
    expect(await db.get("presets", preset.id)).toMatchObject({ id: preset.id, name: "Scoped" });
  });

  it("deleting the ACTIVE workspace records on the survivor's stack so the cascade stays undoable", async () => {
    // Regression for the data-loss bug: an active-workspace delete used to record
    // its undo entry on the doomed workspace's stack, which the App.vue watcher
    // dropped on the next flush (decision #3) — making the cascade un-undoable.
    const history = useHistoryStore();
    const ws = useWorkspaceStore();

    const survivor = await workspaceRepo.create({ name: "Survivor", isGlobalDefault: true });
    await layoutRepo.create({ workspaceId: survivor.id, name: "S1" });
    const active = await workspaceRepo.create({ name: "Active" });
    const activeLayout = await layoutRepo.create({ workspaceId: active.id, name: "A1" });

    await ws.loadAll();
    await ws.setCurrentWorkspace(active.id);
    // Seed the history scope the way App.vue's `immediate` watcher does on boot.
    history.setActiveWorkspace(ws.currentWorkspaceId);
    expect(ws.currentWorkspaceId).toBe(active.id);

    await history.execute(makeDeleteWorkspaceCommand(active.id));

    // The store auto-switched the active pointer to the survivor.
    expect(ws.currentWorkspaceId).toBe(survivor.id);
    // Simulate the App.vue watcher firing on the next flush — the step that, pre-fix,
    // dropped the doomed workspace's stack along with the just-recorded delete entry.
    history.setActiveWorkspace(ws.currentWorkspaceId);

    // The delete must STILL be undoable — recorded on the survivor's stack.
    expect(history.canUndo).toBe(true);
    expect(history.undoLabel).toBe("Delete workspace");

    await history.undo();
    const db = await getDb();
    expect(await db.get("workspaces", active.id)).toMatchObject({ id: active.id, name: "Active" });
    expect(await db.get("layouts", activeLayout.id)).toMatchObject({
      id: activeLayout.id,
      name: "A1",
    });
    expect(history.canUndo).toBe(false);
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
