# Track A — Theming Overhaul: Design & Execution Specification

> Status: Draft for maintainer review (the **authoritative execution plan** for Track A) · Owner: Lead Architect · Depends on: Track B (pop-out + theme-mirroring, shipped) · Schema target: `THEME_SCHEMA_VERSION` 1 → 2 · DB target: `DB_VERSION` 2 → 3 (`src/modules/storage/db.ts`)
>
> **Architecture externally validated & SETTLED (2026-06-02 — do not re-evaluate).** This plan's approach — **Option C**: the custom `--color-*` namespace is the single source of truth, PrimeVue/Volt is a derived consumer — was pressure-tested against PrimeVue-native theming and mature single-source systems (Material 3, MUI, Ant Design, Chakra, Mantine) in the research archive [`track-a-theming-single-source.md`](./track-a-theming-single-source.md) and **confirmed correct; adopting PrimeVue 4's native preset (Option B) was rejected on verified grounds.** Future sessions: that question is closed — do not re-run the research. Four net-new additions from the single-source edition are **adopted into execution**: a CI single-source guard (literal/unknown-token), `docs/decisions/0003-theme-single-source-of-truth.md`, the `--cv-float-tint`/`--dv-*` re-chain (in A1a), and on-color status pairing (`--color-status-*-fg`/`-border`) via a central severity variant resolver (in A1b). The §7 open decisions still need maintainer sign-off before execution.

---

## 1. Overview

### Goal

Make a CommandVue user able to recolor **anything** — surfaces, buttons, borders, focus rings, and the success / danger / warning / info / toast / status palette — from a first-class editing surface, and make the result land **uniformly** across the app, its modals, its floats, and every pop-out monitor at once. Three structural problems block this today:

1. **The surface seam.** PrimeVue/Volt surfaces (modals, popup menus, inputs, sliders, checkboxes, fieldsets, tags) paint on a _different_ surface scale than the app body. Built-in dark themes already show it; custom themes recolor the app body and leave Volt frozen on slate. Modals "look like a different app."
2. **Hardcoded status / un-themeable toast.** `STATUS_HUES` is frozen at `generate.ts:166`; there is no input path to change success/danger/warning/info. `Toast.vue` paints every toast neutral; `Tag.vue` ignores the theme (hardcoded Tailwind `green-100`/`sky-100`/`orange-100`/`red-100` literals, two of which — `sky`, `orange` — are not even in the project palette).
3. **A flat palette authored in a modal.** The palette is flat (single-tier neutral borders, no bevel, no accent glow), and theme authoring lives in a `<Dialog modal>` that cannot float to a second monitor, cannot stay open while you click around the live app, and previews into a **scoped div** that never recolors the running app or any pop-out.

### Why now

Track B shipped the live-recolor backbone: `usePopoutThemeSync.ts` runs one `MutationObserver` on the opener's `<html>` (watching `data-theme`, `data-theme-id`, `data-density`, and `style`) and mirrors every inline `--*` custom property + the three data attributes into every tracked pop-out window. Because `applyTheme` writes tokens as inline `--*` props via `setProperty`, _any_ write to the opener root already fans out to all pop-outs — no new mirroring code. Track A is the consumer that exercises it.

### Headline outcome

- One uniform surface scale — Volt modals/menus/inputs track the theme in both light and dark, **including inside floating panels** (see §3b float-immunity).
- A theme can re-point status hues and supply explicit status/toast colors; tags and toasts become severity-colored and fully themeable.
- A richer, "less-flat" palette: tiered colored borders, a triple-layer surface bevel, and a per-accent `{primary, dim, glow}` triad — all themeable tokens, all pop-out-mirrored for free.
- A **Theme Studio** dockview panel (floatable, pop-outable to a second monitor) that live-recolors the main window + every float + every pop-out on every edit, with a searchable manifest-driven per-token editor and advisory WCAG.
- Themeable duotone icons mapped to `--icon-tone-*`, with an icon affordance on controls (scoped as the final phase A3).

---

## 2. Current state

