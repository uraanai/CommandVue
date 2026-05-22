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

| Layer                    | Choice                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Framework                | Vue 3 + Vite                                                                                              |
| Language                 | TypeScript (strict)                                                                                       |
| Router                   | Vue Router 4                                                                                              |
| State                    | Pinia                                                                                                     |
| Package manager          | pnpm (with workspaces)                                                                                    |
| UI components            | PrimeVue (unstyled) + Tailwind v4                                                                         |
| Window/panel manager     | Dockview Vue                                                                                              |
| Icons                    | @lucide/vue + @iconify-prerendered/vue-mdi + @heroicons/vue                                               |
| 3D map                   | CesiumJS                                                                                                  |
| 2D map                   | MapLibre GL                                                                                               |
| Geospatial math          | @turf/\*, mgrs, h3-js, formatcoords, suncalc                                                              |
| Operational symbology    | milsymbol, @orbat-mapper/convert-symbology (MIL-STD-2525 / APP-6 SIDC codes)                              |
| Charting                 | Apache ECharts (primary) + d3-\* modules (escape hatch)                                                   |
| Real-time                | Native WebSocket via @vueuse/core useWebSocket                                                            |
| Tables / virtualization  | @tanstack/vue-table + @tanstack/vue-virtual                                                               |
| Drag & drop              | @atlaskit/pragmatic-drag-and-drop                                                                         |
| Storage / offline        | idb (IndexedDB), browser-fs-access                                                                        |
| Utilities                | @vueuse/core, dayjs, es-toolkit, nanoid, fuzzysort, immer, klona, rfc6902                                 |
| Markdown                 | markdown-it                                                                                               |
| Spell-check (code)       | CSpell + dictionaries/\*.txt                                                                              |
| Spell-check (user input) | Native `spellcheck` attribute                                                                             |
| Build                    | Vite                                                                                                      |
| Quality                  | ESLint 9 flat config, Prettier, Vitest, vue-tsc                                                           |
| Containerization         | Multi-stage Dockerfile + docker-compose.yml                                                               |
| Documentation site       | VitePress (config: `docs/.vitepress/config.ts`; scripts: `pnpm docs:dev` / `docs:build` / `docs:preview`) |

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

## Git workflow (mandatory)

`main` is protected. `enforce_admins: true` is set — direct push to `main` is rejected for **everyone**, including the maintainer. **Every code change goes through a PR**, no exceptions, even one-line doc fixes.

### The required sequence

```bash
git checkout main && git pull                      # start from clean main
git checkout -b <type>/<short-slug>                # feature branch first, BEFORE any edits
# … edit, commit (lint-staged + commitlint hooks run automatically) …
git push -u origin <type>/<short-slug>             # push branch
gh pr create --title "<conventional-commit-style>" --body "<summary + test plan>"
gh pr merge <n> --rebase --auto                    # queue auto-merge once CI is green
```

Use `--rebase` (or `--squash`) — **never `--merge`** (a merge commit fails the linear-history check).

**Branch naming:** mirror the Conventional Commit prefix — `feat/...`, `fix/...`, `chore/...`, `docs/...`, `refactor/...`.

**Required CI status checks** (set in branch protection, must be green before merge):

- `Lint · Type-check · Test · Build` — `.github/workflows/ci.yml`, job `quality`
- `CSpell` — `.github/workflows/cspell.yml`, job `spell`

**Approval policy:** the maintainer (`awaisali88`) self-merges; required approvals is `0`. Do not raise this to 1+ until a second collaborator exists. **Do NOT auto-merge PRs without checking with the user first** — the user approves merges into `main`, the agent only queues them on explicit confirmation.

### Critical "don'ts"

- **Never run `git push origin main`** — it will be rejected, and the attempt itself indicates you missed this section.
- **Never edit `main` directly.** Confirm `git branch --show-current` is a feature branch before any edit.
- **Never amend a published commit** or force-push to `main` — both blocked by protection, but also bad practice on a shared branch.
- **Never skip the PR** for "trivial" changes — the required CI checks only run on PRs. Same path for one-line typo fixes as for major features.

### If you've already made changes on `main` by mistake

1. Don't push, don't panic.
2. `git checkout -b <type>/<slug>` — your modifications follow you to the new branch.
3. Stage, commit, push, open PR as normal. The recovery is invisible to reviewers.

### How to inspect / modify branch protection

