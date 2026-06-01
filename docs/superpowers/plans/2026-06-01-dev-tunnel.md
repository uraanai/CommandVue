# `pnpm dev:tunnel` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `pnpm dev:tunnel` command that starts the Vite dev server and a Cloudflare _quick_ tunnel pointed at it, printing a public `https://<random>.trycloudflare.com` URL to the terminal.

**Architecture:** A single Node ESM orchestrator (`scripts/dev-tunnel.mjs`) starts Vite via its programmatic API (so it knows the resolved port and can inject `allowedHosts` without editing the committed `vite.config.ts`), then opens a cloudflared quick tunnel at that port using the `cloudflared` npm package (which auto-downloads the binary on first run).

**Tech Stack:** Node 22+ ESM, Vite 8 JS API (`createServer`/`listen`/`close`), `cloudflared` (node-cloudflared) `Tunnel.quick` + `install`/`bin`, pnpm scripts.

**Testing note (TDD exception):** This is a dev-only process orchestrator — it spawns a binary, opens a network tunnel, and downloads files. Per `CLAUDE.md` testing conventions ("test utilities, composables, and store logic; don't aim for component/script snapshot coverage") there is no meaningful unit test here. Verification is **runtime**: run the command, confirm the URL prints, and drive Playwright MCP to the live tunnel URL (the mandatory functional-verification stage). This replaces the TDD red/green steps.

**Branch / isolation:** All work happens in the external worktree `D:\Work\UraanAI\Public\CommandVue-worktrees\feat-dev-tunnel` on branch `feat/dev-tunnel` (off `origin/develop`). The concurrently-running `feat/track-b-phase-3b-opacity` checkout must never be switched or modified.

---

## File Structure

| File                                     | Responsibility                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/dev-tunnel.mjs` (**create**)    | Orchestrator: ensure binary → start Vite → open quick tunnel → print URL → graceful shutdown. Single responsibility; ~70 lines. |
| `package.json` (**modify**)              | `dev:tunnel` + `predev:tunnel` scripts; `cloudflared` devDependency.                                                            |
| `pnpm-lock.yaml` (**modify, generated**) | Lockfile entry for `cloudflared`.                                                                                               |
| `README.md` (**modify**)                 | Scripts-table row + "Remote testing" subsection.                                                                                |
| `dictionaries/tech.txt` (**modify**)     | `cloudflared`, `trycloudflare` for CSpell.                                                                                      |

---

## Task 1: Add `cloudflared` dependency + npm scripts

**Files:**

- Modify: `package.json` (scripts block ~line 42-64; devDependencies block ~line 118-158)

- [ ] **Step 1: Add the two scripts**

In `package.json` `"scripts"`, add after the existing `"dev": "vite",` line:

```json
    "predev:tunnel": "node scripts/copy-cesium-assets.mjs",
    "dev:tunnel": "node scripts/dev-tunnel.mjs",
```

(`predev:tunnel` mirrors `predev` so the Cesium assets are mirrored into `public/cesium/` before the tunnel server starts. pnpm runs `pre<script>` hooks automatically — the repo already relies on this for `predev`/`prebuild`.)

- [ ] **Step 2: Add the devDependency via pnpm (also writes the lockfile)**

Run:

```bash
pnpm add -D cloudflared
```

Expected: `cloudflared` appears in `devDependencies`, `pnpm-lock.yaml` updates, install succeeds. Note: the package's own postinstall binary download is **skipped** because the repo gates build scripts via `pnpm.onlyBuiltDependencies` — this is intentional; the binary downloads at first `dev:tunnel` run instead. Do **not** add `cloudflared` to `onlyBuiltDependencies`.

- [ ] **Step 3: Verify the scripts are registered**

Run:

```bash
pnpm run 2>&1 | grep -E "dev:tunnel|predev:tunnel"
```

Expected: both `dev:tunnel` and `predev:tunnel` are listed.

- [ ] **Step 4: Verify the package resolved**

Run:

```bash
node -e "import('cloudflared').then(m => console.log('exports:', Object.keys(m).join(',')))"
```

Expected: output includes `Tunnel`, `bin`, `install`.

---

## Task 2: Create the orchestrator script

**Files:**

- Create: `scripts/dev-tunnel.mjs`

- [ ] **Step 1: Write the orchestrator**

Create `scripts/dev-tunnel.mjs` with exactly:

```js
#!/usr/bin/env node
/**
 * `pnpm dev:tunnel` — start the Vite dev server AND a Cloudflare *quick* tunnel
 * pointed at it, then print a public https://<random>.trycloudflare.com URL so
 * the running app can be opened from any device, anywhere.
 *
 * Notes:
 * - Quick tunnel: no Cloudflare account or login. The URL is ephemeral and
 *   changes every run. The local dev server is publicly reachable for as long
 *   as this command runs — stop it (Ctrl+C) when you're done.
 * - The `cloudflared` binary is downloaded automatically on first run (the
 *   package's pnpm postinstall is intentionally not run — see the dev:tunnel
 *   spec). Subsequent runs reuse the cached binary.
 * - `server.allowedHosts` is injected HERE, not in `vite.config.ts`, so normal
 *   `pnpm dev` keeps Vite's default DNS-rebinding host protection. Vite still
 *   loads `vite.config.ts` (Cesium `define`, plugins, etc.) and merges this in.
 * - Cesium assets are mirrored by the `predev:tunnel` npm hook (same as `predev`).
 *
 * Run via `pnpm dev:tunnel` (preferred) or directly: `node scripts/dev-tunnel.mjs`.
 */

