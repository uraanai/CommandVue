# Libraries, gotchas & knowledge

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Library integration — Context7 first

**Mandatory rule, no exceptions:** Before writing, modifying, or debugging any code that integrates a third-party library, framework, SDK, CLI tool, or cloud service, fetch current docs via the **Context7 MCP** server. Use `mcp__context7__resolve-library-id` then `mcp__context7__query-docs`. **Never** rely on training-data knowledge or blog posts older than ~6 months — anchoring on stale Cesium-on-Vite guidance cost us hours on 2026-05-20 because `vite-plugin-static-copy@4`'s dev middleware had silently regressed.

This rule applies to: integrating a new package, bumping a major version of an existing one, debugging a runtime error that names a library (e.g. `cesium.js:...`, `[ECharts]`, `<Lucide Icon>`), and acting on any tutorial / blog link the user shares. It does **not** apply to refactoring our own code, writing scripts from scratch, or debugging business logic.

Full rationale + decision matrix lives in [`.agent/workflows/documentation-sync.md`](../workflows/documentation-sync.md) under "Library integration".

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

The canonical reference for "when I change X, what else do I update" is [`.agent/workflows/documentation-sync.md`](../workflows/documentation-sync.md). Consult it before any non-trivial change and apply the relevant updates in the same PR.

The short version, agents must obey:

- **Integrating / bumping / debugging a library** → fetch current docs via Context7 MCP (see "Library integration — Context7 first" above).
- **New / renamed / removed `pnpm` script** → update `README.md` Scripts table.
- **New / removed dependency** → update `README.md` Stack table **and** the `Locked technology stack` table in [`project-and-stack.md`](./project-and-stack.md).
- **New environment variable** → update `README.md` Configuration table, `.env.example`, and `docs/deployment.md`.
- **New panel** → register in `DockLayout.vue` and document in `docs/panels.md`.
- **New tool** → register in `src/modules/tools/index.ts` (`TOOLS`), add a shortcut entry in `src/modules/shortcuts/catalog.ts`, and document in `docs/tools.md`.
- **New `docs/*.md` page** → register in `docs/.vitepress/config.ts` sidebar.
- **CSpell-flagged term** → add to `dictionaries/{operations,project,tech}.txt`, never to `cspell.json`.
- **Architecture / API change** → update the affected `docs/*.md` page (don't leave the docs lying about how the code works).

The full table — including bug-fix triggers, deprecation flows, and what to skip — lives in the workflow file. Read it; don't re-derive it.

---

## Memory & knowledge

CommandVue uses **two memory surfaces**. Both are agent-only — they're not part of the shipped template:

1. **Auto-loaded rules** — the `CLAUDE.md` file and its imported `.agent/rules/*.md` modules, plus `~/.claude/rules/*.md` (user-global) and `.claude/CLAUDE.md` / `.claude/rules/*.md` (project-scoped, if present). These are the files Claude Code's harness actually reads at session start. **Any hard rule that must surface without being searched for goes here, in this rule set.**

2. **Searchable observations + named corpus** — claude-mem (worker runtime). Hooks auto-capture every prompt, tool call, file read, and session summary into `~/.claude-mem/claude-mem.db`. Surface them via:
   - `mcp__plugin_claude-mem_mcp-search__search` → `timeline(anchor=<ID>)` → `get_observations([IDs])` (3-layer pattern — 10× token savings vs fetching full details upfront).
   - `mcp__plugin_claude-mem_mcp-search__smart_search` for tree-sitter symbol/file lookups inside `src/`.
   - The primed **`commandvue` corpus**: `prime_corpus({ name: "commandvue" })` then `query_corpus({ name: "commandvue", question: "..." })` for whole-project Q&A grounded in observations.

> **Important (verified 2026-05-22):** Files at `~/.claude/projects/D--Work-UraanAI-Public-CommandVue/memory/*.md` are **NOT** auto-loaded by Claude Code's harness — that directory is session-storage (JSONL transcripts), not a rule-loader path. Even `MEMORY.md` (the index) does not reliably appear in session startup context. **Treat that directory as reference/archive only.** If a rule must always apply at session start, it goes in `CLAUDE.md` / its `.agent/rules/*.md` modules or in `.claude/rules/`.

**Decision rule for "where does this knowledge go":**

- Hard rule that must always apply at session start → the **`CLAUDE.md` rule set** (the relevant `.agent/rules/*.md` module, or `.claude/rules/` if the rule is project-scoped agent infrastructure that doesn't belong in the project's source-of-truth file).
- Bug-fix recipe, "we tried X and reverted", per-PR rationale, code-knowledge note → already captured via claude-mem hooks; you don't need to write it manually. In worker runtime, `memory_add` is unavailable — rely on the auto-capture.
- Rebuild the `commandvue` corpus after major project changes: `rebuild_corpus({ name: "commandvue" })`.

Before reaching for `grep` on a "where is X" question, try `smart_search` first.
