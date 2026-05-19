import "@fontsource-variable/inter";

import "@/assets/styles/main.css";

import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import App from "./App.vue";
import { router } from "./router";

const app = createApp(App);

app.use(createPinia());
app.use(router);

// PrimeVue is registered in unstyled mode — all visual styling comes from
// the wrappers in `@/components/ui/*` using Tailwind classes via the
// passthrough (pt) API.
app.use(PrimeVue, { unstyled: true });

app.mount("#app");
