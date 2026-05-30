import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ColorSwatchPicker from "@/components/ui/ColorSwatchPicker.vue";

const SWATCHES = [
  { label: "Red", value: "oklch(0.55 0.19 25)" },
  { label: "Green", value: "oklch(0.55 0.16 145)" },
  { label: "Blue", value: "oklch(0.55 0.18 250)" },
] as const;

describe("ColorSwatchPicker", () => {
  it("renders one button per option plus an optional custom button", () => {
    const w = mount(ColorSwatchPicker, {
      props: { modelValue: SWATCHES[0].value, options: SWATCHES },
    });
    const radios = w.findAll('button[role="radio"]');
    expect(radios).toHaveLength(SWATCHES.length);
    // allowCustom defaults to true → the "+" custom-pick button is present.
    const customButtons = w.findAll('button[aria-label="Pick a custom color"]');
    expect(customButtons).toHaveLength(1);
  });

  it("marks only the matching option as aria-checked", () => {
    const w = mount(ColorSwatchPicker, {
      props: { modelValue: SWATCHES[1].value, options: SWATCHES },
    });
    const radios = w.findAll('button[role="radio"]');
    expect(radios[0]?.attributes("aria-checked")).toBe("false");
    expect(radios[1]?.attributes("aria-checked")).toBe("true");
    expect(radios[2]?.attributes("aria-checked")).toBe("false");
  });

  it("emits update:modelValue with the swatch's OKLCH value on click", async () => {
    const w = mount(ColorSwatchPicker, {
      props: { modelValue: SWATCHES[0].value, options: SWATCHES },
    });
    await w.findAll('button[role="radio"]')[2]?.trigger("click");
    expect(w.emitted("update:modelValue")?.[0]).toEqual([SWATCHES[2].value]);
  });

  it("ignores whitespace when matching modelValue against an option", () => {
    // The model value comes back from culori's formatCss with single spaces;
    // user-supplied options may have variant spacing. The picker normalizes.
    const w = mount(ColorSwatchPicker, {
      props: { modelValue: "oklch(0.55  0.18  250)", options: SWATCHES },
    });
    const blueRadio = w.findAll('button[role="radio"]')[2];
    expect(blueRadio?.attributes("aria-checked")).toBe("true");
  });

  it("hides the custom button when allowCustom is false", () => {
    const w = mount(ColorSwatchPicker, {
      props: { modelValue: SWATCHES[0].value, options: SWATCHES, allowCustom: false },
    });
    expect(w.findAll('button[aria-label="Pick a custom color"]')).toHaveLength(0);
  });

  it("disables all interactive elements when disabled is true", () => {
    const w = mount(ColorSwatchPicker, {
      props: { modelValue: SWATCHES[0].value, options: SWATCHES, disabled: true },
    });
    for (const btn of w.findAll("button")) {
      expect(btn.attributes("disabled")).toBeDefined();
    }
  });
});
