# `pnpm dev:tunnel` — Dev Server + Cloudflare Quick Tunnel

**Status:** Spec (design approved in brainstorming; awaiting maintainer review of this doc before implementation).
**Author:** Claude (brainstormed interactively; Cloudflare Tunnel + node-cloudflared facts fetched via Context7 from `/cloudflare/cloudflared` and `/jacoblincool/node-cloudflared`).
**Scope:** A new package script, `pnpm dev:tunnel`, that starts the normal Vite dev server **and** a Cloudflare _quick_ tunnel pointed at it, then prints a public `https://<random>.trycloudflare.com` URL to the terminal so the running app can be opened from any device, anywhere — no Cloudflare account, no manual binary install.
**Out of scope (deferred):** named/persistent tunnels (stable custom domain), tunnels for `pnpm preview` or the production build, Docker integration, CI usage, auth in front of the tunnel.

---

## 1. Decisions (locked in brainstorming)

| Decision           | Choice                          | Rationale                                                                                                                              |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Tunnel type        | **Quick tunnel**                | Zero account/login/DNS; random ephemeral URL printed each run. Matches "spin up a URL to test from anywhere."                          |
| Binary acquisition | **`cloudflared` npm devDep**    | Auto-downloads the platform-correct binary on first run (Windows incl.). No manual `winget`. Cross-platform, pnpm-friendly.            |
| Command name       | **`pnpm dev:tunnel`**           | Mirrors existing `docs:dev` / `docker:up` convention. (`pnpm dev cloud` with a space would pass `cloud` as a Vite arg — wrong shape.)  |
| Orchestration      | **Single Node orchestrator**    | Knows Vite's _actual_ resolved port; clean dedicated URL banner; injects `allowedHosts` inline so committed `vite.config.ts` is clean. |
| Spec location      | **`.internal/specs/`**          | Per `CLAUDE.md` planning-doc convention (private, tracked).                                                                            |
| Branch / PR        | **`feat/dev-tunnel` → develop** | GitFlow. Built in an isolated external git worktree so the concurrently-running `feat/track-b-phase-3b-opacity` task is untouched.     |

## 2. Architecture

A single ESM orchestrator, `scripts/dev-tunnel.mjs` (style mirrors the existing `scripts/copy-cesium-assets.mjs`), run by `node`. Flow:

1. **Ensure binary** — `import { Tunnel, bin, install } from "cloudflared"`. If `!existsSync(bin)`, print `Downloading cloudflared (first run only)…` and `await install(bin)`.
2. **Start Vite programmatically** — `createServer({ server: { allowedHosts: [".trycloudflare.com"] } })` (Vite loads `vite.config.ts` and merges this inline override), then `await server.listen()` and `server.printUrls()`. Read the real port from `server.httpServer.address().port`.
3. **Start the quick tunnel** — `const tunnel = Tunnel.quick(\`http://localhost:${port}\`)`. Await the `"url"` event; print a boxed banner:
   ```
   ┌─ Cloudflare quick tunnel ──────────────────────────────┐
   │  Public URL:  https://<random>.trycloudflare.com        │
   │  Local:       http://localhost:5173                     │
   │  (ephemeral — changes every run; Ctrl+C to stop)        │
   └─────────────────────────────────────────────────────────┘
   ```
   Optionally log the `"connected"` edge location for confidence.
4. **Graceful shutdown** — on `SIGINT`/`SIGTERM`: `tunnel.stop()`, `await server.close()`, exit 0. Also surface `tunnel.on("error"/"exit")`.

### Why programmatic Vite (not two parallel CLI processes)

`run-p dev tunnel` would hardcode `--url http://localhost:5173`; if 5173 is busy, `strictPort: false` makes Vite fall back to 5174 and the tunnel would point at the wrong port. Programmatic startup reads the resolved port and keeps the tunnel correct, while also letting us inject `allowedHosts` without editing the committed config.

## 3. Files changed

