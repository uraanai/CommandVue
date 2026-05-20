---
layout: home

hero:
  name: CommandVue
  text: Vue 3 template for operations dashboards
  tagline: Command-and-control, fleet monitoring, geospatial operations, real-time telemetry — batteries included.
  actions:
    - theme: brand
      text: Get started
      link: /architecture
    - theme: alt
      text: View on GitHub
      link: https://github.com/uraanai/CommandVue

features:
  - title: Map-first
    details: Cesium 3D globe and MapLibre 2D map share the dock as first-class panels. Independent render loops, opt-in camera sync.
  - title: Panel-based
    details: Dockview-vue gives every workspace draggable, resizable, persisted panels. Add a panel by registering a key.
  - title: Real-time ready
    details: Typed WebSocket envelope, heartbeat, reconnect, reactive `lastMessage` / `latency`. No Socket.IO.
  - title: Operational symbology
    details: MIL-STD-2525 / APP-6 SIDC codes rendered by milsymbol. Cross-dialect conversion via `@orbat-mapper/convert-symbology`.
  - title: Themed end-to-end
    details: Tailwind v4 + CSS variables. Brand swap is a single `@theme` block. Dark mode flips via `data-theme`.
  - title: CI green
    details: ESLint 9, Prettier, Vitest, vue-tsc, CSpell, commitlint, husky. Multi-stage Dockerfile. Apache 2.0.
---

## Quickstart

```bash
pnpm install
pnpm dev
```

The dev server boots at `http://localhost:5173` with a demo dock: Cesium globe, MapLibre map, entity table, telemetry chart, WebSocket feed, symbology grid, and a markdown briefing.

## What to read first

If you're forking this template, the recommended path is:

1. [**Architecture**](/architecture) — how Cesium and MapLibre coexist, why panels are async-loaded, where state lives.
2. [**Panels**](/panels) — anatomy of a panel + how to register a new one.
3. [**Styling**](/styling) and [**Theming**](/theming) — the Tailwind v4 + tokens conventions, and a worked brand-override example.
4. [**Real-time**](/realtime) — the WsMessage envelope and the reconnect / backoff math.
5. [**Deployment**](/deployment) — Docker, nginx, env vars, offline mode.

The [roadmap](/roadmap) collects "we considered this and deferred" items so you know which extensions ship cleanly downstream.

## License

Apache 2.0. Use it, fork it, brand it. Attribution appreciated but not required.
