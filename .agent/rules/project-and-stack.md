# Project & stack

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Project context

**CommandVue** is an open-source Vue 3 boilerplate for operations dashboards: command-and-control, fleet monitoring, geospatial operations, mission planning, and real-time telemetry. It is map-first, panel-based, and built to be extended.

This repository is a **template**. Code in this repo should be generic, reusable, and free of domain-specific business logic. Examples and demos are welcome; product-specific features are not.

**Maintainer:** Uraan AI — https://uraanai.com
**Repository:** https://github.com/uraanai/CommandVue
**License:** Apache 2.0

---

## Locked technology stack

Do not substitute libraries from this list without explicit instruction.

| Layer                    | Choice                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework                | Vue 3 + Vite                                                                                                                                                 |
| Language                 | TypeScript (strict)                                                                                                                                          |
| Router                   | Vue Router 4                                                                                                                                                 |
| State                    | Pinia                                                                                                                                                        |
| Package manager          | pnpm (with workspaces)                                                                                                                                       |
| UI components            | PrimeVue (unstyled) + Tailwind v4                                                                                                                            |
| Window/panel manager     | Dockview Vue                                                                                                                                                 |
| Icons                    | @lucide/vue + @iconify-prerendered/vue-mdi + @heroicons/vue                                                                                                  |
| 3D map                   | CesiumJS                                                                                                                                                     |
| 2D map                   | MapLibre GL                                                                                                                                                  |
| Geospatial math          | @turf/\*, mgrs, h3-js, formatcoords, suncalc                                                                                                                 |
| Operational symbology    | milsymbol, @orbat-mapper/convert-symbology (MIL-STD-2525 / APP-6 SIDC codes)                                                                                 |
| Charting                 | Apache ECharts (primary) + d3-\* modules (escape hatch)                                                                                                      |
| Real-time                | Native WebSocket via @vueuse/core useWebSocket                                                                                                               |
| Tables                   | `@tanstack/vue-table` via `src/components/ui/DataTable.vue` (default) — `primevue/datatable` as escape valve, see `docs/decisions/0001-datatable-library.md` |
| Virtualization           | @tanstack/vue-virtual                                                                                                                                        |
| Drag & drop              | @atlaskit/pragmatic-drag-and-drop                                                                                                                            |
| Storage / offline        | idb (IndexedDB), browser-fs-access                                                                                                                           |
| Utilities                | @vueuse/core, dayjs, es-toolkit, nanoid, fuzzysort, immer, klona, rfc6902                                                                                    |
| Markdown                 | markdown-it                                                                                                                                                  |
| Spell-check (code)       | CSpell + dictionaries/\*.txt                                                                                                                                 |
| Spell-check (user input) | Native `spellcheck` attribute                                                                                                                                |
| Build                    | Vite                                                                                                                                                         |
| Quality                  | ESLint 9 flat config, Prettier, Vitest, vue-tsc                                                                                                              |
| Containerization         | Multi-stage Dockerfile + docker-compose.yml                                                                                                                  |
| Documentation site       | VitePress (config: `docs/.vitepress/config.ts`; scripts: `pnpm docs:dev` / `docs:build` / `docs:preview`)                                                    |

---

## What not to do

- Do not add Socket.IO. Native WebSocket only.
- Do not add lodash. Use `es-toolkit`.
- Do not add Moment. Use `dayjs`.
- Do not add Axios for the template. Use native `fetch` (users can add their preferred client).
- Do not introduce SSR or Nuxt-specific patterns.
- Do not import full icon packs.
- Do not commit secrets, API keys, or `.env` files.
- Do not add product-specific business logic. This is a template.

---

## Brand colors (overridable defaults)

The template ships with neutral slate/blue defaults. The intended primary downstream brand (Uraan AI) uses:

- Navy: `#0B1120`
- Teal: `#10C4A2`

These are documented in `docs/theming.md` as an example override.
