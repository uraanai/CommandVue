# Track A — Phase C1: Tokens Tab — the per-token manifest editor

> Status: ready-to-execute. Branch: `feat/c1-tokens-tab` off `develop`. PR → `develop`.
> Engine-stability §3i: **additive only.** No `THEME_SCHEMA_VERSION` bump (stays `2`), no
> `ENGINE_VERSION` bump (stays `1`), no `DB_VERSION` bump (stays `3`), no new design tokens,
> no `knownTokens.ts` edits, **the token doc-sync (the 6-file rule) does NOT fire — no new token family** (asserted below). This phase is pure
> annotation (`tokenManifest.ts`) + a per-token editor UI + consuming the C6-owned override seam.

---

## Goal

Add a **Tokens** tab to the Theme Studio that surfaces every one of the allowlisted tokens
(`ALL_KNOWN_TOKEN_NAMES` — 138 today: SEMANTIC=65, COMPONENT=36, DENSITY=9, THEMEABLE_PRIMITIVE=28)
as a searchable, section-grouped list, with **one control per token kind**,
advisory WCAG chips on color tokens that declare a `contrastAgainst` partner, and an edit path that
writes a **sparse override** into the draft — live-previewed through the shipped apply engine and
persisted through the existing save path. The new `tokenManifest.ts` becomes the single source of
truth for `{section, label, kind, contrastAgainst?}` per token; its set of keys must equal
`ALL_KNOWN_TOKEN_NAMES` exactly (a second drift tripwire alongside the LLM-doc guard).

## Architecture

- **`tokenManifest.ts`** is a pure annotation layer over `knownTokens.ts` (no Vue, no DOM, no IDB).
  It does NOT add token names; it categorizes the existing allowlist into sections + kinds.
- **The override seam is C6-owned, not C1-owned.** Per the canonical integration resolution (master
  plan §B.4/§B.7/§B.10), C6 introduces `overrides: Ref<Record<string,string>>` +
  `setOverride`/`clearOverride`/`clearAllOverrides` on `useThemeAuthoring`, the merged `previewTokens`
  computed, the single merged-push live-apply rule (the C6-owned `watch(a.overrides, pushPreview)`), and
  the 5-tab `<Tabs scrollable>` shell with `StudioTabPlaceholder` bodies. **C1 CONSUMES these**; it does
  not re-declare the ref or invent a second live-apply writer. **C6 is a HARD predecessor of C1** (§B.2):
  Task 0 is a hard gate — if the C6 seam/shell is absent, C1 STOPS and escalates. There is no World-B /
  "introduce a minimal seam + shell" path (the master plan §B.10 item 2 deleted it).
- **The single live-apply writer (D-WRITER, binding):** all Studio token edits flow through one
  merged wholesale push, **owned by C6's `watch(a.overrides, pushPreview)`** —
  `themeStore.previewThemeTokens({ ...generationResult.tokens, ...overrides }, density)`, debounced.
  C1 does NOT re-implement this rule. **`setPreviewToken`/`resetPreviewToken` are NOT used by any Studio
  tab** (they are a second
  writer into `previewDraft` that desyncs on save and on generator re-run, and `resetPreviewToken`'s
  clear-then-reapply flashes the whole token set).
- **Color control is OKLCH-aware (D-C1-COLOR, binding).** `ColorSwatchPicker` requires a non-empty
  `options` grid and its custom path is an sRGB-hex `<input type="color">` — it cannot author the ~70
  arbitrary color tokens, and round-tripping a wide-gamut OKLCH or `color-mix()`/`var()` default
  through it silently corrupts the value. C1 ships a thin **`TokenColorField.vue`** instead.
- **Seeding source is computed values (D-SEED-COMPUTED, binding).** Color controls and WCAG chips seed
  from `getComputedStyle(APP_ROOT).getPropertyValue(name).trim()`, NOT from the sparse `previewTokens`
  map (the generator emits only ~73 of the 138 tokens; the rest resolve to `var()`/`color-mix()` chains
  the map omits or carries unresolved).

## Tech

Vue 3 + Vite + TS(strict); PrimeVue 4 unstyled + Volt + Tailwind v4; Pinia; `idb`; **culori** (OKLCH

- `wcagContrast`); `es-toolkit` (`debounce`); `fuzzysort` (search). Library-first / PrimeVue-first:
  color → `TokenColorField` (built on culori, project token control); length/number → `@/volt/InputNumber.vue`
  (confirmed present) + unit `@/components/ui/Select.vue`; font-stack → `@/components/ui/Select.vue`;
  shadow/free-text → `@/components/ui/Input.vue`. No raw `<input>/<select>/<button>/<textarea>`.

## Dependencies (what must already be merged)

- **Live-preview engine (shipped):** `previewThemeTokens`, `setPreviewToken`, `resetPreviewToken`,
  `cancelPreview`, `endPreview`, `applyTokenOverrides`, `clearTokenOverrides`, `APP_ROOT`,
  `usePopoutThemeSync` — all confirmed in `src/stores/theme.ts`.
- **`useThemeAuthoring`** (confirmed) — owns generation inputs, `generationResult`, `save`/`updateExisting`.
- **`resolve()` / `resolveBaseTokens()`** (confirmed) — `resolve({base, overrides, name}) = base ⊕ overrides`.
- **`Tabs scrollable`** (`src/components/ui/Tabs.vue`, confirmed) — single default panel slot.
- **`TokenValueSchema`** exported from `portableSchema.ts` (confirmed) — value sanitizer.
- **`volt/InputNumber.vue`** exists (confirmed — resolves former Q4).
- **C6 IA shell + override seam** — **HARD predecessor** (master plan §B.2). C1's Tasks 1–3 (manifest +
  spec) can be authored against the four `knownTokens.ts` arrays without C6, but the editor wiring
  (Tasks 7–8) requires C6's `overrides` seam + tab shell. Task 0 is a hard gate: if C6 is absent, STOP
  and escalate.

---

## File Structure

### New

