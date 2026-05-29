# Roadmap

Future-work bucket for CommandVue. Items here are explicitly **not**
in 0.1.0 and exist as a placeholder for "we considered this and
deferred" decisions. File an issue if you want to take any of them on.

## Drawing / measurement

- **Edit handles after finalization** — the design and pseudocode are
  in `docs/research/phase-7-orbat-mapper-notes.md`; the implementation
  is intentionally not in 0.1.0 because drag-edit can surprise users
  who just want to read a measurement. Add an `editable: boolean` prop
  to the tool and a host-level toggle in `MapLibrePanel.vue`.
- **Persistent drawings** — `useDrawingsStore` is in-memory only.
  Adding an idb-backed persistence layer mirrors the layout store
  pattern; the store action signatures already make this a drop-in
  change.
- **GeoJSON export** — `useDrawingsStore.featureCollection` is
  already wired as a computed. A "Download" UI in the TitleBar that
  serializes it through `@/utils/files.saveFile` is a small follow-up.

## Real-time

- **Exponential-backoff reconnect** — `src/modules/realtime/reconnect.ts`
  exports `calculateBackoff()` (with jitter) but `useWebSocketClient`
  currently uses a fixed 1 s delay because `@vueuse/core` v12's
  `autoReconnect.delay` expects a number. Wire a manual reconnect loop
  watching `status`.
- **Pluggable transports** — the envelope shape works for SSE, MQTT-WS,
  and direct WebSocket. A `createTransport({ kind, url })` factory
  would slot in without changing the panels.
- **Backpressure / sampling** — the telemetry store's rolling buffer
  is a fixed 50-message FIFO. For high-rate feeds, add a sampling
  policy (rate-limit, decimate, or coalesce-by-id).

## Rendering

- **deck.gl renderer backend** — discussed in
  `docs/research/phase-7-orbat-mapper-notes.md`. The drawing tool's
  layer-add code could go behind a renderer interface so a deck.gl
  backend could swap in for high-density visualization. Not needed for
  the demo; on the table if a fork needs hundreds of thousands of
  features.
- **Cesium ↔ MapLibre camera sync** — opt-in composable, not default
  behavior. Pattern is well-known (project the active map's center
  forward / backward); needs to be implemented behind a
  `useMapSync(cesium, maplibre)` composable so consumers opt in
  explicitly.

## Symbology

- **SIDC 2525D / APP-6D support** — milsymbol handles the rendering;
  `@orbat-mapper/convert-symbology` handles the cross-dialect
  conversion. We don't bake either into the panels yet because the
  template doesn't ship domain data — but a downstream fork that
  receives SIDC codes from a backend will want the converter wired.
- **Custom symbol overlays** — milsymbol takes a `markerColor` and
  `iconColor`; surfacing them as feature properties + Tailwind tokens
  would let users theme symbol fills the same way they theme the rest
  of the chrome.

## UI surface

- **Help dialog driven by the shortcut catalog** — the catalog already
  carries `label` + `scope`. A `?` shortcut opens a panel that lists
  every binding by scope.
- **Command palette: entities + drawings as result categories** — they
  appear in the data model but aren't wired into the palette's search
  yet. The `category` field on `CommandItem` is the extension point.
- **Toast notifications** — the `Toast.vue` wrapper is in place but no
  `ToastService` is registered with PrimeVue. A producer-side composable
  (`useNotify`) on top of PrimeVue's `useToast` would finish the loop.

## Theming

The runtime theme authoring system (Prompt 4) ships storage, an OKLCH
generation engine, a constrained customizer, per-workspace binding, and
JSON import/export. Deferred extensions:

- **Raw JSON editor with live preview** — a built-in editor (Monaco /
  CodeMirror) where power users type theme JSON and see it apply live, with
  inline validation. The constrained customizer (`ThemeCustomizerDialog`) plus
  JSON import (`ThemeImportDialog`) cover the 90% case; a raw editor's UX
  guardrails need more thought. Foundation already in place: the schema
  (`src/types/theme.ts`), the Zod validator
  (`src/modules/themes/portableSchema.ts`), the apply engine (`apply.ts`), the
  registry (custom themes), and the known-token allowlist.
- **Theme marketplace / community sharing** — browse and install community
  themes from inside the app. Server-side; lands with the Supabase migration.
  The `PortableTheme` JSON wire format + [`docs/theme-schema-for-llms.md`](./theme-schema-for-llms.md)
  are the foundation it would build on.
- **Accessibility theme variants** — high-contrast and colour-blind-safe
  variants generated from the same customizer inputs (pin contrast to max,
  shift status hues to a CVD-safe set). The engine already computes WCAG
  ratios; this exposes them as first-class variants. See
  [`docs/theme-generation-algorithm.md` → Beyond colors](./theme-generation-algorithm.md#beyond-colors-other-themeable-dimensions).
- **Typography & motion theming** — the generator emits colour tokens today.
  Role-based fonts (`body` / `ui` / `display` / `mono`), a type scale, and
  motion-duration tokens are the next pillars — design + decision tree in
  [`docs/theme-generation-algorithm.md` → Beyond colors](./theme-generation-algorithm.md#beyond-colors-other-themeable-dimensions).

## Tooling

- **CSP nonce emission** — Tailwind's compiled CSS currently requires
  `style-src 'unsafe-inline'`. Tighten when the upstream supports
  nonces.
- **Per-PR Lighthouse budget check** — `pnpm build` already passes the
  60 KB shell budget, but enforcing it in CI is a small follow-up.
  Treat the warning printed on Cesium / MapLibre chunks as documented
  expectations.

## Container

- **Distroless runtime** — `nginx:alpine` is fine for a template; a
  distroless variant (or even a `nginx-unprivileged` rootless build)
  is a hardening follow-up.
- **Multi-arch images** — the Dockerfile is platform-neutral; build a
  multi-arch manifest via `docker buildx` and publish to GHCR.

## Out of scope (forever)

These belong in your fork, not in the template:

- Domain models (units, missions, scenarios).
- Authentication / authorization (token storage, login flows).
- Backend APIs (REST clients, GraphQL, etc.).
- Anything that ties to a specific operator / vendor / scenario.

The template's job is to give you a clean shell. Everything in
`src/components/panels/` is a demo; everything in `src/modules/` and
`src/composables/` is reusable scaffolding.
