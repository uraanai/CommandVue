import { afterEach, describe, expect, it } from "vitest";

import { __resetConfirmForTests, useConfirm } from "@/composables/useConfirm";

describe("useConfirm", () => {
  afterEach(() => {
    __resetConfirmForTests();
  });

  it("confirm() opens a prompt (current is set) and stays pending until resolved", async () => {
    const { confirm, current } = useConfirm();
    const promise = confirm({ title: "Delete?" });
    expect(current.value).not.toBeNull();
    expect(current.value?.title).toBe("Delete?");

    // Not resolved yet.
    let settled = false;
    void promise.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it("resolveCurrent(true) resolves the promise true and clears state", async () => {
    const { confirm, current, resolveCurrent } = useConfirm();
    const promise = confirm({ title: "Delete?" });
    resolveCurrent(true);
    await expect(promise).resolves.toBe(true);
    expect(current.value).toBeNull();
  });

  it("resolveCurrent(false) resolves the promise false and clears state", async () => {
    const { confirm, current, resolveCurrent } = useConfirm();
    const promise = confirm({ title: "Delete?" });
    resolveCurrent(false);
    await expect(promise).resolves.toBe(false);
    expect(current.value).toBeNull();
  });

  it("confirmIf(false, …) resolves true immediately WITHOUT opening a prompt", async () => {
    const { confirmIf, current } = useConfirm();
    const result = await confirmIf(false, { title: "Delete?" });
    expect(result).toBe(true);
    expect(current.value).toBeNull(); // no modal was shown
  });

  it("confirmIf(true, …) opens a prompt like confirm()", async () => {
    const { confirmIf, current, resolveCurrent } = useConfirm();
    const promise = confirmIf(true, { title: "Delete?" });
    expect(current.value?.title).toBe("Delete?");
    resolveCurrent(true);
    await expect(promise).resolves.toBe(true);
  });

  it("opening a second prompt auto-cancels the first (resolves it false)", async () => {
    const { confirm, resolveCurrent } = useConfirm();
    const first = confirm({ title: "First" });
    const second = confirm({ title: "Second" });
    // The first promise is auto-resolved false when the second opens.
    await expect(first).resolves.toBe(false);
    // The second is now the active one.
    resolveCurrent(true);
    await expect(second).resolves.toBe(true);
  });

  it("carries through message / details / labels / danger", () => {
    const { confirm, current } = useConfirm();
    void confirm({
      title: "Delete theme?",
      message: "This is permanent.",
      details: ["Name: Ocean", "Source: Generated"],
      confirmLabel: "Delete",
      cancelLabel: "Keep",
      danger: true,
    });
    expect(current.value).toMatchObject({
      title: "Delete theme?",
      message: "This is permanent.",
      details: ["Name: Ocean", "Source: Generated"],
      confirmLabel: "Delete",
      cancelLabel: "Keep",
      danger: true,
    });
  });
});