| Path                                                     | Responsibility                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/themes/tokenManifest.ts`                    | The annotation layer: `{section,label,kind,contrastAgainst?}` for every `KnownTokenName`; `TokenKind` union; `TOKEN_SECTIONS` ids + labels; accessors (`getTokenManifestEntry`, `tokenEntriesForSection`, `populatedSections`). |
| `src/components/panels/theme-studio/TokenColorField.vue` | OKLCH-aware single-token color control: swatch button + popover with an OKLCH H/C/L editor and a validated OKLCH/`color-mix`/`var()` text field; seeds from a computed resolved value; emits a culori-normalized string.        |
| `src/components/panels/theme-studio/TokenRow.vue`        | One token row: label + raw `--name` subtitle, the kind-specific control, edited dot + per-row reset, advisory WCAG chip. Presentation only; props/emits.                                                                        |
| `src/components/panels/theme-studio/TokensTabEditor.vue` | The Tokens-tab body: search box, "edited N" chip, "Reset all" button, section-grouped `TokenRow` list. Props/emits only — no store/composable imports.                                                                          |
| `tests/unit/themes/tokenManifest.spec.ts`                | The drift guard (set-equality with `ALL_KNOWN_TOKEN_NAMES`, valid kinds/sections, `contrastAgainst` validity).                                                                                                                  |

### Modified

| Path                                               | Change                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/composables/useThemeAuthoring.ts`             | **C6-owned — C1 does NOT touch this file.** The `overrides` ref + `setOverride`/`clearOverride`/`clearAllOverrides` + `previewTokens` computed + seed/reset/persist/validate wiring all land in C6 (hard predecessor). Listed here only as the consumed seam.    |
| `src/components/panels/ThemeStudioPanel.vue`       | Replace C6's `tokens` placeholder branch with `<TokensTabEditor>`; forward `@set`/`@reset`/`@reset-all` to `a.setOverride`/`a.clearOverride`/`a.clearAllOverrides`. The C6-owned `watch(a.overrides, pushPreview)` handles live apply — C1 adds no apply writer. |
| `tests/unit/composables/useThemeAuthoring.spec.ts` | **C6-owned — C1 does NOT touch this file.** The override-seam unit coverage (CRUD, merge order, seed-from-overrides, persist, preview parity, validation) lands in C6 alongside the seam. Listed here only as the proven-before-consumed contract.               |

### Untouched (asserted by `tokenManifest.spec.ts` set-equality)

`src/assets/styles/tokens.css`, `src/modules/themes/knownTokens.ts`, `src/modules/themes/generate.ts`,
`docs/theme-schema-for-llms.md`, `tests/unit/docs/theme-schema-for-llms.spec.ts`.
**Read-only imports:** `src/modules/themes/resolve.ts` (`resolve`), `src/modules/themes/portableSchema.ts`
(`TokenValueSchema`), `src/stores/theme.ts`, `src/modules/themes/apply.ts`.

---

## Ordered tasks

> Branch first: `git checkout develop && git pull origin develop && git checkout -b feat/c1-tokens-tab`.

### Task 0 — HARD GATE: confirm C6 landed (World A only)

**Files (read-only probe):** `src/composables/useThemeAuthoring.ts`, `src/components/panels/ThemeStudioPanel.vue`,
`src/components/panels/theme-studio/studioTabs.ts`, `src/components/ui/Tabs.vue`.

