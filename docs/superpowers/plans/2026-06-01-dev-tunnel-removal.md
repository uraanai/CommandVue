# Removal Guide — `pnpm dev:tunnel` (Cloudflare Quick Tunnel)

**Purpose:** Single-prompt removal. When a maintainer asks to "remove the Cloudflare tunnel
feature" / "remove `dev:tunnel`" / "rip out the cloudflared tunneling", apply **this guide** to
fully and cleanly remove everything the feature added. This document is the complete inventory —
no further instructions are needed.

**What the feature is:** `pnpm dev:tunnel` starts the Vite dev server plus a Cloudflare _quick_
tunnel and prints a public `*.trycloudflare.com` URL for remote testing. It was added by branch
`feat/dev-tunnel` (PR #108). It is dev-only tooling — it does **not** touch app source, the
production build, preview, Docker, or CI.

---

## Step 0 — Confirm scope (self-discovery)

Every change this feature introduced is reachable from these tokens. Run from the repo root:

```bash
rg -n -i "dev:tunnel|dev-tunnel|cloudflared|trycloudflare|cloudflare quick tunnel"
```

Each match is in scope **except** matches inside unrelated content added _after_ this feature
(do not touch those). The exhaustive change list is below — the grep is just a cross-check.

## Step 1 — Delete the orchestrator script

- Delete `scripts/dev-tunnel.mjs`.

## Step 2 — `package.json`

- Remove the `"dev:tunnel"` script entry.
- Remove the `"predev:tunnel"` script entry.
- Remove `"cloudflared"` from `devDependencies`.
- Leave `pnpm.onlyBuiltDependencies` **unchanged** — the feature deliberately never added to it.

## Step 3 — Update the lockfile

```bash
pnpm install
```

This drops `cloudflared` (and its transitive deps) from `pnpm-lock.yaml`. Confirm
`node_modules/cloudflared` no longer exists afterward.

## Step 4 — `README.md`

- Remove the `` `pnpm dev:tunnel` `` row from the **Scripts** table.
- Remove the entire `### Remote testing (Cloudflare quick tunnel)` subsection.

## Step 5 — CSpell dictionary (`dictionaries/tech.txt`)

- Remove `cloudflared` and `trycloudflare` (feature-specific — always safe to remove).
- Also remove `worktree`, `worktrees`, `winget`, `backgrounded` — these were added only for the
  docs deleted in Step 6. After editing, run `pnpm spell`; if it flags any of these four as still
  needed by unrelated content, re-add only those.

## Step 6 — Superpowers docs

- Delete `docs/superpowers/specs/2026-06-01-dev-tunnel-design.md`.
- Delete `docs/superpowers/plans/2026-06-01-dev-tunnel.md`.
- Delete **this** guide, `docs/superpowers/plans/2026-06-01-dev-tunnel-removal.md`, **last**.

## Step 7 — Local-only artifacts (nothing in git)

- `.verification-screenshots/feat-dev-tunnel/` is gitignored and was never committed. Delete the
  local folder if it exists; there is nothing to remove from version control.

---

## Verify the removal is complete

1. **No residual references** — re-run the Step 0 grep:

   ```bash
   rg -n -i "dev:tunnel|dev-tunnel|cloudflared|trycloudflare|cloudflare quick tunnel"
   ```

   Expect zero matches (or only matches in unrelated, later-added content you intentionally kept).

2. **Gauntlet passes:**

   ```bash
   pnpm install && pnpm lint && pnpm type-check && pnpm test && pnpm spell && pnpm docs:build
   ```

3. **Normal dev still works:** `pnpm dev` starts the server as before.

## Git workflow (per `CLAUDE.md`)

Branch from `develop` (e.g. `chore/remove-dev-tunnel`), make the changes, push, and open a PR with
`--base develop` titled `chore(dev): remove pnpm dev:tunnel (Cloudflare quick tunnel)`. Do not
auto-merge — the maintainer approves the merge.
