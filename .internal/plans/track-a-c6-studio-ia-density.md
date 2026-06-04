# Track A · Phase C6 — Studio IA Lock + Density Resolution + Scrollable-Tabs Adoption

> **Status:** ready for execution. **Branch off `develop` → PR to `develop`.**
> **Authority note:** this plan conforms to the four binding INTEGRATION sections (unified data-model, phase sequencing, open-decision resolution, cross-phase test/CI/doc-sync strategy). Where this plan and any earlier C6 design sketch differ, **this plan wins** — every gap-hunt BLOCKER/MAJOR is folded into the tasks below.

---

## Goal

Lock the Theme Studio's L1 information architecture and resolve the two deferred UX decisions, shipping the **IA shell first** (placeholders for the unbuilt tabs) so C1/C2/C4/C5 each become a single-tab body-fill:

1. **L1 tab IA** — wrap the Studio's left (controls) pane in one scrollable `ui/Tabs` strip with five locked tabs **Generate · Tokens · Typography · Panels & Chrome · Effects**. The Common band (Start-from / Name / Description), the `Splitter`, and the live-preview pane stay **outside** the tabs. Today's controls become the **Generate** tab body; the other four render navigable "coming in Cx" placeholders.
2. **§3E density resolution — RECOMMENDED option (3)** — the Studio's **editor chrome is pinned to a fixed `comfortable` density** regardless of the authored theme's density; **only the live-preview pane reflects the authored density**. This removes the half-and-half `sm`/`md` inconsistency.
3. **Responsive Splitter** — the controls│preview `Splitter` flips from horizontal to **vertical (stacked)** when the panel is too narrow for a usable side-by-side layout.
4. **Scrollable-tabs adoption + Track B cross-link** — adopt scrollable `ui/Tabs` for the L1 strip and document `<Tabs scrollable>` as the canonical shared overflow affordance, cross-referencing Track B's dockview-native dock tab strip (docs-only; dockview owns its tab DOM).

## Architecture

- **One production file substantively changed:** `src/components/panels/ThemeStudioPanel.vue` (tab wrapper, density-scope wrapper, responsive Splitter, Generate-body extraction, `overrides` seam wiring).
- **Two new production files:** a placeholder sub-component and the locked tab-descriptor source.
- **Two sanctioned shipped-primitive edits** (the gap-hunt BLOCKERs): `src/components/ui/Tabs.vue` gains a `panelsClass` prop + exports `Tab` (required to bound-scroll the tab body); `src/assets/styles/tokens.css` gains a bare `[data-density="comfortable"]` block (required to make the density wrapper non-inert). Both are **additive** — no existing call site or token name changes.
- **C6 owns the `overrides` seam** (per the phase-sequencing integration §4): C6 introduces `useThemeAuthoring.overrides` + `setOverride`/`clearOverride`/`clearAllOverrides` + the single merged-push live-apply rule, so C1/C2/C5 consume it instead of triple-inventing it. (C6 does **not** add any Tokens-tab UI; it lands the seam plumbing so the contract exists.)
- **Zero data-model / token-family / engine / persistence change.** No `THEME_SCHEMA_VERSION` (stays `2`), `ENGINE_VERSION` (stays `1`), or `DB_VERSION` (stays `3`) bump. No new `--token` _name_. No `knownTokens.ts` / `generate.ts` / LLM-doc / guard-test change. The token doc-sync (the 6-file rule) does **not** fire (no new token family — the comfortable density block re-declares existing token names, adding no new name).

## Tech

Vue 3 + Vite + TS(strict) · PrimeVue 4 unstyled + Volt + Tailwind v4 · Dockview-vue 6 · Pinia · `@vueuse/core ^14.3.0` (`useElementSize`) · Vitest + @vue/test-utils + jsdom · Playwright MCP for Stage-1 verification.

## Dependencies

- **Hard prerequisite (shipped, verified):** scrollable `ui/Tabs` (`scrollable`/`scrollbar`/`scrollbarColor` props at `Tabs.vue:43-66`; `.tab-scroll-*` CSS in `main.css`). C6 consumes it.
- **Hard prerequisite (shipped):** `ThemeStudioPanel.vue` + `useThemeAuthoring` (Track A A2a). C6 restructures the panel and extends the composable.
- **Volt `Splitter`** ships `p-vertical:flex-col` PT (`Splitter.vue:33`) — enables the vertical stack. (See §RISK-1 on `layout` reactivity → keyed remount.)
- **C6 hard-gates Wave 2** (C1, C3) per the phase-sequencing integration: C1/C2/C4/C5 mount their bodies into the C6 tab container and consume the C6 `overrides` seam. C6 can branch immediately off current `develop`.

---

## File Structure

