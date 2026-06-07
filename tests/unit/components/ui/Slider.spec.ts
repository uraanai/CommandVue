import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Slider from "@/components/ui/Slider.vue";

function mountSlider(props: Record<string, unknown> = {}) {
  return mount(Slider, { props: { modelValue: 50, min: 0, max: 100, step: 1, ...props } });
}

describe("ui/Slider", () => {
  it("positions the handle at the value's percent with the right ARIA", () => {
    const w = mountSlider({ modelValue: 25 });
    const handle = w.get('[role="slider"]');
    expect(handle.attributes("style")).toContain("left: 25%");
    expect(handle.attributes("aria-valuenow")).toBe("25");
    expect(handle.attributes("aria-valuemin")).toBe("0");
    expect(handle.attributes("aria-valuemax")).toBe("100");
  });

  it("Arrow keys step the value up/down", async () => {
    const w = mountSlider({ modelValue: 50, step: 5 });
    const handle = w.get('[role="slider"]');
    await handle.trigger("keydown", { key: "ArrowRight" });
    expect(w.emitted("update:modelValue")?.[0]).toEqual([55]);
    await handle.trigger("keydown", { key: "ArrowLeft" });
    expect(w.emitted("update:modelValue")?.[1]).toEqual([45]);
  });

  it("Home / End jump to min / max", async () => {
    const w = mountSlider({ modelValue: 50 });
    const handle = w.get('[role="slider"]');
    await handle.trigger("keydown", { key: "Home" });
    expect(w.emitted("update:modelValue")?.[0]).toEqual([0]);
    await handle.trigger("keydown", { key: "End" });
    expect(w.emitted("update:modelValue")?.[1]).toEqual([100]);
  });

  it("quantizes to step without float drift and clamps at bounds", async () => {
    const w = mountSlider({ modelValue: 1, min: 0, max: 1, step: 0.01 });
    const handle = w.get('[role="slider"]');
    await handle.trigger("keydown", { key: "ArrowLeft" }); // 1 → 0.99 (not 0.9900000…1)
    expect(w.emitted("update:modelValue")?.at(-1)).toEqual([0.99]);
  });

  it("is inert when disabled", async () => {
    const w = mountSlider({ modelValue: 50, disabled: true });
    await w.get('[role="slider"]').trigger("keydown", { key: "ArrowRight" });
    expect(w.emitted("update:modelValue")).toBeUndefined();
  });
});
