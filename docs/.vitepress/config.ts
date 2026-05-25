import { defineConfig } from "vitepress";

/**
 * VitePress site config for CommandVue's documentation.
 *
 * Layout:
 *   docs/                       ← VitePress root (set via srcDir below)
 *     index.md                  ← landing page
 *     <section>.md              ← one page per doc topic
 *     research/                 ← deeper notes (linked, not in sidebar)
 *     .vitepress/
 *       config.ts               ← THIS FILE
 *       cache/  dist/           ← gitignored runtime + build output
 *
 * The sidebar mirrors the order in CLAUDE.md / README.md so a new reader
 * walks from "what is this" → "how do panels work" → "how do I theme it"
 * → "how do I ship it".
 */
export default defineConfig({
  title: "CommandVue",
  description:
    "Vue 3 template for operations dashboards — command-and-control, fleet monitoring, geospatial operations, real-time telemetry.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",

  head: [
    ["meta", { name: "theme-color", content: "#0b1120" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "CommandVue documentation" }],
    [
      "meta",
      {
        name: "og:description",
        content:
          "Vue 3 template for operations dashboards. Cesium + MapLibre, Dockview panels, PrimeVue + Tailwind, batteries included.",
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: "Guide", link: "/architecture" },
      { text: "Roadmap", link: "/roadmap" },
      {
        text: "v0.1.0",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/uraanai/CommandVue/blob/main/CHANGELOG.md",
          },
          {
            text: "Contributing",
            link: "https://github.com/uraanai/CommandVue/blob/main/CONTRIBUTING.md",
          },
        ],
      },
    ],

    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Architecture", link: "/architecture" },
        ],
      },
      {
        text: "Building",
        items: [
          { text: "Panels", link: "/panels" },
          { text: "UI primitives", link: "/contributing-ui" },
          { text: "DataTable", link: "/datatable" },
          { text: "Tools", link: "/tools" },
          { text: "State", link: "/state" },
          { text: "Real-time", link: "/realtime" },
        ],
      },
      {
        text: "Look & feel",
        items: [
          { text: "Styling", link: "/styling" },
          { text: "Theming", link: "/theming" },
          { text: "Icons", link: "/icons" },
        ],
      },
      {
        text: "Shipping",
        items: [
          { text: "Deployment", link: "/deployment" },
          { text: "Roadmap", link: "/roadmap" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/uraanai/CommandVue" }],

    editLink: {
      pattern: "https://github.com/uraanai/CommandVue/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Apache 2.0 licensed. Built by Uraan AI.",
      copyright: "© 2026 Uraan AI",
    },

    search: { provider: "local" },
  },
});
