import type { Command, HistoryScope } from "@/modules/history/types";

import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeCommand, makeTransaction } from "@/modules/history/factories";
import { useHistoryStore } from "@/stores/history";

beforeEach(() => {
  setActivePinia(createPinia());
});

/**
 * A fake command that appends `redo:<label>` / `undo:<label>` to `log` so tests
 * can assert call order. Optional `onRedo`/`onUndo` mutate an external model.
 */
function cmd(
  log: string[],
  label: string,
  opts?: {
    scope?: HistoryScope;
    coalesceKey?: string;
    onRedo?: () => void;
    onUndo?: () => void;
  },
): Command {
  return makeCommand({
    label,
    scope: opts?.scope ?? "drawings",
    coalesceKey: opts?.coalesceKey,
    redo() {
      log.push(`redo:${label}`);
      opts?.onRedo?.();
    },
    undo() {
      log.push(`undo:${label}`);
      opts?.onUndo?.();
    },
  });
}

describe("factories", () => {
  it("makeCommand assigns the given fields and generates a non-empty id", () => {
    const c = makeCommand({
      label: "Add polygon",
      scope: "drawings",
      category: "create",
      redo() {},
      undo() {},
      meta: { foo: "bar" },
    });
    expect(c.label).toBe("Add polygon");
    expect(c.scope).toBe("drawings");
    expect(c.category).toBe("create");
    expect(c.meta).toEqual({ foo: "bar" });
    expect(typeof c.id).toBe("string");
    expect(c.id.length).toBeGreaterThan(0);
  });

  it("makeCommand rejects a blank label", () => {
    expect(() => makeCommand({ label: "  ", scope: "drawings", redo() {}, undo() {} })).toThrow();
  });

  it("makeTransaction copies children and sets id/label/scope", () => {
    const log: string[] = [];
    const children = [cmd(log, "a"), cmd(log, "b")];
    const txn = makeTransaction("Batch", "layout", children);
    expect(txn.label).toBe("Batch");
    expect(txn.scope).toBe("layout");
    expect(txn.children).toHaveLength(2);
    expect(txn.id.length).toBeGreaterThan(0);
    // defensive copy — mutating the source array does not affect the transaction
    children.push(cmd(log, "c"));
    expect(txn.children).toHaveLength(2);
  });

  it("makeTransaction rejects a blank label or empty children", () => {
    const log: string[] = [];
    expect(() => makeTransaction("  ", "layout", [cmd(log, "a")])).toThrow();
    expect(() => makeTransaction("Batch", "layout", [])).toThrow();
  });
});

describe("useHistoryStore — execute / undo / redo", () => {
  it("execute runs redo, records the entry, and exposes the undo label", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    await h.execute(cmd(log, "a"));

    expect(log).toEqual(["redo:a"]);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
    expect(h.undoLabel).toBe("a");
    expect(h.undoEntries).toHaveLength(1);
  });

  it("undo invokes the real inverse and moves the entry to the redo stack", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    await h.execute(cmd(log, "a"));
    await h.undo();

    expect(log).toEqual(["redo:a", "undo:a"]);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
    expect(h.undoLabel).toBeUndefined();
    expect(h.redoLabel).toBe("a");
  });

  it("redo re-runs the forward op and moves the entry back", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    await h.execute(cmd(log, "a"));
    await h.undo();
    await h.redo();

    expect(log).toEqual(["redo:a", "undo:a", "redo:a"]);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });

  it("recording a new command invalidates (clears) the redo stack", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    await h.execute(cmd(log, "a"));
    await h.undo();
    expect(h.canRedo).toBe(true);

    await h.execute(cmd(log, "b"));
    expect(h.canRedo).toBe(false);
    expect(h.undoEntries).toHaveLength(1);
    expect(h.undoLabel).toBe("b");
  });

  it("undo and redo are no-ops on empty stacks", async () => {
    const h = useHistoryStore();
    await h.undo();
    await h.redo();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("does not record commands executed while applying (reentrancy guard)", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    const inner = cmd(log, "inner");
    const outer = makeCommand({
      label: "outer",
      scope: "drawings",
      redo() {
        log.push("redo:outer");
      },
      undo() {
        log.push("undo:outer");
        // a side-effect that re-enters the store mid-undo — must NOT be recorded
        void h.execute(inner);
      },
    });

    await h.execute(outer);
    await h.undo();

    expect(log).toEqual(["redo:outer", "undo:outer", "redo:inner"]);
    expect(h.canUndo).toBe(false); // inner was not recorded
    expect(h.canRedo).toBe(true); // only outer sits on the redo stack
    expect(h.redoLabel).toBe("outer");
  });
});

