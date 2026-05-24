# CommandVue — Claude Code / Agent Instructions

This file is read by Claude Code and other AI coding agents at the start of every session. It defines the project's stack, conventions, and rules so agents produce consistent, high-quality code.

---

## Library-first rule (MANDATORY)

**Before building any UI component, check if PrimeVue — or another already-installed library in the locked stack below — has a pre-built equivalent. If it does, use it. Do not roll your own.**

This rule applies to every UI surface: menus, dropdowns, dialogs, close buttons, tables, tabs, popovers, context menus, file pickers, form controls (select / checkbox / color / range / textarea), tags / chips, fieldsets, dividers, toasts, file uploads — all of it. PrimeVue 4 ships 80+ unstyled components; the project consumes them with `:pt` (passthrough) for Tailwind theming. Charts come from `vue-echarts`; maps from `cesium` / `maplibre-gl`; symbology from `milsymbol` / `@orbat-mapper/convert-symbology`. The locked-stack table below names everything available.

### Workflow

1. **Before writing markup** for a new UI element, scan PrimeVue's component list (https://primevue.org — fetch via Context7 with library id `/websites/primevue`). The full reference workflow lives in [`.agent/workflows/library-first.md`](./.agent/workflows/library-first.md).
2. **If a PrimeVue component fits**, use it directly (or extend the relevant `src/components/ui/*` wrapper to delegate to it). Style via `:pt` to match project tokens — never rely on PrimeVue's bundled styles.
3. **If no PrimeVue component fits**, surface the gap before writing custom code. Ask the user; don't assume.
4. **If something custom genuinely is required** (e.g., the slot-driven `ChromeBar`), document why in the component's docstring so future agents don't waste cycles re-evaluating.

### Common mappings (memorize)

| Need                                             | Use                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modal / dialog (with close button)               | PrimeVue `Dialog` (already wrapped by `src/components/ui/Dialog.vue`)                                                                                  |
| Right-click context menu                         | PrimeVue `ContextMenu` — never hand-roll outside-click + clientX/Y                                                                                     |
| Top menu bar / nested submenus                   | PrimeVue `Menubar`                                                                                                                                     |
| Dropdown popup (workspace switcher, action menu) | PrimeVue `Menu` (popup mode) or `TieredMenu`                                                                                                           |
| Tabbed UI                                        | PrimeVue `Tabs` + `TabList` + `Tab` + `TabPanels` (wrapped by `ui/Tabs`)                                                                               |
| Tabular data (sortable, filterable, paginated)   | `<DataTable>` wrapper at `src/components/ui/DataTable.vue` (TanStack default — see ADR 0001); `primevue/datatable` only as the documented escape valve |
| Card grid / item gallery                         | PrimeVue `DataView` (`layout="grid"`) or `Fieldset` + plain grid                                                                                       |
| Section grouping with legend                     | PrimeVue `Fieldset`                                                                                                                                    |
| Inline label / badge                             | PrimeVue `Tag` or `Chip`                                                                                                                               |
| Dropdown select                                  | PrimeVue `Select` (wrapped by `ui/Select`)                                                                                                             |
| Multi-select                                     | PrimeVue `MultiSelect`                                                                                                                                 |
| Text input                                       | PrimeVue `InputText` (wrapped by `ui/Input`) or `IconField` + `InputIcon`                                                                              |
| Number input                                     | PrimeVue `InputNumber`                                                                                                                                 |
| Textarea                                         | PrimeVue `Textarea` — never raw `<textarea>`                                                                                                           |
| Checkbox / radio                                 | PrimeVue `Checkbox` (`binary` for single) / `RadioButton`                                                                                              |
| Color picker                                     | PrimeVue `ColorPicker` — never `<input type=color>`                                                                                                    |
| Range / slider                                   | PrimeVue `Slider` — never `<input type=range>`                                                                                                         |
| Date picker                                      | PrimeVue `DatePicker`                                                                                                                                  |
| File upload (incl. hidden + programmatic)        | PrimeVue `FileUpload` (`mode="basic"`, ref-triggered `choose()`)                                                                                       |
| Button                                           | PrimeVue `Button` (wrapped by `ui/Button` + `ui/IconButton`)                                                                                           |
| Toast notification                               | PrimeVue `Toast` (wrapped by `ui/Toast`)                                                                                                               |
| Confirm dialog                                   | PrimeVue `ConfirmDialog` (use for 2-action; custom Dialog for 3+ actions)                                                                              |
| Popover                                          | PrimeVue `Popover`                                                                                                                                     |
| Divider                                          | PrimeVue `Divider`                                                                                                                                     |
| Chart                                            | `vue-echarts` (not PrimeVue Chart — already in locked stack)                                                                                           |