import { existsSync } from "node:fs";

import { Tunnel, bin, install } from "cloudflared";
import { createServer } from "vite";

// Leading dot ⇒ matches any *.trycloudflare.com subdomain (random each run).
const TUNNEL_ALLOWED_HOST = ".trycloudflare.com";

async function main() {
  // 1. Ensure the cloudflared binary exists (first run downloads it).
  if (!existsSync(bin)) {
    console.log("Downloading cloudflared (first run only)…");
    await install(bin);
  }

  // 2. Start Vite programmatically so we know the resolved port and can allow
  //    the tunnel host. Omitting `configFile` lets Vite load vite.config.ts.
  const server = await createServer({
    server: { allowedHosts: [TUNNEL_ALLOWED_HOST] },
  });
  await server.listen();
  server.printUrls();

  const address = server.httpServer?.address();
  const port = address && typeof address === "object" ? address.port : server.config.server.port;
  const localUrl = `http://localhost:${port}`;

  // 3. Open the quick tunnel at the resolved port.
  const tunnel = Tunnel.quick(localUrl);

  let shuttingDown = false;
  const shutdown = async (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      tunnel.stop();
    } catch (err) {
      console.error("[dev:tunnel] error stopping tunnel:", err);
    }
    try {
      await server.close();
    } catch (err) {
      console.error("[dev:tunnel] error closing Vite server:", err);
    }
    process.exit(code);
  };

  tunnel.on("error", (err) => console.error("[dev:tunnel] cloudflared error:", err));
  tunnel.on("exit", (code) => {
    if (code) console.error(`[dev:tunnel] cloudflared exited with code ${code}`);
  });

  tunnel.once("url", (publicUrl) => {
    const rule = "=".repeat(64);
    console.log(`\n${rule}`);
    console.log("  Cloudflare quick tunnel is live");
    console.log(`  Public URL:  ${publicUrl}`);
    console.log(`  Local:       ${localUrl}`);
    console.log("  Ephemeral — the URL changes every run. Ctrl+C to stop.");
    console.log(`${rule}\n`);
  });

  tunnel.once("connected", (conn) => {
    if (conn && conn.location) console.log(`[dev:tunnel] edge connected: ${conn.location}`);
  });

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });
}

