import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetNotifyForTests,
  __setNotifyHandleForTests,
  DEFAULT_LIFE,
  handleMessageClosed,
  POSITION_TO_GROUP,
  useNotify,
} from "@/composables/useNotify";

/** Fake PrimeVue toast handle that records what it was asked to do. */
function fakeHandle() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
    removeGroup: vi.fn(),
    removeAllGroups: vi.fn(),
  };
}

let handle: ReturnType<typeof fakeHandle>;

beforeEach(() => {
  handle = fakeHandle();
  __setNotifyHandleForTests(handle);
});
afterEach(() => __resetNotifyForTests());

/** The most recent message handed to `add`. */
const lastAdd = () => handle.add.mock.calls.at(-1)?.[0];

describe("useNotify — routing + severity", () => {
  it("maps project severities onto PrimeVue's vocabulary", () => {
    const notify = useNotify();
    notify.success("ok");
    expect(lastAdd().severity).toBe("success");
    notify.info("fyi");
    expect(lastAdd().severity).toBe("info");
    notify.warn("careful");
    expect(lastAdd().severity).toBe("warn"); // warning → warn
    notify.danger("boom");
    expect(lastAdd().severity).toBe("error"); // danger → error
  });

  it("defaults to info severity, bottom-right group, and DEFAULT_LIFE", () => {
    useNotify().show({ summary: "hi" });
    const msg = lastAdd();
    expect(msg.severity).toBe("info");
    expect(msg.group).toBe(POSITION_TO_GROUP["bottom-right"]);
    expect(msg.life).toBe(DEFAULT_LIFE);
  });

  it("routes a position to its outlet group", () => {
    useNotify().show({ summary: "x", position: "top-left" });
    expect(lastAdd().group).toBe(POSITION_TO_GROUP["top-left"]);
  });

  it("omits life for sticky toasts", () => {
    useNotify().danger({ summary: "stay", sticky: true });
    expect(lastAdd().life).toBeUndefined();
  });

  it("passes summary + detail through", () => {
    useNotify().info({ summary: "S", detail: "D" });
    expect(lastAdd()).toMatchObject({ summary: "S", detail: "D" });
  });

  it("no-ops (no throw) when the handle isn't installed", () => {
    __setNotifyHandleForTests(null);
    expect(() => useNotify().success("x")).not.toThrow();
  });
});

describe("useNotify — coalescing by key", () => {
  it("replace (default): removes the prior keyed toast then adds the new one", () => {
    const notify = useNotify();
    notify.danger({ summary: "Connection lost", sticky: true, key: "ws" });
    const first = lastAdd();
    notify.success({ summary: "Reconnected", key: "ws" });
    expect(handle.remove).toHaveBeenCalledTimes(1);
    expect(handle.remove).toHaveBeenCalledWith(first); // the sticky error
    expect(handle.add).toHaveBeenCalledTimes(2);
    expect(lastAdd().summary).toBe("Reconnected");
  });

  it("drop: keeps the live keyed toast and ignores the new one", () => {
    const notify = useNotify();
    notify.info({ summary: "a", key: "k", coalesce: "drop" });
    notify.info({ summary: "b", key: "k", coalesce: "drop" });
    expect(handle.add).toHaveBeenCalledTimes(1);
    expect(handle.remove).not.toHaveBeenCalled();
    expect(lastAdd().summary).toBe("a");
  });

  it("unkeyed toasts never coalesce", () => {
    const notify = useNotify();
    notify.info("a");
    notify.info("b");
    expect(handle.add).toHaveBeenCalledTimes(2);
    expect(handle.remove).not.toHaveBeenCalled();
  });

  it("a closed keyed toast frees the slot (a later drop is allowed)", () => {
    const notify = useNotify();
    notify.info({ summary: "a", key: "k", coalesce: "drop" });
    const first = lastAdd();
    handleMessageClosed(first); // simulate expire / manual close
    notify.info({ summary: "b", key: "k", coalesce: "drop" });
    expect(handle.add).toHaveBeenCalledTimes(2); // not dropped — slot was freed
  });
});

describe("useNotify — dismissal", () => {
  it("dismissAll clears every group", () => {
    useNotify().dismissAll();
    expect(handle.removeAllGroups).toHaveBeenCalledTimes(1);
  });

  it("dismissPosition clears just that position's group", () => {
    useNotify().dismissPosition("top-right");
    expect(handle.removeGroup).toHaveBeenCalledWith(POSITION_TO_GROUP["top-right"]);
  });
});

describe("POSITION_TO_GROUP", () => {
  it("covers exactly the seven canonical positions with stable group ids", () => {
    const positions = Object.keys(POSITION_TO_GROUP).sort();
    expect(positions).toEqual(
      [
        "bottom-center",
        "bottom-left",
        "bottom-right",
        "center",
        "top-center",
        "top-left",
        "top-right",
      ].sort(),
    );
    for (const [pos, group] of Object.entries(POSITION_TO_GROUP)) {
      expect(group).toBe(`cv-toast-${pos}`);
    }
  });
});
