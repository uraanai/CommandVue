# Track A — Phase C4: Panels & Dockview Chrome — Appearance Variants + `panel-appearance` Preset

> **Status:** execution-ready · **Branch:** `feat/c4-panel-appearance` off `develop` · **PR → `develop`**
> **Wave:** 4 (last) per the canonical sequencing — depends on **C6** (Studio tab shell + `overrides` seam) and **C5** (owns `--shadow-1..5` + `--dockpanel-glass-blur`). C1 (token manifest) is a hard predecessor for the Studio token-editor region; see Dependencies.
> This plan is binding. Where it conflicts with the original C4 design dossier, **this plan wins** — it folds in every BLOCKER/MAJOR from the gap-hunt and conforms to the four CANONICAL INTEGRATION sections (data-model, sequencing, open-decisions, test/CI strategy). A fresh engineer with zero prior context can execute it top-to-bottom.

---

## Goal

Make the dockview panel **chrome** — the per-group border, corner radius, drop-shadow, gap, and tab-strip styling — **theme-controlled** via a new family of themeable component tokens, and let the maintainer assign **per-panel, per-workspace** appearance variants (`flat` / `bordered` / `raised` / `glass`) through the **existing Preset system** (no new assignment machinery). The theme defines _what each variant looks like_; a `panel-appearance` preset defines _which panel gets which variant_.

## Architecture

- **Two-layer model.** Layer 1: a closed set of four CSS variant rule-blocks in `dockview.css`, keyed by a `data-cv-appearance` **attribute** on the dock group element (NOT a class — see Decision §0). Every value in those blocks reads a theme token (`--dockpanel-*`), so a theme recolors all four variants at once. Layer 2: a built-in `panel-appearance` preset whose `applyToPanel`/`removeFromPanel` set/clear that attribute on `group.element`, reached via the **session store's existing `getDockviewApi()`** (no second module global).
- **DOM reach.** `getDockviewApi()?.getPanel(panelId)?.api.group.element` resolves to the `.dv-groupview` node in whatever document the panel lives in (docked or popped-out). This is the exact element `session.ts` already mutates with `style.setProperty("--cv-float-alpha", …)` (session.ts:180/519/762). It works for **every** panel type with **zero panel-component edits** and sidesteps the panel-instance registry gap (ChartPanel et al. don't register a handle).
- **On-load apply is a first-class mechanism**, not a fallback. A `DockLayout.vue onReady` sweep re-applies every persisted `panel-appearance` preset after `loadLayout`, because 9 of 10 built-in panels are not audited to run the per-panel `watch(appliedPresetIds)` re-apply.
- **Tokens cascade from existing primitives.** Defaults are `var()` chains off `--radius-md` / `--color-border-default` / `--shadow-bevel-raised` / `--space-1` / `--density-font-size` / `--font-weight-medium` / `--color-interactive`, so dark mode and theme recolor carry with no dark-override block.
- **Chrome geometry is emitted unconditionally** by `generateTheme` as `var()`-chain literals equal to their `tokens.css` defaults (additive, byte-identical, no `ENGINE_VERSION` bump). The user customizes chrome only via sparse `overrides`.
- **`--dockpanel-glass-blur` is owned by C5**, NOT C4. C4 consumes it as `var(--dockpanel-glass-blur, 8px)` so it is order-independent; if C4 lands before C5 the 8px fallback renders.

## Tech / dependencies

- Vue 3 + Vite + TS (strict); PrimeVue 4 unstyled + Volt + Tailwind v4; Dockview-vue 6; Pinia; idb; culori (OKLCH).
- Preset runtime: `presetTypeRegistry`, `usePresetStore`, `usePanelStateStore`, `panelStateRepo.applyPreset/removePreset` — all shipped.
- Live-preview engine: `themeStore.previewThemeTokens`, `useThemeAuthoring.overrides` (the canonical sparse-override seam **introduced by C6**), `usePopoutThemeSync` — shipped after C6.
- Token-manifest editor primitives (C1) for the Panels & Chrome tab's token-editor region.
- **No new persisted input field.** `GenerationInputV2` / `Theme` / `PortableTheme` are unchanged (canonical data-model §2.4). `THEME_SCHEMA_VERSION` stays `2`, `ENGINE_VERSION` stays `1`, `DB_VERSION` stays `3`.

---

## §0 — Decisions locked before any code (resolve gap-hunt BLOCKERs)

These are binding answers; do not re-litigate during execution.

1. **DOM hook is `data-cv-appearance` attribute, not a `.dv-appearance-*` class.** The bare `.dv-groupview` class is not a documented-stable dockview 6 public surface; `dockview.css` only ever references `.dv-groupview-floating`. Mirror the proven session.ts pattern: set `group.element.setAttribute("data-cv-appearance", variant)` and select `.dockview-theme-commandvue .dv-groupview[data-cv-appearance="raised"]`. `removeFromPanel` removes the attribute. (T9 pre-flight still probes `group.element.className`/structure via Context7 + Playwright to confirm `group.element` is the `.dv-groupview` root before finalizing the descendant selector.)

2. **On-load sweep is the primary apply path** (not a mitigation). Wire it in `DockLayout.vue onReady` after `loadLayout` (T8). Do not rely on per-panel watches.

3. **Glass frosts the frame only.** `.dv-groupview[data-cv-appearance="glass"]` sets `background-color` + `backdrop-filter` on the group element. It MUST NOT re-zero `--color-surface-*` on grid groups (that collides with the float-transparency invariant I8 and renders panel content transparent over an opaque sibling/app-bg void). Surface-token zeroing stays exclusive to `.dv-groupview-floating`. On a floating group, glass adds no extra surface zeroing (idempotent) and the header readability floor is preserved by `backdrop-filter: none` on the floating group's `.dv-tabs-and-actions-container`.

4. **DockviewApi handle: reuse `useSessionStore().getDockviewApi()`** from `panelAppearance.ts`. Do NOT add a second `dockApi.ts` module global with an independent lifecycle (desync risk on teardown). The preset module reads a plain store getter; this is consistent with `instances.ts`'s own non-serializable-handle precedent. (The earlier dossier's `dockApi.ts` is **dropped**.)

5. **`--dockpanel-glass-blur` owned by C5; C4 consumes with fallback.** C4 declares zero blur token. C4's glass rule uses `blur(var(--dockpanel-glass-blur, 8px))`.

