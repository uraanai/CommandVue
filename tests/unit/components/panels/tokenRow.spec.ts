import { mount, type VueWrapper } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import { describe, expect, it } from "vitest";

import TokenRow from "@/components/panels/theme-studio/TokenRow.vue";
import Input from "@/components/ui/Input.vue";
import { getTokenManifestEntry } from "@/modules/themes/tokenManifest";
import InputNumber from "@/volt/InputNumber.vue";

const LENGTH_ENTRY = getTokenManifestEntry("--space-panel-padding")!; // spacing · length

function mountRow(resolvedValue: string): VueWrapper {
  return mount(TokenRow, {
    props: { entry: LENGTH_ENTRY, resolvedValue, edited: false },
    global: { plugins: [[PrimeVue, { unstyled: true }]] },
  });
}

describe("TokenRow (C1) — no spurious edits", () => {
  it("a free-text (var chain) blur with no change emits nothing; a real change emits set", async () => {
    const w = mountRow("var(--space-3)"); // not a plain length → free-text Input
    const input = w.findComponent(Input);
    await input.find("input").trigger("blur"); // focus + leave, no edit
    expect(w.emitted("set")).toBeFalsy();

    await input.vm.$emit("update:modelValue", "2rem"); // real change
    await input.find("input").trigger("blur");
    expect(w.emitted("set")?.at(-1)).toEqual(["--space-panel-padding", "2rem"]);
  });

  it("a plain-length re-emit of the same value emits nothing; a change emits set", async () => {
    const w = mountRow("1rem"); // plain length → InputNumber + unit
    const num = w.findComponent(InputNumber);
    await num.vm.$emit("update:model-value", 1); // same as the resolved 1rem
    expect(w.emitted("set")).toBeFalsy();

    await num.vm.$emit("update:model-value", 2); // changed
    expect(w.emitted("set")?.at(-1)).toEqual(["--space-panel-padding", "2rem"]);
  });
});
