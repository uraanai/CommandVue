# Architecture

How CommandVue's parts fit together. Read this first when extending the
template.

## Stack at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  AppShell.vue  (h-screen flex-col, mounts useTheme + shortcuts)      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ TitleBar  (brand · nav · tool toggles · palette · theme)     │    │
│  ├──────────────────────────────────────────────────────────────┤    │
│  │                                                              │    │
│  │  RouterView                                                  │    │
│  │    /     → HomeView   → DockLayout (dockview-vue)            │    │
│  │    /demo → DemoView   → single-panel mount via ?panel=       │    │
│  │    /about → AboutView                                        │    │
│  │                                                              │    │
│  │  Each panel is lazy: defineAsyncComponent(() => import(...))  │    │
│  │                                                              │    │
│  ├──────────────────────────────────────────────────────────────┤    │
│  │ StatusBar  (WS pill · FPS · coordinate readout)              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  CommandPalette  (teleported overlay; opened by Cmd/Ctrl+K)          │
└──────────────────────────────────────────────────────────────────────┘
```

State (Pinia stores):

```
ui          mode · sidebar · commandPaletteOpen
layout      dockview JSON  ↔  idb('layout:dockview')
tools       activeId · history
drawings    finalized features from tools
entities    mock NATO-SIDC unit list (Phase 6 demo)
telemetry   rolling buffer · synthetic 1 Hz signal
connection  WS lifecycle status
```

## Cesium ↔ MapLibre: two engines, one shell

CommandVue runs **two map engines side by side**, each in its own DOM
container and its own render loop. They don't share state. They don't
share cameras. Sync is opt-in (it would live in a composable, not the
shell).

- **CesiumJS** — 3D globe in `CesiumPanel.vue` via `useCesium()`. The
  viewer is held in a `shallowRef` because reactivity proxies break
  Cesium's internals.
- **MapLibre GL** — 2D map in `MapLibrePanel.vue` via `useMapLibre()`.
  Same `shallowRef` pattern. Tools (`measure-distance`, `draw-polygon`)
  attach to this map via `useToolRegistry`.

Both composables register `onBeforeUnmount` cleanup so the WebGL context
is always released when a panel tears down.

### Why `vite-plugin-static-copy` for Cesium

Cesium ships ~5 MB of worker scripts, imagery assets, and stylesheets
that must be served from a known URL. Two patterns exist; we picked
static-copy because the alternative (`vite-plugin-cesium`) has been
stagnant since 2023 and breaks under recent Vite versions.

`vite.config.ts` copies `node_modules/cesium/Build/Cesium/{Assets,
Workers,ThirdParty,Widgets}` into `/cesium/` during both `dev`
(middleware) and `build` (`dist/cesium/`). The matching runtime hook
lives in `src/modules/cesium/init.ts`:

```ts
if (typeof window !== "undefined" && !window.CESIUM_BASE_URL) {
  window.CESIUM_BASE_URL = "/cesium/";
}
```

That file MUST be the first import of `useCesium.ts`. Cesium reads the
URL once at module-load time.

`optimizeDeps.exclude: ["cesium"]` prevents esbuild from pre-bundling
Cesium (its module layout breaks under esbuild's rewrites).

## Bundle budget and code splitting

Target: **initial route under 600 KB gzipped**. Achieved by lazy-loading
every panel:

```ts
const components = {
  cesium: defineAsyncComponent(() => import("@/components/panels/CesiumPanel.vue")),
  maplibre: defineAsyncComponent(() => import("@/components/panels/MapLibrePanel.vue")),
  ...
};
```

Current weights (gzipped):

| Chunk                     | Size         |
| ------------------------- | ------------ |
| `index.js` (shell)        | ~63 KB       |
| `HomeView.js` (dock host) | ~42 KB       |
| `MapLibrePanel.js`        | ~286 KB      |
| `CesiumPanel.js`          | ~1.1 MB      |
| `ChartPanel.js`           | ~165 KB      |
| Other panels              | < 50 KB each |

Cesium's chunk is large because Cesium is large — there is no further
split without forking the package. The 600 KB budget refers to the
**route shell** (index + HomeView), not Cesium.

## Tool registry → drawings flow

```
TitleBar / CommandPalette
      ↓ activate
  useToolsStore.activeId
      ↓ watch
  useToolRegistry  (in MapLibrePanel)
      ↓ setup(ctx)
  measure-distance.ts | draw-polygon.ts
      ↓ user clicks
  vertices[]  →  GeoJSON sources on the map
      ↓ Enter / dblclick
  emit(feature)
      ↓
  useDrawingsStore.add(feature)
```

The tool owns its sources / layers under a `commandvue:<tool-id>:*`
namespace and removes them in `cleanup()`. The contract is covered by
`tests/unit/tools-measure-distance.spec.ts`.

## Real-time flow

```
useWebSocketClient
  ↓
@vueuse/core useWebSocket(url, {
  autoReconnect: { retries: -1, delay: 1000 },
  heartbeat: { interval: 25s, message: ping },
})
  ↓
JSON envelope { type, id, ts, payload }  (src/modules/realtime/protocol.ts)
  ↓
useTelemetryStore.push(message)
  ↓
TelemetryPanel renders the rolling buffer
```

`VITE_WS_URL` overrides the default `wss://echo.websocket.events`.

## Where to look next

- Panel internals → `docs/panels.md`
- Tool registry contract → `docs/tools.md`
- Styling tokens → `docs/styling.md` and `docs/theming.md`
- State management → `docs/state.md`
- Real-time protocol → `docs/realtime.md`
- Container / nginx → `docs/deployment.md`
- Future work → `docs/roadmap.md`
