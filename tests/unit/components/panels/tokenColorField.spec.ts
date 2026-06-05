import { mount } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import TokenColorField from "@/components/panels/theme-studio/TokenColorField.vue";
import Input from "@/components/ui/Input.vue";
import InputNumber from "@/volt/InputNumber.vue";

function mountField(resolvedValue = "oklch(0.55 0.18 250)") {
  return mount(TokenColorField, {
    props: { resolvedValue, edited: false, label: "Interactive" },
    global: { plugins: [[PrimeVue, { unstyled: true }]] },
  });
}

describe("TokenColorField (C1)", () => {
  it("renders a swatch trigger tinted with the resolved value; no native color input", () => {
    const w = mountField();
    const swatch = w.find("button");
    expect(swatch.attributes("style")).toContain("background-color");
    expect(w.find('input[type="color"]').exists()).toBe(false);
  });

  it("editing an OKLCH channel emits a formatCss-normalized OKLCH string", async () => {
    const w = mountField();
    await w.find("button").trigger("click"); // open popover → seeds L/C/H + renders channels
    await nextTick();
    const channels = w.findAllComponents(InputNumber);
    expect(channels).toHaveLength(3);
    await channels[2]!.vm.$emit("update:model-value", 200); // H channel
    const change = w.emitted("change");
    expect(change).toBeTruthy();
    expect(change!.at(-1)![0]).toMatch(/^oklch\(/);
  });

  it("Advanced field accepts a var() value verbatim but rejects an injection value", async () => {
    const w = mountField();
    await w.find("button").trigger("click");
    await nextTick();
    const advanced = w.findComponent(Input);

    // Injection-shaped → rejected, no emit.
    await advanced.vm.$emit("update:modelValue", "<script>alert(1)</script>");
    await advanced.find("input").trigger("blur");
    expect(w.emitted("change")).toBeFalsy();

    // Valid var() → emitted verbatim.
    await advanced.vm.$emit("update:modelValue", "var(--color-blue-500)");
    await advanced.find("input").trigger("blur");
    expect(w.emitted("change")?.at(-1)).toEqual(["var(--color-blue-500)"]);
  });
});
