import type { NotificationRecord } from "@/stores/notification";

import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useNotificationStore } from "@/stores/notification";

let counter = 0;
function rec(over: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: `r${counter++}`,
    severity: "info",
    summary: "msg",
    position: "bottom-right",
    createdAt: 0,
    dismissedAt: null,
    ...over,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  counter = 0;
});

describe("useNotificationStore", () => {
  it("appends records and reports unread (live) count", () => {
    const store = useNotificationStore();
    store.push(rec());
    store.push(rec());
    expect(store.records).toHaveLength(2);
    expect(store.unreadCount).toBe(2);
  });

  it("caps at 50 records, evicting oldest (FIFO)", () => {
    const store = useNotificationStore();
    for (let i = 0; i < 60; i++) store.push(rec({ id: `n${i}` }));
    expect(store.records).toHaveLength(50);
    expect(store.records[0]!.id).toBe("n10"); // 0–9 evicted
    expect(store.records.at(-1)!.id).toBe("n59");
  });

  it("markDismissed sets dismissedAt once (idempotent) and drops unread", () => {
    const store = useNotificationStore();
    const r = rec({ id: "a" });
    store.push(r);
    store.markDismissed("a", 1000);
    expect(store.records[0]!.dismissedAt).toBe(1000);
    store.markDismissed("a", 2000); // keeps the first dismiss time
    expect(store.records[0]!.dismissedAt).toBe(1000);
    expect(store.unreadCount).toBe(0);
  });

  it("markDismissedByPosition only dismisses live records at that position", () => {
    const store = useNotificationStore();
    store.push(rec({ id: "tl", position: "top-left" }));
    store.push(rec({ id: "br", position: "bottom-right" }));
    store.markDismissedByPosition("top-left", 5);
    expect(store.records.find((r) => r.id === "tl")!.dismissedAt).toBe(5);
    expect(store.records.find((r) => r.id === "br")!.dismissedAt).toBeNull();
  });

  it("markAllDismissed dismisses every live record", () => {
    const store = useNotificationStore();
    store.push(rec());
    store.push(rec({ dismissedAt: 1 })); // already dismissed — unchanged
    store.markAllDismissed(9);
    expect(store.unreadCount).toBe(0);
    expect(store.records[1]!.dismissedAt).toBe(1); // not overwritten
  });
});