`gh api repos/uraanai/CommandVue/branches/main/protection`. Settings live there; don't loosen without the user's explicit go-ahead.

---

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

---

## Memory & knowledge

CommandVue uses **two memory surfaces**. Both are agent-only — they're not part of the shipped template:

1. **Auto-loaded rules** — this `CLAUDE.md` file, plus `~/.claude/rules/*.md` (user-global) and `.claude/CLAUDE.md` / `.claude/rules/*.md` (project-scoped, if present). These are the files Claude Code's harness actually reads at session start. **Any hard rule that must surface without being searched for goes here, in this file.**

2. **Searchable observations + named corpus** — claude-mem (worker runtime). Hooks auto-capture every prompt, tool call, file read, and session summary into `~/.claude-mem/claude-mem.db`. Surface them via:
   - `mcp__plugin_claude-mem_mcp-search__search` → `timeline(anchor=<ID>)` → `get_observations([IDs])` (3-layer pattern — 10× token savings vs fetching full details upfront).
   - `mcp__plugin_claude-mem_mcp-search__smart_search` for tree-sitter symbol/file lookups inside `src/`.
   - The primed **`commandvue` corpus**: `prime_corpus({ name: "commandvue" })` then `query_corpus({ name: "commandvue", question: "..." })` for whole-project Q&A grounded in observations.

> **Important (verified 2026-05-22):** Files at `~/.claude/projects/D--Work-UraanAI-Public-CommandVue/memory/*.md` are **NOT** auto-loaded by Claude Code's harness — that directory is session-storage (JSONL transcripts), not a rule-loader path. Even `MEMORY.md` (the index) does not reliably appear in session startup context. **Treat that directory as reference/archive only.** If a rule must always apply at session start, it goes in this file or in `.claude/rules/`.

**Decision rule for "where does this knowledge go":**

- Hard rule that must always apply at session start → **this `CLAUDE.md` file** (or `.claude/rules/` if the rule is project-scoped agent infrastructure that doesn't belong in the project's source-of-truth file).
- Bug-fix recipe, "we tried X and reverted", per-PR rationale, code-knowledge note → already captured via claude-mem hooks; you don't need to write it manually. In worker runtime, `memory_add` is unavailable — rely on the auto-capture.
- Rebuild the `commandvue` corpus after major project changes: `rebuild_corpus({ name: "commandvue" })`.

Before reaching for `grep` on a "where is X" question, try `smart_search` first.

---

## Library integration — Context7 first

**Mandatory rule, no exceptions:** Before writing, modifying, or debugging any code that integrates a third-party library, framework, SDK, CLI tool, or cloud service, fetch current docs via the **Context7 MCP** server. Use `mcp__context7__resolve-library-id` then `mcp__context7__query-docs`. **Never** rely on training-data knowledge or blog posts older than ~6 months — anchoring on stale Cesium-on-Vite guidance cost us hours on 2026-05-20 because `vite-plugin-static-copy@4`'s dev middleware had silently regressed.

This rule applies to: integrating a new package, bumping a major version of an existing one, debugging a runtime error that names a library (e.g. `cesium.js:...`, `[ECharts]`, `<Lucide Icon>`), and acting on any tutorial / blog link the user shares. It does **not** apply to refactoring our own code, writing scripts from scratch, or debugging business logic.

Full rationale + decision matrix lives in [`.agent/workflows/documentation-sync.md`](./.agent/workflows/documentation-sync.md) under "Library integration".

---

## Library-specific gotchas (do not regress)

Two load-bearing configurations that each took hours to land. **If you change any of them, runtime-verify before merging.**

### Cesium-on-Vite — the four working parts

1. **Assets served from `public/cesium/`, not via `vite-plugin-static-copy`'s middleware.** `scripts/copy-cesium-assets.mjs` mirrors `node_modules/cesium/Build/Cesium/{Assets,Workers,ThirdParty,Widgets}` into `public/cesium/` and is wired as `predev` + `prebuild`. `vite-plugin-static-copy@4`'s dev middleware regressed and returned SPA-fallback HTML for asset URLs — every imagery tile came back as `200 text/html`, breaking image decode.
2. **`CESIUM_BASE_URL = "/cesium/"`** set both at build time (`define` in `vite.config.ts`) and at runtime (`window.CESIUM_BASE_URL` in `src/modules/cesium/init.ts`, which must be the first import of `useCesium.ts` — before any other Cesium module).
3. **Ion explicitly disabled in `init.ts`:** `Ion.defaultAccessToken = ""`. The default shared dev token is rate-limited and returns HTML error pages that propagate as `InvalidStateError: The source image could not be decoded` and `Unexpected token '<'`.
4. **Offline imagery + terrain:** `baseLayer: ImageryLayer.fromProviderAsync(TileMapServiceImageryProvider.fromUrl(buildModuleUrl("Assets/Textures/NaturalEarthII")), {})` and `terrainProvider: new EllipsoidTerrainProvider()`. Both ship inside the cesium package; no network required.