If the need you have isn't on this list, check the PrimeVue catalog before inventing custom markup. New mappings discovered during work should be added here.

---

## Agent skills

Project-specific agent guidance lives in [`.agent/skills/`](./.agent/skills). Four skills cover the four workspace-system subsystems: `commandvue-workspace-system`, `commandvue-panel-development`, `commandvue-preset-development`, `commandvue-chrome-system`. Each skill bundles its subsystem's data model, invariants, common mistakes, and copy-paste templates. When working in one of those areas, the relevant skill is the canonical source — read it before making changes.

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

| Layer                    | Choice                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework                | Vue 3 + Vite                                                                                                                                                 |
| Language                 | TypeScript (strict)                                                                                                                                          |
| Router                   | Vue Router 4                                                                                                                                                 |
| State                    | Pinia                                                                                                                                                        |
| Package manager          | pnpm (with workspaces)                                                                                                                                       |
| UI components            | PrimeVue (unstyled) + Tailwind v4                                                                                                                            |
| Window/panel manager     | Dockview Vue                                                                                                                                                 |
| Icons                    | @lucide/vue + @iconify-prerendered/vue-mdi + @heroicons/vue                                                                                                  |
| 3D map                   | CesiumJS                                                                                                                                                     |
| 2D map                   | MapLibre GL                                                                                                                                                  |
| Geospatial math          | @turf/\*, mgrs, h3-js, formatcoords, suncalc                                                                                                                 |
| Operational symbology    | milsymbol, @orbat-mapper/convert-symbology (MIL-STD-2525 / APP-6 SIDC codes)                                                                                 |
| Charting                 | Apache ECharts (primary) + d3-\* modules (escape hatch)                                                                                                      |
| Real-time                | Native WebSocket via @vueuse/core useWebSocket                                                                                                               |
| Tables                   | `@tanstack/vue-table` via `src/components/ui/DataTable.vue` (default) — `primevue/datatable` as escape valve, see `docs/decisions/0001-datatable-library.md` |
| Virtualization           | @tanstack/vue-virtual                                                                                                                                        |
| Drag & drop              | @atlaskit/pragmatic-drag-and-drop                                                                                                                            |
| Storage / offline        | idb (IndexedDB), browser-fs-access                                                                                                                           |
| Utilities                | @vueuse/core, dayjs, es-toolkit, nanoid, fuzzysort, immer, klona, rfc6902                                                                                    |
| Markdown                 | markdown-it                                                                                                                                                  |
| Spell-check (code)       | CSpell + dictionaries/\*.txt                                                                                                                                 |
| Spell-check (user input) | Native `spellcheck` attribute                                                                                                                                |
| Build                    | Vite                                                                                                                                                         |
| Quality                  | ESLint 9 flat config, Prettier, Vitest, vue-tsc                                                                                                              |
| Containerization         | Multi-stage Dockerfile + docker-compose.yml                                                                                                                  |
| Documentation site       | VitePress (config: `docs/.vitepress/config.ts`; scripts: `pnpm docs:dev` / `docs:build` / `docs:preview`)                                                    |

---

## Data tables — TanStack default

`@tanstack/vue-table` is the default data-table library for CommandVue. This is a deliberate, governed exception to the "library-first / PrimeVue-first" mapping above — limited to **tabular data only**. Every other surface (menus, dialogs, file uploads, color pickers, form controls, fieldsets, tags, popovers, etc.) still follows the library-first rule and uses PrimeVue.

- **Default usage:** import the `<DataTable>` wrapper from `src/components/ui/DataTable.vue` (added in Phase 1.2 of Prompt 1).
- **Wrapper API:** typed columns, sortable headers, resizable columns, virtualized rows via `@tanstack/vue-virtual`, column visibility toggle, three density modes (`compact`, `comfortable`, `spacious`), sticky header, optional sticky first column, toolbar slot.
- **Escape valve:** `primevue/datatable` is permitted only for narrow cases where its built-in features (TreeTable, full row-edit-in-place, hierarchical grouping) materially reduce code volume. Every such use must be justified in the PR description and triggers the `governance: primevue-datatable` label automatically. An ESLint warn-level `no-restricted-imports` rule surfaces the deviation during local lint and CI.
- **Decision record:** see `docs/decisions/0001-datatable-library.md` for full rationale.
- **Current migration state:** see `docs/audits/datatable-usage-inventory.md` for which files still use `primevue/datatable` and which have moved to the wrapper.

