import { mount, type VueWrapper } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import TokenRow from "@/components/panels/theme-studio/TokenRow.vue";
import TokensTabEditor from "@/components/panels/theme-studio/TokensTabEditor.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import { TOKEN_MANIFEST_LIST } from "@/modules/themes/tokenManifest";

/** Kind-appropriate resolved values so each control seeds without falling back. */
const RESOLVED: Record<string, string> = Object.fromEntries(
  TOKEN_MANIFEST_LIST.map((e) => {
    if (e.kind === "length") return [e.name, "1rem"];
    if (e.kind === "number") return [e.name, "600"];
    if (e.kind === "shadow") return [e.name, "0 1px 2px rgba(0,0,0,0.2)"];
    if (e.kind === "font-stack") return [e.name, "Inter, sans-serif"];
    return [e.name, "oklch(0.55 0.18 250)"];
  }),
);

function mountEditor(overrides: Record<string, string> = {}): VueWrapper {
  return mount(TokensTabEditor, {
    props: { resolved: RESOLVED, overrides },
    global: { plugins: [[PrimeVue, { unstyled: true }]] },
  });
}

describe("TokensTabEditor (C1)", () => {
  it("renders one row per manifest token, grouped under section headers", () => {
    const w = mountEditor();
    expect(w.findAllComponents(TokenRow)).toHaveLength(TOKEN_MANIFEST_LIST.length);
    expect(w.text()).toContain("Surface"); // first section header
    expect(w.text()).toContain("Status");
  });

  it("search filters to matching rows only", async () => {
    const w = mountEditor();
    // The search box is the first ui/Input (top bar renders before the body).
    await w.findAllComponents(Input)[0]!.vm.$emit("update:modelValue", "status");
    await nextTick();
    const rows = w.findAllComponents(TokenRow);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => /status|toast/i.test(r.props("entry").name as string))).toBe(true);
    expect(w.text()).not.toContain("--color-surface-base");
  });

  it("shows the empty state when nothing matches", async () => {
    const w = mountEditor();
    await w.findAllComponents(Input)[0]!.vm.$emit("update:modelValue", "zzz-no-match-zzz");
    await nextTick();
    expect(w.findAllComponents(TokenRow)).toHaveLength(0);
    expect(w.text()).toContain("No tokens match");
  });

  it("forwards a row's set/reset up to its own emit", async () => {
    const w = mountEditor({ "--color-interactive": "oklch(0.6 0.2 280)" });
    const row = w.findAllComponents(TokenRow)[0]!;
    row.vm.$emit("set", "--color-surface-base", "oklch(0.2 0 0)");
    row.vm.$emit("reset", "--color-surface-base");
    expect(w.emitted("set")?.[0]).toEqual(["--color-surface-base", "oklch(0.2 0 0)"]);
    expect(w.emitted("reset")?.[0]).toEqual(["--color-surface-base"]);
  });

  it("Reset all is disabled with no overrides and emits when there are some", async () => {
    const empty = mountEditor({});
    const resetBtn = (w: VueWrapper) =>
      w.findAllComponents(Button).find((b) => b.text().includes("Reset all"))!;
    expect(resetBtn(empty).props("disabled")).toBe(true);

    const w = mountEditor({ "--color-interactive": "oklch(0.6 0.2 280)" });
    expect(w.text()).toContain("1 edited");
    expect(resetBtn(w).props("disabled")).toBe(false);
    await resetBtn(w).trigger("click");
    expect(w.emitted("reset-all")).toHaveLength(1);
  });
});