| Path                                                          | New/Mod                               | Responsibility (one line)                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/panels/ThemeStudioPanel.vue`                  | **Mod**                               | Add the L1 `<Tabs>` IA, the `data-density="comfortable"` editor wrapper, the responsive (keyed) Splitter, move today's controls into the Generate tab body, wire the `overrides` merged-push preview, add the `data-testid="studio-preview"` marker. |
| `src/components/panels/theme-studio/StudioTabPlaceholder.vue` | **New**                               | Presentational stub for the four not-yet-built tab bodies — centered Lucide icon + title + "lands in Cx" note, token-pure, no interactive elements.                                                                                                  |
| `src/components/panels/theme-studio/studioTabs.ts`            | **New**                               | Single source of the locked 5-tab descriptor list `STUDIO_L1_TABS` + `StudioL1TabId` type; imports the `Tab` shape exported from `Tabs.vue`. LOCKED comment.                                                                                         |
| `src/components/ui/Tabs.vue`                                  | **Mod**                               | Add additive `panelsClass?: string` prop (applied to `PvTabPanels` root + active `PvTabPanel`, so a flex-column tab body bound-scrolls); `export interface Tab`. No existing call-site change.                                                       |
| `src/assets/styles/tokens.css`                                | **Mod**                               | Add a bare `[data-density="comfortable"] { … }` block re-declaring the 9 `--density-*` tokens to their comfortable values, so a nested `data-density="comfortable"` wrapper wins the cascade. Adds no new token _name_.                              |
| `src/composables/useThemeAuthoring.ts`                        | **Mod**                               | Introduce the `overrides` ref + `setOverride`/`clearOverride`/`clearAllOverrides`; seed/clear in `seedFromTheme`/`reset`; persist `overrides` in `save`/`updateExisting`; validate each override key/value.                                          |
| `src/stores/theme.ts`                                         | **Mod**                               | Make `previewThemeTokens` clear-then-apply (no stale-key leak) so a removed override drops from `APP_ROOT`.                                                                                                                                          |
| `tests/setup.ts`                                              | **Mod**                               | Add a global no-op `ResizeObserver` stub (every `ThemeStudioPanel` mount now triggers `useElementSize`).                                                                                                                                             |
| `tests/unit/components/panels/studioTabs.spec.ts`             | **New**                               | IA-lock drift guard: exactly 5 unique ids in the locked order with non-empty labels.                                                                                                                                                                 |
| `tests/unit/components/panels/themeStudioTabs.spec.ts`        | **New**                               | Mount the panel: tab render, default active, placeholder render, preview-persists-on-all-tabs, `data-density="comfortable"` on the editor wrapper, `overrides` merge + reset-strip.                                                                  |
| `tests/unit/composables/useThemeAuthoring.spec.ts`            | **Mod (extend if exists, else New)**  | `overrides` CRUD; merge order (override wins); seed for generated vs static base; save passes `overrides`; validation rejects unknown/oversize values.                                                                                               |
| `tests/unit/components/ui/Tabs.spec.ts`                       | **Mod (extend if exists; else skip)** | If present, assert `panelsClass` reaches `PvTabPanels` and the active panel.                                                                                                                                                                         |
| `docs/theming.md`                                             | **Mod**                               | "Studio information architecture" subsection: the locked 5-tab order + the §3E density resolution.                                                                                                                                                   |
| `docs/contributing-ui.md`                                     | **Mod**                               | "Scrollable tab strips (`<Tabs scrollable>`)" subsection: canonical overflow affordance + Track B dockview cross-link.                                                                                                                               |
| `dictionaries/project.txt`                                    | **Mod (conditional)**                 | Add any CSpell-flagged placeholder-copy term.                                                                                                                                                                                                        |

Net: **3 prod files changed** (panel, Tabs, tokens.css) + **1 prod file changed** for the seam (`useThemeAuthoring.ts`) + **1 store change** + **2 prod files added** + **1 test-setup change** + **2 test files added** + **2 doc files edited**. No token/schema/engine/persistence model change. No version-constant bump.

---

## Ground-truth facts (verified against `develop` HEAD — do not re-derive)

1. **`Tabs.vue` slot contract (`Tabs.vue:200-204`):** there is exactly **one** default slot, rendered once per `v-for` tab and gated by `<slot v-if="tab.id === modelValue" :active="tab.id" />`. There are **no per-tab panel slots** (`tab-${id}` at line 195 is the _label_ slot). Consumers branch on the panel-local `activeTab` ref inside the single default slot. → Edit C uses `v-if="active === 'generate'"`.
2. **`PvTabPanels` is hardcoded `:pt="{ root: { class: 'pt-3' } }"` (`Tabs.vue:200`)** with no `flex`/`min-h-0` — a `flex-1 overflow-y-auto` tab body has no bounded flex parent and will **not** scroll. → Task 4 adds the `panelsClass` prop (BLOCKER fix).
3. **`<PvTabs>` has no `class` passthrough** (`Tabs.vue:180-184` binds only `:value`/`:scrollable`/`@update:value`). → never pass `class`/`px-3` to `<Tabs>`; padding goes on the tab-body wrapper.
4. **`interface Tab` is NOT exported** (`Tabs.vue:35`). → Task 4 adds `export`.
5. **`tokens.css` density blocks are bare `[data-density="x"]`** (compact `:467`, spacious `:481`), specificity 0-1-0 — **NOT** `html[...]`-qualified (only `html[data-theme="dark"]` is qualified, `:573`). **Comfortable is the unselected `:root` default (`:451-459`) with NO `[data-density="comfortable"]` selector.** → a nested `data-density="comfortable"` wrapper is inert until Task 6 adds the bare comfortable block.
6. **Comfortable density values (the literal block to add):** `--density-row-height: 2.25rem; --density-cell-padding-y: var(--space-2); --density-cell-padding-x: var(--space-3); --density-control-height: 2rem; --density-icon-size: 1rem; --density-font-size: var(--text-sm); --density-titlebar-height: 2.5rem; --density-statusbar-height: 1.75rem; --density-panel-header-height: 2.25rem;` (+ the two `--spacing-*` aliases).
7. **PrimeVue 4 `Splitter` `layout`** is documented as a standard prop but **not documented as reactive post-mount** (Context7 `/websites/primevue`); pane geometry is computed from `size`/`minSize` at mount. → Task 7 **keys** the Splitter on `splitterLayout` to force a clean remount on flip (deterministic; split resets to `44/56` — documented behavior, §RISK-1).
8. **Volt `Splitter` wrapper forwards `layout` as a fallthrough attr** to the inner `<Splitter>` (`Splitter.vue` has no explicit `layout` prop binding but the inner Splitter is the root). The `p-vertical:flex-col` PT (`Splitter.vue:33`) styles vertical. → pass `:layout` + `:key` on the `<Splitter>` element.
9. **`useThemeAuthoring` is accessed as `a.<name>.value`** (composable returns refs; e.g. `a.mode.value`, `a.density.value`, `a.generationResult.value`). Returned surface confirmed at `useThemeAuthoring.ts:336-377`.
10. **`themeStore.previewThemeTokens(tokens, density?)`** at `theme.ts:234`; `cancelPreview` `:192`; `endPreview` `:251`. `applyTokenOverrides`/`clearTokenOverrides(root, except?)` at `apply.ts:74/90`.
11. **`tests/setup.ts`** exists, is registered (`vitest.config.ts:19`), and is empty (`export {}`). `@vueuse/core ^14.3.0` is installed; `useElementSize` has no current usage in `src/`.
12. **`docs/contributing-ui.md`, `docs/theming.md`** both exist and are sidebar-registered (`docs/.vitepress/config.ts:81,92`). No sidebar edit needed.
13. **`data-testid`** is an established convention in `src/` (CesiumPanel, MapLibrePanel, DockMenu, DockPopoutContextMenu). The preview marker is house-style-consistent.
14. **All five Lucide names exist** in `@lucide/vue`: `SlidersHorizontal`, `Type`, `LayoutPanelTop`, `Sparkles`, `Palette`. Named imports only (tree-shaking).

---

## Data-model delta

**None.**

- `GenerationInputV2` / `Theme` / `PortableTheme` — unchanged.
- `THEME_SCHEMA_VERSION = 2`, `ENGINE_VERSION = 1`, `DB_VERSION = 3` — **no bump** (per unified data-model integration §1). No migration code; `migrate.ts` untouched; `db.spec.ts`'s `expect(db.version).toBe(3)` stays green.
- The `overrides` seam introduced in `useThemeAuthoring` persists into the **existing** `Theme.overrides: ThemeTokens` field (sparse map) via `themeRepo.create`/`update` — **no new `Theme` field**. C6 ships the seam plumbing + validation; C1 builds the Tokens-tab UI on top of it.
- **Active-tab UI state is intentionally NOT persisted.** `activeTab` is component-local, reset to `"generate"` on every mount. Persisting it would need a `DB_VERSION` bump for zero user benefit (the Studio is a `singleton` panel, so it survives layout reloads). Matches the existing `liveAcrossApp` precedent (`ThemeStudioPanel.vue:56`).
- The `[data-density="comfortable"]` block re-declares **existing** token names; it adds no new `--token` _name_ → no `knownTokens.ts` entry, no doc-sync, no engine impact (it is pure CSS cascade, never emitted by `generate.ts`).

---

## ORDERED TASKS

> Each task: exact path(s) → concrete change → acceptance check. Tasks 1–12 implement; 13–17 verify/doc/PR. Run the static gauntlet (Task 11) before Stage-1 (Task 15).

### Task 1 — Branch off develop

- `git checkout develop && git pull origin develop && git checkout -b feat/c6-studio-ia`
- **Accept:** `git branch --show-current` prints `feat/c6-studio-ia`.

### Task 2 — Make `ui/Tabs` bound-scroll the tab body (BLOCKER fix) + export `Tab`

**File:** `src/components/ui/Tabs.vue`

a. Export the `Tab` interface (line 35):

```ts
export interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}
```

b. Add an additive optional prop to `Props` (after `scrollbarColor`):

```ts
  /**
   * Tailwind classes applied to the TabPanels container AND the active TabPanel,
   * so a flex-column tab body can bound-scroll inside a height-constrained pane.
   * Default keeps the original `pt-3` spacing untouched for existing call sites.
   */
  panelsClass?: string;
