# CommandVue

> A production-grade Vue 3 template for operations dashboards — command-and-control, fleet monitoring, geospatial operations, and real-time telemetry. Cesium 3D globe, MapLibre 2D maps, Dockview panels, PrimeVue + Tailwind, standardized operational symbology, batteries included.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/uraanai/CommandVue/actions/workflows/ci.yml/badge.svg)](https://github.com/uraanai/CommandVue/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522.12-339933?logo=node.js&logoColor=white)](./.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Use this template](https://img.shields.io/badge/use_this-template-2da44e?logo=github)](https://github.com/uraanai/CommandVue/generate)

<!-- TODO: add screenshot of demo dock layout at docs/screenshots/hero.png and reference it here -->

---

## Why CommandVue

- **Map-first.** Cesium 3D globe and MapLibre 2D map render side-by-side in dockable panels with shared coordinate readouts.
- **Panel-based.** Dockview manages drag-resize-tab-stack layouts; user layouts persist to IndexedDB and survive reloads.
- **Production-grade.** Strict TypeScript, ESLint 9 flat config, Prettier, Vitest, vue-tsc, CSpell with operations dictionaries, Husky + commitlint, GitHub Actions CI.
- **Batteries included.** Every dependency in the locked stack is wired and demonstrated by a working example panel — symbology, telemetry, charts, virtual tables, real-time WebSocket.

---

## Stack

| Layer                   | Choice                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| Framework               | Vue 3 + Vite                                                                 |
| Language                | TypeScript (strict)                                                          |
| Router                  | Vue Router 4                                                                 |
| State                   | Pinia                                                                        |
| Package manager         | pnpm (with workspaces)                                                       |
| UI components           | PrimeVue (unstyled) + Tailwind v4                                            |
| Window/panel manager    | Dockview Vue                                                                 |
| Icons                   | @lucide/vue + @iconify-prerendered/vue-mdi + @heroicons/vue                  |
| 3D map                  | CesiumJS                                                                     |
| 2D map                  | MapLibre GL                                                                  |
| Geospatial math         | @turf/\*, mgrs, h3-js, formatcoords, suncalc                                 |
| Operational symbology   | milsymbol, @orbat-mapper/convert-symbology (MIL-STD-2525 / APP-6 SIDC codes) |
| Charting                | Apache ECharts (primary) + d3-\* modules (escape hatch)                      |
| Real-time               | Native WebSocket via @vueuse/core useWebSocket                               |
| Tables / virtualization | @tanstack/vue-table + @tanstack/vue-virtual                                  |
| Drag & drop             | @atlaskit/pragmatic-drag-and-drop                                            |
| Storage / offline       | idb (IndexedDB), browser-fs-access                                           |
| Utilities               | @vueuse/core, dayjs, es-toolkit, nanoid, fuzzysort, immer, klona, rfc6902    |
| Markdown                | markdown-it                                                                  |
| Quality                 | ESLint 9 flat config, Prettier, Vitest, vue-tsc, CSpell                      |
| Containerization        | Multi-stage Dockerfile + docker-compose.yml                                  |

---

## Quick start

```bash
# 1. Click "Use this template" on GitHub
#    → https://github.com/uraanai/CommandVue/generate
#
# 2. Then locally:
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
pnpm install
pnpm dev
```

Requirements: Node ≥ 22.12, pnpm 10.x.

---

## Project structure

```
CommandVue/
├── .github/         CI workflows, dependabot, issue templates
├── .husky/          Git hooks (pre-commit, commit-msg)
├── dictionaries/    CSpell dictionaries (defense, project, tech)
├── docs/            Architecture, panels, tools, theming, deployment
├── public/cesium/   Cesium runtime assets (copied at build time)
├── src/
│   ├── assets/styles/   tokens.css, main.css (Tailwind), dockview.css
│   ├── components/
│   │   ├── ui/          PrimeVue unstyled wrappers
│   │   ├── layout/      AppShell, TitleBar, StatusBar, DockLayout
│   │   ├── panels/      CesiumPanel, MapLibrePanel, EntityListPanel, etc.
│   │   ├── map/         CoordinateReadout, ScaleBar
│   │   └── common/      ErrorBoundary, LoadingSpinner, EmptyState
│   ├── composables/     useCesium, useMapLibre, useWebSocketClient, …
│   ├── modules/         cesium, maplibre, symbology, geo, realtime, tools
│   ├── stores/          ui, layout, tools, entities, telemetry, connection
│   ├── router/          routes
│   ├── views/           HomeView, DemoView, AboutView
│   ├── types/, utils/
│   ├── App.vue, main.ts
├── tests/unit/
├── Dockerfile, docker-compose.yml, nginx.conf
└── CLAUDE.md        Agent instructions (read first)
```

---

## Scripts

| Command             | Action                                                        |
| ------------------- | ------------------------------------------------------------- |
| `pnpm dev`          | Start Vite dev server on http://localhost:5173                |
| `pnpm build`        | Type-check + production build to `dist/`                      |
| `pnpm preview`      | Serve the production build locally                            |
| `pnpm lint`         | Run ESLint with `--fix` and cache                             |
| `pnpm format`       | Prettier write across `src/`                                  |
| `pnpm format:check` | Prettier check (CI-friendly)                                  |
| `pnpm type-check`   | `vue-tsc --build` across all tsconfig projects                |
| `pnpm test`         | Vitest one-shot                                               |
| `pnpm test:watch`   | Vitest watch mode                                             |
| `pnpm spell`        | CSpell across source + docs                                   |
| `pnpm docs:dev`     | Run the VitePress docs site locally (auto-picks a free port)  |
| `pnpm docs:build`   | Build the docs site to `docs/.vitepress/dist/`                |
| `pnpm docs:preview` | Serve the built docs site                                     |
| `pnpm docker:build` | Build the multi-stage Docker image (`commandvue:local`)       |
| `pnpm docker:up`    | `docker compose up --build` (serves on http://localhost:8080) |
| `pnpm docker:down`  | Stop the compose stack                                        |

---

## Configuration

Copy `.env.example` to `.env.local` and override per environment:

| Variable                  | Default                       | Purpose                                                |
| ------------------------- | ----------------------------- | ------------------------------------------------------ |
| `VITE_WS_URL`             | `wss://echo.websocket.events` | Telemetry WebSocket endpoint                           |
| `VITE_MAPLIBRE_STYLE_URL` | OpenFreeMap Liberty           | MapLibre style URL (use a self-hosted one for offline) |
| `VITE_APP_TITLE`          | `CommandVue`                  | Title shown in the tab and TitleBar                    |

---

## Customization

- **Branding & theming** — see [`docs/theming.md`](./docs/theming.md).
- **Adding a panel** — see [`docs/panels.md`](./docs/panels.md).
- **Adding a tool (measure / draw / select)** — see [`docs/tools.md`](./docs/tools.md).
- **Architecture deep-dive (Cesium / MapLibre interplay)** — see [`docs/architecture.md`](./docs/architecture.md).
- **Deployment (Docker, nginx, offline)** — see [`docs/deployment.md`](./docs/deployment.md).

---

## Documentation site

The `docs/` tree is served as a [VitePress](https://vitepress.dev/) site with sidebar navigation, local search, and dark mode by default:

```bash
pnpm docs:dev       # live preview, picks a free port
pnpm docs:build     # static output → docs/.vitepress/dist/
pnpm docs:preview   # serve the built site
```

The site config lives at [`docs/.vitepress/config.ts`](./docs/.vitepress/config.ts). When adding a new doc page, register it in the sidebar there so it appears in the nav.

---

## Docker

```bash
pnpm docker:build
pnpm docker:up    # serves http://localhost:8080
pnpm docker:down
```

The multi-stage `Dockerfile` builds with Node 22 + pnpm via Corepack, then ships the static bundle behind nginx-alpine with an SPA fallback.

---

## Contributing

Pull requests welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the development setup, commit conventions (Conventional Commits, enforced by commitlint), and the code-of-conduct. Security reports go to the address in [`SECURITY.md`](./SECURITY.md).

---

## License

Apache 2.0 — see [`LICENSE`](./LICENSE).

---

## Credits

Built and maintained by [Uraan AI](https://uraanai.com). Inspired by [orbat-mapper](https://github.com/orbat-mapper/orbat-mapper).
