import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import EditableSelect from "@/components/ui/EditableSelect.vue";
import AutoComplete from "@/volt/AutoComplete.vue";

enableAutoUnmount(afterEach);

const UNITS = ["rem", "px", "em", "%"];

function mountSelect(props: Record<string, unknown> = {}) {
  return mount(EditableSelect, {
    props: { modelValue: "rem", options: UNITS, ...props },
    global: { plugins: [[PrimeVue, { unstyled: true }]] },
  });
}

async function openEditor(w: ReturnType<typeof mountSelect>): Promise<void> {
  await w.get("button").trigger("click");
  await nextTick();
}

describe("EditableSelect (ui)", () => {
  it("renders the value as a label and no combobox until clicked", () => {
    const w = mountSelect();
    expect(w.text()).toContain("rem");
    expect(w.findComponent(AutoComplete).exists()).toBe(false);
  });

  it("commits the value when an option is selected", async () => {
    const w = mountSelect();
    await openEditor(w);
    w.findComponent(AutoComplete).vm.$emit("item-select", { value: "px" });
    await nextTick();
    expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["px"]);
  });

  it("commits a typed value on blur only if it is an allowed option (deferred)", async () => {
    vi.useFakeTimers();
    try {
      const w = mountSelect();
      await openEditor(w);
      const ac = w.findComponent(AutoComplete);
      ac.vm.$emit("update:modelValue", "em"); // typed/selected, valid
      ac.vm.$emit("blur");
      vi.advanceTimersByTime(200); // past the deferred-close delay
      await flushPromises();
      expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["em"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a typed value that is not in the options (reverts, no emit)", async () => {
    vi.useFakeTimers();
    try {
      const w = mountSelect();
      await openEditor(w);
      const ac = w.findComponent(AutoComplete);
      ac.vm.$emit("update:modelValue", "vh"); // not an allowed unit
      ac.vm.$emit("blur");
      vi.advanceTimersByTime(200);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toBeFalsy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not open when disabled", async () => {
    const w = mountSelect({ disabled: true });
    await w.get("button").trigger("click");
    await nextTick();
    expect(w.findComponent(AutoComplete).exists()).toBe(false);
  });
});
