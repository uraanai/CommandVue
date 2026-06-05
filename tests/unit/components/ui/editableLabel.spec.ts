import { mount } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import EditableLabel from "@/components/ui/EditableLabel.vue";

function mountLabel(props: Record<string, unknown> = {}) {
  return mount(EditableLabel, {
    props: { modelValue: "Sector 7", ...props },
    global: { plugins: [[PrimeVue, { unstyled: true }]] },
  });
}

async function openEditor(w: ReturnType<typeof mountLabel>): Promise<void> {
  await w.get("button").trigger("click");
  await nextTick();
}

describe("EditableLabel (ui)", () => {
  it("renders the value as a label and no input until clicked", () => {
    const w = mountLabel();
    expect(w.text()).toContain("Sector 7");
    expect(w.find("input").exists()).toBe(false);
  });

  it("commits a changed value on Enter", async () => {
    const w = mountLabel();
    await openEditor(w);
    await w.find("input").setValue("Alpha Base");
    await w.find("input").trigger("keyup.enter");
    expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["Alpha Base"]);
  });

  it("does not emit when the value is unchanged", async () => {
    const w = mountLabel();
    await openEditor(w);
    await w.find("input").trigger("keyup.enter"); // no edit
    expect(w.emitted("update:modelValue")).toBeFalsy();
  });

  it("reverts on Escape without emitting", async () => {
    const w = mountLabel();
    await openEditor(w);
    await w.find("input").setValue("scratch");
    await w.find("input").trigger("keyup.escape");
    expect(w.emitted("update:modelValue")).toBeFalsy();
    expect(w.find("input").exists()).toBe(false); // collapsed back to a label
  });

  it("does not open when disabled", async () => {
    const w = mountLabel({ disabled: true });
    await w.get("button").trigger("click");
    await nextTick();
    expect(w.find("input").exists()).toBe(false);
  });
});