main().catch((err) => {
  console.error("[dev:tunnel] failed to start:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Syntax-check the file**

Run:

```bash
node --check scripts/dev-tunnel.mjs
```

Expected: no output, exit 0.

- [ ] **Step 3: Lint the file (match repo conventions)**

Run:

```bash
pnpm exec eslint scripts/dev-tunnel.mjs
```

Expected: clean. If `no-console` or import-ordering rules fire, fix to match `scripts/copy-cesium-assets.mjs` (which is the precedent for a Node CLI script in this repo — confirm whether `scripts/**` is ignored or console is permitted there and mirror it). Do not suppress rules with inline disables unless `copy-cesium-assets.mjs` does.

---

## Task 3: Runtime verification (functional-verification stage)

**Files:** none (verification only)

- [ ] **Step 1: Start the tunnel command in the background, capturing output**

Run (background) and tee output to a log so the URL can be read:

```bash
pnpm dev:tunnel > .dev-tunnel.log 2>&1 &
```

Wait until the log contains a `trycloudflare.com` URL (first run also downloads the binary, so allow extra time). Then read it:

```bash
grep -Eo "https://[a-z0-9-]+\.trycloudflare\.com" .dev-tunnel.log | head -1
```

Expected: a URL is printed; `.dev-tunnel.log` shows the Vite local URL banner and the "Cloudflare quick tunnel is live" banner.

- [ ] **Step 2: Verify locally first**

Probe the local server:

```bash
node -e "fetch('http://localhost:5173/').then(r => console.log('local status', r.status)).catch(e => { console.error(e); process.exit(1); })"
```

Expected: `local status 200`.

- [ ] **Step 3: End-to-end — navigate to the public URL with Playwright MCP**

Probe for `mcp__plugin_playwright_playwright__*` tools; if absent, `ToolSearch` with `query: "playwright browser"`. Then:

- `browser_navigate` to the captured `trycloudflare.com` URL.
- `browser_snapshot` / `browser_console_messages` — assert the CommandVue app shell mounts (dock chrome / app icon visible) and there is **no** "Blocked request. This host is not allowed." text (that would mean `allowedHosts` is wrong).
- `browser_take_screenshot` → save under `.verification-screenshots/feat-dev-tunnel/tunnel-live.png`.

Expected: app mounts over the public URL; no host-blocked error. (HMR check optional: edit a trivial string in a panel and confirm it updates over the tunnel; if HMR fails, add `server.hmr = { clientPort: 443 }` to the inline override in `dev-tunnel.mjs` and re-verify.)

- [ ] **Step 4: Verify graceful shutdown**

Send SIGINT to the backgrounded process (or Ctrl+C if foreground) and confirm both the Vite server and cloudflared exit (no orphaned `cloudflared` process; port 5173 freed). Remove the temp log:

```bash
rm -f .dev-tunnel.log
```

Expected: process exits cleanly; `.dev-tunnel.log` removed (it is a temp artifact — do not commit it).

---

## Task 4: Documentation + spell dictionary

**Files:**

- Modify: `README.md` (Scripts table; add a "Remote testing" subsection)
- Modify: `dictionaries/tech.txt`

- [ ] **Step 1: Add the Scripts-table row**

Locate the Scripts table in `README.md` and add a row for `dev:tunnel` next to `dev` (match the table's existing column format), e.g.:

```markdown
| `pnpm dev:tunnel` | Run the dev server and expose it via a Cloudflare quick tunnel (public URL printed in the terminal). |
```

- [ ] **Step 2: Add a short "Remote testing" subsection**

Add a brief subsection near the Scripts table:

```markdown
### Remote testing (Cloudflare quick tunnel)

`pnpm dev:tunnel` runs the dev server and opens a Cloudflare **quick tunnel**, printing a public `https://<random>.trycloudflare.com` URL you can open from any device. It uses the `cloudflared` dev-dependency, which downloads its binary automatically on first run — no Cloudflare account or manual install required.

The URL is **ephemeral** (changes every run) and, while the command is running, your local dev server is **publicly reachable** by anyone who has the URL. Stop the command (Ctrl+C) when you're done.
```

- [ ] **Step 3: Add CSpell terms**

Append to `dictionaries/tech.txt` (keep the file's existing sort/format):

```
cloudflared
trycloudflare
```

- [ ] **Step 4: Verify spelling passes**

Run:

```bash
pnpm spell
```

Expected: no unknown-word errors for `cloudflared` / `trycloudflare`.

---

## Task 5: Static gauntlet, commit, push, PR

**Files:** none new (final gate)

- [ ] **Step 1: Run the relevant static checks**

Run:

```bash
pnpm lint && pnpm type-check && pnpm spell
```

Expected: all pass. (`type-check` is `vue-tsc` and does not cover the Node `.mjs` file; `lint` and `spell` are the meaningful gates here.)

- [ ] **Step 2: Stage and commit the feature**

```bash
git add package.json pnpm-lock.yaml scripts/dev-tunnel.mjs
git commit -m "feat(dev): add pnpm dev:tunnel (Vite dev server + Cloudflare quick tunnel)"
```

- [ ] **Step 3: Commit the docs**

```bash
git add README.md dictionaries/tech.txt
git commit -m "docs(dev): document pnpm dev:tunnel + Cloudflare quick tunnel remote testing"
```

- [ ] **Step 4: Push and open the PR against develop (only after user approval)**

```bash
git push -u origin feat/dev-tunnel
gh pr create --base develop --title "feat(dev): pnpm dev:tunnel — Cloudflare quick tunnel for remote testing" --body "<summary + Stage-1 verification table + screenshots path>"
```

Per `CLAUDE.md`: target `develop`, do **not** auto-merge, embed the Stage-1 functional-verification result table in the PR body. **Pause for explicit user go-ahead before pushing / opening the PR.**

---

## Self-Review

- **Spec coverage:** §2 architecture → Task 2; §3 files → Tasks 1/2/4; §4 `allowedHosts`/no-postinstall/HMR/Cesium → Task 2 code + Task 1 Step 2 + Task 3 Step 3; §5 verification → Task 3 + Task 5; §6 docs-sync (README script + dep note + cspell) → Task 4. All spec sections covered.
- **Placeholder scan:** the only `<...>` is the PR body in Task 5 Step 4 (filled at PR time from the actual run) — acceptable. No TODO/TBD in code or steps.
- **Type/name consistency:** `Tunnel`, `bin`, `install` (cloudflared) and `createServer`/`listen`/`close`/`httpServer`/`config.server.port`/`printUrls` (Vite) match the Context7-verified APIs. `TUNNEL_ALLOWED_HOST` defined once and used once. Script name `scripts/dev-tunnel.mjs` consistent across package.json and all tasks.