---

## UI primitives — PrimeVue-first rule

CommandVue uses PrimeVue (unstyled mode) as the foundation for all UI primitives. The active decision is **Option C — hybrid** from ADR 0002.

- **Chosen approach:** hybrid — density-critical / project-API-masked primitives stay hand-rolled in `src/components/ui/*`; general-purpose primitives are installed via Volt (`npx volt-vue add <Name>`) to `src/volt/*`. See `docs/decisions/0002-volt-vs-handrolled-wrappers.md` for the full rationale and the file-by-file split.
- **Default location for new UI primitives:**
  - Density-critical (used in dense lists/forms) or surfaces a deliberately narrowed API → `src/components/ui/<Name>.vue` (hand-rolled).
  - General-purpose, one-off, or composed of standard PrimeVue surfaces → `src/volt/<Name>.vue` (installed via Volt).
  - When in doubt: install via Volt first; promote to hand-rolled only if the consumer surface demands it.
- **Stays hand-rolled today:** `Button`, `IconButton`, `Select`, `Tabs`, `Toast`, `Tooltip` (specialized — floating-ui), `ColorPicker` (specialized — palette + popover), plus `DataTable` (separate; governed by ADR 0001).
- **Adopts Volt today:** `Dialog`, `Input` (PrimeVue `InputText`), `Checkbox`, `Slider`, `Textarea`, `Fieldset`, `Tag`, `Menu`, `Menubar`, `ContextMenu`, `FileUpload`.
- **Forbidden:** raw `<button>`, `<input>`, `<select>`, `<textarea>` outside the UI-primitive definitions themselves. Use the wrapper or the Volt file. ESLint enforces this in Phase 2.4 (warn-level).
- **Forbidden:** non-PrimeVue UI libraries (Element Plus, Naive UI, Vuetify, reka-ui, etc.) without an ADR justifying the exception. `@tanstack/vue-table` is the documented exception per ADR 0001 — tabular data only.

### When adding a new UI primitive

