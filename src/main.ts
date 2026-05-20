import "@fontsource-variable/inter";

import "@/assets/styles/main.css";

import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { createApp, defineAsyncComponent } from "vue";

import App from "./App.vue";
import { router } from "./router";

const app = createApp(App);

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
/* eslint-enable vue/component-definition-name-casing */

app.mount("#app");
