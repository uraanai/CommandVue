import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/storage", () => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
  idbDel: vi.fn(),
  idbClear: vi.fn(),
}));

import { useLayoutStore } from "@/stores/layout";
import { idbDel, idbGet, idbSet } from "@/utils/storage";

describe("layout store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("starts with no stored layout", () => {
    const store = useLayoutStore();
    expect(store.layoutJson).toBeNull();
  });

  it("load() pulls the persisted payload from idb and updates the ref", async () => {
    vi.mocked(idbGet).mockResolvedValueOnce({ grid: { root: {} } });
    const store = useLayoutStore();

    const result = await store.load();

    expect(idbGet).toHaveBeenCalledWith("layout:dockview");
    expect(result).toEqual({ grid: { root: {} } });
    expect(store.layoutJson).toEqual({ grid: { root: {} } });
  });

  it("load() returns null when nothing is stored and leaves the ref alone", async () => {
    vi.mocked(idbGet).mockResolvedValueOnce(undefined);
    const store = useLayoutStore();

    const result = await store.load();

    expect(result).toBeNull();
    expect(store.layoutJson).toBeNull();
  });

  it("save() writes the payload to idb and updates the ref", async () => {
    const store = useLayoutStore();
    const payload = { grid: { root: { branch: 1 } } };

    await store.save(payload);

    expect(idbSet).toHaveBeenCalledWith("layout:dockview", payload);
    expect(store.layoutJson).toBe(payload);
  });

  it("reset() clears idb and the ref", async () => {
    const store = useLayoutStore();
    await store.save({ x: 1 });

    await store.reset();

    expect(idbDel).toHaveBeenCalledWith("layout:dockview");
    expect(store.layoutJson).toBeNull();
  });
});