**`optimizeDeps.exclude` does NOT contain `cesium`.** The old exclusion was a 2023-era workaround that stopped Vite pre-bundling Cesium's CJS subdeps like `mersenne-twister`. `optimizeDeps.include` _does_ contain `mersenne-twister`, and `.npmrc`'s `public-hoist-pattern[]=mersenne-twister` hoists it for pnpm. Belt-and-suspenders.

**Do not add `cesium` back to `optimizeDeps.exclude` without re-verifying the mersenne-twister chain.** If Cesium starts throwing `InvalidStateError` or `Unexpected token '<'`, check the four parts above first — the error chain is almost always: asset URL returns HTML → browser image decoder chokes → Cesium reports a generic decode error.

### milsymbol — build options incrementally, never pass `undefined`

In `src/modules/symbology/render.ts` (and any future call site), build the options object key-by-key — only assign a key when the caller supplied a value:

```typescript
const symbolOptions: Record<string, number | string | undefined> = {
  size: options.size ?? 32,
};
if (options.fillColor !== undefined) symbolOptions.fillColor = options.fillColor;
if (options.iconColor !== undefined) symbolOptions.iconColor = options.iconColor;
if (options.outlineColor !== undefined) symbolOptions.outlineColor = options.outlineColor;
if (options.outlineWidth !== undefined) symbolOptions.outlineWidth = options.outlineWidth;
return new ms.Symbol(sidc, symbolOptions).asSVG();
```

`ms.Symbol` distinguishes "key not present" from "key present with `undefined` value". The latter corrupts internal layout math — `Number(undefined) → NaN` runs through the bbox computation, every derived attribute becomes `NaN`, and `asSVG()` returns `width="NaN" height="NaN" viewBox="X Y NaN NaN"` with fills stripped (the PR #51 regression — ~180 browser warnings per page load).

**Do not refactor to a single object literal** with spread or explicit `undefined` defaults. The conditional-assign pattern is intentional.

Also: **import the default, never the named** — the `.d.ts` lies. It declares `export class Symbol`, which compiles cleanly, but the actual ESM only has `export default ms` with `ms.Symbol` hanging off it:

```typescript
// ❌ compiles green, throws "Symbol is not a constructor" at runtime
import { Symbol } from "milsymbol";

// ✅ correct
import ms from "milsymbol";
new ms.Symbol(sidc, options);
```

This is a milsymbol-specific quirk. Don't generalize the `undefined`-key rule to other libraries.

---

## Keeping documentation in sync

The canonical reference for "when I change X, what else do I update" is [`.agent/workflows/documentation-sync.md`](./.agent/workflows/documentation-sync.md). Consult it before any non-trivial change and apply the relevant updates in the same PR.

The short version, agents must obey:

- **Integrating / bumping / debugging a library** → fetch current docs via Context7 MCP (see "Library integration — Context7 first" above).
- **New / renamed / removed `pnpm` script** → update `README.md` Scripts table.
- **New / removed dependency** → update `README.md` Stack table **and** the `Locked technology stack` table above.
- **New environment variable** → update `README.md` Configuration table, `.env.example`, and `docs/deployment.md`.
- **New panel** → register in `DockLayout.vue` and document in `docs/panels.md`.
- **New tool** → register in `src/modules/tools/index.ts` (`TOOLS`), add a shortcut entry in `src/modules/shortcuts/catalog.ts`, and document in `docs/tools.md`.
- **New `docs/*.md` page** → register in `docs/.vitepress/config.ts` sidebar.
- **CSpell-flagged term** → add to `dictionaries/{operations,project,tech}.txt`, never to `cspell.json`.
- **Architecture / API change** → update the affected `docs/*.md` page (don't leave the docs lying about how the code works).

The full table — including bug-fix triggers, deprecation flows, and what to skip — lives in the workflow file. Read it; don't re-derive it.
