# CommandVue — Claude Code / Agent Instructions

This file is read by Claude Code and other AI coding agents at the start of every session. It defines the project's stack, conventions, and rules so agents produce consistent, high-quality code.

---

## Project context

**CommandVue** is an open-source Vue 3 boilerplate for operations dashboards: command-and-control, fleet monitoring, geospatial operations, mission planning, and real-time telemetry. It is map-first, panel-based, and built to be extended.

This repository is a **template**. Code in this repo should be generic, reusable, and free of domain-specific business logic. Examples and demos are welcome; product-specific features are not.

**Maintainer:** Uraan AI — https://uraanai.com
**Repository:** https://github.com/uraanai/CommandVue
**License:** Apache 2.0

---

## Locked technology stack

Do not substitute libraries from this list without explicit instruction.

| Layer | Choice |
|---|---|
| Framework | Vue 3 + Vite |
| Language | TypeScript (strict) |
| Router | Vue Router 4 |
| State | Pinia |
| Package manager | pnpm (with workspaces) |
| UI components | PrimeVue (unstyled) + Tailwind v4 |
| Window/panel manager | Dockview Vue |
| Icons | @lucide/vue + @iconify-prerendered/vue-mdi + @heroicons/vue |
| 3D map | CesiumJS |
| 2D map | MapLibre GL |
| Geospatial math | @turf/*, mgrs, h3-js, formatcoords, suncalc |
| Operational symbology | milsymbol, @orbat-mapper/convert-symbology (MIL-STD-2525 / APP-6 SIDC codes) |
| Charting | Apache ECharts (primary) + d3-* modules (escape hatch) |
| Real-time | Native WebSocket via @vueuse/core useWebSocket |
| Tables / virtualization | @tanstack/vue-table + @tanstack/vue-virtual |
| Drag & drop | @atlaskit/pragmatic-drag-and-drop |
| Storage / offline | idb (IndexedDB), browser-fs-access |
| Utilities | @vueuse/core, dayjs, es-toolkit, nanoid, fuzzysort, immer, klona, rfc6902 |
| Markdown | markdown-it |
| Spell-check (code) | CSpell + dictionaries/*.txt |
| Spell-check (user input) | Native `spellcheck` attribute |
| Build | Vite |
| Quality | ESLint 9 flat config, Prettier, Vitest, vue-tsc |
| Containerization | Multi-stage Dockerfile + docker-compose.yml |

---

## Icon usage rules

- **@lucide/vue** — UI chrome only (buttons, toolbars, panel controls, status indicators).
- **@iconify-prerendered/vue-mdi** — domain icons (units, vehicles, aircraft, weather, sensors, infrastructure).
- **@heroicons/vue** — sparingly, only where the Heroicons aesthetic matches better than Lucide.
- **Always use named imports.** Never `import * as Icons`. Tree-shaking depends on this.

---

## Architectural rules

1. **Cesium and MapLibre run in separate DOM containers with separate render loops.** Do not attempt to sync cameras automatically. If sync is needed for a specific feature, it is opt-in and lives in a composable.
2. **Viewer/map instances are never stored in reactive state.** Hold them in `shallowRef` or plain refs. Reactive proxies break Cesium's internals.
3. **Tools (measure, draw, select) register through the Tool Registry pattern** (`src/modules/tools/registry.ts`). Tools must implement `activate()`, `deactivate()`, and clean up all listeners.
4. **Pinia stores hold serializable state only.** No DOM refs, no Cesium objects, no Map instances in stores.
5. **Composables own lifecycle.** Initialization and teardown of viewers/maps happens in composables, not components.
6. **One panel = one component in `src/components/panels/`.** Panels are registered in `DockLayout.vue` and identified by string keys.

---

## Styling rules

- Tailwind v4 utility-first. No CSS modules, no scoped styles for layout/spacing.
- Use the `cn()` helper from `src/utils/cn.ts` (clsx + tailwind-merge) when composing dynamic classes.
- Design tokens live in `src/assets/styles/tokens.css` as CSS variables.
- Override brand colors by editing `tokens.css`. Do not hardcode hex values in components.
- Dark mode toggles via `data-theme="dark"` on `<html>`.

---

## State management rules

- One store per concern. Don't create kitchen-sink stores.
- Stores expose actions; components don't mutate state directly.
- Use `storeToRefs` when destructuring state in components.
- Persist layout state via `idb`, not localStorage (larger quota, async).

---

## File / folder conventions

- Components: PascalCase (`EntityListPanel.vue`).
- Composables: camelCase, prefixed with `use` (`useCesium.ts`).
- Stores: lowercase singular (`ui.ts`, `telemetry.ts`).
- Modules: lowercase, domain-grouped (`modules/symbology/`, `modules/geo/`).
- Types: colocated with their module; shared types in `src/types/`.

---

## Testing conventions

- Unit tests in `tests/unit/` mirror `src/` structure.
- Use Vitest + @vue/test-utils.
- Test utilities, composables, and store logic. Don't aim for component snapshot coverage.

---

## Commit conventions

Conventional Commits, enforced by commitlint:
- `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `perf:`, `style:`

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
