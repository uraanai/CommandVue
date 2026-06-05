import { mount, type VueWrapper } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import Ripple from "primevue/ripple"; // eslint-disable-line @typescript-eslint/no-restricted-imports -- test must register PrimeVue's Ripple directive to mount the panel
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import { STUDIO_L1_TABS } from "@/components/panels/theme-studio/studioTabs";
import ThemeStudioPanel from "@/components/panels/ThemeStudioPanel.vue";
import { __unregisterBuiltinThemesForTests, registerBuiltinThemes } from "@/modules/themes/builtin";
import { useThemeStore } from "@/stores/theme";

import { resetForStoreTest } from "../../stores/helpers";

function mountPanel(): VueWrapper {
  return mount(ThemeStudioPanel, {
    // Minimal usePanelApi bag — the Studio reads only `params.params`.
    props: { params: { params: {} } } as never,
    global: {
      plugins: [[PrimeVue, { unstyled: true }]],
      directives: { ripple: Ripple },
    },
    attachTo: document.body,
  });
}

/** The 5 tab header buttons (PrimeVue tags them `data-pc-name="tab"`). */
function tabs(w: VueWrapper) {
  return w.findAll('[data-pc-name="tab"]');
}
function clickTab(w: VueWrapper, label: string): Promise<void> {
  const tab = tabs(w).find((t) => t.text() === label);
  if (!tab) throw new Error(`tab "${label}" not found`);
  return tab.trigger("click").then(() => nextTick());
}

beforeEach(async () => {
  await resetForStoreTest();
  registerBuiltinThemes();
});

afterEach(() => {
  __unregisterBuiltinThemesForTests();
});

describe("ThemeStudioPanel — C6 IA", () => {
  it("renders the 5 locked L1 tabs in order", () => {
    const w = mountPanel();
    expect(tabs(w).map((t) => t.text())).toEqual(STUDIO_L1_TABS.map((t) => t.label));
  });

  it("defaults to the Generate tab showing the generation controls", () => {
    const w = mountPanel();
    const txt = w.text();
    expect(txt).toContain("Mode");
    expect(txt).toContain("Base color");
    expect(txt).toContain("Contrast");
  });

  it("renders the matching placeholder for each not-yet-built tab", async () => {
    const w = mountPanel();
    for (const { label, title, phase } of [
      { label: "Tokens", title: "Tokens", phase: "C1" },
      { label: "Typography", title: "Typography", phase: "C2" },
      { label: "Panels & Chrome", title: "Panels & Chrome", phase: "C4" },
      { label: "Effects", title: "Effects", phase: "C5" },
    ]) {
      await clickTab(w, label);
      expect(w.text()).toContain(title);
      expect(w.text()).toContain(`Lands in ${phase}`);
    }
  });

  it("keeps exactly one preview marker on every tab (preview lives outside Tabs)", async () => {
    const w = mountPanel();
    expect(w.findAll('[data-testid="studio-preview"]')).toHaveLength(1);
    for (const label of ["Tokens", "Effects", "Generate"]) {
      await clickTab(w, label);
      expect(w.findAll('[data-testid="studio-preview"]')).toHaveLength(1);
    }
  });

  it("pins the editor chrome to comfortable density; the preview reflects authored density", () => {
    const w = mountPanel();
    // The editor (controls) wrapper is pinned comfortable regardless of theme.
    expect(w.find('[data-density="comfortable"]').exists()).toBe(true);
    // The preview wrapper binds :data-density to the authored density (default comfortable).
    expect(w.find('[data-testid="studio-preview"]').attributes("data-density")).toBe("comfortable");
  });

  it("does not push a live preview on a cold blank mount", async () => {
    const store = useThemeStore();
    const spy = vi.spyOn(store, "previewThemeTokens");
    mountPanel();
    await nextTick();
    // Let any (debounced, 120ms) push fire — there must be none on a blank mount.
    await new Promise((r) => setTimeout(r, 200));
    expect(spy).not.toHaveBeenCalled();
  });
});
