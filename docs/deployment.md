# Deployment

CommandVue is a static SPA. Any web server can ship the contents of
`dist/`. The template includes a Docker recipe that wraps an
nginx-served bundle for parity with production.

## Container recipe

Multi-stage `Dockerfile`:

- Build: `node:22-alpine` + Corepack-managed pnpm + a BuildKit cache
  mount on the pnpm store. Layered so `pnpm install` caches separately
  from source changes.
- Runtime: `nginx:alpine` carrying only `dist/` + our `nginx.conf`.
  Healthcheck via `wget --spider` against `/`.

Build + run:

```bash
pnpm docker:build         # → commandvue:local (~150 MB on disk)
pnpm docker:up            # → http://localhost:8080
pnpm docker:down
```

The image is fully self-contained — Cesium assets, MapLibre, Inter
font files all live under `dist/`.

## nginx config highlights

`nginx.conf` ships with:

- **SPA fallback** — `try_files $uri $uri/ /index.html;` so Vue
  Router's history mode works on deep-link refresh.
- **Long-cache hash assets** — `/assets/` and `/cesium/` get a
  `Cache-Control: public, immutable` + 1-year `expires`.
- **No-cache entry HTML** — `/index.html` is `no-cache, no-store,
must-revalidate` so users pick up new asset hashes immediately.
- **Gzip** — text + JSON + JS + CSS + SVG + `application/wasm`.
- **Security headers** — `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy`.
- **`server_tokens off`** — hides the nginx version banner.

### Content-Security-Policy

Intentionally **not set** by default. CSP must be tailored per
deployment because the policy depends on the consumer's backends,
tile sources, CDNs, and embedded widgets. A suggested baseline for a
self-contained CommandVue deployment hitting OpenFreeMap + the demo
WS:

```nginx
add_header Content-Security-Policy
  "default-src 'self'; \
   script-src 'self'; \
   style-src 'self' 'unsafe-inline'; \
   img-src 'self' data: blob: https://tiles.openfreemap.org; \
   font-src 'self' data:; \
   connect-src 'self' https://tiles.openfreemap.org wss:; \
   worker-src 'self' blob:;"
  always;
```

`unsafe-inline` on `style-src` is required by Tailwind's compiled
output today; we're tracking the upstream movement toward
nonce-friendly style emission and will tighten when feasible.

## Environment variables

| Name                          | Default                       | Purpose                      |
| ----------------------------- | ----------------------------- | ---------------------------- |
| `VITE_APP_NAME`               | `CommandVue`                  | TitleBar + browser tab label |
| `VITE_WS_URL`                 | `wss://echo.websocket.events` | Telemetry WS endpoint        |
| `VITE_DEFAULT_MAP_CENTER_LAT` | `30.0`                        | Initial map center           |
| `VITE_DEFAULT_MAP_CENTER_LON` | `70.0`                        | Initial map center           |
| `VITE_DEFAULT_MAP_ZOOM`       | `4`                           | Initial zoom                 |

Copy `.env.example` → `.env.local` to override locally. Vite bakes
these into the production bundle at build time, so production overrides
mean a rebuild.

### Rotating values without a rebuild

If you need to swap `VITE_WS_URL` per environment without rebuilding
the image, proxy through nginx and have the SPA hit a relative path:

```nginx
location /telemetry-ws {
  proxy_pass http://your-backend:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

Build with `VITE_WS_URL=wss://your.host/telemetry-ws` (or `/telemetry-ws`
if same-origin) and let the reverse proxy switch upstreams.

## Offline / air-gapped mode

CommandVue's only mandatory outbound dependency is the **MapLibre style
JSON + raster tiles**. Cesium ships its assets via static-copy. To run
fully offline:

1. **Self-host MapLibre tiles.** Drop a `style.json` + tile pyramid
   into `public/maps/` (or `/usr/share/nginx/html/maps/` for the
   container). Reference it via `VITE_MAPLIBRE_STYLE_URL=/maps/style.json`.

   `src/modules/maplibre/styles.ts` exports `OFFLINE_STUB_STYLE` —
   a minimal valid spec with no sources — for the case where you want
   the panel to render even when no tile source is reachable.

2. **Self-host the WS endpoint.** Set `VITE_WS_URL` to your internal
   wss URL (or use the nginx proxy approach above).

3. **Remove the OpenFreeMap attribution link** if you're not using it
   anymore. It's set automatically by MapLibre when the style includes
   the OpenFreeMap sources.

The Cesium globe ships imagery via Cesium's bundled assets, so the 3D
panel works offline by default. Imagery layers from external providers
(Bing, ArcGIS) need their tokens / quotas; replace them via the Cesium
`Viewer` configuration in `useCesium.ts`.

## CDN / static-host alternatives

The `dist/` output is plain static. Drop it onto any of these without
the Docker recipe:

- **Cloudflare Pages / Netlify / Vercel** — point at the repo, set the
  build command to `pnpm build`, output directory to `dist`. Set env
  vars in the platform UI (rebuilds on change).
- **S3 + CloudFront** — `aws s3 sync dist/ s3://bucket/` plus a
  CloudFront distribution with the default-root-object set to
  `index.html` and a custom-error-response on 403/404 → `/index.html`
  (the SPA-fallback equivalent).
- **GitHub Pages** — copy `dist/` into a `gh-pages` branch via the
  standard workflow. The repo's nginx headers won't apply; you'd be
  trusting GitHub's defaults.

The Docker recipe is the recommended production path because it bakes
in our security headers and cache strategy.

## Reverse-proxy + backend pattern

The `docker-compose.yml` includes a commented backend service stub.
The intended composition for a production stack:

```
[ client ] → nginx (this image)
                ├─ /              → static SPA
                ├─ /api/*         → proxy_pass http://backend:3000
                └─ /ws/*          → proxy_pass http://backend:3000 (upgraded)
```

Add the `proxy_pass` blocks to `nginx.conf` when you wire the backend.
The compose file already has the network shape ready.

## Health and observability

The container exposes a `/` healthcheck via the Dockerfile's
`HEALTHCHECK` directive. For richer health, add a `/healthz` route on
your backend and proxy it through nginx. Logging is plain nginx
`access.log` / `error.log` to stdout/stderr — pipe them into your log
aggregator of choice.

## Shipping the documentation site

The `docs/` tree is a VitePress site. The build is independent of the
app build and produces a separate static bundle:

```bash
pnpm docs:build     # → docs/.vitepress/dist/
pnpm docs:preview   # local sanity check of the built site
```

The output is plain static. The same hosts that serve the app bundle
work here:

- **GitHub Pages** — point a workflow at `docs/.vitepress/dist/` after
  `pnpm docs:build`. Use a separate `gh-pages` branch (or the new
  Pages-from-workflow flow) so it doesn't collide with the app bundle.
- **Netlify / Cloudflare Pages / Vercel** — set the build command to
  `pnpm docs:build` and publish `docs/.vitepress/dist/`. Useful when
  the app itself ships elsewhere.
- **Same nginx container as the app** — copy the docs bundle into
  `/usr/share/nginx/html/docs/` and add a `location /docs/ { try_files
$uri $uri/ /docs/index.html; }` block so its client-side routing
  works.

The docs site has no runtime dependencies (no API calls, no WS), so
offline / air-gapped deployment is just "serve the static folder."