**Change:** This is a gate, not a fork. C6 is a HARD predecessor (master plan §B.2: `C6 → C1` is a
blocking edge; §B.10 item 2 deleted C1's "introduce a Tabs wrapper" path). Grep `useThemeAuthoring.ts`
for the `overrides` ref + `setOverride`/`clearOverride`/`clearAllOverrides` + `previewTokens` computed,
and `ThemeStudioPanel.vue` for the 5-tab `<Tabs scrollable>` shell driven by `STUDIO_L1_TABS` from
`studioTabs.ts`.

- **If the C6 seam + shell are present (World A) → proceed.** Confirm `STUDIO_L1_TABS` contains
  `{ id: "tokens", label: "Tokens" }` and that the panels container can bound-scroll a tab body (C6's
  `panelsClass`). C1 only fills the `tokens` placeholder and forwards per-token edits to the C6 seam.
- **If the C6 seam or shell is absent → STOP and escalate.** Do NOT implement a minimal seam or a 2-tab
  shell — that path is forbidden by the master plan. Mirror the C2 T0 / C4 T0 hard-gate behavior: report
  that C6 has not landed and wait for it to merge before resuming C1. (Answered by SO-4 / Q-WORLD: the
  intended order is C6 first, then C1.)

**Confirm controls + Tabs slot contract:** `Tabs.vue` exposes ONE default slot rendered for the active
tab (`<slot v-if="tab.id === modelValue" :active="tab.id" />`); there are NO per-tab panel slots. Tab
bodies branch on the panel-local `activeTab` ref via `v-if`. Confirm `volt/InputNumber.vue` resolves and
`ui/Select.vue` / `ui/Input.vue` import paths.

**Acceptance:** A one-paragraph note in the PR body confirms World A (C6 present) and that the gate
passed. `volt/InputNumber.vue`, `ui/Select.vue`, `ui/Input.vue` resolve; the `Tabs` default-slot contract
is written down.

---

### Task 1 — `tokenManifest.ts`: types, sections, accessors (no entries yet)

**File:** `src/modules/themes/tokenManifest.ts` (new).

**Change:** Add the kind union, section ids + labels, the entry interface, and accessors. Do NOT
hand-type the full entry list here — Task 2 generates the list programmatically and hand-annotates.

```ts
import type { KnownTokenName } from "@/modules/themes/knownTokens";
import { ALL_KNOWN_TOKEN_NAMES } from "@/modules/themes/knownTokens";

/** Control-selection category for a token's editor. */
export type TokenKind =
  | "color" // OKLCH/hex/color-mix/var → TokenColorField (custom-any, OKLCH-aware)
  | "length" // rem/px dimension → InputNumber + unit Select (free-text fallback for var() chains)
  | "number" // unitless scalar (font-weight) → InputNumber
  | "font-stack" // CSS font-family list → Select (curated) + free text
  | "shadow" // box-shadow composite → validated text Input
  | "duration"; // reserved; zero entries today (asserted) — forward-compat for a motion phase

/** Canonical Studio section ids. Order here is display order. Later phases
 *  (C2/C4/C5) append their own sections in their PRs; C1 owns these. */
export const TOKEN_SECTIONS = [
  "surface",
  "border",
  "text",
  "interactive",
  "status",
  "focus-and-depth",
  "spacing",
  "radius",
  "typography",
  "accent-scale",
  "surface-scale",
  "component-datatable",
  "component-dockpanel",
  "component-menubar",
  "component-statusbar",
  "component-dialog",
  "component-tooltip",
  "component-button",
  "density",
  "compat-aliases",
] as const;
export type TokenSection = (typeof TOKEN_SECTIONS)[number];

export const TOKEN_SECTION_LABELS: Record<TokenSection, string> = {
  surface: "Surface",
  border: "Border",
  text: "Text",
  interactive: "Interactive",
  status: "Status",
  "focus-and-depth": "Focus & Depth",
  spacing: "Spacing",
  radius: "Radius",
  typography: "Typography",
  "accent-scale": "Accent scale",
  "surface-scale": "Surface scale",
  "component-datatable": "DataTable",
  "component-dockpanel": "Dock panel",
  "component-menubar": "Menu bar",
  "component-statusbar": "Status bar",
  "component-dialog": "Dialog",
  "component-tooltip": "Tooltip",
  "component-button": "Button",
  density: "Density",
  "compat-aliases": "Compatibility aliases",
};

export interface TokenManifestEntry {
  name: KnownTokenName;
  section: TokenSection;
  label: string;
  kind: TokenKind;
  /** For color foregrounds: a color-kind KnownTokenName background to compute an
   *  advisory WCAG ratio against. Never the token itself. */
  contrastAgainst?: KnownTokenName;
}

// TOKEN_MANIFEST_LIST is declared in Task 2.
export declare const TOKEN_MANIFEST_LIST: readonly TokenManifestEntry[];

export const TOKEN_MANIFEST: Readonly<Record<KnownTokenName, TokenManifestEntry>> = Object.freeze(
  Object.fromEntries(TOKEN_MANIFEST_LIST.map((e) => [e.name, e])),
) as Record<KnownTokenName, TokenManifestEntry>;

export function getTokenManifestEntry(name: string): TokenManifestEntry | undefined {
  return (TOKEN_MANIFEST as Record<string, TokenManifestEntry>)[name];
}
export function tokenEntriesForSection(section: TokenSection): readonly TokenManifestEntry[] {
  return TOKEN_MANIFEST_LIST.filter((e) => e.section === section);
}
export function populatedSections(): readonly TokenSection[] {
  return TOKEN_SECTIONS.filter((s) => TOKEN_MANIFEST_LIST.some((e) => e.section === s));
}
```

> Replace the `declare const` placeholder with the real array in Task 2 (single file). The
> `Object.freeze(Object.fromEntries(...))` build means coverage is enforced at runtime by the spec
> (TS cannot prove array completeness against `Record<KnownTokenName,…>`).

**Acceptance:** `pnpm type-check` clean (after Task 2 supplies the list); the union, section list, and
accessors compile.

---

### Task 2 — `tokenManifest.ts`: the entries (generate skeleton, hand-annotate)

**File:** `src/modules/themes/tokenManifest.ts` (same file; add `TOKEN_MANIFEST_LIST`).

**Change:** Author `TOKEN_MANIFEST_LIST` as an explicit literal array, **one entry per
`ALL_KNOWN_TOKEN_NAMES` member, in section order**. Do NOT trust a prose count — the spec's
set-equality test is the guard. To avoid omissions, scaffold from the four real arrays
(`SEMANTIC_TOKEN_NAMES`=65, `COMPONENT_TOKEN_NAMES`=36, `DENSITY_TOKEN_NAMES`=9,
`THEMEABLE_PRIMITIVE_TOKEN_NAMES`=28 → **138** today), then hand-tune `{section,label,kind,contrastAgainst}`.
Re-derive these counts from the live `knownTokens.ts` at execution time rather than trusting this prose —
the set-equality guard (Task 3) is the real contract.

> **Source-array split for `--font-family-*` (do not let the scaffold drop one):** `--font-family-body`
> lives in `SEMANTIC_TOKEN_NAMES`; `--font-family-sans` and `--font-family-mono` live in
> `THEMEABLE_PRIMITIVE_TOKEN_NAMES`. The manifest's `typography` section covers **all three** regardless
> of which array each comes from — a "scaffold from the four arrays" loop must union across arrays, not
> assume one section maps to one array.

**Section → tokens → kind → contrastAgainst (authoritative — every allowlist name appears once):**

- **surface** (color): `--color-surface-base`, `--color-surface-raised`, `--color-surface-overlay`,
  `--color-surface-sunken`, `--color-surface-bevel-light`, `--color-surface-bevel-dark`
- **border** (color): `--color-border-subtle`, `--color-border-default`, `--color-border-strong`,
  `--color-border-accent`
- **text** (color): `--color-text-primary`→`--color-surface-base`, `--color-text-secondary`→`--color-surface-base`,
  `--color-text-tertiary`→`--color-surface-base`, `--color-text-disabled`→`--color-surface-base`,
  `--color-text-inverse`→`--color-interactive`
- **interactive** (color): `--color-interactive`, `--color-interactive-hover`, `--color-interactive-active`,
  `--color-interactive-subtle`, `--color-on-interactive`→`--color-interactive`, `--color-interactive-glow`,
  `--color-interactive-dim`
- **status** (color): `--color-status-success`→`--color-status-success-subtle`, `--color-status-success-subtle`,
  `--color-status-success-border`, `--color-status-warning`→`--color-status-warning-subtle`,
  `--color-status-warning-subtle`, `--color-status-warning-border`,
  `--color-status-danger`→`--color-status-danger-subtle`, `--color-status-danger-subtle`,
  `--color-status-danger-border`, `--color-status-info`→`--color-status-info-subtle`,
  `--color-status-info-subtle`, `--color-status-info-border`, `--color-toast-bg`,
  `--color-toast-fg`→`--color-toast-bg`, `--color-toast-border`, `--color-toast-success-bg`,
  `--color-toast-success-fg`→`--color-toast-success-bg`, `--color-toast-info-bg`,
  `--color-toast-info-fg`→`--color-toast-info-bg`, `--color-toast-warning-bg`,
  `--color-toast-warning-fg`→`--color-toast-warning-bg`, `--color-toast-danger-bg`,
  `--color-toast-danger-fg`→`--color-toast-danger-bg`
- **focus-and-depth**: `--color-focus-ring` (color), `--shadow-focus-ring` (shadow),
  `--shadow-bevel-raised` (shadow), `--shadow-bevel-sunken` (shadow), `--shadow-accent-glow` (shadow)
- **spacing** (length): `--space-panel-padding`, `--space-panel-gap`, `--space-form-gap`,
  `--space-inline-gap`, `--space-section-gap`
- **radius** (length): `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`
- **typography** (font-stack): `--font-family-body`, `--font-family-sans`, `--font-family-mono`
- **accent-scale** (color): `--color-accent-50 … --color-accent-900` (10)
- **surface-scale** (color): `--color-p-surface-0 … --color-p-surface-950` (12)
- **component-datatable**: `--datatable-header-bg` (color), `--datatable-header-fg` (color)→`--datatable-header-bg`,
  `--datatable-row-hover-bg` (color), `--datatable-row-selected-bg` (color), `--datatable-border` (color),
  `--datatable-cell-padding-y` (length), `--datatable-cell-padding-x` (length), `--datatable-row-height` (length),
  `--datatable-font-size` (length)
- **component-dockpanel**: `--dockpanel-bg` (color), `--dockpanel-tab-bg` (color),
  `--dockpanel-tab-active-bg` (color), `--dockpanel-tab-border` (color), `--dockpanel-padding` (length)
- **component-menubar**: `--menubar-bg` (color), `--menubar-fg` (color)→`--menubar-bg`,
  `--menubar-item-hover-bg` (color), `--menubar-height` (length)
- **component-statusbar**: `--statusbar-bg` (color), `--statusbar-fg` (color)→`--statusbar-bg`,
  `--statusbar-border` (color), `--statusbar-height` (length), `--statusbar-font-size` (length)
- **component-dialog**: `--dialog-bg` (color), `--dialog-backdrop` (color), `--dialog-shadow` (shadow),
  `--dialog-border` (color)
- **component-tooltip**: `--tooltip-bg` (color), `--tooltip-text` (color)→`--tooltip-bg`,
  `--tooltip-radius` (length), `--tooltip-font-size` (length)
- **component-button**: `--button-radius` (length), `--button-font-weight` (number),
  `--button-height-sm` (length), `--button-height-md` (length), `--button-height-lg` (length)
- **density** (length, 9): `--density-row-height`, `--density-cell-padding-y`, `--density-cell-padding-x`,
  `--density-control-height`, `--density-icon-size`, `--density-font-size`, `--density-titlebar-height`,
  `--density-statusbar-height`, `--density-panel-header-height`
- **compat-aliases** (color): `--color-surface`, `--color-foreground`→`--color-surface`, `--color-muted`,
  `--color-faint`, `--color-border`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`

> **Labels:** terse + consistent (e.g. `"Surface · raised"`, `"Text · primary"`, `"Status · success"`,
> `"DataTable · header bg"`, `"Density · row height"`). Keep ≤ ~40 chars.

> **Density note (Q1 resolved → DEFAULT allow-with-chip):** density tokens stay in the manifest and ARE
> shown in the editor with an advisory "overrides density attribute" chip on those rows. (If the
> maintainer later picks "hide," the manifest entries remain and `TokensTabEditor` filters them — no
> manifest change.) See Task 6.

**Acceptance:** `pnpm type-check` clean; `new Set(Object.keys(TOKEN_MANIFEST))` equals
`new Set(ALL_KNOWN_TOKEN_NAMES)` (set-equality — no numeric literal); importing `TOKEN_MANIFEST_LIST`
in the Task-3 spec set-equals `ALL_KNOWN_TOKEN_NAMES`.

---

### Task 3 — `tokenManifest.spec.ts`: the drift guard

**File:** `tests/unit/themes/tokenManifest.spec.ts` (new). Vitest, `import { describe, expect, it } from "vitest"`.

**Change — assertions:**

1. **Total coverage (set-equality, NO numeric literal):**
   `expect(new Set(Object.keys(TOKEN_MANIFEST))).toEqual(new Set(ALL_KNOWN_TOKEN_NAMES))`. This catches
   orphan manifest entries AND un-annotated allowlist tokens (the second doc-sync tripwire) and auto-tracks
   any future `knownTokens.ts` growth without a hardcoded count to update.
2. **List/record parity:** `TOKEN_MANIFEST_LIST.length === ALL_KNOWN_TOKEN_NAMES.length` (derived equality,
   not a literal); every list `name` is unique and present in the record.
3. **Valid kinds:** every `kind ∈ TokenKind`; `TOKEN_MANIFEST_LIST.filter(e => e.kind === "duration").length === 0`
   (dormant member can't rot into a silent miscategorization).
4. **Valid sections:** every `section ∈ TOKEN_SECTIONS`; every `TokenSection` has a `TOKEN_SECTION_LABELS` entry.
5. **Section ordering:** `populatedSections()` is a subsequence of `TOKEN_SECTIONS` (same relative order).
6. **`contrastAgainst` validity:** for every entry with `contrastAgainst`: (a) value ∈ `ALL_KNOWN_TOKEN_NAMES`,
   (b) `TOKEN_MANIFEST[value].kind === "color"`, (c) `value !== entry.name`, (d) the entry itself is `kind === "color"`.
7. **Labels:** every `label` is a non-empty trimmed string, ≤ 40 chars.
8. **Density tokens:** all 9 `--density-*` entries are `kind: "length"`, `section: "density"`.
9. **Accessors:** `getTokenManifestEntry("--color-interactive")?.kind === "color"`;
   `getTokenManifestEntry("__nope__") === undefined`; `tokenEntriesForSection("status")` contains
   `--color-toast-bg` and `--color-status-success`.

**Acceptance:** `pnpm test tokenManifest` green; deleting any one entry fails assertion 1 (sanity-check
manually once, then restore).

---

### Task 4 — `useThemeAuthoring.ts`: override seam (C6-owned — NOT a C1 task)

> **C1 does NOT implement this.** The override seam on `useThemeAuthoring` — the `overrides` ref,
> `setOverride`/`clearOverride`/`clearAllOverrides`, the merged `previewTokens` computed, the
> `seedFromTheme`/`reset`/`save`/`updateExisting`/`validate` wiring, and the paired-variant
> `overrides: {}` rule — all land in **C6** (master plan §B.4). C6 is a HARD predecessor (Task 0 gate),
> so by the time C1 runs the seam already exists. C1 only **consumes** the returned surface:
> `overrides`, `setOverride`, `clearOverride`, `clearAllOverrides`, `previewTokens`.

**File:** none. C1 makes no edit to `useThemeAuthoring.ts`.

**Acceptance:** Task 0 confirmed the C6 seam is present and its return surface exposes the five members
C1 consumes. Nothing for C1 to build here.

---

### Task 5 — `TokenColorField.vue`: the OKLCH-aware color control

**File:** `src/components/panels/theme-studio/TokenColorField.vue` (new). Under `panels/` → not scanned
by `check:single-source`, but stay token-pure by hand-review (state in PR).

**Why custom (document in the file header):** `ColorSwatchPicker` requires a non-empty curated `options`
grid and its custom path is an sRGB-hex `<input type="color">` — it cannot author the ~70 arbitrary
color tokens, gamut-clamps wide-gamut OKLCH on every pick, and cannot represent/preserve `color-mix()`
or `var()` defaults. `TokenColorField` accepts no options, seeds from a computed resolved value, and
preserves an unedited value verbatim.

**Props / emits:**

```ts
interface Props {
  /** Computed resolved CSS value for this token (from getComputedStyle(APP_ROOT)). Seeds the control. */
  resolvedValue: string;
  /** True when an override exists for this token (drives the edited affordance upstream). */
  edited: boolean;
  ariaLabel: string;
}
interface Emits {
  (e: "change", value: string): void;
}
```

**Behavior:**

- Swatch button shows `resolvedValue` as `background-color` (the browser renders `var()`/`color-mix()`/
  `oklch()` natively). Clicking opens a cheap absolute popover (no floating-ui — same pattern as
  `ColorSwatchPicker`).
- Popover has two paths: (a) an OKLCH editor — three `@/volt/InputNumber.vue` fields for L (0–1, step 0.01),
  C (0–0.4, step 0.005), H (0–360, step 1), seeded by `culori.converter("oklch")(resolvedValue)` when it
  parses; on commit emit `culori.formatCss({ mode: "oklch", l, c, h })`. (b) an "Advanced" `@/components/ui/Input.vue`
  text field for `color-mix()`/`var()`/alpha values, validated by `TokenValueSchema.safeParse(value).success`
  before emit (red border + tooltip on fail, no emit).
- If `resolvedValue` does not parse as OKLCH (e.g. an unresolved `var()` chain), the OKLCH editor seeds
  to a neutral `oklch(0.7 0 0)` and the Advanced field is pre-focused — the user edits raw.
- Never gamut-clamp through an sRGB hex input. There is no `<input type="color">` in this control.

**Acceptance:** mounts standalone with a stubbed `resolvedValue="oklch(0.55 0.18 250)"`; editing L/C/H emits
a `formatCss`-normalized OKLCH string; pasting `var(--color-blue-500)` into Advanced emits it verbatim;
pasting `<script>` is rejected (no emit). No raw `<input type=color>`.

---

### Task 6 — `TokenRow.vue` + `TokensTabEditor.vue`: the editor body

**Files:** `src/components/panels/theme-studio/TokenRow.vue`, `src/components/panels/theme-studio/TokensTabEditor.vue` (new).

**`TokenRow.vue` props / emits:**

```ts
interface Props {
  entry: TokenManifestEntry; // from tokenManifest
  resolvedValue: string; // getComputedStyle resolved value for entry.name
  resolvedContrastBg?: string; // getComputedStyle resolved value for entry.contrastAgainst
  edited: boolean; // entry.name in overrides
}
interface Emits {
  (e: "set", token: string, value: string): void;
  (e: "reset", token: string): void;
}
```

**`TokenRow.vue` content:** label (`entry.label`) + raw `--name` subtitle (`font-mono text-[10px] text-faint`,
also the row `title`); the kind-specific control; an "edited" dot + a per-row reset `@/components/ui/IconButton.vue`
(Lucide `RotateCcw`) shown only when `edited`; for `kind: "color"` with `contrastAgainst`, the advisory WCAG chip.

**Control per kind:**

- `color` → `TokenColorField` (`:resolved-value="resolvedValue"` `:edited="edited"` `@change="$emit('set', entry.name, $event)"`).
- `length` → `@/volt/InputNumber.vue` + unit `@/components/ui/Select.vue` (`rem`|`px`). Parse `resolvedValue`
  with `/^(-?[\d.]+)\s*(rem|px|em|%)?$/`; emit `` `${num}${unit}` ``. **Fallback (Q2 DEFAULT):** if
  `resolvedValue` is not a plain number+unit (e.g. a `var()` chain), render a free-text `@/components/ui/Input.vue`
  for that row instead, validated by `TokenValueSchema`.
- `number` → `@/volt/InputNumber.vue` (no unit); emit the numeric string.
- `font-stack` → `@/components/ui/Select.vue` seeded from `CURATED_FONTS` (`@/modules/themes/curated-swatches`)
  - a free-text custom value; validate non-empty before emit.
- `shadow` → `@/components/ui/Input.vue` text, validated by `TokenValueSchema.safeParse` (≤500, no injection);
  red border + tooltip + no emit on fail.
- `duration` → not rendered (zero entries).
- **Density rows** (`section === "density"`): render normally + an advisory chip "Overrides density attribute"
  (muted) per Q1 DEFAULT.

**WCAG chip (D-SEED-COMPUTED):** for `color` + `contrastAgainst`, compute
`culori.wcagContrast(resolvedValue, resolvedContrastBg)`. Render a chip: ratio to 1 decimal + verdict
(`≥4.5 AA`, `≥3 AA Large`, else `⚠ low`), muted styling — **advisory, never blocks**. If either value
fails to parse (undefined from `wcagContrast`), hide the chip silently. Restrict computation to entries
where both sides are present/parseable.

**`TokensTabEditor.vue` props / emits:**

```ts
interface Props {
  /** Resolved current values for EVERY manifest token (getComputedStyle(APP_ROOT) snapshot). */
  resolved: Record<string, string>;
  /** Sparse override map (token → value) for "edited" badges + reset state. */
  overrides: Record<string, string>;
}
interface Emits {
  (e: "set", token: string, value: string): void;
  (e: "reset", token: string): void;
  (e: "reset-all"): void;
}
```

**`TokensTabEditor.vue` content:**

- **Top bar:** search `@/components/ui/Input.vue` (`spellcheck="false"`, placeholder "Search tokens…")
  - an "edited N" chip (`Object.keys(overrides).length`) + a "Reset all" `@/components/ui/Button.vue`
    (`size="sm" variant="secondary"`, disabled when `overrides` empty, `@click="$emit('reset-all')"`).
- **Body:** a plain `overflow-y-auto` `<div>` scroll container, grouped by `populatedSections()`. Each
  section is a sticky header (`TOKEN_SECTION_LABELS[section]`) + its `TokenRow`s. Filter
  `TOKEN_MANIFEST_LIST` by `search` (fuzzy via `fuzzysort` over `label` + `name`); sections with zero
  matches under the current search are hidden. All sections flat-expanded (collapse is C6 polish — Q5 DEFAULT).
- **Per row:** `:resolved-value="resolved[entry.name]"`, `:resolved-contrast-bg="entry.contrastAgainst ? resolved[entry.contrastAgainst] : undefined"`,
  `:edited="entry.name in overrides"`, forward `@set`/`@reset`.
- **Empty search state:** centered muted "No tokens match '<query>'." + a "Clear search" link.

> No store/composable imports in either component. No raw `<input>/<select>/<button>/<textarea>`
> (use the named wrappers). `px-3` horizontal padding goes on the body wrapper, never on the `Tabs` root
> or TabList viewport.

**Acceptance:** `TokensTabEditor` renders standalone with stubbed `resolved`/`overrides`; search filters;
editing a row emits `set`; the reset button emits `reset`/`reset-all`; lint clean for ui-primitive governance.

---

### Task 7 — `ThemeStudioPanel.vue`: fill the Tokens tab body + forward edits to the C6 seam

**File:** `src/components/panels/ThemeStudioPanel.vue`.

C6 already owns the 5-tab shell (`activeTab`, `STUDIO_L1_TABS`, the `<Tabs scrollable>` wrapper, the
`StudioTabPlaceholder` bodies) AND the single live-apply writer — the C6-owned
`watch(a.overrides, pushPreview)` that does the merged wholesale `previewThemeTokens` push + stale-key
strip on every override change. **C1 adds NO apply writer, no shell, no `<Tabs>`, no second watch.** C1's
two jobs:

1. **Fill the `tokens` placeholder branch** in C6's existing default slot with `<TokensTabEditor>`.
2. **Forward the editor's events** to the C6 seam actions.

**Steps:**

1. **Imports:** add `TokensTabEditor` (`@/components/panels/theme-studio/TokensTabEditor.vue`) and
   `TOKEN_MANIFEST_LIST` (`@/modules/themes/tokenManifest`). No `debounce`, no `Tabs` — those belong to C6.
2. **Resolved-values snapshot** (D-SEED-COMPUTED) — a read-only accessor (NOT an apply writer) that
   re-reads computed custom properties off `APP_ROOT` to seed the color controls + WCAG chips:
   ```ts
   import { APP_ROOT } from "@/stores/theme"; // the exported root ref the store writes to (confirm in Task 0)
   const resolvedTokens = ref<Record<string, string>>({});
   function snapshotResolved(): void {
     const cs = getComputedStyle(APP_ROOT);
     const out: Record<string, string> = {};
     for (const e of TOKEN_MANIFEST_LIST) out[e.name] = cs.getPropertyValue(e.name).trim();
     resolvedTokens.value = out;
   }
   ```
   Call `snapshotResolved()` on mount, when switching to the `tokens` tab, and after C6's push settles
   (`watch(a.overrides, () => queueMicrotask(snapshotResolved))` — a read-only re-snapshot, it does not
   re-apply). The painting is C6's `watch(a.overrides, pushPreview)`; this watcher only re-reads the
   resolved values for the controls.
3. **Per-token handlers — forward only, no apply call:**
   ```ts
   function onTokenSet(token: string, value: string): void {
     a.setOverride(token, value);
   }
   function onTokenReset(token: string): void {
     a.clearOverride(token);
   }
   function onTokenResetAll(): void {
     a.clearAllOverrides();
   }
   ```
   Each mutates `a.overrides`; C6's `watch(a.overrides, pushPreview)` fires the single debounced merged
   push (and the full-strip-then-re-push that removes orphan keys density/compat aliases leave behind).
   **C1 does NOT call `previewThemeTokens`, `endPreview`, or any debounced apply here** — that is the
   double-write the master plan §B.4/§B.10 forbids.
4. **Template:** replace C6's `tokens` placeholder branch in the single default slot:
   ```vue
   <TokensTabEditor
     v-else-if="active === 'tokens'"
     :resolved="resolvedTokens"
     :overrides="a.overrides.value"
     @set="onTokenSet"
     @reset="onTokenReset"
     @reset-all="onTokenResetAll"
   />
   ```
   The container, slot shape, `studioTabs.ts`, common band, `Splitter`, preview pane, and footer are
   C6's and stay untouched.
5. **`onSave`/`onDiscard`:** unchanged mechanics, already wired by C6 — `onSave` persists `overrides` via
   the composable then `endPreview()`; `onDiscard` calls `a.reset()` (clears overrides) +
   `themeStore.cancelPreview()`. C1 confirms but does not re-implement.

**Acceptance:** `pnpm dev` mounts; the Tokens tab renders inside C6's shell; editing `--color-interactive`
in Tokens updates `getComputedStyle(APP_ROOT)` and the preview "Engage" swatch (via C6's watcher); reset
reverts it; common band + preview + footer unchanged. No `previewThemeTokens`/`debounce` apply call lives
in C1's diff.

---

### Task 8 — `useThemeAuthoring.spec.ts`: composable seam coverage (C6-owned — NOT a C1 task)

> **C1 does NOT touch this spec.** The override-seam unit coverage — override CRUD, merge order,
> seed-from-overrides, persist-includes-overrides (primary vs paired `{}`), preview parity vs `resolve()`,
> and validation — lands in **C6** alongside the seam it tests (master plan §B.4). C1 does not extend
> `useThemeAuthoring.ts`, so it adds no cases here. The C1 PR exercises the seam end-to-end via the
> Task-6 component tests + the Stage-1 Playwright flow (Task 10).

**File:** none for C1. (C6's PR owns the cases below, listed here only so the C1 reviewer knows the seam
is already proven before C1 consumes it: override CRUD; merge order; seed-from-overrides + reset/static
clear; persist-create primary `overrides` + paired `{}`; persist-update patch; preview parity vs
`resolve()` on a non-generator token; >500-char / `<script>` / `javascript:` validation → `validate()`
false + `saveError` set + no repo call.)

**Acceptance:** Task 0 confirmed C6's `useThemeAuthoring.spec.ts` seam cases are green. Nothing for C1 here.

---

### Task 9 — Static gauntlet + dictionaries

**Change:** Run `pnpm lint && pnpm check:single-source && pnpm type-check && pnpm test && pnpm spell && pnpm build`.
Add any new term surfaced by `pnpm spell` (e.g. `WCAG`, `OKLCH` if not already present, manifest label
words like `bevel`/`sunken`/`dockpanel`) to `dictionaries/{tech,project}.txt` — never `cspell.json`.
Run `pnpm docs:build` as well (the theme-work gauntlet includes it), though no docs change is expected.

**Acceptance:** all green; no doc-sync file changed (assert via `git status` — only the new/modified files
from this plan appear).

---

### Task 10 — Stage 1 Playwright verification, then PR

Run the Stage-1 assertions (below), capture screenshots, build the result table, open the PR to `develop`.

**Acceptance:** all Stage-1 assertions PASS, 0 console errors; PR opened with the result table + Stage-2
checklist + chosen open-question answers; CI `quality` + `CSpell` green; **do not auto-merge** — wait for
the maintainer.

---

## Data-model delta

**Zero deltas to the persisted/portable schema.** No fields added to `GenerationInputV2`, `Theme`,
`ThemeBase`, or `PortableTheme`. Per-token edits land in the **already-existing** `Theme.overrides: ThemeTokens`
(sparse map, `theme.ts:181`). Therefore:

- `THEME_SCHEMA_VERSION` stays `2` (confirmed `theme.ts:22`). `ENGINE_VERSION` stays `1` (confirmed
  `theme.ts:32`). `DB_VERSION` stays `3`.
- **No migration code.** Every persisted theme already has `overrides` (defaulted `{}` by the repo +
  `migrateThemeV1ToV2` + idb v3). A pre-C1 theme shows all values at their resolved-base default with zero
  edited badges.
- **Portability round-trip unchanged.** `exportThemeToJson` serializes `theme.overrides` verbatim;
  `importThemeFromJson` validates each key via `TokenNameSchema` (`isKnownToken`) and each value via
  `TokenValueSchema`. Every C1-produced override passes by construction (controls emit only allowlisted
  keys + length-validated, injection-filtered values).
- **The one behavioral invariant** (not a schema field): override-over-base composition. The persisted
  theme is `{ base: {kind:"generated", input}, overrides: {…edited…} }`; `resolve()` applies
  `base ⊕ overrides` (override wins). C1 makes the UI _produce_ both halves; the type system is unchanged.

---

## Doc-sync — the token doc-sync (the 6-file rule) does NOT fire (no new token family)

C1 is the phase that **creates** `tokenManifest.ts` (the 6th file of the rule), so it adds no token family of its
own and the token doc-sync does not fire. The five rule files below stay untouched:

| Doc-sync file                                   | C1 action                                                    |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `src/assets/styles/tokens.css`                  | **No change** — no new token defaults.                       |
| `src/modules/themes/knownTokens.ts`             | **No change** — every surfaced token is already allowlisted. |
| `src/modules/themes/generate.ts`                | **No change** — no new emitted keys, no math change.         |
| `docs/theme-schema-for-llms.md`                 | **No change** — no new token names anywhere.                 |
| `tests/unit/docs/theme-schema-for-llms.spec.ts` | **No change** — stays green untouched.                       |

**Guard for this claim:** `tokenManifest.spec.ts` assertion 1 (`set(manifest) === set(ALL_KNOWN_TOKEN_NAMES)`)
means the manifest can never introduce a token name that isn't already allowlisted, and a future phase that
adds a token to `knownTokens.ts` without a manifest entry fails this spec — the manifest is a second
drift tripwire alongside the LLM-doc guard. Verify with `git status` in Task 9: only the new/modified files
listed in File Structure appear.

---

## Two-stage verification

### Stage 0 — probe

Probe `mcp__plugin_playwright_playwright__*`. If absent, run `ToolSearch` with `query: "playwright browser"`.
If still unavailable, fall back to a manual smoke checklist, state this explicitly in the PR, and embed NO
Stage-1 results table.

### Stage 1 — Playwright automated (binary; all must PASS before PR)

Drive `pnpm dev`, open the Theme Studio panel. Screenshots → `.verification-screenshots/feat/c1-tokens-tab/<checkpoint>.png`.

| id     | description                    | check                                                                                                                                                                                                                                                                 | screenshot             |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| C1-A1  | Tokens tab renders             | Click "Tokens" → a section header ("Surface") and a known row (`--color-interactive`) are visible.                                                                                                                                                                    | `tokens-tab-open`      |
| C1-A2  | Search filters                 | Type "status" → only status-section rows show; non-matching sections hidden.                                                                                                                                                                                          | `tokens-search-status` |
| C1-A3  | Color edit live-applies        | Open `--color-interactive`, pick a distinct hue → `getComputedStyle(documentElement).getPropertyValue("--color-interactive")` reflects the new value AND the preview "Engage" background changed.                                                                     | `tokens-color-edited`  |
| C1-A4  | Edited badge + per-row reset   | Row shows the edited dot + reset; click reset → inline `--color-interactive` reverts to the generator value.                                                                                                                                                          | `tokens-reset-one`     |
| C1-A5  | Length edit (visible consumer) | Edit `--density-cell-padding-x` via InputNumber+unit → computed value updates AND a preview row's horizontal padding changes. (NOT `--radius-md` — the preview sample uses fixed Tailwind `rounded-*`.)                                                               | `tokens-length-edit`   |
| C1-A6  | WCAG chip                      | `--color-text-primary` row shows a ratio chip; also assert a `var()`-chained pair (`--menubar-fg` over `--menubar-bg`) shows a chip (computed-value seeding). Edit text-primary to a low-contrast color → chip flips to the low-contrast warning; edit still applied. | `tokens-wcag-chip`     |
| C1-A7  | Reset all                      | With ≥2 edits incl. a non-generator token (`--density-row-height`), click "Reset all" → "0 edited" AND all edited inline vars (including the density one) are gone from `APP_ROOT` computed styles.                                                                   | `tokens-reset-all`     |
| C1-A8  | Generate↔Tokens coexistence    | Override `--color-interactive`, switch to Generate, move the Accent slider → computed `--color-interactive` still equals the OVERRIDE.                                                                                                                                | `tokens-coexist`       |
| C1-A9  | Live toggle round-trip         | Edit a token → toggle "Live across app" off → on → the override re-applies to `APP_ROOT`.                                                                                                                                                                             | `tokens-live-toggle`   |
| C1-A10 | Persist round-trip             | Save the theme → reopen Studio in edit mode → Tokens tab shows the same edited rows (overrides seeded).                                                                                                                                                               | `tokens-persist`       |
| C1-A11 | Console hygiene                | 0 console errors; report the warning count across the flow.                                                                                                                                                                                                           | —                      |

Embed the Markdown result table (id/desc/result/screenshot) + console-error/-warning counts + PASS/FAIL line
in the PR. No PR until all green.

### Stage 2 — human design checklist (3–7 items, closes the PR)

- [ ] Token rows have comfortable density; the raw `--token` subtitle is legible but recessive.
- [ ] The "edited" affordance (dot + reset) reads clearly without crowding the control.
- [ ] WCAG chips feel advisory (muted), not alarming, at default values.
- [ ] Search-empty and reset-all-disabled states feel intentional, not broken.
- [ ] The Generate/Tokens tab switch is obvious; the common band + preview staying put feels right.
- [ ] The `TokenColorField` popover (OKLCH editor + Advanced) is discoverable and not cramped at narrow split widths.

**Scrutinize for this phase:** color-control alignment within rows at narrow split widths; whether the
per-row reset icon competes visually with the control; whether the density "overrides density attribute"
chip reads as informative rather than as an error.

---

## Risks

1. **Two-writer race (avoid by construction):** the single merged-push live-apply rule is C6-owned
   (`watch(a.overrides, pushPreview)`). C1's risk is re-introducing a second writer — if a C1 handler
   ALSO calls `previewThemeTokens`/`debouncedApply` on a token edit, you get a double wholesale push
   (full-set repaint per keystroke). C1's handlers must only mutate `a.overrides` (`setOverride`/
   `clearOverride`/`clearAllOverrides`) and let C6's watcher do the apply. Assert "no `previewThemeTokens`
   call in the C1 diff" in the PR.
2. **Orphan keys on reset/disable:** `applyTokenOverrides` is additive — overrides on tokens the generator
   never emits (density, compat aliases) leak unless the apply does a full strip then re-push. This is
   handled by C6's `watch(a.overrides, pushPreview)` (the §B.4 clear-then-reapply); C1-A7 pins that it
   works for a `clearAllOverrides` from the Tokens tab.
3. **Computed-value seeding cross-realm read:** in a popped-out Studio, `APP_ROOT` is the opener root.
   `getComputedStyle(APP_ROOT)` must read the opener, not the pop-out document. Verify the `APP_ROOT`
   export points at the captured top-window root.
4. **`ColorSwatchPicker` reuse temptation:** do NOT shortcut to `ColorSwatchPicker` for color rows — it
   gamut-clamps OKLCH and can't author `color-mix()`/`var()`. `TokenColorField` is mandatory.
5. **`InputNumber` precision round-trip:** `0.8125rem` must parse/emit without precision loss; the
   tolerant regex + free-text fallback for `var()`-chained lengths handles this.
6. **Manifest-entry hand-authoring drift:** scaffold from the four `knownTokens.ts` arrays (union across
   them — the `--font-family-*` split spans SEMANTIC + THEMEABLE_PRIMITIVE); the set-equality spec is the
   guard. Do not trust any prose count.

---

## Open questions (maintainer decisions — defaults applied, confirm)

- **Q1 — Density token overrides.** DEFAULT: **allow with an advisory "overrides density attribute" chip**
  on `--density-*` rows. Alternative: hide them from the editor (manifest entries remain; `TokensTabEditor`
  filters). Confirm.
- **Q2 — Length control for `var()`-chained defaults.** DEFAULT: **free-text `Input` fallback** (validated)
  when the resolved value isn't a plain number+unit. Confirm.
- **Q3 — Paired-variant overrides.** DEFAULT: **paired gets `overrides: {}`** (mode-specific hand-edits
  don't copy to the flipped variant). Confirm.
- **Q5 — Section collapse.** DEFAULT: **flat-expanded + sticky headers**; collapsible sections deferred to
  C6. Confirm.
- **Q6 — Curated swatch presets per color section.** DEFAULT: **custom-any everywhere via `TokenColorField`**;
  no curated-swatch presets in v1 (the OKLCH editor + Advanced field covers all cases). Confirm whether
  accent/status rows should additionally surface `ACCENT_COLOR_SWATCHES`/`STATUS_HUE_SWATCHES` as optional
  presets.
- **Q-WORLD — confirm C6 landed first.** Answered by SO-4 / master plan §B.2: C6 (IA shell + override
  seam) is a HARD predecessor and ships first. C1 runs in that world only. Task 0 is a hard gate — if C6
  is absent, C1 STOPS and escalates (no minimal-seam fallback). Confirm C6 is merged before starting C1.