6. **`--shadow-1..5` owned by C5; C4 `raised` consumes `var(--shadow-bevel-raised)` today.** C4 does NOT consume `--shadow-1..5` directly (avoids a hard consumer-before-producer edge in the same PR). `--dockpanel-shadow` defaults to `var(--shadow-bevel-raised)` (shipped, A1c). If C5 later wants the chrome shadow on its ramp, C5 re-points `--dockpanel-shadow` → `var(--shadow-4)` in C5's PR. **This removes the C5 hard-edge for C4's own merge.**

7. **`--dockpanel-tab-active-indicator` SHIPS with a real CSS consumer** (an active-tab indicator rule) in the same PR (T13, Q6). If the dockview-6 active-tab selector cannot be confirmed via the T9 Context7/Playwright probe, the token is **dropped from all six doc-sync files** (including its `tokenManifest.ts` row) in the same PR (7 tokens instead of 8). No "decide later."

8. **`applicableTo` is derived, not frozen.** Export `ALL_BUILTIN_PANEL_TYPE_IDS` from `src/modules/panels/builtin.ts` (`= BUILTIN_PANELS.map(p => p.id)`), and set `PANEL_APPEARANCE_APPLICABLE_TO = ALL_BUILTIN_PANEL_TYPE_IDS`. A registry spec asserts equality with the registered panel-type id set so the two can't drift.

9. **No new `GenerationInputV2.chrome` field.** Chrome geometry is `overrides`-only (canonical §2.4).

10. **`ui/Select` API is `:options="[{label,value}]"` + `:model-value` + `@update:model-value`** — NOT PrimeVue `option-label`/`option-value` props (verified against `src/components/ui/Select.vue`). The preset editor copies the existing editors' usage.

---

## File Structure

### New files

