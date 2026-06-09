# Verification

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Runtime verification (mandatory after major-version bumps)

The static gauntlet (`pnpm lint && pnpm type-check && pnpm test && pnpm spell && pnpm build && pnpm docs:build`) does **not** prove a major-version migration is safe. All five can pass while the running app is broken in ways that only surface when components actually mount in the browser.

**After any major-version bump** of a UI framework, build tool, state library, or rendering library:

1. Run `pnpm dev` and confirm panels mount + key flows work. Drive verification with the **Playwright MCP** server (`mcp__plugin_playwright_playwright__*`) when possible; otherwise ask the user to verify manually.
2. Click through **every panel that uses the bumped library** — runtime regressions are component-mount-specific.
3. Watch for these failure modes (each has bitten this repo at least once):
   - **Vite `optimizeDeps` failures** — `Cannot optimize dependency: X`, `Failed to find module Y`, pre-bundle vs raw-serve interop, pnpm strict-store hiding transitive CJS deps (the `mersenne-twister` bug).
   - **Vue `inject` regressions** when functional components are involved (the Lucide 1.16 / Vue 3.5 bug — fixed in 1.16+ but the pattern recurs across libraries).
   - **ESM ↔ CJS interop mismatches** — `.d.ts` claims a named export the ESM module doesn't provide (the milsymbol `Symbol` bug).
   - **Reactivity lifecycle changes** in major releases — e.g. echarts 6 added strict `setOption` lifecycle rules that broke `vue-echarts` 8 reactive updates.
   - **Breaking-prop removal** — e.g. `dockview-vue 6` dropped the `:components` prop; panel registration must move to global `app.component()`.
4. When CI is green but the page doesn't mount, the relevant tooling is **browser console + dev-server stderr**, not the build log.

**Do not** report a migration complete until the running app has been clicked through.

When multiple major bumps land in one session, plan to spend the **back half** of the session on runtime fixes — the static work is the easier half.

---

## Type-checking — don't trust a cached `vue-tsc` pass

`pnpm type-check` runs `vue-tsc --build`, which caches results in `node_modules/.tmp/*.tsbuildinfo`. That incremental cache can report a **clean pass while the committed code has a real type error** — it skips re-checking files it believes are unchanged, and `vue-tsc --build --force` does **not** reliably bust it. CI runs cache-free and catches what the local run missed.

When a type-check result is load-bearing — before pushing, before claiming a PR is green — make it cache-free first:

```bash
find . -name '*.tsbuildinfo' -delete && pnpm type-check
```

…or just trust CI's clean run over a local green.

> Bit us on 2026-06-08: a duplicate `onKeydown` (`@keydown.enter` + `@keydown.esc` on one element compiles to two `onKeydown` props → `TS1117`) passed every local `pnpm type-check` on a stale cache and only failed in CI.

---

## Verification protocol — automated + human review

Every phase of every prompt ends with two verification stages, in this order:

1. **Automated functional verification** — Claude Code uses Playwright MCP to drive a real browser through the changes and assert on observable state (DOM attributes, computed styles, console output, screenshots at named checkpoints). Binary pass/fail. No design judgment. **Claude Code does not open a PR until this stage is fully green.** If any assertion fails, fix the underlying issue and re-run until it passes; do not embed failing results in the PR description.
2. **Human design review** — A short, focused **checkbox task-list** (`- [ ]`, 3–7 items max) of subjective quality checks that automation cannot make: typography balance, color harmony, density feel, hover-state polish. The user drives each item after the PR is open, ticks the boxes, and merges only when all are checked (see the "Stage 2 review section" rule below for the exact format).

**Tool availability:** At the start of each phase's verification, Claude Code probes for `mcp__plugin_playwright_playwright__*` tools. If unavailable, run `ToolSearch` with `query: "playwright browser"` to load them. If still unavailable, fall back to a manual smoke-test checklist, state this explicitly in the PR description, and do not embed Stage 1 results.

**Screenshots:** Capture to `.verification-screenshots/<branch-name>/<checkpoint-name>.png`. The directory is gitignored. PR descriptions reference screenshots by relative path — reviewers open them locally rather than viewing them inline.

**Stage 1 result table:** Embedded in every PR description as a structured Markdown table — assertion id, description, result, screenshot. Plus console-error count, console-warning count, and a PASS/FAIL summary line. The table reflects actual Playwright run results, never "expected pass."

**Stage 2 review section:** Closes the PR description. The human-review items **MUST be a GitHub markdown task-list** — each item a `- [ ]` checkbox the maintainer literally ticks off in the PR UI, **never** a numbered or plain-bulleted list. It contains: 3–7 design-judgment items (subjective checks automation can't make — typography balance, color harmony, density feel, hover-state polish), a final `- [ ]` **Ready to merge** item, and a 2–3 sentence "things to specifically scrutinize for this phase" callout. The section is the explicit merge gate: the maintainer reviews each box, checks them all off, and merges only when every box (including "Ready to merge") is ticked. Lead the section with a one-line instruction telling the reviewer to tick each box and how to drive the review (e.g. `pnpm dev` + which panel/flow to open).

**Rule:** This protocol applies to all current and future agent-driven work on CommandVue. No exceptions without explicit user override.