describe("useHistoryStore — transactions", () => {
  it("collapses a multi-command transaction into one step, undone in reverse", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    await h.runInTransaction("Batch", "drawings", async () => {
      await h.execute(cmd(log, "a"));
      await h.execute(cmd(log, "b"));
      await h.execute(cmd(log, "c"));
    });

    expect(log).toEqual(["redo:a", "redo:b", "redo:c"]);
    expect(h.undoEntries).toHaveLength(1);
    expect(h.undoLabel).toBe("Batch");

    log.length = 0;
    await h.undo();
    expect(log).toEqual(["undo:c", "undo:b", "undo:a"]);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);

    log.length = 0;
    await h.redo();
    expect(log).toEqual(["redo:a", "redo:b", "redo:c"]);
  });

  it("collapses a single-command transaction into a plain command entry", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    await h.runInTransaction("Solo", "drawings", async () => {
      await h.execute(cmd(log, "only"));
    });

    expect(h.undoEntries).toHaveLength(1);
    // single child → labelled by the command, not the transaction wrapper
    expect(h.undoLabel).toBe("only");
  });

  it("records nothing for an empty transaction", async () => {
    const h = useHistoryStore();
    await h.runInTransaction("Nothing", "drawings", () => {});
    expect(h.canUndo).toBe(false);
    expect(h.undoEntries).toHaveLength(0);
  });

  it("rolls back applied children in reverse when the body throws, recording nothing", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    await expect(
      h.runInTransaction("Batch", "drawings", async () => {
        await h.execute(cmd(log, "a"));
        await h.execute(cmd(log, "b"));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(log).toEqual(["redo:a", "redo:b", "undo:b", "undo:a"]);
    expect(h.canUndo).toBe(false);
    expect(h.undoEntries).toHaveLength(0);
  });
});

describe("useHistoryStore — coalescing", () => {
  it("merges same-key edits within the window, keeping the older undo and newer redo", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const h = useHistoryStore();
      const undoLog: string[] = [];
      const cell = { value: 0 };

      await h.execute(
        makeCommand({
          label: "set 1",
          scope: "panel-state",
          coalesceKey: "alpha",
          redo() {
            cell.value = 1;
          },
          undo() {
            cell.value = 0;
            undoLog.push("->0");
          },
        }),
      );

      vi.setSystemTime(300); // within the 400ms window
      await h.execute(
        makeCommand({
          label: "set 2",
          scope: "panel-state",
          coalesceKey: "alpha",
          redo() {
            cell.value = 2;
          },
          undo() {
            cell.value = 1;
            undoLog.push("->1");
          },
        }),
      );

      expect(h.undoEntries).toHaveLength(1);
      expect(h.undoLabel).toBe("set 2"); // newest label wins

      await h.undo();
      expect(cell.value).toBe(0); // older baseline undo ran, not the newer one
      expect(undoLog).toEqual(["->0"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not merge once the window has elapsed", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const h = useHistoryStore();
      const log: string[] = [];

      await h.execute(cmd(log, "a", { scope: "panel-state", coalesceKey: "alpha" }));
      vi.setSystemTime(500); // > 400ms
      await h.execute(cmd(log, "b", { scope: "panel-state", coalesceKey: "alpha" }));

      expect(h.undoEntries).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the redo stack even when an edit coalesces", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const h = useHistoryStore();
      const log: string[] = [];

      await h.execute(cmd(log, "a", { scope: "panel-state", coalesceKey: "k" }));
      vi.setSystemTime(50);
      await h.execute(cmd(log, "x", { scope: "panel-state" })); // no key
      await h.undo(); // x → redo stack
      expect(h.canRedo).toBe(true);

      vi.setSystemTime(100);
      await h.execute(cmd(log, "b", { scope: "panel-state", coalesceKey: "k" })); // coalesces with a
      expect(h.undoEntries).toHaveLength(1);
      expect(h.canRedo).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useHistoryStore — capacity + workspace scoping", () => {
  it("caps the undo stack at 100, evicting the oldest entry", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    for (let i = 0; i < 101; i++) {
      await h.execute(cmd(log, `c${i}`));
    }

    expect(h.undoEntries).toHaveLength(100);
    // oldest (c0) evicted, newest (c100) on top
    expect(h.undoLabel).toBe("c100");
    const labels = h.undoEntries.map((e) =>
      e.kind === "command" ? e.command.label : e.transaction.label,
    );
    expect(labels[0]).toBe("c1"); // c0 gone
  });

  it("drops the prior workspace's stack on switch (history is per-workspace)", async () => {
    const h = useHistoryStore();
    const log: string[] = [];

    h.setActiveWorkspace("ws-A");
    await h.execute(cmd(log, "a"));
    expect(h.canUndo).toBe(true);

    h.setActiveWorkspace("ws-B");
    expect(h.canUndo).toBe(false); // B starts fresh

    h.setActiveWorkspace("ws-A");
    expect(h.canUndo).toBe(false); // A's stack was dropped when we left it
  });
});