| File                     | Change                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`           | Add `"dev:tunnel": "node scripts/dev-tunnel.mjs"` + `"predev:tunnel": "node scripts/copy-cesium-assets.mjs"` (mirrors `predev`, so Cesium assets exist). Add `cloudflared` to `devDependencies`. |
| `scripts/dev-tunnel.mjs` | **New** orchestrator (§2).                                                                                                                                                                       |
| `README.md`              | Add `dev:tunnel` row to the Scripts table + a short "Remote testing" note (quick-tunnel caveats: ephemeral URL, public-while-running).                                                           |
| `vite.config.ts`         | **Untouched** — `allowedHosts` is injected inline by the orchestrator; normal `pnpm dev` keeps Vite's default DNS-rebinding protection.                                                          |

## 4. Key technical details / gotchas

- **`allowedHosts` is mandatory.** Vite (current major) rejects requests whose `Host` header isn't allow-listed with `Blocked request. This host is not allowed.`. `.trycloudflare.com` (leading dot ⇒ matches any subdomain) is required because the quick-tunnel subdomain is random each run. Injected only in `dev:tunnel`, never globally.
- **No pnpm `postinstall` reliance.** The repo gates build scripts via `pnpm.onlyBuiltDependencies` (only `esbuild`). `cloudflared`'s postinstall download therefore won't run on `pnpm install` — intentional. The binary downloads on first `dev:tunnel` via the explicit `install(bin)` call, keeping `pnpm install` side-effect-free. We do **not** add `cloudflared` to `onlyBuiltDependencies`.
- **HMR over the tunnel.** Vite's HMR client infers `wss://<tunnel-host>:443`, which cloudflared proxies. Expected to work unmodified. Fallback only if verification shows it broken: set `server.hmr.clientPort = 443` in the inline override (kept out of the committed config).
- **Cesium assets.** `predev:tunnel` runs the same `copy-cesium-assets.mjs` as `predev`, so the globe works over the tunnel identically to local `pnpm dev`.
- **Security framing (documented in README note).** A quick tunnel exposes the local dev server to the public internet for as long as the command runs. The URL is unguessable but unauthenticated; stop the command (Ctrl+C) when done. This is a deliberate, opt-in dev convenience — not wired into build/preview/CI.

## 5. Verification

1. `pnpm install` in the worktree (pulls `cloudflared`).
2. `pnpm dev:tunnel` → assert: binary downloads on first run; Vite serves locally; the `trycloudflare.com` URL prints in the banner.
3. **End-to-end:** drive Playwright MCP to navigate to the printed `trycloudflare.com` URL and assert the CommandVue app mounts (real cross-origin test, not just localhost). Capture a screenshot to `.verification-screenshots/feat-dev-tunnel/`.
4. Confirm `Ctrl+C` tears down both the tunnel and the Vite server cleanly.
5. Static gauntlet for the touched files: `pnpm lint && pnpm type-check` (the new file is `.mjs`/node-only; no app-code type surface). `pnpm spell` for README/script prose; add any flagged terms (`cloudflared`, `trycloudflare`) to `dictionaries/tech.txt`.
6. Fallback: if the test browser can't reach the tunnel URL, record a manual smoke result in the PR and state the Playwright stage was skipped.

## 6. Documentation-sync obligations (per `CLAUDE.md`)

- **New pnpm script** → README Scripts table (§3). ✅ planned.
- **New dependency (`cloudflared`, dev-only tooling)** → add to README's stack/tooling note. It is a dev convenience, **not** an architectural lock, so it is intentionally **not** added to the `Locked technology stack` table in `CLAUDE.md`. Flagged here for maintainer agreement.
- **CSpell** → add `cloudflared` / `trycloudflare` to `dictionaries/tech.txt`, never to `cspell.json`.

## 7. Open questions for maintainer

1. README placement of the dev-dependency mention — a small "Remote testing" subsection under Scripts is proposed; confirm that's the right home vs. the Stack table.
2. Any objection to leaving the `.internal/specs/` doc in the PR diff (already chosen "committed"), vs. squashing it out before opening the PR.