| Path                                                             | Responsibility (one line)                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/presets/panelAppearance.ts`                         | The `panel-appearance` preset type: variant constants, config type, `data-cv-appearance` attribute set/clear via session `getDockviewApi`, `applicableTo` derived from builtin ids, `PANEL_APPEARANCE_PRESET` definition. |
| `src/components/presets/editors/PanelAppearancePresetEditor.vue` | Lazy `editComponent` for the preset — a `ui/Select` of the four variants + a `glass` perf note.                                                                                                                           |
| `src/components/panels/theme-studio/PanelsChromeTab.vue`         | The "Panels & Chrome" Studio tab body: (a) chrome token-editor region over `tokenManifest` filtered to `section: "Panels & Chrome"`, (b) per-panel variant assignment region.                                             |
| `tests/unit/presets/panelAppearance.spec.ts`                     | Unit tests for attribute set/swap/clear, no-op paths, fallback-to-flat, against a mocked session `getDockviewApi` + real jsdom element.                                                                                   |

### Modified files

| Path                                         | Precise change                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/assets/styles/tokens.css`               | Add 7 `--dockpanel-*` chrome defaults in a new Layer-3 `:root` sub-block after line 519 (`--dockpanel-padding`). No blur token (C5). No dark block (all chains dark-aware).                                                                                                                                                                                                                                                      |
| `src/assets/styles/dockview.css`             | (a) line 24 binding → `var(--dockpanel-tab-font-size)`; (b) four `--dv-panel-*` wiring vars + tab font-weight binding inside `.dockview-theme-commandvue`; (c) four `[data-cv-appearance="…"]` rule blocks; (d) `@supports` glass guard + glass surface frost (frame-only); (e) `@media (forced-colors: active)` reset for raised+glass; (f) floating-group glass header `backdrop-filter: none`; (g) active-tab indicator rule. |
| `src/modules/themes/generate.ts`             | Insert 7-key unconditional additive emission block before the `if (input.fontFamily)` block (line 467).                                                                                                                                                                                                                                                                                                                          |
| `src/modules/themes/knownTokens.ts`          | Append 7 names to `COMPONENT_TOKEN_NAMES` (after `--dockpanel-padding`, line 128).                                                                                                                                                                                                                                                                                                                                               |
| `docs/theme-schema-for-llms.md`              | Add a "Panel chrome (optional)" bullet block after the "Depth & accent" block (ends line 122), before "Typography (optional)" (line 124).                                                                                                                                                                                                                                                                                        |
| `src/modules/presets/builtin.ts`             | Import `PANEL_APPEARANCE_PRESET`; add to `BUILTIN_PRESET_TYPES`.                                                                                                                                                                                                                                                                                                                                                                 |
| `src/modules/panels/builtin.ts`              | Export `ALL_BUILTIN_PANEL_TYPE_IDS` (derived from `BUILTIN_PANELS.map(p => p.id)`).                                                                                                                                                                                                                                                                                                                                              |
| `src/components/layout/DockLayout.vue`       | In `onReady`, after `loadLayout`, run the one-time `panel-appearance` sweep (rAF + element-exists guard).                                                                                                                                                                                                                                                                                                                        |
| `src/components/panels/ThemeStudioPanel.vue` | Add the `panels` tab id + body branch in the single `<Tabs>` default slot (the shell + `STUDIO_L1_TABS` are C6's; C4 only fills the `panels` branch).                                                                                                                                                                                                                                                                            |
| `src/modules/themes/tokenManifest.ts`        | Append 7 manifest entries with `section: "Panels & Chrome"` (C1's file).                                                                                                                                                                                                                                                                                                                                                         |
| `tests/unit/themes/generate.spec.ts`         | Add a dedicated with-chrome assertion (7 keys present + exact values). Do NOT widen the global minimal-input count bound.                                                                                                                                                                                                                                                                                                        |
| `tests/unit/presets/registry.spec.ts`        | Assert `panel-appearance` registered + `applicableTo` equals the registered panel-type id set + `listFor("chart")`/`listFor("theme-studio")` include it.                                                                                                                                                                                                                                                                         |
| `tests/unit/themes/tokenManifest.spec.ts`    | (C1's guard auto-covers via set-equality; no manual edit beyond keeping it green.)                                                                                                                                                                                                                                                                                                                                               |
| `dictionaries/tech.txt`                      | Add `dockpanel`, `backdrop` if CSpell flags them.                                                                                                                                                                                                                                                                                                                                                                                |

### Untouched (explicitly)

`migrate.ts`, `resolve.ts`, `apply.ts`, `portableSchema.ts`, `import.ts`, `export.ts`, `themeRepo.ts`, `instances.ts`, `db.ts`, `preset.ts` store, `panelState.ts` store, `types/theme.ts`, `types/preset.ts`, any panel component. No `dockApi.ts` (dropped per §0.4).

---

## Tasks (ordered, bite-sized)

> Branch first: `git checkout develop && git pull origin develop && git checkout -b feat/c4-panel-appearance`.
> **Pre-flight (Context7, mandatory before T9 + T13):** `resolve-library-id "dockview"` → `query-docs` for dockview-vue 6.x: the group root element/class, `panel.api.group.element` accessor, and the active-tab DOM class. Confirm `group.element` is the `.dv-groupview` root and pin the active-tab selector before writing CSS/preset reach code.

### T0 — IA gate (C6 shell present?)

**Files:** none (inspection). Confirm `src/components/panels/ThemeStudioPanel.vue` already imports `<Tabs>` and `STUDIO_L1_TABS` from `src/components/panels/theme-studio/studioTabs.ts` with a `panels` tab id, and that `useThemeAuthoring` exports the `overrides` seam (`overrides`, `setOverride`, `clearOverride`). C4 is Wave 4 — these MUST exist.

**Acceptance:** `STUDIO_L1_TABS` contains `{ id: "panels", label: "Panels & Chrome" }` at order 4; `a.overrides` is a `Ref<Record<string,string>>`. If absent, STOP and escalate — C6 has not landed; C4 cannot proceed (no throwaway shell, per canonical sequencing §5).

### T1 — Tokens: `tokens.css` chrome defaults

**File:** `src/assets/styles/tokens.css`. Insert after line 519 (`--dockpanel-padding: var(--space-panel-padding);`), inside the same Layer-3 `:root` block:

```css
/* DockPanel chrome (Track A C4) — the geometry + depth + tab styling of a
     dock group's frame, surfaced as themeable tokens so a THEME controls what
     "bordered" / "raised" / "glass" look like. Pure var() chains off existing
     semantic + primitive tokens so dark mode + theme recolor carry with no dark
     override block. The glass blur radius is owned by C5 (--dockpanel-glass-blur);
     C4's glass rule consumes it as var(--dockpanel-glass-blur, 8px). */
--dockpanel-radius: var(--radius-md);
--dockpanel-border-width: 1px;
--dockpanel-shadow: var(--shadow-bevel-raised);
--dockpanel-gap: var(--space-1);
--dockpanel-tab-font-size: var(--density-font-size);
--dockpanel-tab-font-weight: var(--font-weight-medium);
--dockpanel-tab-active-indicator: var(--color-interactive);
```

> `--dockpanel-shadow` → `var(--shadow-bevel-raised)` is a **shadow** (foreground-class, A1c), so it survives the float surface-zero (invariant I8). Never default it to a surface token. `--dockpanel-border-width: 1px` is a fixed literal (geometry, not derived).

**Acceptance:** `pnpm build` succeeds; app renders unchanged (defaults equal prior implicit chrome); in devtools `getComputedStyle(document.documentElement).getPropertyValue("--dockpanel-radius")` resolves to the `--radius-md` value.

### T2 — Allowlist: `knownTokens.ts`

**File:** `src/modules/themes/knownTokens.ts`. Append to `COMPONENT_TOKEN_NAMES` after `--dockpanel-padding` (line 128):

```ts
  // DockPanel chrome (Track A C4) — themeable geometry + depth + tab styling.
  // The --dv-panel-* wiring vars in dockview.css are intentionally NOT here
  // (internal, like --cv-float-*); the --dockpanel-glass-blur token is owned by
  // C5, not declared here. Only these --dockpanel-* surface tokens are overridable.
  "--dockpanel-radius",
  "--dockpanel-border-width",
  "--dockpanel-shadow",
  "--dockpanel-gap",
  "--dockpanel-tab-font-size",
  "--dockpanel-tab-font-weight",
  "--dockpanel-tab-active-indicator",
```

`ALL_KNOWN_TOKEN_NAMES` / `KnownTokenName` widen automatically (spread). Do NOT add `--dv-panel-*`, `--cv-float-tint/-alpha`, `data-cv-appearance`, or `--dockpanel-glass-blur`.

**Acceptance:** `isKnownToken("--dockpanel-radius") === true` for all 7; `pnpm type-check` green.

### T3 — Engine emission: `generate.ts`

**File:** `src/modules/themes/generate.ts`. Insert immediately **before** the `if (input.fontFamily) {` block (line 467), after the main `tokens` literal closes (line 465 `};`):

```ts
// --- Panel-chrome geometry + depth + tab styling (Track A C4). Emitted
// UNCONDITIONALLY as var() references / fixed literals equal to the tokens.css
// defaults, so a generated theme is self-describing AND byte-identical to the
// cascade default (additive keys, no ENGINE_VERSION bump). A theme customizes
// chrome by editing these via sparse overrides (Panels & Chrome / Tokens tab).
// The glass blur radius (--dockpanel-glass-blur) is owned + emitted by C5. ----
tokens["--dockpanel-radius"] = "var(--radius-md)";
tokens["--dockpanel-border-width"] = "1px";
tokens["--dockpanel-shadow"] = "var(--shadow-bevel-raised)";
tokens["--dockpanel-gap"] = "var(--space-1)";
tokens["--dockpanel-tab-font-size"] = "var(--density-font-size)";
tokens["--dockpanel-tab-font-weight"] = "var(--font-weight-medium)";
tokens["--dockpanel-tab-active-indicator"] = "var(--color-interactive)";
```

> Emit `var()` chains, not resolved literals: (1) preserves live recolor (a later accent change re-tints `--dockpanel-tab-active-indicator`); (2) guarantees byte-identity with the `tokens.css` default so engine-stability passes. Matches the `--color-focus-ring: "var(--color-interactive)"` precedent (generate.ts:~423).

**Acceptance:** `generateTheme(validInput).tokens` contains all 7 keys with the exact documented values.

### T4 — Generate spec: with-chrome assertion (tight bound)

**File:** `tests/unit/themes/generate.spec.ts`. Do **NOT** widen the existing minimal-input count bound (canonical test strategy: minimal-input fixture sets no optional field and keeps its exact band; chrome keys are emitted unconditionally so they are part of the baseline — confirm the baseline count moves by +7 and update the **exact** minimal-input expectation to the new number, e.g. `73 → 80`, keeping it tight; do not pad to `≤95`). Add explicit value assertions:

```ts
expect(tokens["--dockpanel-radius"]).toBe("var(--radius-md)");
expect(tokens["--dockpanel-border-width"]).toBe("1px");
expect(tokens["--dockpanel-shadow"]).toBe("var(--shadow-bevel-raised)");
expect(tokens["--dockpanel-gap"]).toBe("var(--space-1)");
expect(tokens["--dockpanel-tab-font-size"]).toBe("var(--density-font-size)");
expect(tokens["--dockpanel-tab-font-weight"]).toBe("var(--font-weight-medium)");
expect(tokens["--dockpanel-tab-active-indicator"]).toBe("var(--color-interactive)");
```

Confirm the existing "emits only known tokens" assertion (generate.spec.ts:~86-90) stays green (it auto-covers the 7 via T2).

**Acceptance:** `pnpm test generate` green; the minimal-input count expectation reflects the new exact baseline.

### T5 — LLM doc: `theme-schema-for-llms.md`

**File:** `docs/theme-schema-for-llms.md`. Insert after the "Depth & accent" block (ends line 122), before "**Typography (optional):**" (line 124):

```md
**Panel chrome (optional — the dock group frame; all default to chains off the
radius / border / shadow / density tokens, so most themes omit them):** the
geometry `--dockpanel-radius`, `--dockpanel-border-width`, `--dockpanel-gap`; the
depth `--dockpanel-shadow`; the tab strip `--dockpanel-tab-font-size`,
`--dockpanel-tab-font-weight`, `--dockpanel-tab-active-indicator`. The four
appearance variants (flat / bordered / raised / glass) read these tokens; a
`panel-appearance` preset picks which panel uses which variant.
```

> The guard (`theme-schema-for-llms.spec.ts`) checks doc→allowlist: every `--token` mentioned must be in `knownTokens.ts` (satisfied by T2 in the same PR). The example envelope stays `schemaVersion: 1`; do NOT add new tokens to the example. No spec edit required.

**Acceptance:** `pnpm test theme-schema-for-llms` green (balanced fences, all mentioned tokens known).

### T6 — CSpell dictionary (if flagged)

**File:** `dictionaries/tech.txt`. Add `dockpanel`, `backdrop` only if `pnpm spell` flags them. (`bordered`/`raised`/`glass`/`flat` are dictionary words.)

**Acceptance:** `pnpm spell` green.

### T7 — Export `ALL_BUILTIN_PANEL_TYPE_IDS`

**File:** `src/modules/panels/builtin.ts`. After the `BUILTIN_PANELS` array (the list registering `cesium, maplibre, entities, chart, telemetry, markdown, symbology, components-browser, showcase, theme-studio`), export:

```ts
/** Every built-in panel-type id. Single source for preset `applicableTo`
 *  contracts so they can't drift from the registered set. */
export const ALL_BUILTIN_PANEL_TYPE_IDS = BUILTIN_PANELS.map((p) => p.id) as readonly PanelType[];
```

(Import `PanelType` from `@/types/workspace` if not already imported.)

**Acceptance:** `pnpm type-check` green; `ALL_BUILTIN_PANEL_TYPE_IDS.length === 10`.

### T8 — DockLayout on-load sweep (primary apply path)

**File:** `src/components/layout/DockLayout.vue`. In `onReady`, **after** `await session.loadLayout(target)`, add a one-time sweep. Use the panel-state store's `listForLayout()` (already used by session.ts:147) and the preset registry; defer to `requestAnimationFrame` so dockview has rendered groups, with a one-retry guard if the group element isn't resolvable yet.

```ts
import { presetTypeRegistry } from "@/modules/presets/registry";
import { usePanelStateStore } from "@/stores/panelState";
// ...
const panelStateStore = usePanelStateStore();

function sweepPanelAppearance(attempt = 0): void {
  const def = presetTypeRegistry.get("panel-appearance");
  if (!def) return;
  let allResolved = true;
  for (const ps of panelStateStore.listForLayout()) {
    const ids = ps.appliedPresetIds ?? [];
    for (const presetId of ids) {
      const preset = usePresetStore().getById(presetId);
      if (preset?.typeId !== "panel-appearance") continue;
      const el = session.getDockviewApi()?.getPanel(ps.panelId)?.api.group.element;
      if (!el) {
        allResolved = false;
        continue;
      }
      void def.applyToPanel(ps.panelId, preset.config);
    }
  }
  // dockview may not have laid out every group on the first frame — retry once.
  if (!allResolved && attempt < 1) requestAnimationFrame(() => sweepPanelAppearance(attempt + 1));
}
// inside onReady, after loadLayout:
requestAnimationFrame(() => sweepPanelAppearance());
```

> Verify the exact `usePresetStore` lookup name (`getById` / `presets` map / `applied config` source) against the store before finalizing — the goal is to resolve each applied `panel-appearance` preset's `config.variant`. If the panel-state stores the resolved config inline, read it from there instead of the preset store.

**Acceptance:** load a saved layout that has a `panel-appearance` preset on a `chart` panel (which does not register a panel-instance) → the group element gains `data-cv-appearance` without the panel running any watch.

### T9 — Preset module: `panelAppearance.ts`

**File (new):** `src/modules/presets/panelAppearance.ts`. (Run the Context7 pre-flight first; confirm `panel.api.group.element` and that `group.element` is the `.dv-groupview` root.)

```ts
import type { PresetTypeDefinition } from "./types";
import type { Ulid } from "@/types/workspace";

import { ALL_BUILTIN_PANEL_TYPE_IDS } from "@/modules/panels/builtin";
import { useSessionStore } from "@/stores/session";

/** The closed set of panel appearance variants. */
export const PANEL_APPEARANCE_VARIANTS = ["flat", "bordered", "raised", "glass"] as const;
export type PanelAppearanceVariant = (typeof PANEL_APPEARANCE_VARIANTS)[number];

export interface PanelAppearanceConfig extends Record<string, unknown> {
  variant: PanelAppearanceVariant;
}

/** Panel types this preset applies to — derived, never frozen, so it can't drift
 *  from the registered set (registry spec asserts equality). */
export const PANEL_APPEARANCE_APPLICABLE_TO = ALL_BUILTIN_PANEL_TYPE_IDS;

const APPEARANCE_ATTR = "data-cv-appearance";

/** Resolve a panel's dock GROUP element via the session store's bound DockviewApi.
 *  Works in whatever document the panel currently lives (docked or popped-out). */
function groupElementFor(panelId: Ulid): HTMLElement | undefined {
  const api = useSessionStore().getDockviewApi();
  if (!api) return undefined;
  // dockview-vue 6: `panel.api.group.element` is the .dv-groupview node
  // (same element session.ts mutates for --cv-float-alpha).
  return api.getPanel(panelId)?.api.group.element ?? undefined;
}

export function applyAppearance(panelId: Ulid, config: PanelAppearanceConfig): void {
  const el = groupElementFor(panelId);
  if (!el) return; // panel not mounted / group not resolvable → silent no-op
  const variant = PANEL_APPEARANCE_VARIANTS.includes(config.variant) ? config.variant : "flat";
  el.setAttribute(APPEARANCE_ATTR, variant);
}

export function removeAppearance(panelId: Ulid): void {
  groupElementFor(panelId)?.removeAttribute(APPEARANCE_ATTR);
}

export const PANEL_APPEARANCE_PRESET: PresetTypeDefinition<PanelAppearanceConfig> = {
  id: "panel-appearance",
  title: "Panel Appearance",
  description: "Set a panel's frame style — flat, bordered, raised, or glass.",
  icon: "square", // Lucide chrome icon (panel frame). Alt: "layers" / "frame".
  applicableTo: PANEL_APPEARANCE_APPLICABLE_TO,
  defaultConfig: { variant: "flat" },
  editComponent: () => import("@/components/presets/editors/PanelAppearancePresetEditor.vue"),
  applyToPanel: applyAppearance,
  removeFromPanel: removeAppearance,
};
```

> **Why the DockviewApi path, not the panel-instance registry:** the registry holds _domain_ handles (MapLibre `Map`, Cesium `Viewer`); `ChartPanel` and others don't register. Reaching `group.element` through the DockviewApi works for every panel uniformly with **no per-panel code change** and is exactly how `session.ts` already manipulates group elements. The attribute is idempotent + DOM-direct: it only needs the group element to exist in the DOM, which it does the moment the panel mounts.

**Acceptance:** `pnpm type-check` green; `PANEL_APPEARANCE_PRESET.id === "panel-appearance"`; `applicableTo.length === 10`.

### T10 — Register the preset

**File:** `src/modules/presets/builtin.ts`. Import and add to `BUILTIN_PRESET_TYPES`:

```ts
import { PANEL_APPEARANCE_PRESET } from "./panelAppearance";
// ...
export const BUILTIN_PRESET_TYPES = [
  MAP_STYLE_PRESET,
  MAP_OVERLAY_PRESET,
  CHART_THEME_PRESET,
  PANEL_APPEARANCE_PRESET,
] as const;
```

The existing `registerBuiltinPresetTypes` loop + cast handle the new entry unchanged.

**Acceptance:** after `registerBuiltinPresetTypes()`, `presetTypeRegistry.get("panel-appearance")` is defined.

### T11 — Preset editor SFC

**File (new):** `src/components/presets/editors/PanelAppearancePresetEditor.vue`. Mirror `MapStylePresetEditor.vue`'s emit pattern; use `ui/Select`'s actual API (`:options="[{label,value}]"`, `:model-value`, `@update:model-value`).

```vue
<script setup lang="ts">
import type { PanelAppearanceConfig } from "@/modules/presets/panelAppearance";

import Select from "@/components/ui/Select.vue";
import { PANEL_APPEARANCE_VARIANTS } from "@/modules/presets/panelAppearance";

interface Props {
  modelValue: PanelAppearanceConfig;
}
const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: PanelAppearanceConfig] }>();

const VARIANT_OPTIONS = PANEL_APPEARANCE_VARIANTS.map((v) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}));
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Appearance</span>
      <Select
        :model-value="modelValue.variant"
        :options="VARIANT_OPTIONS"
        @update:model-value="
          (v) =>
            emit('update:modelValue', {
              ...props.modelValue,
              variant: v as PanelAppearanceConfig['variant'],
            })
        "
      />
    </label>
    <p v-if="modelValue.variant === 'glass'" class="text-faint text-xs">
      Glass uses a GPU backdrop blur where supported. Over a live map it can cost frames, and it
      does not blur a WebGL canvas inside the same panel. Use sparingly.
    </p>
  </div>
</template>
```

**Acceptance:** mounts; emits `update:modelValue` with `{ variant }`; the perf note shows only for `glass`.

### T12 — dockview.css: wiring vars + tab font-size/weight binding

**File:** `src/assets/styles/dockview.css`. Inside `.dockview-theme-commandvue { … }`: change line 24 and add the wiring vars + font-weight binding:

```css
/* was 0.8125rem — now density-aware via the C4 chrome token */
--dv-tabs-and-actions-container-font-size: var(--dockpanel-tab-font-size);

/* Themeable panel-chrome geometry (Track A C4). These --dv-panel-* names are
     the dockview-scoped wiring; the themeable surface is the --dockpanel-* family
     (in tokens.css + the allowlist). A theme recolors chrome by overriding
     --dockpanel-*, never --dv-panel-* directly. */
--dv-panel-radius: var(--dockpanel-radius);
--dv-panel-border-width: var(--dockpanel-border-width);
--dv-panel-shadow: var(--dockpanel-shadow);
--dv-panel-gap: var(--dockpanel-gap);
```

Apply `--dockpanel-tab-font-weight` to the active tab where dockview exposes it (confirm the tab class via the T9 probe; if no first-class var, set it in the active-tab rule in T13).

**Acceptance:** app renders; dock tab font-size now tracks density (switching density resizes tab text).

### T13 — dockview.css: variant rule blocks + glass + forced-colors + active indicator

**File:** `src/assets/styles/dockview.css`. Append (selectors keyed on the `data-cv-appearance` attribute on `.dv-groupview`; confirm `.dv-groupview` is the group root via the T9 probe):

```css
/* ── Panel appearance variants (Track A C4) ──────────────────────────────────
   A closed set of frame styles. The data-cv-appearance attribute lands on the
   dock GROUP element via the panel-appearance preset (mirrors the proven
   session.ts setProperty pattern, not an undocumented class). Every value reads
   a theme token so the THEME controls what each variant looks like. */

.dockview-theme-commandvue .dv-groupview[data-cv-appearance="flat"] {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.dockview-theme-commandvue .dv-groupview[data-cv-appearance="bordered"] {
  border: var(--dv-panel-border-width) solid var(--color-border-default);
  border-radius: var(--dv-panel-radius);
  box-shadow: none;
}

.dockview-theme-commandvue .dv-groupview[data-cv-appearance="raised"] {
  border: var(--dv-panel-border-width) solid var(--color-border-default);
  border-radius: var(--dv-panel-radius);
  box-shadow: var(--dv-panel-shadow);
}

/* Glass: FRAME-ONLY frost (Decision §0.3 — NEVER re-zero --color-surface-* on a
   grid group; that collides with the float-transparency invariant and renders
   panel content transparent over an opaque void). Gated behind @supports; the
   solid fallback is the bordered look. Blur radius is owned by C5
   (--dockpanel-glass-blur); consumed here with an 8px fallback. */
.dockview-theme-commandvue .dv-groupview[data-cv-appearance="glass"] {
  border: var(--dv-panel-border-width) solid var(--color-border-default);
  border-radius: var(--dv-panel-radius);
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .dockview-theme-commandvue .dv-groupview[data-cv-appearance="glass"] {
    background-color: color-mix(in oklch, var(--cv-float-tint) 70%, transparent);
    -webkit-backdrop-filter: blur(var(--dockpanel-glass-blur, 8px));
    backdrop-filter: blur(var(--dockpanel-glass-blur, 8px));
  }
}

/* Glass on a FLOATING group: the float block already produces the translucent
   surface; keep the header opaque so the float's 85% readability floor isn't
   undermined by stacked blur. */
.dockview-theme-commandvue
  .dv-groupview-floating[data-cv-appearance="glass"]
  .dv-tabs-and-actions-container {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

/* Active-tab indicator (Track A C4, Q6). Confirm the dockview-6 active-tab class
   via the Context7/Playwright probe before finalizing this selector. */
.dockview-theme-commandvue .dv-tab.dv-active-tab {
  box-shadow: inset 0 -2px 0 0 var(--dockpanel-tab-active-indicator);
  font-weight: var(--dockpanel-tab-font-weight);
}

/* Forced-colors / high-contrast: raised + glass must never be transparent or
   lose their frame. Mirrors the existing float forced-colors block. */
@media (forced-colors: active) {
  .dockview-theme-commandvue .dv-groupview[data-cv-appearance="glass"] {
    background-color: Canvas;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  .dockview-theme-commandvue .dv-groupview[data-cv-appearance="raised"],
  .dockview-theme-commandvue .dv-groupview[data-cv-appearance="glass"] {
    border: 1px solid CanvasText;
  }
}
```

> If the T9 probe cannot confirm a stable active-tab selector, **drop `--dockpanel-tab-active-indicator`** from T1/T2/T3/T5 and the manifest (reduce to 6 tokens) in this same PR (Decision §0.7). `--cv-float-tint` is the existing fixed light/dark-aware float tint (`p-surface-100`/`p-surface-800`); glass reuses it exactly as the float block does.

**Acceptance:** manually adding `data-cv-appearance="raised"` to a `.dv-groupview` in devtools shows border+shadow; `glass` shows `backdrop-filter: blur(...)` in Chromium; `flat` shows no border/shadow.

### T14 — Unit: `panelAppearance.spec.ts`

**File (new):** `tests/unit/presets/panelAppearance.spec.ts`. Mock the session store's `getDockviewApi` (e.g. `vi.mock("@/stores/session", …)` returning a fake `{ getDockviewApi: () => ({ getPanel: () => ({ api: { group: { element } } }) }) }`) with `element = document.createElement("div")`. Always `import { describe, expect, it, vi, beforeEach } from "vitest"` (globals: false).

- `applyAppearance(id, { variant: "raised" })` → `element.getAttribute("data-cv-appearance") === "raised"`.
- swap: apply `glass`, then `raised` → attribute is `"raised"` (single value, no accumulation).
- `removeAppearance(id)` → attribute is `null` (removed).
- no-op when `getDockviewApi()` returns null → no throw, element untouched.
- no-op when `getPanel` returns undefined → no throw.
- invalid variant `applyAppearance(id, { variant: "bogus" as never })` → attribute `"flat"`.
- `PANEL_APPEARANCE_APPLICABLE_TO.length === 10`.

**Acceptance:** `pnpm test panelAppearance` green.

### T15 — Unit: registry spec extension

**File:** `tests/unit/presets/registry.spec.ts`. Use `__unregisterBuiltinPresetTypesForTests()` in `beforeEach`, then `registerBuiltinPresetTypes()`:

- `presetTypeRegistry.get("panel-appearance")` defined.
- `[...PANEL_APPEARANCE_PRESET.applicableTo].sort()` deep-equals `[...ALL_BUILTIN_PANEL_TYPE_IDS].sort()` (drift guard).
- `presetTypeRegistry.listFor("chart")` and `listFor("theme-studio")` include `panel-appearance` (confirm the registry's lookup method name — `listFor` / `presetsForPanel` — and that it does `applicableTo.includes(panelType)`).

**Acceptance:** `pnpm test registry` green.

### T16 — Manifest entries (C1's file)

**File:** `src/modules/themes/tokenManifest.ts`. Append 7 entries with `section: "Panels & Chrome"` (confirm the exact entry shape — `{ section, label, kind, contrastAgainst? }` — against C1's `TokenKind` union):

```ts
"--dockpanel-radius":               { section: "Panels & Chrome", label: "Panel radius",        kind: "length" },
"--dockpanel-border-width":         { section: "Panels & Chrome", label: "Panel border width",  kind: "length" },
"--dockpanel-shadow":               { section: "Panels & Chrome", label: "Panel shadow",        kind: "shadow" },
"--dockpanel-gap":                  { section: "Panels & Chrome", label: "Panel gap",           kind: "length" },
"--dockpanel-tab-font-size":        { section: "Panels & Chrome", label: "Tab font size",       kind: "length" },
"--dockpanel-tab-font-weight":      { section: "Panels & Chrome", label: "Tab font weight",     kind: "number" },
"--dockpanel-tab-active-indicator": { section: "Panels & Chrome", label: "Active tab indicator", kind: "color", contrastAgainst: "--dockpanel-tab-bg" },
```

> C1's set-equality guard (`tokenManifest.spec.ts`) requires every allowlisted token to have a manifest entry — this is the second tripwire alongside the LLM-doc guard. If `--dockpanel-tab-active-indicator` was dropped in T13, drop its manifest row too.

**Acceptance:** `pnpm test tokenManifest` green (set-equality holds).

### T17 — Studio "Panels & Chrome" tab body

**Files:** `src/components/panels/theme-studio/PanelsChromeTab.vue` (new) + `src/components/panels/ThemeStudioPanel.vue` (fill the `panels` branch in the single `<Tabs>` default slot per C6's contract — `v-else-if="activeTab === 'panels'"` renders `<PanelsChromeTab />`).

`PanelsChromeTab.vue` has two regions, both PrimeVue-first (no raw `<select>`/`<input>`):

**Region (a) — chrome token editors.** Reuse C1's manifest-driven per-section editor filtered to `section === "Panels & Chrome"`. Each control writes through the **canonical single-writer path** (canonical test strategy §0.3 / D-WRITER): `a.setOverride(token, value)` (debounced ~150ms via es-toolkit `debounce`, cancelled in `onUnmounted`), then the panel re-pushes the **merged** set `{ ...(a.generationResult.value?.tokens ?? {}), ...a.overrides.value }` via `themeStore.previewThemeTokens(...)`. Per-token reset → `a.clearOverride(token)` + merged re-push. **Do NOT call `themeStore.setPreviewToken` directly** (second-writer race). Control-per-kind: radius/border-width/gap/tab-font-size → `Slider` (Volt); shadow → text `Input`; tab-font-weight → `Select` (400/500/600/700); active-indicator → `ColorSwatchPicker`.

**Region (b) — per-panel variant assignment.** A small form: `Select "Panel"` (open panels from `session.getDockviewApi()?.panels` mapped to `{ label: title, value: panelId }`) × `Select "Variant"` (flat/bordered/raised/glass) × Apply `Button`. On Apply: find-or-create one global `panel-appearance` preset per variant (4 reusable global presets, `workspaceId: null`) via `usePresetStore`, then `usePresetStore().applyToPanel(panelId, presetId)`. A list below shows current assignments (panel → variant) with a Remove (`removeFromPanel` via `usePresetStore().removeFromPanel`). Apply disabled until both selects chosen. Failures surface via `useToast`. Glass option shows the same perf note.

States: empty (no open panels) → region (b) shows "Open a panel to assign an appearance"; region (a) still edits tokens globally. Built-in theme → token edits route to the existing "save as new" guard; assignment is theme-independent and always available.

**Acceptance:** Studio shows the "Panels & Chrome" tab (order 4); moving a chrome slider live-updates dock chrome with "Live across app" on; assigning a variant applies the preset and the target group gains `data-cv-appearance`.

### T18 — Full static gauntlet

Run: `pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build`. Run `pnpm docs:build` if `theme-schema-for-llms.md` is in the VitePress tree.

> `check:single-source` scans only `src/volt/**` + `src/components/ui/**`. The editor SFCs live under `src/components/presets/editors/` and `src/components/panels/theme-studio/` (unscanned), and `dockview.css`/`tokens.css` are unscanned — but keep them token-pure by hand-review (only semantic utilities + `var()`/`color-mix`, no hex/`oklch(` literals). State this in the PR.

**Acceptance:** all green.

### T19 — Stage-1 Playwright verification

Drive A1–A12 (below); save screenshots to `.verification-screenshots/feat/c4-panel-appearance/`. Fix any failure and re-run until green **before** opening the PR. **C4 windowing click-through is mandatory and non-skippable** (dockview-adjacent): click through docked + popped-out states, glass-over-map, and forced-colors.

**Acceptance:** all assertions PASS; console-error count 0.

### T20 — PR

`git push -u origin feat/c4-panel-appearance`; `gh pr create --base develop --title "feat(theming): panel appearance variants + panel-appearance preset (Phase C4)"`. Body: summary, the 6-file doc-sync checklist, the Stage-1 result table (A1–A12 with screenshot paths + console counts + PASS/FAIL), the Stage-2 human checklist with the "scrutinize for C4" callout, and the residual open questions. **Stop and wait for the maintainer to merge.**

---

## Data-model delta

**Zero new persisted fields.** `GenerationInputV2`, `Theme`, `PortableTheme`, `ThemeBase` unchanged (canonical §2.4). `THEME_SCHEMA_VERSION` stays `2`; `ENGINE_VERSION` stays `1` (7 keys emitted unconditionally as `var()`-chain literals equal to `tokens.css` defaults → byte-identical, additive); `DB_VERSION` stays `3`; no migration code. The only persisted artifacts C4 adds are `Preset` records (`typeId: "panel-appearance"`, `config: { variant }`), written via the existing `presetRepo` — governed by existing preset persistence, no C4 change to preset storage. Chrome customization rides the existing `Theme.overrides` sparse map (already validated by `themeRepo` invariants + `portableSchema` via `TokenNameSchema`/`TokenValueSchema`), so a chrome-overriding theme round-trips through export/import precisely because the 7 names are allowlisted in T2.

---

## 6-file doc-sync checklist (one PR)

C4 adds a token family after C1 has shipped, so it is subject to the **6-file** rule — the 5 token-doc-sync files plus the `tokenManifest.ts` manifest row (C1's set-equality drift guard fails without it).

1. `src/assets/styles/tokens.css` — 7 `--dockpanel-*` defaults (T1). ✅
2. `src/modules/themes/knownTokens.ts` — 7 names appended to `COMPONENT_TOKEN_NAMES` (T2). ✅
3. `src/modules/themes/generate.ts` — 7-key unconditional additive emission (T3). ✅
4. `docs/theme-schema-for-llms.md` — "Panel chrome (optional)" block (T5). ✅
5. Guard test `tests/unit/docs/theme-schema-for-llms.spec.ts` — passes mechanically once 2+4 agree (no edit). ✅
6. `src/modules/themes/tokenManifest.ts` — append the 7 `section: "Panels & Chrome"` manifest entries (T16); the **second tripwire** `tokenManifest.spec.ts` set-equality requires them. ✅

(If `--dockpanel-tab-active-indicator` is dropped per §0.7, apply the drop across all six files — including its `tokenManifest.ts` row — in the same PR.)

---

## 2-stage verification

### Stage 0 — probe

Probe `mcp__plugin_playwright_playwright__*`. If absent, `ToolSearch query: "playwright browser"`. If still unavailable, fall back to a manual smoke checklist, state so in the PR, and embed NO Stage-1 results table.

### Stage 1 — Playwright automated assertions (binary)

Screenshots → `.verification-screenshots/feat/c4-panel-appearance/<checkpoint>.png`.

| ID  | Assertion                                                                                                                                                                                                                                         | Checkpoint             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| A1  | Apply `panel-appearance` (bordered) → group `[data-cv-appearance="bordered"]`; computed `border-width > 0`; `border-radius` matches `--dockpanel-radius`.                                                                                         | `bordered-applied.png` |
| A2  | Apply `raised` → attribute `raised`; computed `box-shadow !== "none"`.                                                                                                                                                                            | `raised-applied.png`   |
| A3  | Apply `glass` → attribute `glass`; computed `backdrop-filter` contains `blur(` (Chromium).                                                                                                                                                        | `glass-applied.png`    |
| A4  | Apply `flat` → attribute `flat`; computed `box-shadow === "none"`, `border-width === "0px"`.                                                                                                                                                      | `flat-applied.png`     |
| A5  | Swap `glass`→`raised` → single attribute value `raised`; no leftover.                                                                                                                                                                             | `swap-variant.png`     |
| A6  | Remove preset / `removeFromPanel` → `data-cv-appearance` attribute absent.                                                                                                                                                                        | `removed.png`          |
| A7  | Edit `--dockpanel-radius` in the Panels & Chrome tab (Live across app on) → bordered group's computed `border-radius` changes; reset reverts it (no orphaned inline prop on `APP_ROOT`).                                                          | `live-radius.png`      |
| A8  | Switch density compact→spacious → dock tab strip computed `font-size` changes (via `--dockpanel-tab-font-size: var(--density-font-size)`).                                                                                                        | `density-tabfont.png`  |
| A9  | Pop a panel out, apply `raised` → popped-out group (child window) gains `data-cv-appearance="raised"`; `--dockpanel-*` vars present on child `<html>`.                                                                                            | `popout-raised.png`    |
| A10 | Apply `glass` to a panel over a MapLibre panel → translucent blurred frame; no console errors.                                                                                                                                                    | `glass-over-map.png`   |
| A11 | Emulate `forced-colors: active` (via `browser_run_code_unsafe` → `page.emulateMedia({ forcedColors: 'active' })`; if unavailable, downgrade to a CSS-rule-presence assertion and flag it) → glass group opaque `Canvas`, `backdrop-filter: none`. | `forced-colors.png`    |
| A12 | Console-error count == 0; warning count baseline across A1–A11.                                                                                                                                                                                   | (summary)              |

Plus the standard summary line: console-error count, console-warning count, PASS/FAIL.

### Stage 2 — Human design checklist (3–7 items)

> **Scrutinize for C4:** these variants are theme-driven — verify they read in BOTH light and dark and don't fight the existing float glass; glass legibility over a bright map and the raised-shadow read in dark are the riskiest calls.

1. Do `bordered`/`raised` borders sit flush with the tab strip (no double border vs dockview's own separators)?
2. Is the `raised` shadow subtle enough to read as elevation, not a halo — in light AND dark?
3. Does `glass` stay legible over a bright map (header readability floor preserved on floats)?
4. Is the default radius (`--radius-md`) sensible — corners not clipping panel content?
5. Does the active-tab indicator color have enough contrast against the tab background?
6. Does the Panels & Chrome tab feel consistent with the other Studio tabs (control density, spacing)?
7. Is the glass perf note clear without being alarmist?

---

## Risks

- **R1 — `.dv-groupview` / active-tab selector instability (was a BLOCKER).** Mitigated by the `data-cv-appearance` attribute hook (no class dependency) + the T9 Context7/Playwright probe + the §0.7 drop-path for the active-tab indicator if its selector can't be confirmed. If `group.element` turns out NOT to be the `.dv-groupview` root, fall back to `[data-cv-appearance]` selectors scoped directly to `group.element` (the attribute is on the exact element regardless of its class).
- **R2 — On-load apply for non-watching panels (was a BLOCKER).** The T8 sweep is the primary path; rAF + one-retry covers late group layout. Residual: if a layout pops a panel to a child window _after_ load, the sweep already ran — covered by the per-panel re-apply for watching panels and by re-assignment; document that a popped-out non-watching panel may need a re-apply (acceptable, rare).
- **R3 — Glass double-composite on floats (E5).** Resolved by frame-only frost (§0.3) + opaque float header; idempotent with the float block.
- **R4 — `backdrop-filter` can't blur a WebGL canvas inside the same panel (E6).** Documented in the editor perf note + PR; not a defect. Glass over a _sibling_ map blurs the map.
- **R5 — Count-bound regression.** T4 updates the exact minimal-input baseline by +7 and keeps it tight (no `≤95` padding), so a future scale leak still trips CI.
- **R6 — `usePresetStore` lookup shape assumptions in T8/T17.** Verify the store's applied-preset-config source before finalizing the sweep + assignment code (config may live on the panel-state record rather than the preset record).

---

## Open questions

1. **Glass on grid groups: ship as frame-frost (recommended, §0.3) or no-op on grid (floats only)?** Plan ships frame-frost. Maintainer yes/no (SO-2).
2. **`--dockpanel-tab-active-indicator`: ship with the active-tab rule (recommended) or drop if the dockview-6 active-tab selector can't be confirmed (§0.7)?** Plan ships it pending the T9 probe. Maintainer confirm.
3. **One reusable preset per variant (4 global presets, recommended) vs free-form per-assignment presets?** Plan uses 4 reusable globals; the canonical Apply-Preset dialog still allows custom ones.
4. **Per-group vs per-panel semantics (E4):** the attribute lands on the group, so tabbed siblings share the variant. Plan accepts this with a one-line tooltip "applies to the panel's group." Maintainer confirm.
