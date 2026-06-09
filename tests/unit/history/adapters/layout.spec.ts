import { beforeEach, describe, expect, it } from "vitest";

import { makeDeleteLayoutCommand, makeRenameLayoutCommand } from "@/modules/history/adapters";
import { getDb } from "@/modules/storage/db";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useHistoryStore } from "@/stores/history";
import { useLayoutStore } from "@/stores/layout";

import { resetForStoreTest } from "../../stores/helpers";

beforeEach(async () => {
  await resetForStoreTest();
});

describe("layout adapter — rename", () => {
  it("round-trips the layout name", async () => {
    const history = useHistoryStore();
    const ws = await workspaceRepo.create({ name: "W", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "Before" });
    await useLayoutStore().loadForWorkspace(ws.id);

    await history.execute(makeRenameLayoutCommand(layout.id, "After"));
    const db = await getDb();
    expect((await db.get("layouts", layout.id))?.name).toBe("After");

    await history.undo();
    expect((await db.get("layouts", layout.id))?.name).toBe("Before");
  });
});

describe("layout adapter — delete", () => {
  it("deletes a layout + its panel-states and restores them by id (one step)", async () => {
    const history = useHistoryStore();
    const ws = await workspaceRepo.create({ name: "W", isGlobalDefault: true });
    const keep = await layoutRepo.create({ workspaceId: ws.id, name: "Keep" });
    const doomed = await layoutRepo.create({ workspaceId: ws.id, name: "Doomed" });
    const panel = await panelStateRepo.create({
      layoutId: doomed.id,
      panelType: "maplibre",
      state: { x: 1 },
    });
    await useLayoutStore().loadForWorkspace(ws.id);

    await history.execute(makeDeleteLayoutCommand(doomed.id));
    const db = await getDb();
    expect(await db.get("layouts", doomed.id)).toBeUndefined();
    expect(await db.get("panel-states", panel.id)).toBeUndefined();
    expect(await db.get("layouts", keep.id)).toBeDefined();

    await history.undo();
    expect(await db.get("layouts", doomed.id)).toMatchObject({ id: doomed.id, name: "Doomed" });
    expect(await db.get("panel-states", panel.id)).toMatchObject({ id: panel.id, state: { x: 1 } });
  });
});