```

and in `withDefaults`: `panelsClass: ""`.

c. Thread it through the template (replace lines 200-204). The `PvTabPanels` root must keep `pt-3` AND gain the consumer classes; the active `PvTabPanel` must become a flex child so `overflow-y-auto` inside the slot bounds against the pane height:

```vue
<PvTabPanels :pt="{ root: { class: cn('pt-3', panelsClass) } }">
      <PvTabPanel
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
        :pt="{ root: { class: panelsClass } }"
      >
        <slot v-if="tab.id === modelValue" :active="tab.id" />
      </PvTabPanel>
    </PvTabPanels>
```

(`cn` is already imported at `Tabs.vue:10`.)

- **Why both elements:** PrimeVue stacks `TabPanels` (the container) → `TabPanel` (per-tab). The body's `flex-1 min-h-0` resolves only if its parent chain is `flex min-h-0 flex-1 flex-col` all the way to the pane. Applying `panelsClass` to both the container and the active panel gives an unbroken flex column.
- **Accept:** `pnpm type-check` clean; no existing `<Tabs>` call site changes behavior (default `panelsClass: ""` → only `pt-3` as before). A throwaway mount with `panelsClass="flex min-h-0 flex-1 flex-col"` puts the classes on the `[data-pc-section="root"]` of `PvTabPanels`.

### Task 3 — Add the locked L1 tab descriptor source

**File (new):** `src/components/panels/theme-studio/studioTabs.ts`

```ts
import type { Tab } from "@/components/ui/Tabs.vue";

/**
 * LOCKED by Phase C6 (spec §4) — do not reorder or rename without maintainer
 * sign-off. C1/C2/C4/C5 fill the corresponding tab bodies; they MUST NOT edit
 * this list. Guarded by tests/unit/components/panels/studioTabs.spec.ts.
 */
export const STUDIO_L1_TABS = [
  { id: "generate", label: "Generate" },
  { id: "tokens", label: "Tokens" },
  { id: "typography", label: "Typography" },
  { id: "panels", label: "Panels & Chrome" },
  { id: "effects", label: "Effects" },
] as const satisfies readonly Tab[];

export type StudioL1TabId = (typeof STUDIO_L1_TABS)[number]["id"];
```

- **Accept:** `pnpm type-check` clean; the array `satisfies readonly Tab[]` against the now-exported `Tab` type; order is `generate, tokens, typography, panels, effects`.

### Task 4 — Add the placeholder component

**File (new):** `src/components/panels/theme-studio/StudioTabPlaceholder.vue`

```vue
<script setup lang="ts">
import type { Component } from "vue";

/**
 * StudioTabPlaceholder — presentational stub rendered as the body of the L1
 * tabs not yet built (Tokens C1 · Typography C2 · Panels & Chrome C4 · Effects
 * C5). Deliberate custom component: it is not a PrimeVue surface (no library
 * equivalent), so the library-first rule does not apply. Token-pure (no color
 * literals); no raw interactive elements → governance-clean.
 */
interface Props {
  icon: Component;
  title: string;
  phase: string;
  note: string;
}
defineProps<Props>();
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
    <component :is="icon" :size="20" class="text-faint" />
    <p class="text-muted text-sm font-medium">{{ title }}</p>
    <p class="text-faint max-w-[20rem] text-xs">{{ note }}</p>
    <p class="text-faint text-[10px] tracking-wider uppercase">Lands in {{ phase }}</p>
  </div>
