import "@fontsource-variable/inter";

import "@/assets/styles/main.css";

import { LUCIDE_CONTEXT } from "@lucide/vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { createApp, defineAsyncComponent } from "vue";

import { initializeTheme } from "@/composables/useTheme";
import { registerBuiltinChromeItems } from "@/modules/chrome/builtin";
import { registerBuiltinPanels } from "@/modules/panels/builtin";
import { MISSING_PANEL_TYPE, registerMissingPanel } from "@/modules/panels/missing";
import { registerUnassignedPanel, UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { registerBuiltinPresetTypes } from "@/modules/presets/builtin";
import { seedIfEmpty } from "@/modules/storage/seed";
import { themeRepo } from "@/modules/storage/themeRepo";
import { registerBuiltinThemes } from "@/modules/themes/builtin";
import { themeRegistry } from "@/modules/themes/registry";

import App from "./App.vue";
import { router } from "./router";

// First-run seed before anything else touches storage. Top-level await is
// supported by Vite for entry modules; ensures the Operations workspace,
// Default layout, and Default chrome profile exist before App.vue mounts.
await seedIfEmpty();

// Theme bootstrap. Hydrates `useTheme()`'s in-memory mode from IDB (the
// authoritative store), wires the prefers-color-scheme listener for auto
// mode, and re-applies the resolved theme to `data-theme` on <html>. The
// anti-FOUC inline script in `index.html` already set a paint-safe value;
// this call reconciles IDB with that and fixes the rare case where the
// localStorage mirror diverged from IDB (private mode, storage cleared, …).
await initializeTheme();

// Suppress the browser's native context menu site-wide. CommandVue's
// right-click affordances are handled by PrimeVue ContextMenu instances
// throughout the app, and the native menu would otherwise overlay them.
// Native menu is preserved for text editing surfaces (`<input>`,
// `<textarea>`, and any `contenteditable` host) so users keep cut / copy /
// paste / spell-check. This deliberately mimics the eventual desktop
// (Tauri / Electron) packaging where the OS has no browser-tab chrome to
// host a native page menu at all.
window.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("input, textarea, [contenteditable=''], [contenteditable='true']")) {
      return;
    }
    event.preventDefault();
  },
  { capture: true },
);

// Populate the panel registry before mount. The registry sits alongside the
// global `app.component()` registrations below — Dockview resolves panel
// components from the global registry, while the panel registry owns the
// metadata (title, icon, category, async loader) used by menus and Phase F's
// preset `applicableTo` contract.
registerBuiltinPanels();
registerUnassignedPanel();
registerMissingPanel();
registerBuiltinChromeItems();
registerBuiltinPresetTypes();
registerBuiltinThemes();

// Hydrate the theme registry with any custom themes persisted in IndexedDB
// (Prompt 4 Phase C). Runs AFTER `registerBuiltinThemes()` so the built-ins
// own the canonical ids first; loadFromRepo skips already-registered ids. The
// fetcher is passed in (rather than the registry importing themeRepo) to keep
// the registry storage-agnostic and avoid a circular import.
await themeRegistry.loadFromRepo(() => themeRepo.getAll());

const app = createApp(App);

// `@lucide/vue` 1.16's <Icon /> is a functional component that calls
// `inject(LUCIDE_CONTEXT, {})` on render. Without a matching `provide()`
// at the app root, the destructuring inside Icon throws
// `Cannot destructure property 'size' of useLucideProps() as it is undefined`.
// Providing an empty object globally satisfies the inject and lets icons
// use their own per-instance props.
app.provide(LUCIDE_CONTEXT, {});

app.use(createPinia());
app.use(router);

// PrimeVue is registered in unstyled mode — all visual styling comes from
// the wrappers in `@/components/ui/*` using Tailwind classes via the
// passthrough (pt) API.
app.use(PrimeVue, { unstyled: true });

// Dockview-vue 6 looks up panel components by string name via Vue's local +
// global registry (it walks the parent chain looking at `instance.components`
// and falls back to `appContext.components`). We register each panel
// globally here under its lowercase dockview panel-type ID so any
// `<DockviewVue>` instance can resolve them. Async imports preserve the
// lazy-chunk strategy from the previous (v4) wiring.
//
// The lowercase names match the `component:` string passed to `addPanel` in
// `DockLayout.vue`. Vue's lint rule prefers PascalCase, but these are
// dockview panel-type IDs, not template tag names — disable the rule.
/* eslint-disable vue/component-definition-name-casing */
app.component(
  "cesium",
  defineAsyncComponent(() => import("@/components/panels/CesiumPanel.vue")),
);
app.component(
  "maplibre",
  defineAsyncComponent(() => import("@/components/panels/MapLibrePanel.vue")),
);
app.component(
  "entities",
  defineAsyncComponent(() => import("@/components/panels/EntityListPanel.vue")),
);
app.component(
  "chart",
  defineAsyncComponent(() => import("@/components/panels/ChartPanel.vue")),
);
app.component(
  "telemetry",
  defineAsyncComponent(() => import("@/components/panels/TelemetryPanel.vue")),
);
app.component(
  "symbology",
  defineAsyncComponent(() => import("@/components/panels/SymbologyPanel.vue")),
);
app.component(
  "markdown",
  defineAsyncComponent(() => import("@/components/panels/MarkdownPanel.vue")),
);
app.component(
  "components-browser",
  defineAsyncComponent(() => import("@/components/panels/ComponentsPanel.vue")),
);
app.component(
  UNASSIGNED_PANEL_TYPE,
  defineAsyncComponent(() => import("@/components/panels/UnassignedPanel.vue")),
);
app.component(
  MISSING_PANEL_TYPE,
  defineAsyncComponent(() => import("@/components/panels/MissingPanelPlaceholder.vue")),
);
/* eslint-enable vue/component-definition-name-casing */

app.mount("#app");