1. Check the PrimeVue catalog (https://primevue.org). If it exists and matches the use case, decide between the two installation targets above and install/wrap accordingly.
2. Check the Volt catalog (https://volt.primevue.org). If Volt covers it and the component fits the "general-purpose" criterion, prefer `npx volt-vue add <Name>` over hand-rolling.
3. If neither has it, document the rationale in the component file's header comment and proceed with a thin hand-rolled wrapper in `src/components/ui/<Name>.vue`.
4. Downstream apps override styling via Tailwind classes (Volt) or `:pt` passthrough (hand-rolled wrappers). Both resolve to the project's CSS-token vocabulary.

### Active artifacts

- ADR: `docs/decisions/0002-volt-vs-handrolled-wrappers.md` (Accepted 2026-05-24).
- Compliance audit: `docs/audits/primevue-firstrule-audit-2026-05-24.md`. Tracks Phase 2.3 migration scope.
- Wrapper inventory: `docs/audits/ui-wrappers-inventory.md`.
- PrimeVue usage inventory: `docs/audits/primevue-component-usage.md`.

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
6. **One panel = one component in `src/components/panels/`.** Panels are registered globally via `app.component(id, ...)` in `main.ts` (Dockview resolves panel components from Vue's global registry). The **Panel Registry** (`src/modules/panels/registry.ts`) owns the metadata — title, icon, category, async loader, lifecycle hooks — used by menus and (from Phase F) preset application.

---

## Panel Registry

The Panel Registry is the single source of truth for "what panel types exist in this app."

- **Source of truth:** `src/modules/panels/registry.ts` (singleton `panelRegistry`).
- **Built-in registration:** `registerBuiltinPanels()` in `src/modules/panels/builtin.ts`, called once from `main.ts` before `app.mount()`.
- **Definition shape:** `PanelDefinition` in `src/modules/panels/types.ts` — `id`, `title`, `description`, `icon` (Lucide name), `category`, async `component()` loader, optional `singleton`, optional `serialize` / `restore` lifecycle hooks (wired in Phase G).
- **Dockview integration:** the registry does NOT replace `app.component()`. Dockview-vue 6 resolves panel components from Vue's global registry. The registry sits alongside it and adds metadata for the View / Components Panel / Add Component menu and the Phase F preset `applicableTo` contract. The `id` field of a registry entry must equal the string passed to `app.component()` and to `addPanel({ component: id })`.
- **Synthetic types:** `UNASSIGNED_PANEL_TYPE = "__unassigned__"` (in `src/modules/panels/unassigned.ts`) reserves the namespace for empty panels (assignment state: `empty`). Underscore-prefixed ids are reserved for synthetic types and must not be used by real panels.
- **Extending downstream:** apps that fork CommandVue add their own panel types via `panelRegistry.register({ id, ... })` plus an `app.component(id, ...)` registration. The registry exposes `subscribe()` so UI surfaces stay in sync as types are added at runtime.
- **Categories:** `charts`, `data`, `docs`, `maps`, `monitoring`, `tools`. Use the closest match; don't invent one-offs.
- **Test seam:** `panelRegistry.__resetForTests()` / `__unregisterBuiltinPanelsForTests()` exist for spec isolation. Never call them from app code.

---

## Chrome System

The Chrome System owns the persistent application UI surrounding the dock — top bar, status bar, and all their items.

- **Source of truth:** `src/modules/chrome/registry.ts` (singleton `chromeItemRegistry`) + `src/stores/chrome.ts` (`useChromeStore`) + `src/components/chrome/ChromeBar.vue` (renders one bar with three slots).
- **Built-in registration:** `registerBuiltinChromeItems()` in `src/modules/chrome/builtin.ts`, called once from `main.ts` before mount.
- **Slots:** `top-left`, `top-center`, `top-right`, `status-left`, `status-center`, `status-right` — defined in `src/types/chrome.ts` (`CHROME_SLOTS`).
- **Item shape:** `ChromeItemDefinition` in `src/modules/chrome/types.ts` — `id`, `title`, `description`, `icon` (Lucide), `allowedSlots`, optional `defaultSlot`, async `component()` loader, `removable`, `singleton`.
- **The always-on rule:** `app-icon` is registered with `removable: false`. Its right-click context menu mirrors the MenuBar's File / Edit / View structure — when the user hides the menu bar (View → Hide Menu Bar) the app icon remains the only path to those actions. Never make `app-icon` removable, never allow it in slots other than `top-left`.
- **Permission gating:** `useChromeStore.canEdit` is the extension point. Phase E returns `true` (unconditional). Downstream apps replace this computed with their own permission check (e.g. read from a session store). When `canEdit` is `false`, `enterEditMode` is a no-op and `EditModeToggleItem` doesn't render.
- **Edit mode:** `useChromeStore.editMode` toggles via the EditModeToggle item or the app-icon context menu. In edit mode, slots show a dashed border, present items get an `×` badge (only for `removable: true`), and a `+` button per slot opens a dropdown of items that can be added (filtered by `allowedSlots` and excluding items already present elsewhere).
- **Persistence:** active arrangement is a `ChromeProfile` record persisted via `chromeProfileRepo`. Exactly one profile has `isDefault: true`. The store auto-persists every mutation to the active profile.
- **Test seam:** `chromeItemRegistry.__resetForTests()` / `__unregisterBuiltinChromeItemsForTests()` exist for spec isolation. Never call them from app code.

---

## Presets

Typed bundles of visual configuration applied to panels at runtime.

- **Source of truth:** `src/modules/presets/registry.ts` (`presetTypeRegistry`) + `src/stores/preset.ts` (`usePresetStore`).
- **Built-in registration:** `registerBuiltinPresetTypes()` in `src/modules/presets/builtin.ts`, called once from `main.ts` before mount. Ships three example types: `map-style` (runtime-wired to `map.setStyle`), `map-overlay` and `chart-theme` (registered with stub `applyToPanel`s — downstream apps replace these with tailored implementations).
- **Type shape:** `PresetTypeDefinition<TConfig>` in `src/modules/presets/types.ts` — `id`, `title`, `description`, `icon`, `applicableTo` (panel-type ids), `defaultConfig`, async `editComponent`, `applyToPanel(panelId, config)`, optional `removeFromPanel`.
- **Records vs types:** a `Preset` record (`src/types/preset.ts`) is one user-created instance of a type, persisted via `presetRepo`. Records have `workspaceId: null` (global to user) or a workspace id (scoped, cascades on workspace delete).
- **Runtime apply path:** the panel component watches `panelStateStore.getState(panelId)?.appliedPresetIds`. On change, it iterates in order (later overrides earlier — CSS-cascade semantics) and calls `presetTypeRegistry.get(typeId).applyToPanel(panelId, config)`. Panel components reach their live instance via the **panel-instance registry** (`src/modules/panels/instances.ts`) — each panel registers its imperative handle on mount.
- **Cascading order** is enforced by `panelStateRepo.applyPreset`: re-applying an already-applied preset moves it to the end of `appliedPresetIds`, raising its precedence.
- **`applicableTo` contract:** preset types declare which panel types they apply to. The Apply Preset dialog filters candidates by panel type; downstream apps adding panels must opt in by listing them here.
- **Test seam:** `presetTypeRegistry.__resetForTests()` / `__unregisterBuiltinPresetTypesForTests()` for spec isolation.

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

## Branch and workflow conventions

CommandVue uses a GitFlow-style workflow. **Agents working in this repo must follow it:**

- **Never commit directly to `main` or `develop`.** Both are protected.
- **All feature work begins from `develop`.** Pull latest before branching.
- **One branch per logical unit of work.** Conventional naming: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`.
- **PRs target `develop` by default.** Use `gh pr create --base develop`.
- **PRs to `main` are release PRs only**, opened from `develop`, titled `release: <version>`.
- **After each phase, stop and wait for PR merge** before starting the next phase. Do not chain phases without merge confirmation.
- **PR titles follow Conventional Commits.** Match the type to the work: `feat:` for new capabilities, `fix:` for bug fixes, `docs:` for docs-only, etc.

### The required sequence (feature work)

```bash
git checkout develop && git pull origin develop    # start from clean develop
git checkout -b <type>/<short-slug>                # feature branch first, BEFORE any edits
# … edit, commit (lint-staged + commitlint hooks run automatically) …
git push -u origin <type>/<short-slug>             # push branch
gh pr create --base develop --title "<conventional-commit-style>" --body "<summary + test plan>"
# Stop and wait for the user to merge. Do not auto-merge.
```

**Branch naming:** mirror the Conventional Commit prefix — `feat/...`, `fix/...`, `chore/...`, `docs/...`, `refactor/...`.

### Release PRs (develop → main)

Release PRs are the only PRs that target `main`. Open from `develop` with a `release:` title and a changelog summary; squash-merge once CI is green; tag the resulting commit on `main`.

### Branch protection

| Branch    | `enforce_admins` | Linear history | Merge methods                            |
| --------- | ---------------- | -------------- | ---------------------------------------- |
| `main`    | `true`           | required       | squash only (enforced by linear history) |
| `develop` | `false`          | not required   | squash or merge commit                   |

Both branches require the same status checks before merge:

- `Lint · Type-check · Test · Build` — `.github/workflows/ci.yml`, job `quality`
- `CSpell` — `.github/workflows/cspell.yml`, job `spell`

Both workflows fire on PRs to either `main` or `develop`.

**Approval policy:** the maintainer (`awaisali88`) self-merges; required approvals is `0`. Do not raise this to 1+ until a second collaborator exists. **Do NOT auto-merge PRs without checking with the user first** — the user approves every merge.

### Critical "don'ts"

- **Never run `git push origin main`** or `git push origin develop` — both will be rejected.
- **Never edit `main` or `develop` directly.** Confirm `git branch --show-current` is a feature branch before any edit.
- **Never amend a published commit** or force-push — both blocked by protection.
- **Never skip the PR** for "trivial" changes — required CI checks only run on PRs.
- **Never use `--merge` for PRs to `main`** — main requires linear history; squash or rebase the merge method.

### If you've already made changes on a protected branch by mistake

1. Don't push, don't panic.
2. `git checkout -b <type>/<slug>` — your modifications follow you to the new branch.
3. Stage, commit, push, open PR as normal. The recovery is invisible to reviewers.

### How to inspect / modify branch protection

- `gh api repos/uraanai/CommandVue/branches/main/protection`
- `gh api repos/uraanai/CommandVue/branches/develop/protection`

Settings live there; don't loosen without the user's explicit go-ahead.

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