| Concern                                  | Where                                                                                                                                                                                                                                                                                                      | Pain point                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data model**                           | `Theme` (`src/types/theme.ts:64-87`); `ThemeGenerationMeta` (`theme.ts:56-62`); `THEME_SCHEMA_VERSION = 1` (`theme.ts:22`); `ThemeDefinition` (`theme.ts:95`)                                                                                                                                              | A `Theme` is a **fully-resolved** record with a complete `tokens: Record<string,string>`. Three provenances diverge structurally: built-ins (6 JSONs, no `generation`, ~30-50 tokens, many `var(--color-slate-*)` primitive refs, bare keys normalized at load by `builtin.ts:39-45`); generated (carry `generation`, full ~73-token Record, 100% derivable); imported (`source:"imported"`, may or may not carry `generation`). `generation` is **lossy** — no `fontFamily`, no `statusHues`. **There is no `resolve()` / compose step** — `applyTheme` iterates `theme.tokens` verbatim. No notion of "only the changed tokens."                                                                                                                                                                                                                         |
| **Generation engine**                    | `generateTheme` (`generate.ts:173-435`); inputs `ThemeGenerationInput` (`generate.ts:40-53`); OKLCH gamut map `oklch()`/`css()` (`generate.ts:86-107`); `solveForContrast` (`generate.ts:115-139`); `contrastTarget` (`generate.ts:141-145`)                                                               | Pure, deterministic, gamut-safe. Emits ~73 tokens, all `oklch(...)` except literal `#ffffff`. Sound foundation — the problem is what it _can't_ take as input.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Status hardcode**                      | `STATUS_HUES = { success:145, warning:75, danger:27, info:250 }` (`generate.ts:166`); status emission (`generate.ts:253-259, 352-359`); compat aliases (`generate.ts:380-383`)                                                                                                                             | Frozen `const`, **no input path**. Mode-tuned `statusL/statusC/subtleL/subtleC` derive L/C; only hue is fixed. Customizer copy promises status families are accent-independent (`ThemeCustomizerDialog.vue:592-631`); LLM doc says "don't recolor these" (`docs/theme-schema-for-llms.md:122-123`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Three-layer tokens**                   | `tokens.css` — primitives `@theme` (`:47-139`); semantic (`:317-377`); density (`:391-433`); component (`:442-501`); dark overrides (`:511-565`)                                                                                                                                                           | Status is a flat 8 (`--color-status-{success,warning,danger,info}` + `-subtle`). Borders are neutral only. No bevel, no accent glow/dim, no status-border. The palette reads "flat."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **The surface seam**                     | `--color-p-surface-*` `@theme` block (`tokens.css:170-186`); the real Volt chain `bg-surface-N` → `--color-surface-N` → (via `tailwindcss-primeui` `@theme inline`) → `--p-surface-N` → opaque literals in `main.css:57-69`; `--p-primary-*` already aliased to `--color-interactive*` at `main.css:73-76` | **Verified dead-code bug on top of the seam.** The variable the generator and validator target — `--color-p-surface-*` — is consumed by _nothing_ (`grep "var(--color-p-surface" src/` → 0 matches). The variable Volt actually resolves is single-`p` `--p-surface-*` (`main.css:58-69`), never touched by any theme path. So `generate.ts:307-326` derives a tinted `--color-p-surface-*` scale nobody reads; `knownTokens.ts:180-191` allowlists the wrong target; the 6 built-ins override `--color-surface-*` but leave `--p-surface-*` on slate. `@theme inline` inlines `var(--p-surface-N)` at the use site, so the **only** runtime lever on a Volt surface is `--p-surface-N` (single `p`). Volt files additionally bake a `dark:` split (`Dialog.vue:71-75`) that picks between two slate stops keyed to `data-theme`, not the theme's surface. |
| **The two `--color-surface-*` families** | App semantic `--color-surface-{base,raised,overlay,sunken}` (`tokens.css`); primeui numeric `--color-surface-{0..950}` (`node_modules/tailwindcss-primeui/.../theme/colors.css`, declared `@theme inline { --color-surface-0..950: var(--p-surface-N); }`)                                                 | **VERIFIED collision by prefix.** Two unrelated families share the `--color-surface-*` stem. The named family is real and inline-overridable; the numeric family is a `@theme inline` alias of `--p-surface-N` and is **not** inline-overridable (writing `--color-surface-200` on `:root` does nothing). Any contributor adding a numeric `--color-surface-N` to `knownTokens`/the manifest mints a silently-dead control.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Float-transparency override**          | `dockview.css:93-97`                                                                                                                                                                                                                                                                                       | **VERIFIED.** Inside any `.dv-groupview-floating`, all five app surface tokens (`--color-surface`, `-base`, `-sunken`, `-raised`, `-overlay`) are set to `transparent` so a floated panel's `bg-surface*` shows the single "glass" tint. **Foreground tokens (text/icon/border) are deliberately left untouched.** This directly constrains the seam fix: any Volt surface wired to those tokens renders with no background inside a float.                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Apply path**                           | `applyTheme` (`apply.ts:41-57`); `clearPreviousKeys` (`apply.ts:70-84`); `clearTheme` (`apply.ts:63-68`); `cssVarName` (`apply.ts:28-30`)                                                                                                                                                                  | Whole-theme replace only. Reads `data-theme-applied` (JSON array) to tear down prior keys, writes each `theme.tokens` entry as inline `--*` on `document.documentElement` (`apply.ts:42`, hardcoded), re-records keys, sets `data-theme-id`/`data-theme`/`data-density`. **No sparse/partial apply primitive, no diff re-resolution.** `applyTheme` writes `data-theme` to `theme.mode`; `useTheme.applyResolved` writes it to the resolved light/dark — same attribute, two writers, reconciled by bridging.                                                                                                                                                                                                                                                                                                                                              |
| **Light/dark/auto + paired bridging**    | `useTheme` (`src/composables/useTheme.ts`); `applyResolved` (`:77-87`); `bridgeVariant` (`:122-154`, reads `generation?.paired` at `:132`); `applyPairedTheme` (`:112-120`); anti-FOUC inline script reads `localStorage['commandvue:theme']`                                                              | Mode toggle resolves light/dark, mirrors to `localStorage`, may swap to a paired theme via `generation.paired` then `-light`/`-dark` suffix. A mode toggle can trigger a **full** `applyTheme` of the paired theme. The anti-FOUC path runs before app JS — it **cannot** run `generateTheme`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Pop-out mirroring (Track B)**          | `usePopoutThemeSync.ts` — one `MutationObserver` on `<html>` (`:68-75`, filter `['data-theme','data-theme-id','data-density','style']`); `syncWindow` (`:30-57`); `registerPopoutWindow` (`:78-81`); seeded pre-paint by `public/popout.html`                                                              | **The live-recolor backbone.** **VERIFIED two sharp edges:** (1) `syncWindow` does a **full** `dst.setAttribute("style", tokens)` replace (`:51`), rebuilding the pop-out's entire inline style from the opener's `--*` props each pass — it copies _all_ `--*` props regardless of any preview attribute. (2) The observer callback is `() => syncAll()` with **no debounce/coalescing on the mirror side** (`:70`) — one mutation → one full rebuild per pop-out. Floats are same-document and recolor off the cascade for free.                                                                                                                                                                                                                                                                                                                         |
| **Authoring dialogs**                    | `ThemeCustomizerDialog.vue` (738 lines, `<Dialog modal>`); `ThemeImportDialog.vue`; `ThemePickerDialog.vue`; launched from `MenuBar.vue` View menu (`:315-322, 382-388`); customizer dual-mounted in MenuBar + picker (`ThemePickerDialog.vue:384-389`)                                                    | 3-input flow → full token Record. Preview writes to a **scoped `<div :style>`** — never touches `<html>`, so it does **not** recolor the running app or pop-outs. "Save always creates a new theme"; **no per-token editing exists**. Edit gated to `source==='generated'` with a `generation` block (`MenuBar.vue:54-56`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Known-token allowlist**                | `knownTokens.ts` — `SEMANTIC` (`:24-77`), `COMPONENT` (`:79-123`), `DENSITY` (`:125-135`, generator deliberately omits these), `THEMEABLE_PRIMITIVE` (`:154-192`); `ALL_KNOWN_TOKEN_NAMES` (`:194`); `isKnownToken`/`listUnknownTokens` (`:206-213`)                                                       | ~90 tokens. **No grouping, label, type, or contrast-pairing metadata.** Gates generation (`generate.spec.ts:86-90`), import (`portableSchema.ts:42-44, 66`), repo invariants, and the LLM-doc guard test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Storage**                              | `src/modules/storage/db.ts` — `DB_VERSION = 2` (`:9`), `upgrade` (`:89`), `VersionError` reopen (`:126-127`); custom themes in object store `custom-themes`                                                                                                                                                | **VERIFIED path** is `src/modules/storage/db.ts` (NOT `db.ts:9`). A **second** IndexedDB exists at `src/utils/storage.ts` (`DB_VERSION = 1`) — **confirmed not to hold theme data** (audit item, see §5). The `VersionError` branch reopens at the _existing higher_ version with **no upgrade callback** — a hazard for old builds run after the v3 upgrade.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

## 3. Key design decisions

### (a) Data-model v2 — generated-base ⊕ sparse-overrides, with a **mandatory** resolved cache

**Decision.** Move to a discriminated `base` + sparse `overrides` model with a `resolve()` materializer, keeping the full resolved `tokens` Record as a **mandatory, write-through** field (see the boot/anti-FOUC contract in §3h — the cache is load-bearing, not a convenience).

```ts
// src/types/theme.ts (v2)
export const THEME_SCHEMA_VERSION = 2 as const;
export const ENGINE_VERSION = 1 as const; // bumps when generateTheme's MATH changes (see §3i)

export interface GenerationInputV2 {
  schemaVersion: 2;
  baseColor: string;
  accentColor: string;
  contrast: number; // 30-100
  mode: ThemeMode;
  density: ThemeDensity;
  fontFamily?: string; // NOW persisted (was lost). OMITTED, not defaulted, when unset (see §3i).
  statusHues?: { success?: number; warning?: number; danger?: number; info?: number };
  statusOverrides?: StatusOverrides; // A1b
  // A1c richness knobs (bevel depth, accent-triad alpha) live here too
}

export type ThemeBase =
  | { kind: "generated"; input: GenerationInputV2 } // re-derivable
  | { kind: "static"; tokens: ThemeTokens }; // frozen, not derivable (built-ins, hand-authored imports)

export interface Theme {
  // …id/name/description/author/source/mode/density…
  base: ThemeBase;
  overrides: ThemeTokens; // sparse: ONLY user-hand-edited tokens (A2b). {} for fresh-generated.
  tokens: ThemeTokens; // MANDATORY resolved cache (write-through). Always populated. See §3h.
  paired?: ThemeId; // moved off `generation` — pairing is base-independent
  createdAt: number;
  updatedAt: number;
}
```

`resolve(theme): ThemeTokens` (new `src/modules/themes/resolve.ts`):

1. Base tokens: `static` → `base.tokens`; `generated` → `generateTheme(base.input).tokens`, **memoized** in a module `Map` keyed on `${ENGINE_VERSION}:${JSON.stringify(base.input)}` (the `ENGINE_VERSION` prefix guarantees a stale cache is never served across an engine math bump — see §3i; the input string must include `statusHues` + every richness knob or two themes collide).
2. Shallow-merge `{ ...baseTokens, ...overrides }` (override wins — CSS-cascade semantics).
3. Return. `resolve()` is the source of truth; the `tokens` cache is written through on every `create`/`update`.

**Why this shape.** Generated themes stay live against the engine while `overrides` give the user a pin; built-ins and hand-authored imports use `static` and are preserved byte-for-byte; the write-through cache lets v2 land without rewriting every consumer (`apply.ts`, `export.ts`, `usePopoutThemeSync`, `ThemePickerDialog` swatch sampling) in one PR.

**Rejected alternatives.** _Pure sparse, no `static`_ — the 6 built-ins reference hand-tuned `var(--color-slate-*)` primitives and were never generated; forcing them through `generateTheme` visibly recolors them. _Drop the cache, resolve on every read_ — breaks anti-FOUC first paint (§3h) and re-runs culori gamut loops on hot paths. _Keep `generation` beside `overrides`_ — `generation` is lossy; folding it into a versioned `base.input` is cleaner.

### (b) The surface-seam fix — DERIVE + EMIT into a **float-immune, opaque** `--p-surface-*` scale

**Decision.** Fix the live variable `--p-surface-N` (single `p`), and make every Volt surface track the theme **without** going transparent inside floats. Reject mapping Volt surface rungs to the four app surface tokens that `dockview.css:93-97` forces to `transparent`.

This is the critique's #1 blocker, now closed. The earlier draft wired `--p-surface-*` → `--color-surface-overlay/-raised/-sunken/-base`; those exact tokens are zeroed inside `.dv-groupview-floating`, so a Volt `Dialog`/`Menu` opened **from inside a floating panel** would inherit `transparent` and render with no background (text over the map). The fix must source Volt surfaces from values that stay opaque in a float.

Two scales are genuinely different abstractions and stay separate: the app scale is a 4-rung semantic ladder; the PrimeVue scale is an 11-rung `0..950` ramp Volt indexes for multiple roles (bg, border, hover, icon, mid-ramp text). Keep two scales; make the PrimeVue one **derive, rung-aware, and float-immune.**

- **The float-immune source.** Introduce dedicated, theme-driven **opaque** surface tokens that are NOT re-pointed inside `.dv-groupview-floating` — e.g. `--color-surface-solid-raised` / `--color-surface-solid-overlay` (parallel to the existing named ladder but explicitly exempt from the float-transparency block). The generator emits these from the same OKLCH solve as `--color-surface-raised/-overlay`. `--p-surface-N` derives from _these_ (plus the foreground tokens, which are already float-untouched), never from the four tokens that go transparent.
- **A2-light (ships in A1a):** in `main.css:57-69`, replace the hardcoded `--p-surface-*` literals with a pinned rung→role table referencing the **float-immune** surface tokens + the foreground tokens (which `dockview.css` leaves alone). Because every theme drives those tokens, Volt surfaces follow the theme **in their own mode**, opaque inside floats, with zero Volt edits and zero theme-data changes. Heals all 6 built-ins for free.
- **A2-full (fast-follow inside A1a, scope-gated — Open Decision 1):** rewrite the 10 Volt `:pt` strings to read the float-immune semantic tokens directly and **delete every `dark:` surface variant** — e.g. `Dialog.vue` root → `bg-[var(--color-surface-solid-overlay)] border-[var(--color-border-default)] text-[var(--color-text-primary)]`. This makes Volt structurally identical to the already-correct hand-rolled `ContextMenu.vue` and means overriding one token recolors both modes. After this, the `main.css` derivation is a safety net.

Fix the generator: stop emitting dead `--color-p-surface-*`; emit the float-immune `--color-surface-solid-*` tokens and rely on the `main.css` derivation for the `--p-surface-N` ramp (single source of truth). Handle `knownTokens.ts` per §3j (do **not** silently drop p-surface names before the import upcast lands).

**Critical traps to document (once, authoritatively):**

1. `tailwindcss-primeui` uses `@theme inline`, so `var(--p-surface-N)` is inlined at the Volt use site — you **cannot** fix this by editing `--color-surface-N`. The **only** runtime lever on a Volt surface is `--p-surface-N` (single `p`).
2. There are **two** `--color-surface-*` families: the real app-named one (`base/raised/overlay/sunken`, inline-overridable) and the primeui numeric one (`0..950` = `@theme inline` alias of `--p-surface-N`, **not** inline-overridable). The numeric family must never enter `knownTokens`/the manifest (A2b uniqueness test asserts this — §3f).
3. The four app surface tokens go `transparent` inside floats. Volt surfaces must source from the **`-solid-*`** tokens, not these.

### (c) Status / toast color model — hue-first, color-second, default-to-today

**Decision.** Status stays **generative** (auto-adapts L/C to mode, stays in-gamut, keeps the AA story) but each family gains optional overrides. When absent, the engine takes **exactly today's path → byte-identical status tokens** (the new status-border/toast keys are additive — see the single-source rule below).

```ts
type StatusFamilyOverride = { hue?: number; color?: string; subtle?: string }; // precedence: color > hue
type StatusOverrides = { success?: …; warning?: …; danger?: …; info?: … };
```

- **Tier 1 (hue-only, default UX, A1b):** `{ hue: 30 }` re-points just the hue; engine derives L/C from the mode-tuned constants → gamut-safe, mode-adaptive, subtle auto-derives. Zero accessibility risk.
- **Tier 2 (explicit color, escape valve, A2b):** `{ color, subtle? }` — emitted token is the user's exact color normalized through `oklch()`/`css()` (floored, gamut-clamped); missing `subtle` derives from the color's hue, falling back to the default hue when the color is achromatic (`?? STATUS_HUES.x`).

**Single source for the new status-border + toast defaults (closes critique #5/#important-byte-identity).** Defaults for `--color-status-{s}-border` and the toast block live in **`tokens.css`** as `var()` chains off the existing status/surface tokens (so built-ins — which are static JSON and never touch the generator — get them for free). The generator emits **only `--color-status-{s}` / `-subtle` (today's keys, byte-identical when unset)** plus the status-border/toast keys **only when a status override is present** (so a re-pointed hue carries its border/toast through). This means: no generated/built-in asymmetry, no two-source drift, and the byte-identical guarantee holds for the _status_ keys regardless of the additive defaults.

**Toast (A1b).** `tokens.css` defines `--color-toast-{success,info,warning,danger}-{bg,fg}` (= family `-subtle` / family solid) plus shared neutral `--color-toast-{bg,fg,border}` (= surface-raised / text-primary / border-default) so an un-severitied toast keeps today's neutral look. Toasts become themeable transitively.

Status/toast contrast checks are **advisory only** — surfaced in the A2b editor, never added to `contrastReport.failures` (`generate.ts:412-422` checks only text/border/focus/on-interactive today; keep it that way). **Explicit note (critique #minor-3):** Tier-2 status/toast colors opt **out** of the computed-AA guarantee the rest of the engine provides; the A2b WCAG chip must cover `toast-fg`-on-`toast-bg` and `status-fg`-on-`status-subtle` pairs, advisory-only.

**Rejected:** mutable `STATUS_HUES` export (global mutable state, breaks determinism); fully free-form status (loses mode-adaptation/gamut/AA-subtle); 4 separate top-level `successHue?` fields (doesn't scale to color/subtle); tying status to the accent (explicitly forbidden by existing design).

### (d) The richer "less-flat" palette — concrete new tokens (A1c)

Three families, all **foreground-class** (border/shadow colors, never surface fills) so they survive the float transparency override at `dockview.css:93-97` (foreground tokens there are deliberately untouched):

1. **Triple-layer surface bevel.** `--color-surface-bevel-light` / `--color-surface-bevel-dark`, derived from `surfaceRaised` by ±0.04 L (light) / ±0.05 L (dark), low-chroma carrying base hue; plus composed `--shadow-bevel-raised` / `--shadow-bevel-sunken` inset box-shadows. Components opt in via box-shadow. (Rejected `border-image` gradients — heavy, theme-hostile.)
2. **Tiered colored borders.** `--color-border-accent` (= `borderDefault` hue-nudged toward `accentHue`, chroma ~0.04) for active/selected panels (wires `--dv-paneview-active-outline-color`), plus the `--color-status-{s}-border` family from A1b.
3. **Per-accent {primary, dim, glow} triad.** Extend the **interactive** vocabulary (not a parallel `accent-*` namespace): `--color-interactive-glow` (= `oklch(interL, interChroma, accentHue, dark?0.4:0.32)` — alpha, for focus halos / hover rings / active-tab glow) and `--color-interactive-dim` (desaturated/darkened accent). Wire `--shadow-accent-glow: 0 0 0 3px var(--color-interactive-glow)`; optionally compose into `--shadow-focus-ring`.

All three are **additive KEYS** (new defaults in `tokens.css`) → no schema bump for the palette itself. The `statusHues`/richness _inputs_ force the bump, and those ride the v2 model (§3a) which A1a/A1a.5 establishes. **Engine-stability contract (§3i) applies:** these are new key names only — no existing key's derivation changes — so existing migrated themes do not recolor.

### (e) Theme Studio dockview panel + live-recolor-all-windows (A2a)

**Decision.** Register a **singleton** `theme-studio` dockview panel (category `tools`, icon `palette`) that hosts authoring and, on every edit, writes draft tokens to the **top/opener window's `document.documentElement`** via a new sparse apply primitive that takes an **explicit root** (never ambient `document`). Because `usePopoutThemeSync`'s observer mirrors `<html>` `style` changes, every float and every pop-out (including a popped-out Studio) recolors automatically.

- Dual registration (mandatory, dockview-vue 6 resolves by string): `panelRegistry.register({ id:'theme-studio', … })` in `builtin.ts` **and** `app.component('theme-studio', …)` in `main.ts`.
- Lift authoring logic into a shared `useThemeAuthoring()` composable so the (transitional) dialog and the panel don't fork ~700 lines.
- **New apply primitives** in `apply.ts`: `applyTokenOverrides(overrides, root)` / `clearTokenOverrides(root)` — **`root` is an explicit `HTMLElement` argument**, never ambient `document.documentElement`. Tracked under a **separate** attribute `data-theme-preview-applied` (must NOT reuse `data-theme-applied`).
- **Opener-root acquisition (closes critique #important-opener-root, the highest-risk assumption).** A single module-level reference to the **top window's** root element is captured in `main.ts` at app boot (`const APP_ROOT = document.documentElement` in the top realm) and exported. `useThemeAuthoring` → the store → the apply primitives all target `APP_ROOT`, never the child window's `document`. A popped-out Studio runs in a child realm where ambient `document` is the _child's_ — so ambient access is forbidden; only the captured top-realm `APP_ROOT` is written. This is what makes the mirror fan-out work from inside a pop-out.
- **Draft session in the Pinia store** (survives panel unmount/pop-out, unlike modal-local refs): `previewDraft`, `beginPreview`, `setPreviewToken` (debounced ~16–32ms at the DOM-write boundary), `resetPreviewToken`, `commitPreview` (→ `themeRepo` → `setTheme`), `cancelPreview` (→ `clearTokenOverrides(APP_ROOT)` + re-apply committed theme = instant rollback everywhere).
- **No-flash commit ordering (closes critique #important-mirror-race).** `commitPreview` applies the committed theme tokens **additively first**, then clears only the preview keys not present in the committed set — there is never a frame where the opener root has neither. `cancelPreview` likewise re-applies committed tokens before clearing preview keys.
- **Mirror-side coalescing (closes critique #important-mirror-race).** `usePopoutThemeSync` gets a one-line change: wrap the observer callback in `requestAnimationFrame` coalescing so N mutations/frame collapse into one `syncAll()` (today it is `() => syncAll()` with no batching, `usePopoutThemeSync.ts:70`). This is the only edit to that file.
- The Studio **never writes `data-theme` directly** — only `--*` tokens. Mode toggles flow through `bridgeVariant`; a mid-edit mode change re-resolves the draft against the paired base.

**The elegant property:** edit in _any_ window → top/opener root updates → all windows (including the editor's own pop-out) re-mirror. Single source of truth, single (now rAF-coalesced) observer.

**Rejected:** a new BroadcastChannel/postMessage pipe (duplicates the working observer, races the popout.html seed); applying to the pop-out's own root + a reverse observer (loops); non-singleton (two editors race on the root).

### (f) Per-token editor + advisory WCAG (A2b)

**Decision.** A second "Tokens" tab in the Theme Studio panel, driven by a hand-authored **manifest** layered over `knownTokens.ts`:

```ts
// src/modules/themes/tokenManifest.ts
interface TokenManifestEntry {
  name: KnownTokenName;
  section: string; // Surfaces, Borders, Text, Interactive, Status, Focus, Accent scale, …
  label: string;
  kind: "color" | "length" | "font-stack" | "shadow" | "number";
  description?: string;
  contrastAgainst?: KnownTokenName[];
}
```

`tokenManifest.spec.ts` asserts every `ALL_KNOWN_TOKEN_NAMES` member appears **exactly once** (catches drift) **and** that no numeric `--color-surface-N` name (the primeui `@theme inline` family) leaks into `ALL_KNOWN_TOKEN_NAMES` — minting a silently-dead control (critique #blocker-namespace). UI is **library-first**: filter box (`IconField` + `InputIcon` + `InputText`, fuzzysort over name+label+section), collapsible `Fieldset` per section; per-kind controls — color → hand-rolled `ui/ColorPicker.vue` (ADR 0002 exception, never `<input type=color>`), length/number → `InputNumber` + unit `Select` or `Slider`, font-stack → `Select`. Color values round-trip OKLCH via culori, matching `ColorSwatchPicker.vue`.

**Sparse capture:** a token whose value equals the resolved base value is **not** an override (dropped from the map); changing it captures it into `overrides`. Per-token reset deletes the key; per-section and panel-level "reset all" clear scoped/all keys.

**Advisory WCAG:** reuse culori `wcagContrast`. For tokens with `contrastAgainst` pairs (now including the status/toast pairs from §3c), show an inline chip (green ≥ target, amber ≥3, red below) computed against the **effective** (post-override) value of the paired token — resolved via the hidden-helper `getComputedStyle` pattern from `ThemePickerDialog.vue:71-101`, computed off the **debounced** effective map and **memoized per pair** (a forced reflow per keystroke per chip is too expensive). Never blocks save.

**Exclude from the editable manifest (or mark "pins the cascade"):** `DENSITY_TOKEN_NAMES` and `--font-family-*` — the generator deliberately doesn't emit them; they cascade from `data-density`, and an inline `--*` override would beat the attribute selector and pin density/font regardless of the control.

### (g) Duotone icons (scoped as the final phase A3)

**Decision.** Defer. High feasibility, large surface (new SVG asset pipeline + wrapper-API changes across 6+ primitives), depends on A2 landing. Lucide is strictly single-path `currentColor` and **cannot** do duotone. Three tiers when built: (1) `--icon-tone-{primary,secondary,accent}` semantic tokens generated from text/accent; (2) a small in-house duotone SVG set for ~12 high-traffic chrome icons (two `<path>` groups filled with `var(--icon-tone-*)`); (3) an optional leading-icon slot on `Button`/`Select`/`Input`/`Checkbox`. Domain (mdi) and Heroicons stay single-color. Adopting an external duotone pack requires an icon-library ADR (CLAUDE.md locks icons to Lucide/mdi/Heroicons).

### (h) The resolved cache is load-bearing for first paint — MANDATORY, never resolved at boot

**Decision (closes critique #important-anti-FOUC).** The anti-FOUC inline script and the `applyTheme` boot path **read only the resolved `tokens` cache, never `resolve()`** — `generateTheme` (culori, gamut loops) cannot run in a tiny pre-paint inline script. Therefore:

- `Theme.tokens` is **mandatory** (non-optional, §3a), always populated on `create`/`update` via `resolve()` **after** `assertValid`.
- **Boot invariant:** the persisted active theme always carries a populated `tokens` cache. A repo invariant (§5 item 4) enforces a non-empty `tokens` on write.
- Any theme that could be active at boot is guaranteed to have its cache; the migration (§5) and import upcast (§5 item 3) both populate it. A theme whose cache is somehow absent fails the invariant on write rather than forcing a boot-time resolve.
- **Verification:** the existing first-paint check is **re-run** (not assumed) with a _generated_ custom theme active — asserting no unthemed frame on reload.

### (i) Engine-stability contract — additive-only across A1a→A1c

**Decision (closes critique #blocker-diff-migration).** The diff-into-overrides migration's "no surprise recolor" promise holds only if existing emitted token NAMES keep **byte-identical derivation math** across engine versions; richness is **only additive new keys**.

- **Contract:** between A1a and A1c, no existing emitted token's derivation changes. New richness (bevel/glow/border-accent/status-border/toast) is new key names exclusively.
- If a future phase _must_ change an existing key's math (e.g. `--color-border-default` nudged toward accent), that constitutes an **engine bump**: increment `ENGINE_VERSION`, and either (a) add the changed key to every migrated theme's `overrides` retroactively in that PR's migration, or (b) gate the change behind user re-edit. Never silently change math under a fixed `ENGINE_VERSION`.
- `resolve()` memoization is keyed on `${ENGINE_VERSION}:…` (§3a) so a stale base cache is never served across a bump.
- **`fontFamily` reconstruction (critique sub-point).** During migration, `--font-family-body` is only present in a stored theme when the original input set `fontFamily` (`generate.ts:403-406`). If absent, leave `input.fontFamily` **undefined** (omit it) rather than back-filling the tokens.css default — back-filling would pin a previously-inherited value. The diff-into-overrides step (§5 item 2) captures the actual stored font tokens as overrides anyway, so the rendered result is identical either way; omitting keeps the input honest.
- **Test:** migrate a v1 generated theme; bump the engine (A1c); assert `resolve()` output is unchanged for all pre-A1c keys.

---

## 4. Phased plan

> Each sub-phase is one PR, independently shippable, ending with the repo's two-stage verification (Stage 1 Playwright-MCP automated; Stage 2 human design review). All token additions co-update `generate.ts` + `tokens.css` + `knownTokens.ts` + the LLM doc + its guard test in the **same PR** (CLAUDE.md doc-sync rule). **Windowing changes (A2a) trigger the mandatory click-through per CLAUDE.md.**

---

### A1a — Surface-seam fix (FIRST)

**Goal.** Make every Volt surface (modals, popup menus, inputs, sliders, checkboxes, fieldsets, tags) follow the active theme in both modes **and stay opaque inside floating panels**, and kill the dead-code `--color-p-surface-*` bug.

**Design.** §3b. A2-light derivation in `main.css` (sourcing the new float-immune `--color-surface-solid-*` tokens) + the generator key-prefix fix as the core PR; A2-full Volt `:pt` rewrite as a scope-gated fast-follow in the same PR if time allows (Open Decision 1).

**Files to change.**

- `src/modules/themes/generate.ts:~196` — emit `--color-surface-solid-raised` / `--color-surface-solid-overlay` (opaque, same OKLCH solve as `-raised`/`-overlay`). `:293-326,373` — change the emitted prefix from dead `--color-p-surface-` to nothing (rely on `main.css` derivation); delete the dead `pSurfaceColors` spread. Update the comment block.
- `src/assets/styles/main.css:57-69` — replace the `--p-surface-*` literals with a pinned rung→role table referencing the **float-immune** surface tokens + foreground tokens (confirm against a `grep "surface-\d" src/volt/*` audit first):

  | Rung          | Volt role                | Maps to                                                  |
  | ------------- | ------------------------ | -------------------------------------------------------- |
  | `-0`          | dialog/menu body (light) | `--color-surface-solid-raised`                           |
  | `-50`         | app field bg             | `--color-surface-solid-raised` (or a solid base variant) |
  | `-100`        | hover                    | `--color-surface-solid-overlay`                          |
  | `-200`        | borders                  | `--color-border-default`                                 |
  | `-300`        | strong border            | `--color-border-strong`                                  |
  | `-400`        | icon                     | `--color-text-tertiary`                                  |
  | `-500`/`-600` | submenu label            | `--color-text-secondary`                                 |
  | `-700`        | body text on light       | `--color-text-primary`                                   |
  | `-800`        | menu popup (dark)        | `--color-surface-solid-raised`                           |
  | `-900`        | dialog body (dark)       | `--color-surface-solid-overlay`                          |
  | `-950`        | deep sunken              | `--color-surface-solid-overlay`                          |

  (No rung maps to the four float-transparent app tokens.)

- `src/modules/themes/knownTokens.ts:172-192` — **do NOT drop** the 12 `--color-p-surface-*` names yet (they gate import validation; dropping them before the v2 import upcast lands breaks v1-export imports — critique #blocker-import-ordering, §3j). Mark them accepted-but-ignored; add the new `--color-surface-solid-*` names.
- `src/volt/*.vue` (A2-full) — `Dialog.vue:71-75`, `Menu.vue:31-56`, `Checkbox.vue`, `Slider.vue`, `InputText.vue`, `Textarea.vue`, `Fieldset.vue`, `DataView.vue`, `Tag.vue`, `SecondaryButton.vue`: replace `bg-surface-0 dark:bg-surface-900` → `bg-[var(--color-surface-solid-overlay)]`, etc.; delete every `dark:` surface variant.
- `tokens.css:170-186` — keep the dead `--color-p-surface-*` block as a deprecated no-op alias for one release; add `--color-surface-solid-*` defaults (and dark overrides) **outside** the float-transparency selector.
- `dockview.css:93-97` — no change required (the `-solid-*` tokens are intentionally absent from this block, so they stay opaque inside floats). Add a comment cross-referencing the seam fix.
- `generate.spec.ts:42-58`, `tests/unit/docs/theme-schema-for-llms.spec.ts` — replace p-surface emission assertions; **add a runtime computed-style assertion** that overriding the theme moves a Volt dialog's background.
- `docs/design-tokens.md:69`, `docs/theme-schema-for-llms.md`, `docs/contributing-ui.md` — correct the variable name; document the **three** traps from §3b (`@theme inline` inlining, the two `--color-surface-*` families, float transparency).

**Data/token/generation changes.** No theme-data change; the derivation lives in `main.css`. New `--color-surface-solid-*` keys (additive). Generation emits fewer dead keys.

**Migration.** Built-ins healed for free. Old `--color-p-surface-*` keys become harmless no-ops; import still accepts them (names retained, §3j). **No schema bump in A1a unless the v2 model is folded here** (Open Decision 8).

**Verification.**

- Stage 1 (Playwright-MCP): for each of the 6 built-ins + one generated theme, open a Volt `Dialog` and `Menu`, assert computed `background-color` of the body equals the resolved `--color-surface-solid-overlay`/`-raised`; toggle dark, re-assert; override the surface token live and assert the menu recolors. **NEW MANDATORY assertion (critique #1):** open a Volt `Dialog` and `Menu` **from inside a floating panel** and assert computed `background-color` is opaque (not `rgba(…, 0)` / `transparent`). Screenshots at `.verification-screenshots/<branch>/{builtin-dark-dialog, generated-menu, override-live, float-dialog-opaque}.png`. Console error/warning counts = 0. Verify a pop-out Volt dialog recolors off the copied stylesheet.
- Stage 2 (human): does the dialog read as "same app" as the panel body? Mid-ramp icon/text contrast preserved across all 6 built-ins? Any rung that miscolors a fill? Float dialogs legible over bright imagery?

**Risks.** Rung-mapping regression (build the rung→role table from a full `grep` first — highest risk); the three documented traps; float dialog legibility (covered by the new opaque assertion); low-contrast custom surfaces (mitigated since Volt text pins to contrast-solved `--color-text-primary`).

---

### A1a.5 — v2 data model + schema/DB bump (keystone)

**Goal.** Land the `base + overrides + mandatory cache` model, `THEME_SCHEMA_VERSION` 1→2, `DB_VERSION` 2→3, the `resolve()` materializer, and the full migration — as a **standalone PR** so the CSS-only seam fix and the data migration are reviewed/reverted independently (Open Decision 8).

**Design.** §3a, §3h, §3i, and §5 in full.

**Files to change.**

- `src/types/theme.ts` — v2 `Theme`, `ThemeBase`, `GenerationInputV2`, `ENGINE_VERSION`, `THEME_SCHEMA_VERSION = 2`.
- **New** `src/modules/themes/resolve.ts` — memoized `resolve()` keyed on `${ENGINE_VERSION}:${JSON.stringify(base.input)}`.
- `src/modules/storage/db.ts` — `DB_VERSION = 3` (`:9`); `upgrade` branch `oldVersion < 3` (§5 item 2), idempotent + skip-and-log; **tolerate a missing `base` on read** (treat as `static` legacy) rather than strip it, closing the downgrade-write hazard (critique #blocker-DB).
- `src/modules/themes/builtin.ts:39-45` — wrap normalized token bag as `base:{kind:"static",tokens}`, `overrides:{}`, `tokens` cache = base (load-time synthesis, no JSON edits).
- `src/repositories/themeRepo.ts:50-123` — invariants per §5 item 4 (sparse-override key validation; `base.kind` shape; exactly-one-of generated-input/static-tokens; **mandatory non-empty `tokens` cache** per §3h). `create`/`update` call `resolve()` **after** `assertValid`.
- `src/modules/themes/import.ts:90-100` — relax "reject non-current" to "accept 1 and 2, upcast 1"; **upcast BEFORE validate** (§3j).
- `src/modules/themes/portableSchema.ts` — v2 schema (`base`, `overrides`, mandatory `tokens`); embed the resolved cache in `PortableTheme` for cross-app rendering (Open Decision 7).
- `src/composables/useTheme.ts` — read `theme.paired` (moved off `generation`); keep anti-FOUC reading the cache only (§3h).
- `tests` — migration round-trip tests incl. the **downgrade-write survival** test (open at v3, write, reopen at v2 build, assert `base`/`overrides` survive — critique #blocker-DB) and the **engine-stability** test (§3i).

**Migration.** The full §5 strategy. **Audit item:** confirm `src/utils/storage.ts` (the second IndexedDB, `DB_VERSION=1`) holds no theme data (it does not) and record that in the PR.

**Verification.** Stage 1: upgrade a fixture DB of v1 records (generated + imported + built-in-shaped), assert every record renders pixel-identical post-upgrade (resolved cache matches stored tokens); import a real v1 `.commandvue-theme.json` (with `--color-p-surface-*` keys) and assert it succeeds (upcast-before-validate); reload with a generated custom theme active and assert **no unthemed first-paint frame** (§3h). Console counts = 0.

---

### A1b — Status / toast color unlock

**Goal.** Make success/danger/warning/info hue-tunable, give toasts and tags severity coloring that follows the theme, with **byte-identical status tokens** when overrides are unset.

**Design.** §3c. Hue-only Tier 1 ships here; Tier 2 defers to A2b. Toast/status-border defaults live in `tokens.css` (single source); the generator emits them only when an override is present.

**Files to change.**

- `src/types/theme.ts` — `StatusFamilyOverride`, `StatusOverrides`; thread `statusHues`/`statusOverrides` into `GenerationInputV2`.
- `src/modules/themes/generate.ts` — `:40-53` accept `statusOverrides`; `:166` keep `STATUS_HUES` as defaults (`const hues = { ...STATUS_HUES, ...input.statusHues }`); `resolveStatusFamily(name, defaultHue)` consumed by `:253-259, 352-359`; **when an override is present** also emit `--color-status-{s}-border` + the per-severity toast keys; regenerate the 4 compat aliases from the **same resolved value**; thread `statusOverrides` into `generatePairedVariant` (`:444-457`).
- `src/modules/themes/knownTokens.ts` — append status-border + toast token names to the allowlist.
- `src/assets/styles/tokens.css` — add the toast block + status-border defaults as `var()` chains off existing status/surface tokens, in `:root` and (only if needed) dark; these cover built-ins and unset-override generated themes (single source, §3c).
- `src/volt/Tag.vue:24-34` — replace **all four** severity literals (`green-100`/`sky-100`/`orange-100`/`red-100` — note `sky`/`orange` are off-palette today, so this also removes a latent off-theme bug, critique #minor-Tag) with `--color-status-*` + `-subtle` + `-border` per severity.
- `src/components/ui/Toast.vue:25-41` — `:pt` severity map: left stripe `border-l-4` colored by `--color-status-{severity}`, bg from `-subtle`, fg from `--color-toast-{severity}-fg`; neutral fallback `--color-toast-bg/-fg`. **Context7-verify** the PrimeVue 4 Toast `message` PT severity surface before wiring.
- `src/modules/themes/portableSchema.ts` — extend the v2 generation schema with `statusOverrides` (per-family `{ hue?: 0-360, color?, subtle? }`).
- `ThemeCustomizerDialog.vue` (transitional) — thread `statusOverrides`, pre-fill from `base.input.statusOverrides`; minimal 4-swatch "Status colors" row for the visible A1b win (Open Decision 6).
- `docs/theme-schema-for-llms.md` + guard test — add a "Toast (optional)" + status-border section; soften rule 4 to "you MAY shift status hues, keep them in their semantic families."

**Migration.** **Byte-identical status guarantee:** `resolveStatusFamily` with no override calls exactly `css(status(STATUS_HUES.x))`/`css(statusSubtle(STATUS_HUES.x))`. Snapshot test asserts `{}` and `undefined` overrides reproduce today's **status** tokens; the new border/toast keys equal their `tokens.css`-derived defaults. Bump the `generate.spec.ts` token-count bound only for the override-present path. Built-ins: no JSON edits (inherit toast/border via `var()` chains). **Verify a built-in (e.g. `command-center-dark`) renders a colored danger toast** — it has NO generator path, only the `tokens.css` chain (critique #important-byte-identity).

**Verification.** Stage 1: generate a theme with `statusHues.danger` re-pointed; assert `--color-status-danger` hue shifted and `--color-toast-danger-fg` follows; fire one toast per severity, assert computed left-stripe = resolved status color; render a `Tag` of each severity across all 6 built-ins, screenshot-diff; assert no entry in `contrastReport.failures`. Console counts = 0.
Stage 2: severity tags/toasts read correctly in every built-in? `warning:75` vs built-in amber mismatch acceptable (preserve for byte-identity)?

**Risks.** Token-count test bounds; achromatic Tier-2 subtle (fallback to default hue); gamut (normalize every override through `oklch()`/`css()`); PrimeVue PT severity shape (Context7-verify); compat-alias desync (regenerate from resolved value); pop-out built-in toast tokens live in the stylesheet — verify in a pop-out.

---

### A1c — Richer "less-flat" palette

**Goal.** Ship the bevel + tiered colored borders + accent triad as themeable tokens and adopt them on a curated set of surfaces.

**Design.** §3d. All new tokens are foreground-class (border/shadow) to survive float transparency. **Engine-stability (§3i): additive new keys only — no existing key's math changes**, so migrated themes do not recolor.

**Files to change.**

- `src/modules/themes/generate.ts` — after the surface block: emit `--color-surface-bevel-light/-dark` + `--color-border-accent`; after the interactive block: `--color-interactive-glow` (alpha) + `--color-interactive-dim`; composed `--shadow-bevel-raised/-sunken` + `--shadow-accent-glow`.
- `src/assets/styles/tokens.css` — new tokens in the `@theme` semantic block + dark overrides; shadow tokens near existing shadow primitives.
- `src/modules/themes/knownTokens.ts` — allowlist all new keys.
- Component adoption (curated, Open Decision 11): panel headers + cards + primary `Button` get `--shadow-bevel-raised`; active/selected dockview panels use `--color-border-accent` (wire `--dv-paneview-active-outline-color`); focus uses `--shadow-accent-glow`.
- `docs/theme-schema-for-llms.md` + guard test; `generate.spec.ts` — assert new tokens emitted + alpha-glow string gamut-valid.

**Migration.** Built-ins + user themes inherit neutral defaults from `tokens.css`. The §5 diff-into-overrides + §3i additive-only contract guarantee A1c does NOT recolor existing themes (their pre-A1c keys are pinned as overrides or unchanged). Re-saving a generated theme emits the new tokens.

**Verification.** Stage 1: generate a theme, assert bevel/glow/border-accent present and gamut-valid (incl. the `oklch(L C H / a)` alpha string accepted by box-shadow/color-mix); screenshot a card + active panel + focused button across light/dark and **inside a float** (assert the bevel survives the float transparency override); run the §3i engine-stability test. Console counts = 0.
Stage 2: reads "less flat" without looking noisy? Glow tasteful at the chosen alpha? Bevel visible but not heavy at 1px?

**Risks.** Float transparency trap (border/shadow only, never fills); status-hue test regression (defaults identical); alpha tokens through the gamut path (runtime-verify in a pop-out); Tag/Toast visual regression (screenshot-diff all 6 built-ins); contrast report doesn't yet cover bevel/border (scope into A2b advisory chips).

---

### A2a — Theme Studio dockview panel

**Goal.** Move authoring OUT of the modal INTO a floatable, pop-outable singleton panel that live-recolors the main window + every float + every pop-out on every edit, **including when the Studio itself is popped out.**

**Design.** §3e. The single decision that makes live-recolor free: the panel writes draft tokens to the **captured top-window root (`APP_ROOT`)**, never the pop-out child's `document`.

**Files to change.**

- **New** `src/components/panels/ThemeStudioPanel.vue` — `usePanelApi(props)`, reads `params.params.themeToEditId`, consumes `useThemeAuthoring()`, watches the generation result → `applyTokenOverrides(overrides, APP_ROOT)` while live; `onUnmounted` → `clearTokenOverrides(APP_ROOT)`. **Does NOT call `beginPreview` on mount** — only on explicit user action or when opened with a valid `themeToEditId` (closes critique #minor-restore: a restored/blank Studio sits idle). Template = the dialog's inner content re-laid vertically, minus `<Dialog>`/footer chrome.
- **New** `src/composables/useThemeAuthoring.ts` — the ~12 refs + `generationResult`/`contrastReport` computeds + `save`/`updateExisting`/`seedFromTheme`/`loadFrom*`.
- `src/main.ts` — capture `export const APP_ROOT = document.documentElement` at top-realm boot; `app.component('theme-studio', defineAsyncComponent(...))`.
- `src/modules/themes/apply.ts` — `applyTokenOverrides(overrides, root: HTMLElement)` / `clearTokenOverrides(root: HTMLElement)` under `data-theme-preview-applied` (explicit `root`, never ambient `document`); make `applyTheme` clear draft bookkeeping so a real commit wins.
- `src/stores/theme.ts` — `previewDraft` + `beginPreview`/`setPreviewToken`(debounced ~16–32ms)/`resetPreviewToken`/`commitPreview`/`cancelPreview`/`previewResolvedTokens`; commit/cancel use the **additive-first, clear-second** ordering (§3e, no-flash).
- `src/modules/panels/builtin.ts` — append `{ id:'theme-studio', title:'Theme Studio', icon:'palette', category:'tools', singleton:true, component:() => import(...) }`.
- `src/components/layout/MenuBar.vue` — replace `openCustomizer` with `openThemeStudio(edit)`: focus-existing singleton (`api.getPanel('theme-studio')?.api.setActive()`) else `addPanel({ id:'theme-studio', component:'theme-studio', floating:true, params:{ themeToEditId }})`; re-route the picker's per-card Edit/Import (`ThemePickerDialog.vue:384-389`). Guard against the unguarded-spawn race (don't copy ComponentsPanel's pattern).
- `src/composables/usePopoutThemeSync.ts` — **one-line change:** wrap the observer callback in `requestAnimationFrame` coalescing (§3e). Add a comment that the `style` filter already catches `applyTokenOverrides`.
- `ThemeCustomizerDialog.vue` — thin to delegate into `useThemeAuthoring()` for the transition release, or delete (Open Decision 9).
- **Dockview serialization:** ensure a restored Studio panel opens blank (don't persist `themeToEditId`); defensive fallback to "create new" if `themeRegistry.get(id)` is undefined.

**Data/token changes.** No theme-schema change. New ephemeral `data-theme-preview-applied` attribute (never persisted).

**Verification.**

- Stage 1: open Theme Studio, drag the contrast slider, assert opener `<html>` style updates; open a second pop-out, assert **both** opener and pop-out recolor; **pop out the Studio itself**, drag a control, assert the opener + a separate pop-out both update (**HARD GATE** — proves the panel writes `APP_ROOT`, not the child, critique #important-opener-root); cancel, assert instant rollback everywhere; **drag a slider for ~1s with 2 pop-outs open and assert zero frames where a pop-out root has empty `--color-surface-base`** (no-flash, critique #important-mirror-race); reload with Studio open, assert exactly one instance, no preview applied, no console error (critique #minor-restore). Screenshots at named checkpoints. Console counts = 0. **Windowing change → mandatory click-through per CLAUDE.md.**
- Stage 2: live recolor feels instant + stable while dragging? Panel reads well tall-and-narrow? Commit/cancel boundary obvious?

**Risks.** Pop-out realm targeting (mitigated by the explicit-`root` + captured-`APP_ROOT` design; still runtime-verify, highest risk); draft/commit ordering (no-flash ordering above); observer fan-out cost (rAF coalescing); singleton focus-vs-spawn race (guarded); lost modal affordances (clear drafts on unmount); category `tools` is the closest closed-union match (Open Decision 14).

---

### A2b — Per-token editor + advisory WCAG

**Goal.** A searchable, manifest-driven per-token editor as a second Studio tab, writing sparse `overrides` with live advisory WCAG (incl. status/toast pairs).

**Design.** §3f.

**Files to change.**

- **New** `src/modules/themes/tokenManifest.ts` + `tests/unit/modules/themes/tokenManifest.spec.ts` (every `ALL_KNOWN_TOKEN_NAMES` exactly once; **no numeric `--color-surface-N` leaks in**, critique #blocker-namespace).
- **New** `src/components/panels/ThemeTokenEditor.vue` + `ThemeTokenRow.vue` (filter box, `Fieldset` per section, per-kind control, advisory WCAG chip, reset `IconButton`).
- `src/stores/theme.ts` — `setPreviewToken`/`resetPreviewToken` write the sparse `overrides` patch; `commitPreview` resolves patch → cache and persists `overrides`.
- `src/modules/themes/portableSchema.ts` — confirm the editor can set the full `ALL_KNOWN_TOKEN_NAMES` surface minus density/font (Open Decision 4).
- Tier-2 explicit status color (§3c) lands here alongside the WCAG-advisory chips (status/toast pairs included).

**Data/token changes.** No new tokens; surfaces the existing ~90 (minus density/font, §3f). `overrides` becomes user-populated.

**Migration.** None beyond the v2 model. Exclude `DENSITY_TOKEN_NAMES` + `--font-family-*` from the editable set (or mark "pins the cascade").

**Verification.** Stage 1: filter the list, override `--color-surface-raised`, assert the modified-dot appears, the live app + a pop-out recolor, the WCAG chip recomputes against the effective paired value, reset clears the override and the app reverts; override a Tier-2 status color and assert the toast-fg/status-subtle advisory chip computes; commit, reload, assert the override persists and `tokens` cache matches `resolve()`. Console counts = 0.
Stage 2: search fast + grouping legible at ~90 tokens? WCAG chips read as advisory not blocking? Reset affordances discoverable?

**Risks.** Effective-value WCAG must read post-override values (computed off the debounced effective map, memoized per pair); name-clash on "Save as new" (inline error like the customizer's `saveError`); overriding a derived scale token leaves the scale inconsistent (advisory only); density/font override fights the cascade (excluded).

---

### A3 — Themeable duotone icons (LATER)

**Goal.** `--icon-tone-*` tokens + an in-house duotone set for high-traffic chrome + optional leading-icon affordance on controls.

**Design.** §3g. Depends on A2 (the editor gives the tone tokens a home).

**Files to change.**

- `src/modules/themes/generate.ts` + `tokens.css` + `knownTokens.ts` — `--icon-tone-{primary,secondary,accent}` from text/accent.
- **New** `src/assets/icons/duotone/*.svg` (~12 icons) + `src/components/ui/DuotoneIcon.vue` (maps `--icon-tone-*`).
- `ui/Button.vue`, `Select.vue`, `Input.vue`, `Checkbox.vue` — optional leading-icon slot/prop (real API change — Open Decision 10).
- Possible icon-library ADR if an external duotone pack is chosen (Open Decision 13).

**Migration.** Additive tokens (no bump). Existing single-color Lucide icons unchanged.

**Verification.** Stage 1: assert duotone icons recolor with `--icon-tone-*` overrides and mirror to pop-outs. Stage 2: two tones read clearly at small sizes across light/dark?

**Risks.** Asset-pipeline cost; wrapper-API blast radius; ADR needed for a non-locked icon pack.

---

## 5. Migration strategy

**Two independent counters — bump both in the A1a.5 PR: `THEME_SCHEMA_VERSION` 1 → 2 (`src/types/theme.ts:22`) and `DB_VERSION` 2 → 3 (`src/modules/storage/db.ts:9`).** Audit item, recorded in the PR: the **second** IndexedDB at `src/utils/storage.ts` (`DB_VERSION=1`) holds **no** theme data and is out of scope.

1. **The 6 built-in JSONs.** **Load-time synthesis** (no data migration). `builtin.ts` keeps running `normalizeTokens` on the bare-key bag, then wraps it as `base:{kind:"static",tokens:normalized}`, `overrides:{}`, `tokens` cache = base tokens. JSONs stay diff-friendly and preserve their slate/teal/violet primitive refs byte-for-byte.

2. **User themes in IndexedDB (`custom-themes`).** A `db.ts` `upgrade` branch `oldVersion < 3`, idempotent and skip-and-log tolerant (mirroring the `VersionError` handling at `db.ts:126-127`):
   - `source==="generated"` with a `generation` block → `base={kind:"generated",input:{baseColor,accentColor,contrast,mode,density, fontFamily: <undefined unless --font-family-body present, §3i>, statusHues: STATUS_HUES}}`, move `generation.paired` → `theme.paired`.
   - **The single most important migration decision (Open Decision 2):** set `overrides` = the **diff** between the stored `tokens` and `generateTheme(input).tokens`, so every existing theme renders **pixel-identical** post-upgrade and only changes when the user re-edits. Combined with the **additive-only engine-stability contract (§3i)** and `ENGINE_VERSION`-keyed memoization, this neutralizes A1c's engine change for existing themes — _provably_, via the §3i regression test.
   - `source==="imported"`/`"user"` without `generation` → `base={kind:"static",tokens:record.tokens}`, `overrides={}`. Preserved verbatim.
   - Drop the old `generation` field after copying. Populate the `tokens` cache (mandatory, §3h).
   - `resolve()` on a `generated` base calls `generateTheme`, which throws on unparseable colors — wrap in try/catch and skip-and-log the record, never an uncaught throw.

3. **Exported `.commandvue-theme.json` files in the wild (v1).** `importThemeFromJson` gains a v1→v2 upcast running the **same per-record transform** as #2, **before** Zod-v2 + repo validation (upcast-before-validate, critique #blocker-import-ordering). Relax `import.ts:90-100` from "reject non-current" to "accept 1 and 2, upcast 1." The v1 `--color-p-surface-*` keys are stripped during upcast; because A1a retained those names in `knownTokens` (§3j), an import landing in the window between A1a and A1a.5 still validates. **Embed the resolved `tokens` cache** in `PortableTheme` so a downstream fork with a divergent `generateTheme` renders the original (static fallback) — Open Decision 7.

4. **Repo invariants (`themeRepo.ts:50-123`).** Invariant 4 validates keys of the sparse `overrides` (not full `tokens`); invariant 8 → "if `base.kind==='generated'`, `base.input` is shaped (baseColor/accentColor/contrast 30-100)"; invariant 9 "exactly one of generated-input / static-tokens per `base.kind`"; **invariant 10 (new, §3h): `tokens` cache is present and non-empty.** `create`/`update` call `resolve()` **after** `assertValid` to populate the cache. **Downgrade-write tolerance (critique #blocker-DB):** a record missing `base` (written by an old build that didn't understand v2) is treated as `static` legacy on read, never stripped; a regression test opens at v3, writes, reopens at a v2 build, and asserts `base`/`overrides` survive the round-trip.

5. **LLM doc.** Keep advertising a **flat sparse-token contract** mapping to `base:{kind:"static"}` + empty `overrides` — LLM-authored themes stay as simple as today. Document `base.input` for the generated path as reference only. The guard test (`theme-schema-for-llms.spec.ts`), `generate.spec`, `portable.spec`, `themeRepo.spec` all assert the v1 shape and must be updated in the A1a.5 PR.

**Backward-compat.** A v2 Theme is a strict superset of v1 (adds `base`+`overrides`, keeps the mandatory `tokens` cache), so `apply.ts`/`export.ts`/`usePopoutThemeSync`/`ThemePickerDialog` keep reading `theme.tokens` through the transition. The downgrade-write hazard (old build after the v3 upgrade) is now **contained**: invariants tolerate a missing `base` rather than strip it, and the round-trip test gates that behavior.

---

## 6. Sequencing + dependencies

```
A1a  Surface seam ──► A1a.5  v2 model + schema/DB bump ──► A1b  Status/toast ──► A1c  Richer palette
 (CSS-only,                  (keystone: base+overrides,         (after v2 model)      (after v2 model;
  float-immune)               mandatory cache, migration,                             additive-only,
                              engine-stability contract)                              §3i)
                                          │
                                          ▼
                                 A2a  Theme Studio panel ──► A2b  Per-token editor
                                 (depends on A1a + Track B)   (tab in A2a; writes overrides)
                                          │
                                          ▼
                                 A3  Duotone icons (later; depends on A2)
```

**Order and rationale.**

- **A1a is first** — highest-leverage fast visible win (heals the seam for all 6 built-ins with zero theme-data changes), fixes a verified dead-code bug, smallest blast radius, and is the precondition for A2's "recolor every window" demo looking convincing. The float-immunity fix is mandatory in A1a (critique #1).
- **A1a.5 (the v2 model) is the keystone** and a **standalone PR** (Open Decision 8) so the CSS-only seam fix and the higher-risk schema/DB migration are reviewed/reverted independently. It must land **before A1b** (so `statusHues`/`statusOverrides` have a home in `base.input`, avoiding a second bump) and **before A1c** (so diff-into-overrides + §3i neutralize the engine change).
- **A1b before A1c** — smaller, higher visible payoff (colored tags/toasts).
- **A2a depends on A1a** (un-fixed Volt surfaces would look broken) and on Track B (shipped). **A2b depends on A2a** + the v2 model.
- **A3 depends on A2** and is explicitly deferred.

---

## 7. Open decisions for the maintainer

1. **A1a scope — A2-light only, or +A2-full Volt rewrite?** — _Recommended: A2-light (derivation + generator fix + `-solid-_`tokens) in A1a; A2-full Volt`:pt` rewrite as a fast-follow. The derivation is the safety net; the Volt rewrite is the true fix but higher churn.\*
2. **Diff-into-overrides on upgrade — pixel-identical or live-against-engine?** — _Recommended: diff-into-overrides (non-surprising upgrade), backed by the §3i additive-only contract. Document that generated themes are otherwise "live" against the engine._
3. **Keep the resolved `tokens` cache long-term, or remove after transition?** Note: §3h makes it **mandatory and load-bearing for first paint**, so "remove" is off the table for the active-theme path. — _Recommended: keep permanently; it is required for anti-FOUC, not a transitional convenience._
4. **Status overrides in A1b — hue-only, or hue + explicit color?** — _Recommended: hue-only Tier 1 in A1b; explicit Tier 2 color in A2b with the WCAG-advisory editor._
5. **Toast coupling — derived from status, or independently overridable?** — _Recommended: derived in A1b; add a `toast?` override block later only if a brand wants neutral toasts with colored status badges._
6. **A1b customizer UX — plumb-only, or a 4-swatch "Status colors" row now?** — _Recommended: a minimal 4-swatch row, to deliver the visible A1 win._
7. **PortableTheme cross-app contract — embed the resolved `tokens` alongside sparse `base`+`overrides`?** — _Recommended: yes, embed the cache so a fork with a divergent engine still renders the original._
8. **Where does the v2 model land — folded into A1a, or a standalone A1a.5 PR?** — _Recommended: standalone A1a.5 immediately after A1a (this spec assumes A1a.5), so the seam fix and the schema/DB migration are reviewed/reverted independently._
9. **A2a modal cutover — hard delete, or one-release overlap?** — _Recommended: thin the dialog to delegate into `useThemeAuthoring()` for one transition release, then delete._
10. **"Icon on every control" — hard requirement or chrome-only aesthetic?** — _Recommended: chrome-only in A3's first cut; promote to a control-API change only after the duotone token model proves out._
11. **Bevel adoption list (A1c).** — _Recommended: the curated three (panel headers + cards + primary buttons); expand after a Stage-2 review._
12. **Accent-triad naming — `--color-interactive-glow/-dim` or a parallel `--color-accent-glow/-dim`?** — _Recommended: `interactive-_` (stays in the semantic vocabulary the wrappers already read).\*
13. **Duotone icons — in-house SVG set or external pack (Phosphor duotone)?** — _Recommended: in-house ~12-icon set, no ADR needed, full token control._
14. **Panel category — accept `tools`, or add a `settings` category to the closed `PanelCategory` union?** — _Recommended: accept `tools`._
15. **Studio panel — singleton, or multiple drafts side-by-side?** — _Recommended: singleton + focus-existing (multiple instances break the single-root live-apply model)._
16. **Float-immune surface tokens — new `--color-surface-solid-*` pair, or re-point `--p-surface-*` back to opaque inside `.dv-groupview-floating`?** (The two routes the critique named for closing the float regression.) — _Recommended: new `--color-surface-solid-_`tokens (explicit, theme-driven, one source) over a second`.dv-groupview-floating` override block (which would re-introduce a mode/float coupling the seam fix is trying to remove).\*
17. **Engine-stability contract enforcement — by convention + the §3i regression test, or by a CI guard that snapshots every emitted key's value across a fixed input set?** — _Recommended: both; the snapshot guard makes an accidental math change a red CI, not a silent recolor._