</template>
```

- Icon rendered via `<component :is="icon">` (named Lucide imports passed from the parent — UI chrome → `@lucide/vue` per icon rules). No `import *`.
- **Accept:** renders title + note + "Lands in Cx"; no `<button>/<input>/<select>/<textarea>`; `pnpm lint` clean. (Lives under `src/components/panels/**` → not scanned by `check:single-source`, but stays token-pure by hand-review.)

### Task 5 — Wire imports + script state in the panel

**File:** `src/components/panels/ThemeStudioPanel.vue`

a. Add imports (top of `<script setup>`):

```ts
import { SlidersHorizontal, Type, LayoutPanelTop, Sparkles } from "@lucide/vue";
import { useElementSize, useDebounceFn } from "@vueuse/core";
import Tabs from "@/components/ui/Tabs.vue";
import StudioTabPlaceholder from "@/components/panels/theme-studio/StudioTabPlaceholder.vue";
import { STUDIO_L1_TABS } from "@/components/panels/theme-studio/studioTabs";
```

(Drop `Palette` — unused → `no-unused-vars`. Do not import `StudioL1TabId` — `activeTab` is `ref<string>`, see §RISK-2.)

b. Add state (after `const a = useThemeAuthoring()`):

```ts
const activeTab = ref<string>("generate");

// Responsive Splitter: stack controls above preview when the panel is too narrow
// for a usable side-by-side split. Observed on the panel root.
const panelRoot = ref<HTMLElement | null>(null);
const { width: panelWidth } = useElementSize(panelRoot);
const STACK_BELOW_PX = 560; // below this total width → vertical stack
const splitterLayout = computed<"horizontal" | "vertical">(() =>
  panelWidth.value > 0 && panelWidth.value < STACK_BELOW_PX ? "vertical" : "horizontal",
);
```

- `panelWidth.value > 0` guards the initial `0` from `useElementSize` before first measure → defaults `horizontal` (no flash). 560px: at the `44/56` split, the controls pane (`min-size: 22`) bottoms out near 246px usable below ~560px total — cramped for the `ColorSwatchPicker` rows. Tunable design constant (Stage-2 + SO-4 sign-off in the integration doc).
- **Accept:** `pnpm type-check` clean; no unused-import lint warnings.

### Task 6 — Add the `[data-density="comfortable"]` block (BLOCKER fix)

**File:** `src/assets/styles/tokens.css` — insert a new block immediately **before** the existing `[data-density="compact"]` block (line 467), so the editor wrapper's `data-density="comfortable"` matches a real rule and wins over an inherited `<html data-density="spacious">` (nearer ancestor, equal 0-1-0 specificity, re-declared on the inner element):

```css
/* Comfortable is the @theme/:root default; this explicit block lets a nested
 * `[data-density="comfortable"]` wrapper (the Theme Studio editor chrome, C6)
 * override an inherited `<html data-density="…">` for its subtree. Values are
 * identical to the :root defaults above — this adds NO new token NAME, so it is
 * not a doc-sync / knownTokens / engine change. Authored as a bare attribute
 * selector (specificity 0-1-0) so the inner wrapper beats the html-level value. */
[data-density="comfortable"] {
  --density-row-height: 2.25rem;
  --density-cell-padding-y: var(--space-2);
  --density-cell-padding-x: var(--space-3);
  --density-control-height: 2rem;
  --density-icon-size: 1rem;
  --density-font-size: var(--text-sm);
  --density-titlebar-height: 2.5rem;
  --density-statusbar-height: 1.75rem;
  --density-panel-header-height: 2.25rem;
  --spacing-titlebar: var(--density-titlebar-height);
  --spacing-statusbar: var(--density-statusbar-height);
}
```

- **Accept:** `pnpm build` succeeds; in a quick dev check, `<html data-density="spacious">` with a `<div data-density="comfortable">` descendant resolves `getComputedStyle(div).getPropertyValue("--density-control-height") === "2rem"` (comfortable), while a node outside the wrapper resolves `2.5rem` (spacious). This is the security/correctness proof the density split rests on.

### Task 7 — Density-scope wrapper + Tabs IA in the controls pane

**File:** `src/components/panels/ThemeStudioPanel.vue` — replace the controls `<SplitterPanel :size="44" :min-size="22"> … </SplitterPanel>` body (lines 181-278). The current controls `<div>` becomes the **Generate** body; wrap the whole pane in `data-density="comfortable"` and the L1 `<Tabs>`:

```vue
<SplitterPanel :size="44" :min-size="22">
  <!-- §3E option (3): the editor chrome is pinned to a fixed `comfortable`
       density so its controls never re-space with the AUTHORED density. Only the
       preview pane (the other SplitterPanel) reflects a.density.value. -->
  <div data-density="comfortable" class="flex min-h-0 w-full flex-col overflow-hidden">
    <Tabs
      v-model="activeTab"
      :tabs="STUDIO_L1_TABS"
      scrollable
      panels-class="flex min-h-0 flex-1 flex-col"
      class="flex min-h-0 flex-1 flex-col"
    >
      <template #default="{ active }">
        <!-- GENERATE — today's controls moved here VERBATIM (bindings unchanged).
             Only structural change: was `p-3`, now `px-3 pb-3 pt-1` + `flex-1`
             so the body scrolls inside the bounded tab panel. -->
        <div
          v-if="active === 'generate'"
          class="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto px-3 pt-1 pb-3 text-sm"
        >
          <!-- … the existing Mode / Base / Accent / Status hues / Contrast /
               Density / Font / paired+apply checkboxes / saveError block,
               lines 183-276, UNCHANGED … -->
        </div>
        <StudioTabPlaceholder
          v-else-if="active === 'tokens'"
          :icon="SlidersHorizontal"
          title="Tokens"
          phase="C1"
          note="Per-token editor — change any of the themeable tokens directly."
        />
        <StudioTabPlaceholder
          v-else-if="active === 'typography'"
          :icon="Type"
          title="Typography"
          phase="C2"
          note="Font roles, the modular type scale, and Google Fonts."
        />
        <StudioTabPlaceholder
          v-else-if="active === 'panels'"
          :icon="LayoutPanelTop"
          title="Panels & Chrome"
          phase="C4"
          note="Dockview chrome tokens and per-panel appearance variants."
        />
        <StudioTabPlaceholder
          v-else-if="active === 'effects'"
          :icon="Sparkles"
          title="Effects"
          phase="C5"
          note="Elevation, glow, and blur."
        />
      </template>
    </Tabs>
  </div>
</SplitterPanel>
```

Critical constraints honored:

- **Padding is on the tab-body wrapper (`px-3`), NEVER on `<Tabs>`'s scroll viewport.** The `class` on `<Tabs>` lands on `PvTabs` root (which has no scroll-viewport role); the `px-3` that pads content is on the inner Generate `<div>`. PrimeVue's `getWidth`-vs-`scrollWidth` end-detection measures the TabList `content` viewport (`Tabs.vue:160-167`), which C6 never pads → the next-chevron end-detection stays correct (gap-hunt MAJOR #2 resolution).
- **Single default slot, branch on `active`** — matches `Tabs.vue:202`'s `<slot v-if="tab.id === modelValue" :active>`. No per-tab panel slots (BLOCKER fix).
- **Generate body scrolls** because `panels-class="flex min-h-0 flex-1 flex-col"` (Task 2) makes the `PvTabPanels` + active `PvTabPanel` a bounded flex column.
- The Generate state survives tab switches (values live in `useThemeAuthoring` refs created once at `setup`; the control DOM unmounts but the refs don't reset). Transient UI state (open `ColorSwatchPicker` popover, in-flight `Slider` drag) does NOT survive — accepted + documented in the PR.

- **Accept:** Generate tab shows all of today's controls; the other 4 show `StudioTabPlaceholder`; the Generate body scrolls within the pane (does not overflow the Splitter); the live preview (other pane) is unchanged.

### Task 8 — Responsive (keyed) Splitter + root ref

**File:** `src/components/panels/ThemeStudioPanel.vue`

a. On the root `<div>` (line 109) add `ref="panelRoot"`:

```vue
<div ref="panelRoot" class="bg-surface text-foreground flex h-full w-full flex-col overflow-hidden">
```

b. On the `<Splitter>` (line 180) bind layout + **key** it (PrimeVue Splitter `layout` is not documented as reactive post-mount → force a clean remount on flip, §RISK-1):

```vue
<Splitter
  :key="splitterLayout"
  :layout="splitterLayout"
  class="!h-full !rounded-none !border-0"
>
```

- The `!h-full !rounded-none !border-0` overrides are layout-agnostic and load-bearing (Volt Splitter applies `border rounded-md`; stripping keeps it flush). `:size="44"/`:size="56"`are percentages along the active axis and work in both orientations. The remount on flip resets a user-dragged split to`44/56` — documented behavior (§RISK-1), not a defect.
- **Accept:** widen/narrow the dev panel across 560px → the split flips horizontal↔vertical cleanly (controls above preview when vertical); no console error; no horizontal→vertical→horizontal flash on mount.

### Task 9 — Preview test marker

**File:** `src/components/panels/ThemeStudioPanel.vue` — add `data-testid="studio-preview"` to the preview-pane wrapper `<div>` (the one with `:data-density="a.density.value"`, ~line 283):

```vue
<div
  data-testid="studio-preview"
  class="border-border-subtle overflow-hidden rounded-lg border"
  :style="previewStyle"
  :data-density="a.density.value"
>
```

- **Accept:** the marker is queryable; preview still reflects authored density (`data-testid` is an established `src/` convention, fact #13).

### Task 10 — Introduce the `overrides` seam + merged-push preview (integration §4)

> C6 owns this seam so C1/C2/C5 consume it rather than triple-inventing it. C6 adds the plumbing + validation + the single live-apply rule; it does **not** add Tokens-tab UI (that is C1). The seam persists into the existing `Theme.overrides` field — **no data-model change**.

**File:** `src/composables/useThemeAuthoring.ts`

a. Add the ref + helpers (alongside the other refs; expose them in the `return {}` at line 336):

```ts
import { isKnownToken } from "@/modules/themes/knownTokens";
import { TokenValueSchema } from "@/modules/themes/portableSchema";
// …
const overrides = ref<Record<string, string>>({});

function setOverride(token: string, value: string): void {
  overrides.value = { ...overrides.value, [token]: value };
}
function clearOverride(token: string): void {
  const next = { ...overrides.value };
  delete next[token];
  overrides.value = next;
}
function clearAllOverrides(): void {
  overrides.value = {};
}
```

> Confirm the exact export names during execution: `isKnownToken` from `src/modules/themes/knownTokens.ts`, and the value schema `TokenValueSchema` from `src/modules/themes/portableSchema.ts` (per the CI-guard survey). If the value schema is named differently, use the actual export; do not invent one.

b. In `seedFromTheme(theme)` — seed `overrides` from the theme's existing sparse map (never access `.input` on a static base):

```ts
overrides.value = theme ? { ...(theme.overrides ?? {}) } : {};
```

c. In `reset()` — `overrides.value = {};`.

d. In `save()` and `updateExisting()` — pass `overrides: overrides.value` to `themeRepo.create`/`update`; the paired variant gets `overrides: {}`.

e. In `save()`/`updateExisting()` validation (before persist) — reject bad override entries, set `saveError`, and return the failure sentinel `null` (matches the existing `save`/`updateExisting` return type — confirmed in useThemeAuthoring.ts: both are `Promise<Theme | null>` and already `return null` on a handled error):

```ts
for (const [key, val] of Object.entries(overrides.value)) {
  if (!isKnownToken(key)) {
    saveError.value = `Unknown token: ${key}`;
    return null;
  }
  if (!TokenValueSchema.safeParse(val).success) {
    saveError.value = `Invalid value for ${key}`;
    return null;
  }
}
```

f. Add to the `return {}` (line 336): `overrides, setOverride, clearOverride, clearAllOverrides`.

**File:** `src/stores/theme.ts` — make `previewThemeTokens` clear-then-apply so a removed override key drops from `APP_ROOT` (additive `applyTokenOverrides` would otherwise leave it stranded). Inside `previewThemeTokens` (`:234`), before `applyTokenOverrides(tokens, APP_ROOT)`, call `clearTokenOverrides(APP_ROOT, new Set(Object.keys(tokens)))` (clear everything not in the new set), then apply. Verify against the existing body — if it already clears-then-applies, no change is needed; the requirement is that **disabling a previously-pushed key removes it from the root**.

**File:** `src/components/panels/ThemeStudioPanel.vue` — make the preview merge override-wins and push the merged set:

```ts
const previewStyle = computed<Record<string, string>>(() => ({
  ...(a.generationResult.value?.tokens ?? {}),
  ...a.overrides.value,
}));

const pushPreview = useDebounceFn(() => {
  const tokens = { ...(a.generationResult.value?.tokens ?? {}), ...a.overrides.value };
  if (Object.keys(tokens).length > 0 && liveAcrossApp.value) {
    themeStore.previewThemeTokens(tokens, a.density.value);
  }
}, 120);
```

Replace `applyToApp()`'s body to call the merged push (keep the `interacted`/`liveAcrossApp` gates), and add `watch(a.overrides, () => { interacted = true; pushPreview(); }, { deep: false })`. The existing `watch(a.generationResult, …)` also calls `pushPreview()`. `onUnmounted` cancels the debounce (`pushPreview.cancel?.()`) before `cancelPreview()`.

- This is the **single live-apply writer** (integration §4): both the generator path and any future per-token override path go through the one merged `previewThemeTokens` push. C6's Tokens tab is a placeholder, so no per-token edits exist yet — but the seam + rule are in place for C1.
- **Accept:** existing live-preview behavior is byte-identical for the generator path (no overrides set → merged set == `generationResult.tokens`); `previewStyle` is override-wins; a unit test (Task 13) proves `overrides` CRUD + merge order + reset-strip.

### Task 11 — Static gauntlet

- `pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build`
- Run `pnpm docs:build` after Task 16.
- `check:single-source` scans `src/volt/**` + `src/components/ui/**`. The `Tabs.vue` edit (Task 2) is class-only (`cn('pt-3', panelsClass)`) → no color literal → stays green. The new panel/placeholder files live under `src/components/panels/**` (unscanned) but are token-pure.
- **Accept:** all green.

### Task 12 — Add the global `ResizeObserver` stub

**File:** `tests/setup.ts` — replace `export {};` with a no-op `ResizeObserver` (jsdom lacks it; every `ThemeStudioPanel` mount now calls `useElementSize` → `new ResizeObserver(...)`, which throws synchronously without this):

```ts
/**
 * Global Vitest setup. jsdom has no ResizeObserver; @vueuse/core useElementSize
 * (ThemeStudioPanel responsive Splitter, C6) constructs one at mount, so every
 * spec that mounts the panel needs this stub.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

export {};
```

- **Accept:** mounting `ThemeStudioPanel` in jsdom no longer throws on `ResizeObserver`.

### Task 13 — Unit specs

**File (new):** `tests/unit/components/panels/studioTabs.spec.ts` (IA-lock drift guard):

```ts
import { describe, expect, it } from "vitest";
import { STUDIO_L1_TABS } from "@/components/panels/theme-studio/studioTabs";

describe("STUDIO_L1_TABS (C6 IA lock)", () => {
  it("has exactly the 5 locked tabs in order", () => {
    expect(STUDIO_L1_TABS.map((t) => t.id)).toEqual([
      "generate",
      "tokens",
      "typography",
      "panels",
      "effects",
    ]);
  });
  it("has unique ids and non-empty labels", () => {
    const ids = STUDIO_L1_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of STUDIO_L1_TABS) expect(t.label.length).toBeGreaterThan(0);
  });
});
```

**File (new):** `tests/unit/components/panels/themeStudioTabs.spec.ts` — mount the panel with real Pinia + `resetForStoreTest()` in `beforeEach`; pass `props = { params: { params: {} } }` (minimal `usePanelApi` bag). Assert:

1. The L1 strip renders exactly the 5 `STUDIO_L1_TABS` labels in order.
2. Default active tab is `generate`; the Generate body renders a known control (e.g. the Contrast `Slider` or the "Mode" label).
3. Setting `activeTab` to `tokens`/`typography`/`panels`/`effects` renders a `StudioTabPlaceholder` with the matching `title`/`phase`.
4. `[data-testid="studio-preview"]` is present for **every** active tab (`count === 1` after switching to each) → proves the preview lives outside `<Tabs>`.
5. The controls-pane wrapper carries `data-density="comfortable"`; the preview wrapper carries `:data-density` bound to `a.density.value`.
6. Cold blank mount does NOT call `previewThemeTokens` (spy the store; `interacted` gate intact).

**File (mod, extend if exists else new):** `tests/unit/composables/useThemeAuthoring.spec.ts`:

- `overrides` CRUD: `setOverride`/`clearOverride`/`clearAllOverrides` mutate the ref; `setOverride` is immutable-replace (new object identity).
- Seed: a generated-base theme with `overrides` seeds them; a `null`/blank seeds `{}`; a static base seeds `{}` and never throws.
- Save: `save()`/`updateExisting()` pass `overrides` to the repo (mock `themeRepo`); validation rejects an unknown token key and an oversize/injection value (sets `saveError`, returns falsy).

**Harness note:** `import { describe, expect, it, vi } from "vitest"` (globals off). Use `createTestingPinia` is **NOT** used here — use real Pinia + `resetForStoreTest()` from `tests/unit/stores/helpers.ts`. The `ResizeObserver` stub (Task 12) covers the mount.

- **Accept:** `pnpm test` passes all new/extended specs.

### Task 14 — Stage 0 probe + Stage 1 Playwright verification

- Probe `mcp__plugin_playwright_playwright__*` (deferred — already surfaced). If absent, `ToolSearch` `query: "playwright browser"`. If still unavailable, fall back to a manual smoke checklist, state this in the PR, and embed NO Stage-1 results table.
- Drive `pnpm dev`; open the Theme Studio panel; run the assertion list (below). Screenshots → `.verification-screenshots/feat-c6-studio-ia/<checkpoint>.png` (gitignored).
- **Accept:** every assertion PASS; 0 console errors; results table assembled for the PR.

### Task 15 — Document IA + scrollable-tabs reuse contract

**File:** `docs/theming.md` — add a "Studio information architecture" subsection: the locked 5-tab order (`generate · tokens · typography · panels · effects`), the rule that the Common band / Splitter / preview stay outside the tabs, and the §3E density resolution (editor pinned `comfortable`, preview reflects authored density; mechanism = the `[data-density="comfortable"]` block + the wrapper). Keep any token _names_ mentioned here in `theming.md` only — do NOT mirror into `docs/theme-schema-for-llms.md` (that would trip the LLM-doc guard, which checks doc→allowlist).

**File:** `docs/contributing-ui.md` — add a "Scrollable tab strips (`<Tabs scrollable>`)" subsection: it is the single shared overflow affordance for any `ui/Tabs`-built strip (Studio L1, showcase Navigation demo); cross-reference Track B — the dockview-native dock tab strip is single-row-scrollable through dockview's own overflow dropdown + `--dv-tabs-container-scrollbar-color`, a deliberately separate engine (dockview owns its tab DOM) sharing only the **one-row-never-wrap** contract. (Cross-link is docs-only per integration SO-4/Q4 — no dockview code change.)

- Both files exist and are sidebar-registered (fact #12) → no `docs/.vitepress/config.ts` edit.
- **Accept:** `pnpm docs:build` clean; both subsections present; Track B cross-link explicit.

### Task 16 — Conditional CSpell

**File:** `dictionaries/project.txt` — if `pnpm spell` flags any placeholder-copy term (verify "dockview", "modular" — likely already in `dictionaries/tech.txt`), add the term to `dictionaries/project.txt` (never `cspell.json`).

- **Accept:** `pnpm spell` clean.

### Task 17 — Commit, push, open PR

- Conventional commit + co-author trailer:

```
git add -A
git commit -m "feat(theming): lock Studio L1 tab IA + density resolution + scrollable tabs (Phase C6)"
git push -u origin feat/c6-studio-ia
```

- `gh pr create --base develop --title "feat(theming): Studio IA lock + density resolution + scrollable-tabs adoption (Phase C6)" --body "<Stage-1 results table + Stage-2 checklist + scrutinize callout + open-question answers>"`
- **Do NOT auto-merge** — wait for the maintainer.
- **Accept:** PR open against `develop`; CI `quality` + `CSpell` green; Stage-1 table embedded.

---

## Doc-sync checklist (the 6-file rule)

**The token doc-sync (the 6-file rule) does NOT fire for C6 (no new token family).** C6 adds no new token _name_, no `*_TOKEN_NAMES` array entry, no `generate.ts` emission, no persisted-shape change. Confirm each is untouched before opening the PR:

| Doc-sync file                                   | C6 touch?                 | Why                                                                                                                                                 |
| ----------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/assets/styles/tokens.css`                  | **Yes — but no new name** | Adds a `[data-density="comfortable"]` block re-declaring **existing** token names. Not a new family → does not trigger the rule's other four files. |
| `src/modules/themes/knownTokens.ts`             | No                        | No new token name.                                                                                                                                  |
| `src/modules/themes/generate.ts`                | No                        | No new emitted key.                                                                                                                                 |
| `docs/theme-schema-for-llms.md`                 | No                        | No new token; the LLM-doc + its guard test stay untouched. Studio-IA prose lives in `docs/theming.md` only.                                         |
| `tests/unit/docs/theme-schema-for-llms.spec.ts` | No                        | Guard stays green by construction (C6 never runs through any code it reads).                                                                        |

**The one-line scope test:** if a change touches a `--token` _name_, a `*_TOKEN_NAMES` array, `generate.ts`, or any persisted shape, it is out of phase. The comfortable density block touches a `--token` _value re-declaration_ but no _name_ → in phase.

---

## 2-stage verification

### Stage 1 — Playwright automated assertions

Screenshots → `.verification-screenshots/feat-c6-studio-ia/<checkpoint>.png`. Embed the actual-run results table (assertion id · description · result · screenshot · PASS/FAIL) + console-error count (target 0) + console-warning count + a PASS/FAIL summary in the PR. PR not opened until fully green.

| ID  | Assertion                                                                                                                                                                                                                                                                                                                                                                                                              | Checkpoint                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A1  | L1 strip shows 5 tabs in order: Generate, Tokens, Typography, Panels & Chrome, Effects; single row, no wrap.                                                                                                                                                                                                                                                                                                           | `01-l1-strip.png`                                    |
| A2  | Default active tab is Generate; the Generate body shows Mode + Base color + Contrast controls.                                                                                                                                                                                                                                                                                                                         | `02-generate-active.png`                             |
| A3  | Click each of Tokens / Typography / Panels & Chrome / Effects → the matching `StudioTabPlaceholder` (title + "Lands in Cx") renders; no console error.                                                                                                                                                                                                                                                                 | `03-placeholders.png`                                |
| A4  | `[data-testid="studio-preview"]` count === 1 after switching to **each** of the 5 tabs (preview lives outside `<Tabs>`).                                                                                                                                                                                                                                                                                               | `04-preview-persists.png`                            |
| A5  | Set authored Density → **Spacious** in Generate. A rendered editor control's computed height resolves the **comfortable** `--density-control-height` (`getComputedStyle(controlEl).getPropertyValue("--density-control-height").trim() === "2rem"`), while the same property inside `[data-testid="studio-preview"]` resolves `2.5rem` (spacious). Component-layer token, computed value — not a raw inherited string. | `05-density-split.png`                               |
| A6  | Change Contrast to a new value → switch to Effects → switch back to Generate → the slider retains the new value (state survives tab unmount).                                                                                                                                                                                                                                                                          | `06-state-persist.png`                               |
| A7  | Resize the panel below 560px → the Splitter stacks vertically (controls above preview). Above 560px → side-by-side.                                                                                                                                                                                                                                                                                                    | `07-responsive-stack.png`, `07-responsive-split.png` |
| A8  | Force the controls pane narrow enough that 5 tabs overflow → chevron nav buttons appear and scroll the strip; the right chevron disappears at the end (edge-fade). At full width → no chevrons.                                                                                                                                                                                                                        | `08-scroll-chevrons.png`                             |
| A9  | Live-across-app on: changing a Generate input recolors the main app; switching L1 tabs does **not** change the main app theme (preview re-pushes on input change, not tab change).                                                                                                                                                                                                                                     | `09-live-stable-on-tab-switch.png`                   |
| A10 | The Generate tab body scrolls **inside** the pane (a long controls list does not overflow/clip the Splitter; the strip stays pinned above the scroll region).                                                                                                                                                                                                                                                          | `10-body-bound-scroll.png`                           |

### Stage 2 — Human design review (3-7 items)

1. **Tab strip legibility** — do the 5 tabs read as a clean single row at the default Studio width, comfortable target sizes (no cramped `sm` feel)?
2. **Density split feels right** — with a `compact` authored theme, does the editor stay comfortably spaced while the preview visibly tightens? Legible contrast between panes, not jarring?
3. **Placeholder tone** — do the "Lands in Cx" stubs read as intentional roadmap, not broken/empty? Icon + copy balanced?
4. **Responsive stack threshold** — does 560px feel like the right break? In the stacked layout, is controls-above-preview the natural reading order?
5. **Chevron polish** — when the strip scrolls, do the chevrons + edge fade feel native (matching the showcase Navigation demo), smooth hover states?

**Scrutinize for this phase:** the §3E density split is the subtle judgment call — confirm the editor truly never re-spaces with the authored density while the preview always does (Task 6's comfortable block is what makes this real, not inert). And confirm tab switching never causes a visible flash in the live app theme (the preview re-pushes on input change, not on tab change; the keyed Splitter remount on the responsive flip is the one place to watch for a momentary pane redraw).

---

## Risks

- **§RISK-1 — PrimeVue `Splitter` `layout` reactivity.** Context7 (`/websites/primevue`) documents `layout` as a prop but **not** as reactive post-mount; pane geometry is computed from `size`/`minSize` at mount. **Mitigation:** `:key="splitterLayout"` (Task 8) forces a clean remount on orientation flip — deterministic, at the cost of resetting a user-dragged split back to `44/56` on each flip. This is documented behavior, acceptable for a responsive breakpoint that fires rarely. The remount momentarily tears down both panes (incl. the live preview), so verify A7 shows no console error and the preview re-renders cleanly after the flip.
- **§RISK-2 — `activeTab` typing.** `<Tabs>` emits `string` (`Tabs.vue:183` `String(v)`). `activeTab` is `ref<string>` (not `Ref<StudioL1TabId>`) so the `@update:modelValue` boundary needs no cast; the `v-if="active === 'generate'"` comparisons are literal-string-safe. The `StudioL1TabId` union remains the drift-guard's job (Task 13), not a runtime constraint.
- **§RISK-3 — `previewThemeTokens` stale-key leak.** If the store's `applyTokenOverrides` is purely additive, a removed override key would strand on `APP_ROOT`. Task 10 makes `previewThemeTokens` clear-then-apply (`clearTokenOverrides(APP_ROOT, new Set(keys))` then apply). C6 has no per-token edits yet (Tokens tab is a placeholder), so this is forward-insurance for C1; still, A9 + the unit merge test guard it.
- **§RISK-4 — `useElementSize` initial-0 flash.** `panelWidth.value > 0` guard defaults to `horizontal` until first measure → no horizontal→vertical→horizontal flash. In a popped-out narrow Studio, `useElementSize` observes the panel element in its own (child) realm — correct; the breakpoint is per-window (a narrow pop-out stacks, a wide one splits). Verify the pop-out case manually if Playwright can't drive a second window.
- **§RISK-5 — Tab-body scroll vs Splitter `*:min-h-0`.** The Volt Splitter PT already sets `*:min-h-0` on panes; combined with `panels-class="flex min-h-0 flex-1 flex-col"` (Task 2) and the body's `flex-1 overflow-y-auto`, the body bounds-scrolls. A10 is the dedicated guard — if it fails, the `panelsClass` thread (Task 2) is the first place to check.

---

## Open questions (for the PR description; answers locked by the integration sections)

These are answered by the binding INTEGRATION decisions and are restated here only so the maintainer can confirm in-PR:

1. **IA-first vs IA-last ordering** — **LOCKED: C6 ships the IA shell first** with placeholders, inverting the spec's "C6 last" (integration phase-sequencing §3, SO-4). C1/C2/C4/C5 each fill one tab body. (Single biggest planning decision; confirm in PR.)
2. **Placeholder tabs** — **LOCKED: navigable stubs, not disabled** (integration open-decision D6 / SO-4). They communicate the roadmap and are fully verifiable.
3. **Responsive breakpoint** — **560px, controls-above-preview**, a tunable design constant subject to Stage-2 review.
4. **Cross-link Track B** — **docs-only**; dockview owns its tab DOM (integration SO-4/Q4).
5. **`saveError` placement** — stays in the Generate tab body (where the inputs that produce it live); hides when another tab is active, re-shows on return. The footer Save button also surfaces failure. Revisit (footer toast) in a later phase if missed.
6. **`scrollbar` visibility on the L1 strip** — hidden (chevrons/wheel/drag), matching the compact Studio chrome (`<Tabs scrollable>` default).
7. **`overrides` seam ownership** — **LOCKED: C6 introduces it** (integration phase-sequencing §4); C1/C2/C5 consume `a.overrides`/`setOverride`/`clearOverride` and the single merged-push rule rather than re-declaring it.

---

### Key file paths (absolute)

- `D:\Work\UraanAI\Public\CommandVue\src\components\panels\ThemeStudioPanel.vue` — main edit
- `D:\Work\UraanAI\Public\CommandVue\src\components\panels\theme-studio\StudioTabPlaceholder.vue` — NEW
- `D:\Work\UraanAI\Public\CommandVue\src\components\panels\theme-studio\studioTabs.ts` — NEW
- `D:\Work\UraanAI\Public\CommandVue\src\components\ui\Tabs.vue` — `panelsClass` prop + `export Tab` (sanctioned additive edit)
- `D:\Work\UraanAI\Public\CommandVue\src\assets\styles\tokens.css` — `[data-density="comfortable"]` block (sanctioned, no new token name)
- `D:\Work\UraanAI\Public\CommandVue\src\composables\useThemeAuthoring.ts` — `overrides` seam
- `D:\Work\UraanAI\Public\CommandVue\src\stores\theme.ts` — `previewThemeTokens` clear-then-apply
- `D:\Work\UraanAI\Public\CommandVue\src\volt\Splitter.vue` — consumed via `:layout` fallthrough, NOT modified (`p-vertical:flex-col` PT at line 33)
- `D:\Work\UraanAI\Public\CommandVue\src\assets\styles\main.css` — `.tab-scroll-*` CSS, consumed, NOT modified
- `D:\Work\UraanAI\Public\CommandVue\tests\setup.ts` — `ResizeObserver` stub
- `D:\Work\UraanAI\Public\CommandVue\tests\unit\components\panels\studioTabs.spec.ts` — NEW
- `D:\Work\UraanAI\Public\CommandVue\tests\unit\components\panels\themeStudioTabs.spec.ts` — NEW
- `D:\Work\UraanAI\Public\CommandVue\tests\unit\composables\useThemeAuthoring.spec.ts` — extend
- `D:\Work\UraanAI\Public\CommandVue\docs\theming.md` + `docs\contributing-ui.md` — doc edits

**Net: 5 production files changed (panel, Tabs.vue, tokens.css, useThemeAuthoring.ts, theme.ts), 2 production files added, 1 test-setup change, 2 test files added (+1 extended), 2 doc files edited. Zero data-model / token-family / engine / persistence change. No `THEME_SCHEMA_VERSION` / `ENGINE_VERSION` / `DB_VERSION` bump. The token doc-sync (the 6-file rule) does NOT fire (no new token family).**
