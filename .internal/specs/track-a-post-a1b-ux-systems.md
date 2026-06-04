The critique's central claim is confirmed: `THEME_SCHEMA_VERSION = 1`, `DB_VERSION = 2`, and `statusOverrides` is bolted onto the v1 `ThemeGenerationMeta` (line 88) — A1b shipped without A1a.5, inverting the keystone ordering. I also confirmed the inventory drift: line 68 says Toast position default `top-right` while the code defaults to `bottom-right`. Both fixes will be folded in. I have enough grounding to produce the final spec.

# Track A — Post-A1b UX Systems Planning Spec

**Theme-modal tab segregation · Toast/notification system · Component showcase panel**

---

## Status / context

This is forward planning for the **next wave of Track A UX systems**, picking up after the theming-overhaul keystone work. **A1a** (surface-seam fix, float-immune `--color-surface-solid-*` tokens) and **A1b** (status/toast unlock — hue-tunable status families, themed `Tag`, themed `Toast`) are **merged**. The authoritative plan remains `.internal/specs/track-a-theming.md`; this document slots three maintainer-driven asks into that spine without minting a parallel track:

1. **"Segregate the Create-Theme modal into tabs"** — status colors + hues, typography per role, background/modal colors, "more categories" instead of one long scroll.
2. **"Finish the toast loop"** — the themed `Toast.vue` outlet is orphaned (no service, no mount, no producer); make notifications actually appear, multi-position.
3. **"A component showcase/playground panel"** — one surface that renders every UI primitive so theme + behavior changes are visible and testable in one place.

The reconciliation stance, derived from the grounding analysis: **tab-segregation is absorbed into A2a/A2b (no new phase); toast and showcase become two small new phases inserted into the Track A spine, ordered toast → showcase.** All three respect the locked stack — PrimeVue (unstyled) + Volt + Tailwind v4, Dockview panels, Pinia, and ADR-0004's single-source `--color-*` tokens. No non-PrimeVue UI libraries are introduced.

### Keystone-ordering reconciliation (read before sequencing — the critique's blocking finding)

The authoritative spec (`.internal/specs/track-a-theming.md:463`) mandated that **A1a.5 land _before_ A1b**, so `statusHues`/`statusOverrides` would have a home in `base.input` and a second schema bump would be avoided. **Shipped reality inverted this.** Verified against the live tree on 2026-06-03:

- `src/types/theme.ts:22` — `THEME_SCHEMA_VERSION = 1` (still v1; A1a.5's 1→2 bump never landed).
- `src/modules/storage/db.ts:9` — `DB_VERSION = 2` (still v2; A1a.5's 2→3 bump never landed).
- `src/types/theme.ts:88` — `statusOverrides?: StatusOverrides` is **bolted onto the v1 `ThemeGenerationMeta`** (with `schemaVersion: 1`), exactly the "second bump" the parent spec tried to avoid.

**Consequence this spec now owns:** A1a.5 is no longer a clean greenfield keystone. Its migration must **retroactively upcast already-shipped v1 generated themes that carry `statusOverrides`** into the v2 `base`+`overrides` model — folding the bolted-on `generation.statusOverrides` into `base.input.statusHues` (Tier-1 hue) and/or `overrides` (Tier-2 explicit `color`/`subtle`) as appropriate, idempotently and without dropping any persisted family. This is added to A1a.5's scope and file list below (§4). Every downstream claim that "A1a.5 precedes A1c so diff-into-overrides neutralizes the engine change" remains valid for A1c; what changes is that A1a.5 now carries **A1b-created migration debt**, and the planning framing is no longer "clean keystone, then build forward" but "**reconciling keystone** that absorbs the v1 statusOverrides that already shipped." The sequencing table and risks reflect this.

---

## 1. Theme-modal tab segregation

### Current modal inputs

The authoring surface today is a single flat `<Dialog modal>` at `src/components/dialogs/ThemeCustomizerDialog.vue` (width `72rem`): a two-column grid — a left **Inputs** column and a right **Live preview + Contrast report** column — with a "Start from" segmented row across the top and a Cancel / Save / Update footer. Every input lives on one scroll with **no segmentation**:

| Input             | Control                                                                           | Notes                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Name (required)   | `ui/Input`                                                                        | identity                                                                                                                    |
| Description       | `ui/Input`                                                                        | optional                                                                                                                    |
| Start-from        | 3 `ui/Button` toggles (Blank / Built-in / Custom) + conditional `ui/Select`       | from `themeRegistry.listBuiltIn()` / `listGenerated()`                                                                      |
| Mode              | 2-button segmented radiogroup                                                     | Light / Dark                                                                                                                |
| Base color        | `ui/ColorSwatchPicker` over `BASE_COLOR_SWATCHES` + hex readout                   |                                                                                                                             |
| Accent color      | `ColorSwatchPicker` over `ACCENT_COLOR_SWATCHES` + hex readout                    |                                                                                                                             |
| Status hues (A1b) | four `ColorSwatchPicker` rows (success/warning/danger/info), `allow-custom=false` | `statusOverrides` computes `undefined` when all byte-identical to default                                                   |
| Contrast          | `volt/Slider` (min 30, max 100, step 1) + readout                                 |                                                                                                                             |
| Density           | 3-button segmented radiogroup                                                     | Compact / Comfortable / Spacious                                                                                            |
| Font family       | `ui/Select` over `CURATED_FONTS`                                                  |                                                                                                                             |
| Paired variant    | `volt/Checkbox` "Generate paired Dark/Light variant"                              |                                                                                                                             |
| Apply after save  | `volt/Checkbox`                                                                   |                                                                                                                             |
| Live preview      | scoped `<div :style data-density data-theme-preview>`                             | fake menubar + telemetry rows + sample buttons + status badges + text hierarchy; **writes to a scoped div, never `<html>`** |
| Contrast report   | text/surface, text/raised, on-interactive ratios + AA pass/fail + failures list   | from `generationResult.contrastReport`                                                                                      |

`generationResult` is a **single computed over all refs** (calls `generateTheme()`); the contrast report is likewise global. The dialog is dual-mounted — from `MenuBar.vue` (`openCustomizer`) and `ThemePickerDialog.vue` (`customizerOpen`). The token vocabulary any per-token tab would expose already lives, naturally grouped, in `src/modules/themes/knownTokens.ts` (SEMANTIC / COMPONENT / DENSITY / THEMEABLE_PRIMITIVE). A wrapped `ui/Tabs` (over PrimeVue Tabs/TabList/Tab/TabPanels, flat `{ tabs: {id,label,disabled}[], modelValue }` API) already exists at `src/components/ui/Tabs.vue`.

### Proposed tab taxonomy and input placement

The tab structure becomes the **information architecture of the A2a Theme Studio panel's "Generate" surface**, reusing `src/components/ui/Tabs.vue` (the locked PrimeVue Tabs wrapper; PrimeVue 4 Tabs supports `scrollable` for narrow form factors — Context7-verify before relying on it). Six tabs:

1. **Foundation** — Mode, Density, Contrast slider. (Global-shape knobs.)
2. **Palette** — Base color, Accent color (existing `ColorSwatchPicker`s). _New:_ per-accent triad preview (`--color-interactive-glow` / `-dim`, A1c) and the curated base/accent custom "+".
3. **Status & Feedback** — the four A1b status-hue rows (move verbatim). _New:_ Tier-2 explicit status `{color, subtle}` escape valves (A2b) and a Toast preview swatch row (`--color-toast-*-bg/-fg`, A1b). This is the maintainer's "status colors + hues" tab.
4. **Typography** — Font family (move from current `Select`). _New (deferrable):_ role-based stacks — body vs mono vs heading/display, mapping `--font-family-body/-sans/-mono`.
5. **Surfaces & Chrome** — _New:_ background/surface tier swatches (`--color-surface-base/-raised/-overlay/-sunken` + the A1a float-immune `--color-surface-solid-*`) and modal/dialog colors (`--dialog-bg/-border/-shadow`, `--menubar-*`, `--statusbar-*`). The maintainer's "background/surface + modal/dialog colors" tab. **See the editability caveat below — this tab is read-only-preview in A2a and only becomes editable in A2b.**
6. **Effects & Borders (A1c)** — border tiers (`--color-border-subtle/-default/-strong/-accent`), bevel (`--color-surface-bevel-*`, `--shadow-bevel-*`), accent glow (`--shadow-accent-glow`), radii (`--radius-*`), focus ring.

> **Maintainer refinement (2026-06-04, after the A2a panel shipped) — COMMON CONTROLS PIN ON TOP, OUTSIDE THE TABS.** Start-from, Name, and Description are **not** tab content: they apply to the whole theme and must live in a common band pinned **above** the L1 tab strip (and above the preview), always visible from any tab. Only the per-section knobs (Mode/Density/Contrast, Palette, Status, …) go inside tabs. The A2a panel already ships this band — the header, then a common Start-from / Name / Description section, then the resizable controls │ preview `Splitter`, then the footer. When the L1 Generate/Tokens tabs land (A2b), they slot into the **controls** pane only; the common band, the preview pane, and the Discard/Save footer stay outside the tabs. (So tab 1 "Foundation" above drops Name/Description/Start-from — those are common, not Foundation-tab content.)

> **Editability caveat for the maintainer (ask 1 deferral — surfaced prominently per critique).** The maintainer's literal request was an **editable** "background/surface + modal/dialog colors" tab. In **A2a**, the Surfaces & Chrome tab and the Effects & Borders tab render **read-only derived previews** — they show the colors the engine produces from the high-level Foundation/Palette/Status inputs, but you cannot pin an individual surface/dialog token there. **Per-token editing of those surfaces is delivered in A2b's Tokens tab, two phases out.** If the maintainer needs an editable backgrounds/modal tab sooner than A2b, that is a scope-pull decision (Open Decision 24) — it cannot be honestly satisfied inside the curated Generate surface, because per-token control is by definition the A2b manifest editor's job.

**Persistent rail — the key UX move.** The Live Preview + Contrast Report do **not** live inside any tab. The two-region layout is preserved: tabs occupy the input region; the preview + contrast report stay pinned in the opposite region so they remain visible regardless of active tab. Because `generationResult` is one computed over all refs, it already updates live across tab switches with **zero per-tab wiring**.

### Relationship to A2a (Theme Studio panel)

A2a lifts these refs into `useThemeAuthoring()`; the panel template is, per the spec, "the dialog's inner content re-laid vertically." **The tab segregation IS that re-lay.** Two layers of tabs result:

- **L1 (top-level authoring mode):** "Generate" (curated high-level inputs that exist today) vs "Tokens" (the A2b manifest per-token editor).
- **L2 (within Generate):** the six section tabs above (Foundation / Palette / Status & Feedback / Typography / Surfaces & Chrome / Effects & Borders). **A2a ships the L1 "Generate" tab populated with all six L2 section tabs — not a single flat Generate surface.** (This resolves the §1/§4 wording ambiguity the critique flagged: "the Generate tab" in the sequencing table is shorthand for the L1 Generate _container_, which itself holds the six L2 sub-tabs.)
- **L2 (within Tokens):** section groupings, driven by the `section` field on each `tokenManifest.ts` entry ("Surfaces, Borders, Text, Interactive, Status, Focus, Accent scale, …").

**The `section` field is the single source for both vocabularies.** The six Generate-tab labels and the Tokens-tab section groupings must both derive from the manifest's `section` taxonomy (or a shared constant that both the curated Generate labels and the manifest reference) — otherwise the two surfaces drift apart. `tokenManifest.spec` asserts exactly-one-section per token; the Generate tabs reuse those same section labels.

Inside the A2b Tokens tab, sections become collapsible `volt/Fieldset`s with a fuzzysort filter (`IconField` + `InputIcon` + `InputText`), advisory WCAG chips attaching per-token via the manifest's `contrastAgainst`. Because A2a previews into the **real** `<html>` via `applyTokenOverrides(overrides, APP_ROOT)`, the scoped-div mockup shrinks to a minimal confirmation swatch — freeing rail space for the tabs. A2a routes Mode through `bridgeVariant` (never writing `data-theme` directly), so Mode staying on the Foundation tab is compatible.

**The decisive recommendation: do not tab-segregate the soon-to-be-thinned `<Dialog modal>` as a standalone deliverable.** Per Open Decision 9 (thin-then-delete the dialog), pre-A2a modal tab work has near-zero reuse and fights the live-recolor design. If the maintainer wants a visible win sooner, the only honest option is a **transitional, pure-presentational `ui/Tabs` reorg of today's existing refs** (Foundation / Palette / Status / Typography), explicitly flagged as throwaway, which `useThemeAuthoring()` later absorbs unchanged. **This spec recommends _defer_ (no transitional artifact); the throwaway path is offered only because the maintainer asked for it, and Open Decision 1 forces an explicit choice rather than leaving both live.**

### Files affected

- `src/components/dialogs/ThemeCustomizerDialog.vue` — restructure inputs into `ui/Tabs` panels; keep preview + contrast report outside the tabs (transitional only, per Open Decision 9).
- `src/components/ui/Tabs.vue` — reuse as-is; verify `scrollable` PT passthrough if 6+ tabs overflow the narrow Studio panel.
- `src/composables/useThemeAuthoring.ts` _(NEW, A2a)_ — the ~12 refs + `generationResult`/`contrastReport` computeds the tabs bind to.
- `src/components/panels/ThemeStudioPanel.vue` _(NEW, A2a)_ — hosts L1 Generate/Tokens tabs; Generate holds the six L2 section tabs; final form of the IA.
- `src/components/panels/ThemeTokenEditor.vue` + `ThemeTokenRow.vue` _(NEW, A2b)_ — the Tokens tab; sections from the manifest.
- `src/modules/themes/tokenManifest.ts` _(NEW, A2b)_ — its `section` field is the shared taxonomy for both Generate L2 labels and Tokens sections; one entry per `ALL_KNOWN_TOKEN_NAMES`.
- `src/modules/themes/knownTokens.ts` _(read-only reference)_ — already the grouped source of truth.
- `src/modules/themes/curated-swatches.ts` _(read-only)_ — `BASE`/`ACCENT`/`STATUS` swatches + `CURATED_FONTS` feed the Palette/Status/Typography tabs.
- `src/components/layout/MenuBar.vue` — `openCustomizer` wiring becomes `openThemeStudio`.
- `src/components/dialogs/ThemePickerDialog.vue` — second mount; re-routes to Studio.
- `tests/unit/modules/themes/tokenManifest.spec.ts` _(NEW, A2b)_ — every token maps to exactly one section/tab; asserts the Generate L2 labels are a subset of the manifest `section` values (drift guard).

### Risks

- **Double-cutover churn.** Tabbing the modal now, then re-laying the same tabs vertically into A2a, is two UX migrations. _Mitigation:_ do the segregation directly in A2a's `useThemeAuthoring()`/panel, or scope any pre-A2a version to a pure presentational re-org the composable absorbs unchanged. _(The internally-hedged recommend-defer-but-keep-throwaway-alive tension the critique flagged is resolved at Open Decision 1: recommendation is defer; the transitional path ships only on explicit maintainer override.)_
- **Preview/contrast visibility regression.** If preview goes inside a tab panel it disappears on tab switch. _Hard requirement:_ preview + contrast report stay in a region **outside** `ui/Tabs`; they already bind one global computed, so no rewiring is needed.
- **Tab overflow in the tall-narrow Studio panel.** Six horizontal tabs will not fit a popped-out narrow panel. _Mitigation:_ PrimeVue Tabs `scrollable` (verify the wrapper passes it through) or a vertical tab rail for the panel form factor.
- **Taxonomy drift** between Generate-tab grouping and the A2b manifest `section` field. _Mitigation:_ both derive from one source; `tokenManifest.spec` asserts exactly-one-section per token and that Generate L2 labels ⊆ manifest sections.
- **Cascade fights.** Density and `--font-family-*` exposed as inline-override controls beat the `data-density` attribute (spec §3f excludes `DENSITY_TOKEN_NAMES` + `--font-family-*` from the editable manifest). The Typography tab must drive font family through the **generation input**, not a raw token override.
- **Library-first compliance.** Tabs must use `ui/Tabs`, section groups `volt/Fieldset`, filter `IconField`/`InputIcon`/`InputText` — a from-scratch segmented control violates CLAUDE.md.
- **Scope creep into A2b.** "Background/surface + modal/dialog colors" and "more categories" imply per-token editing (A2b territory). Keep the Generate tabs to curated high-level inputs; route true per-token control into the A2b Tokens tab. **Surfaced to the maintainer as the ask-1 deferral above.**

### Open questions

- Ship as a scoped pre-A2a presentational refactor (fast, throwaway), or land only inside A2a's vertical panel (one cutover, no throwaway)? Open Decision 9 leans defer.
- Two-level tabs (L1 Generate/Tokens, L2 sections) vs a single flat strip mixing curated + per-token controls?
- Tab orientation in the Studio panel: horizontal scrollable vs a vertical rail for the tall-narrow form factor.
- Exact tab count/labels: the proposed six (Foundation, Palette, Status & Feedback, Typography, Surfaces & Chrome, Effects & Borders) vs a tighter four (Foundation, Color, Typography, Advanced)?
- Does Typography take on role-based stacks (body/mono/heading) now, or stay single-font until the deferred role-based font extension lands?
- Persistent preview: keep the scoped-div mockup, or shrink to a confirmation swatch once A2a recolors the whole app live?
- Where do Mode and Density live — Foundation tab, or a separate "Layout" tab?
- Editable backgrounds/modal tab in A2a (scope-pull from A2b), or accept view-only until A2b (recommended)?

---

## 2. Toast / notification system

### Current orphan state

The toast outlet is orphaned **end-to-end**:

- `src/components/ui/Toast.vue` (41 lines) wraps `primevue/toast` (`PvToast`) with a `:pt` that paints each message from the `--color-toast-*` tokens via `toastMessageClass(severity)` in `src/components/ui/toastTheme.ts` (severity map success/info/warn/error → neutral fallback; **A1b complete, single-source-clean**). The wrapper declares **only** a `position` prop (defaults `bottom-right`) and does **not** forward `group` — despite `docs/audits/ui-wrappers-inventory.md` claiming `position, group`.
- **Nothing mounts `<Toast>`.** `src/components/layout/AppShell.vue` renders ChromeBar/CommandPalette/ConfirmDialog/SaveLayoutAsDialog but no Toast outlet.
- `src/main.ts` registers `app.use(PrimeVue, { unstyled: true })` and Pinia/router but **never** `app.use(ToastService)`. Grep finds **zero** `useToast` / `ToastService` call sites in `src/`.
- Tokens exist in `src/assets/styles/tokens.css` (`--color-toast-bg/fg/border` + per-severity bg/fg). `docs/roadmap.md:70-72` already names this gap.

A strong precedent for the producer composable exists: `src/composables/useConfirm.ts` + `src/components/dialogs/ConfirmDialog.vue` is an app-wide singleton service (mounted once in **AppShell.vue:130** — see the docstring caveat below — driven by a module-level `ref`, with `__resetConfirmForTests()` and `tests/unit/composables/useConfirm.spec.ts`). Realtime plumbing is ready: `src/composables/useWebSocketClient.ts` exposes reactive `status` (`ConnectionStatus`) and `lastMessage` (`WsMessage` envelope), and the chrome `websocket-status` built-in already surfaces connection state.

> **Docstring-vs-reality caveat (must obey AppShell, not the docstrings).** `useConfirm.ts:6` and `Toast.vue:8-9` both say their host mounts "at the app root (App.vue)" / "Drop a single `<Toast/>` in App.vue". **That is stale.** The real mount site is `AppShell.vue` (ConfirmDialog is at `AppShell.vue:130`). All new toast wiring — `<NotificationOutlets>` and the `useNotify` handle install — mounts in **AppShell.vue alongside `<ConfirmDialog/>`**, _not_ App.vue. Fix both stale docstrings in this PR so the next agent doesn't mount in the wrong file.

### Design

Three layers, all grounded in the locked stack (PrimeVue unstyled + the `useConfirm` singleton pattern). **Context7-verify the PrimeVue 4 `ToastService`/`useToast` API and the `message` PT severity surface before wiring** — already flagged in the A1b note and the `Toast.vue` docstring; PrimeVue uses `warn`/`error` (not `warning`/`danger`), which `toastTheme.ts` already bridges for styling.

**(1) Wiring.** In `src/main.ts`, add `import ToastService from 'primevue/toastservice'` and `app.use(ToastService)` immediately after `app.use(PrimeVue, { unstyled: true })`. Mount outlets once in `AppShell.vue` alongside `<ConfirmDialog />`.

**(2) Multi-position outlets via groups — and the grouped-vs-ungrouped duality resolved.** Extend `Toast.vue` to forward a `group` prop to `PvToast` (a 1-line fix; the inventory already documents the prop). Create a `NotificationOutlets.vue` host rendering the **7 canonical PrimeVue positions** (`top-left|top-center|top-right|bottom-left|bottom-center|bottom-right|center`), each a `<Toast position group>` pairing with a stable group id (`cv-toast-<position>`, e.g. `cv-toast-bottom-right`).

- **Every outlet is grouped — there is no ungrouped/default outlet.** A bare `<Toast position="bottom-right">` with **no** `group` would only receive ungrouped `add()` calls, while a grouped `bottom-right` outlet only receives `add({ group: 'cv-toast-bottom-right' })`. Mixing the two for the same corner double-renders or silently drops. **Resolution:** `useNotify` **always** sets `group` from `POSITION_TO_GROUP[position]`; the "default position" is implemented as `position` defaulting to `bottom-right` inside `notify.show`, which then maps to the `cv-toast-bottom-right` _group_. There is never an ungrouped `add()`. The 7 outlets are the only sinks.
- **Mount-validation guard.** Because a grouped `add()` whose `group` has no mounted outlet **silently no-ops** in PrimeVue, `NotificationOutlets.vue` renders the outlet for **every** value in `POSITION_TO_GROUP`, and a dev-only assertion (and a unit test) verify the outlet set is exactly the key set of `POSITION_TO_GROUP`. This makes "fired into a missing group" structurally impossible rather than a runtime mystery.
- PrimeVue has **no native left-center/right-center**, so bare `left`/`right` are documented as **aliases to corners** (honest API) rather than over-claimed. See ask-2 note below.

**(3) Producer composable `useNotify` (mirrors `useConfirm` ergonomics)** — wraps `useToast()` with typed severity helpers and sane defaults so feature code never touches PrimeVue's `warn`/`error` vocabulary or raw group-id strings:

- `notify.success | info | warn | danger(summaryOrOpts)` — maps the project's `warning`/`danger` names onto PrimeVue `warn`/`error` at the producer boundary (single source of the mapping, shared with `toastTheme.ts`).
- `notify.show({ severity, summary, detail?, position?, life?, sticky?, key?, coalesce? })` — `position` routes via the `POSITION_TO_GROUP` lookup (default `bottom-right`), `sticky:true` omits `life`, default `life` ~5000ms.
- `notify.dismissAll()` → `toast.removeAllGroups()`; `notify.dismissPosition(pos)` → `toast.removeGroup(POSITION_TO_GROUP[pos])`.
- **`key` semantics — two explicit modes, resolving the critique's drop-vs-replace conflict.** A `key` identifies a logical notification "slot." `coalesce` selects behavior when a toast with the same `key` is already live:
  - `coalesce: 'replace'` (**default for keyed toasts**) — remove the prior toast with that key and add the new one (update-in-place). This is what the WebSocket example needs: `notify.danger('Connection lost', {key:'ws-status', sticky:true})` then later `notify.success('Reconnected', {key:'ws-status'})` **replaces** the sticky error with the success toast. Implemented by tracking key→live-message and calling `toast.remove(prev)` (or `removeGroup` fallback) before the new `add()`.
  - `coalesce: 'drop'` — if a toast with that key is live, **drop the new one** (anti-spam for a flapping high-rate producer that legitimately wants "only one of these on screen, first wins").
  - Unkeyed toasts never coalesce. The earlier draft conflated these; the WebSocket bridge uses `replace`, the spam-guard path uses `drop`.
- Export a `Notification` type (severity union = project's `success|info|warning|danger` + optional `secondary|contrast`).

Because `useToast()` only resolves inside the Vue app context, `useNotify` **captures the toast handle once via an install step in AppShell into a module-level ref** (exactly like `useConfirm`), so non-component producers (stores, the WebSocket watcher) can call `notify.*`. Ship `__resetNotifyForTests()` + `tests/unit/composables/useNotify.spec.ts` mirroring `useConfirm.spec.ts` (including a `replace`-coalesce assertion and a `drop`-coalesce assertion).

**(4) Telemetry → notifications (native WebSocket only, no Socket.IO).** A thin, **opt-in** watcher, not baked into the client. `useWebSocketClient` already exposes `status` + `lastMessage`; provide a `useConnectionNotifications` composable that `watch`es `status` and raises `notify.danger('Connection lost', { sticky, key:'ws-status', coalesce:'replace' })` / `notify.success('Reconnected', { key:'ws-status', coalesce:'replace' })` — **the `replace` mode is what makes "Reconnected" supersede the live sticky "Connection lost" instead of being dropped** — optionally dispatching on `lastMessage.type`. Kept as a **documented opt-in example** near the chrome `websocket-status` neighborhood — the template must not hardcode domain alert semantics (CLAUDE.md: no business logic).

**(5) Notification center / history — DEFER, but define the seam record now.** A bell-icon center with unread badge and persistent history is a separate, larger feature. Land only the **seam**, and make it a _real_ seam by fixing the record type now:

```ts
// src/stores/notification.ts — capped ring buffer (50-FIFO, like telemetry)
interface NotificationRecord {
  id: string; // nanoid; stable across dismiss
  severity: "success" | "info" | "warning" | "danger";
  summary: string;
  detail?: string;
  position: ToastPosition; // resolved position (group source)
  key?: string; // coalesce key, if any
  createdAt: number; // epoch ms
  dismissedAt: number | null; // null while live; set on dismiss/expire
}
```

`useNotify` optionally pushes one `NotificationRecord` per emitted toast into `useNotificationStore` (serializable, capped 50-FIFO). `dismissAll`/`dismissPosition` set `dismissedAt` on the matching live records (they do **not** delete history); coalesce-`replace` marks the superseded record `dismissedAt` and pushes the replacement as a new record. The center itself (chrome item + PrimeVue `Menu`/`DataView`, unread = `dismissedAt === null` count) is roadmap, not this phase — but because the record shape and the dismiss/coalesce reconciliation are fixed now, a future bell reads from the store without retrofitting producers.

**Accessibility.** PrimeVue Toast renders `role="alert"` (implicitly `aria-live="assertive"`, `aria-atomic="true"`); the close control is a real `<button>` with a customizable `aria-label`. Assertive is correct for errors but interrupts screen readers for routine info — consider a polite channel for low-severity messages. The current `:pt` styles root/message/content/text/summary/detail but **not the close button or per-severity icons** — sticky toasts especially need a visible, accessible close control, so `pt.closeButton` styling must land here.

**z-index budget (concrete values — the most probable runtime regression, now resolved not deferred).** The stacking contract, top to bottom:

| Layer                                                 | z-index                                           | Source                                            |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Toasts                                                | **9000** (`baseZIndex: 9000`, `autoZIndex: true`) | `NotificationOutlets.vue` props to each `<Toast>` |
| Modal dialogs / overlays (Volt Dialog, ConfirmDialog) | ~1100–2000                                        | PrimeVue overlay defaults                         |
| Dockview floating windows / popouts                   | ~1000-range                                       | Dockview stacking                                 |
| Dock panels, ChromeBar                                | base app                                          | —                                                 |

Toasts must float **above everything**, including modal overlays and Dockview popouts, so the wrapper's existing `z-50` Tailwind class is **insufficient and is replaced** by PrimeVue's `baseZIndex: 9000` + `autoZIndex` on the `<Toast>` outlets (verify the wrapper passes these through; add them to `Toast.vue`'s prop surface). 9000 sits clear of PrimeVue's overlay band and Dockview's range with headroom. A cross-position Playwright check (toast over an open Dialog, toast over a floating Dockview panel) is part of Stage-1 verification for this phase.

**Pointer-events on empty outlet regions (new — prevents click-blocking).** Each of the 7 `<Toast>` outlet roots is a `fixed`-positioned, `w-[360px]` container anchored to a corner/edge/center. Seven such containers layered over the viewport will **intercept clicks over their empty regions** unless neutralized. **Requirement:** every outlet root gets `pointer-events: none`, and only the rendered toast _message_ elements re-enable `pointer-events: auto` (via the `message` PT). This is added to `NotificationOutlets.vue`/`Toast.vue` PT and asserted in the Playwright pass (click a button beneath an empty corner outlet and confirm it activates).

### Files affected

- `src/main.ts` — `app.use(ToastService)`.
- `src/components/ui/Toast.vue` — forward `group` prop; expose `baseZIndex`/`autoZIndex`; add `pt.closeButton`/icon styling; add `pointer-events:none` root + `pointer-events:auto` on message; **fix stale App.vue docstring**.
- `src/components/ui/toastTheme.ts` — single source of the `warning`/`danger` → `warn`/`error` mapping (imported by `useNotify`).
- `src/components/layout/AppShell.vue` — mount `NotificationOutlets.vue` + install the `useNotify` handle, alongside `<ConfirmDialog/>` (mirrors line 130).
- `src/components/common/NotificationOutlets.vue` _(NEW)_ — the 7 grouped position outlets; renders exactly the key set of `POSITION_TO_GROUP`; pointer-events-none roots.
- `src/composables/useNotify.ts` _(NEW)_ — producer composable, `POSITION_TO_GROUP`, `coalesce` replace/drop logic, `__resetNotifyForTests()`.
- `src/stores/notification.ts` _(NEW)_ — `NotificationRecord` ring-buffer seam (shape defined above) for the future center.
- `src/composables/useConnectionNotifications.ts` _(NEW, opt-in example)_ — telemetry/WebSocket bridge using `coalesce:'replace'`.
- `src/composables/useConfirm.ts` — **fix stale App.vue docstring** (mount site is AppShell).
- `tests/unit/composables/useNotify.spec.ts` _(NEW)_ — severity mapping, `replace` vs `drop` coalesce, outlet-set == `POSITION_TO_GROUP` keys, default-position routing.
- `docs/audits/ui-wrappers-inventory.md` — fix **both** drifts in the same PR (documentation-sync rule): the `group`-prop row (line 17) **and** the wrong "Position default `top-right`" line (line 68 — code defaults to `bottom-right`).
- `docs/roadmap.md` — mark the loop closed.

### Risks

- **Severity vocabulary mismatch** (`warn`/`error` vs `warning`/`danger`). `toastTheme.ts` bridges styling; `useNotify` imports that same mapping at the producer boundary, so callers can't silently mis-style.
- **`useToast()` context.** Module-level producers (stores, the WebSocket watcher) need the install-once-into-module-ref pattern or they throw "No PrimeVue Toast provided" — a green-build/broken-runtime class bug; runtime-verify with Playwright.
- **Grouped-vs-ungrouped duality.** Resolved: every outlet is grouped, `useNotify` always sets `group`, no ungrouped `add()` exists; the dev assertion + unit test pin outlet-set == group-set.
- **Silent no-op on missing group.** Resolved by rendering an outlet for every `POSITION_TO_GROUP` value plus the dev assertion.
- **Coalesce semantics.** Resolved: `replace` (default for keyed) vs `drop` (opt-in spam guard); WebSocket bridge uses `replace`.
- **z-index / dock layering.** Resolved to a concrete budget (toasts `baseZIndex: 9000` + `autoZIndex`, above the ~1100–2000 overlay band and Dockview's ~1000 range); cross-position Playwright check required. The wrapper's `z-50` is replaced.
- **Pointer-events click-blocking.** Resolved: outlet roots `pointer-events:none`, messages `pointer-events:auto`; Playwright asserts a button under an empty corner still clicks.
- **Unstyled-mode gaps.** Close button + per-severity icons are currently unstyled/invisible; must be addressed for sticky toasts.
- **Position over-claiming.** Only 7 honest positions exist; document them rather than promising synthesized left-center/right-center.
- **Spam/backpressure.** A flapping WebSocket or high-rate stream floods the screen without `key` + `coalesce`; the FIFO-cap (history) + coalesce (display) land from day one.
- **a11y for chatty info.** `assertive`/`role=alert` interrupts screen readers for routine info — a polite channel may be warranted.

### Open questions

- Producer API shape: thin `useNotify` only, or a richer model (categories/keys/actions) from the start? _Recommend thin now (with `key`/`coalesce`), store seam for later._
- How many positions to officially support — 7 canonical, with `left`/`right` as corner aliases? (See ask-2 note: maintainer asked "any position.")
- Default `life` and default position — 5000ms / `bottom-right`? (The status bar lives bottom, so bottom-right may overlap it.)
- Install-once-module-ref (so stores can notify) acceptable, or restrict notifications to component context?
- Notification-center scope: confirm deferred, only the `useNotificationStore` seam (record shape now fixed) lands. History persisted (idb, like layouts) or in-memory per session?
- WebSocket connection notifications as an active default, or a commented opt-in example only? _Recommend opt-in (template purity)._
- Volt vs hand-rolled: keep the A1b-themed hand-rolled `ui/Toast.vue` or migrate to a Volt file? _Recommend keep hand-rolled — A1b already invested in the token passthrough._

> **Ask-2 note ("any position").** The maintainer asked for toasts "from any position." PrimeVue's Toast supports exactly **7** canonical positions; there is no native arbitrary-coordinate or left-center/right-center placement. This spec **delivers the 7 honestly and aliases `left`/`right` to corners**, rather than over-promising. If the maintainer's mental model is truly arbitrary placement, that requires a custom non-PrimeVue overlay layer — an ADR-level deviation from the library-first rule, explicitly out of scope here and called out as Open Decision 9 so the gap between "any" and "7 canonical" is a **conscious, recorded** decision rather than silently narrowed.

---

## 3. Component showcase / playground panel

### The PanelDefinition

A **new singleton dock panel** that doubles as living documentation and a live theming smoke test — it renders the project's **actual** UI primitives, so theme-token and behavior changes are visible in one scroll:

```
id:          "showcase"
title:       "Component Showcase"
description:  "Live gallery of every UI primitive — theming + behavior smoke test."
icon:         "palette"           // @lucide/vue chrome icon
category:     "docs"              // closed PanelCategory union; mirrors components-browser
singleton:    true
component:    () => import('@/components/panels/ShowcasePanel.vue')
```

Registration is the standard two-step contract: add the `PanelDefinition` to `BUILTIN_PANELS` in `src/modules/panels/builtin.ts` **and** `app.component("showcase", defineAsyncComponent(...))` in `src/main.ts`. Closest precedent is `ComponentsPanel.vue` (id `components-browser`, category `docs`, singleton). `category: "docs"` is the honest match — do **not** mint a new category (the `PanelCategory` union is closed: `charts|data|docs|maps|monitoring|tools`).

### The primitive registry — the anti-drift backbone (resolves ask-3 gap)

The earlier draft asserted "enumerate from a single typed list" but **no such list exists today**. This phase **creates it** so the showcase cannot silently fall behind the primitive set:

- **New file `src/components/showcase/registry.ts`** exports `SHOWCASE_PRIMITIVES: ShowcaseEntry[]`, one entry per `ui/*` and `volt/*` primitive: `{ id, label, tab: 'display'|'inputs'|'buttons'|'overlays'|'notifications', render: () => Component }`. This is the **single source** the panel iterates to build sections.
- **New guard test `tests/unit/components/showcase/registry.spec.ts`** reads the `ui/` and `volt/` directories (or a generated manifest of them) and **fails when a primitive file has no matching `SHOWCASE_PRIMITIVES` entry**. Adding a new primitive without a showcase section breaks CI — drift becomes a failing test, not a hope. (Toast/DataTable and any deliberately-excluded primitives are listed in an explicit `SHOWCASE_EXCLUDE` allowlist the test consults, so exclusions are intentional and reviewed.)

This converts "enumerate from a single typed list" from an aspiration into a real, test-enforced mechanism, which the critique correctly flagged as ungrounded.

### Sections to showcase

A vertically scrolling panel grouped into `ui/Tabs` tabs to stay navigable. Each section is a `volt/Fieldset` (legend = primitive name) wrapping a labeled grid of states — reuse `SymbologyPanel.vue`'s Fieldset+grid pattern. **No raw `<button>`/`<input>`** (CLAUDE.md); styling via Tailwind tokens + `:pt`, zero hardcoded hex (ADR-0004).

- **Tab 1 — Display:** Tags/Chips (one `Tag` per severity success/info/warn/error/secondary/contrast), Fieldsets, Dividers, badges, density samples, A1b status families, and (once A1c lands) bevel/glow/border-accent swatches.
- **Tab 2 — Inputs:** Input (text/search/number), Textarea, Select, MultiSelect, Checkbox (+ binary), Slider, ColorPicker/ColorSwatchPicker, DatePicker, FileUpload (basic) — each in default/disabled/invalid states, **wired to live local refs** so interactive controls actually demo.
- **Tab 3 — Buttons:** Button (each severity + outlined/text/sm/lg/disabled/loading), IconButton, SecondaryButton.
- **Tab 4 — Overlays & Feedback:** Dialog (open via button → `v-model`), ConfirmDialog via `useConfirm().confirm(...)`, Tooltip (several placements), ContextMenu (right-click target), Menu/Menubar, Popover.
- **Tab 5 — Notifications:** toast trigger matrix — buttons for each severity × a position `Select` bound to the 7 positions, firing via `useNotify()`. **Hard-gated on A-Toast (see dependency below); this tab is added as a fast-follow once A-Toast merges, not shipped behind a runtime placeholder.**

`ShowcasePanel.vue` is `<script setup>`, holds local demo refs (`sliderVal`, `checkVal`, `selectVal`, `colorVal`, `toastPosition`) and helpers (`fireToast(severity)` / `openConfirm()` / `openDialog()`), keeps `defineProps<PanelApiProps>()` for consistency, and needs **no** serialize/restore (stateless playground).

### Ship-in-template vs dev-only

**Ship in the template as a `category: "docs"` panel — not dev-only.** It is genuine living documentation of the design system and a theme-verification tool, paralleling `ComponentsPanel` and `SymbologyPanel`, which already ship. It is the natural **acceptance surface for Track A's token work** (verify A1a/A1b/A1c recolor every primitive in one screenshot) and a ready-made **recolor demo target for A2a's Stage-1 verification gate**. Document it in `docs/panels.md` and the VitePress sidebar per documentation-sync. It is likely **not** seeded into the default layout (opened on demand like `components-browser`).

### Dependency on the toast system (single, consistent rule)

**Hard dependency, resolved to one path.** The Notifications tab calls `useNotify()` → `useToast().add()`, which silently no-ops with no `ToastService` registered. The earlier draft offered two contradictory mitigations (runtime "service not registered" placeholder **and** sequencing the tab as a fast-follow). **This spec picks one: sequence it.** A-Showcase's **four non-toast tabs (Display/Inputs/Buttons/Overlays) ship first; the Notifications tab is added in the same PR that depends on A-Toast having merged** (A-Toast is ordered before A-Showcase in §4, so by the time the panel lands, the service exists and the tab is live — no placeholder, no dead code). If, and only if, the maintainer chooses the optional interleave that floats A-Showcase _before_ A-Toast (Open Decision 21), then the Notifications tab is simply **omitted** from that earlier cut and added when A-Toast lands — still no runtime-placeholder branch. The non-toast tabs have **no** blocking dependency.

> **Moving-target caveat (critique).** Because A-Showcase is ordered before A1c and A2a in the recommended chain, its Display tab's "bevel/glow/border-accent swatches" render nothing until A1c lands, and its value as A2a's live-recolor demo target only fully materializes at A2a. This is acceptable for a _living_ doc (it grows with the system), but it means the showcase is **explicitly a moving target retrofitted across A1c and A2a**, not a frozen acceptance surface at phase 3. Each of those later phases adds its own showcase rows in its own PR (tracked in their file lists). Open Decision 21 lets the maintainer instead land A-Showcase _after_ A1c for a one-pass richer demo.

### Files affected

- `src/components/panels/ShowcasePanel.vue` _(NEW)_ — the panel component; iterates `SHOWCASE_PRIMITIVES`.
- `src/components/showcase/registry.ts` _(NEW)_ — the single typed primitive list (anti-drift source).
- `tests/unit/components/showcase/registry.spec.ts` _(NEW)_ — fails when a `ui/`/`volt/` primitive lacks an entry (minus `SHOWCASE_EXCLUDE`).
- `src/modules/panels/builtin.ts` — add the `PanelDefinition`.
- `src/main.ts` — `app.component("showcase", defineAsyncComponent(...))` in the panel block.
- `src/views/DemoView.vue` _(optional)_ — add a `showcase` case to the `switch` + panels array for the route previewer.
- `src/modules/storage/seed.ts` _(likely not)_ — only if `showcase` should appear in `SEED_PANEL_TYPES` / default layout.
- `src/main.ts` / `src/components/layout/AppShell.vue` _(DEPENDENCY, not owned here)_ — `app.use(ToastService)` + mounted outlets, required before the Notifications tab can fire.
- `docs/panels.md` — document the panel.
- `docs/.vitepress/config.ts` — sidebar entry if a new docs page is added.

### Risks

- **Hard toast dependency** — resolved by sequencing (A-Toast before A-Showcase); the Notifications tab ships only once the service exists, no runtime-placeholder branch.
- **Drift** — resolved by the `SHOWCASE_PRIMITIVES` registry + the CI guard test that fails on an unlisted primitive.
- **Scope creep into a docs site** — keep it a behavioral/visual smoke test, not exhaustive prop docs (VitePress owns that).
- **Bundle weight** — importing every primitive eagerly bloats the chunk; acceptable as a single lazy chunk, but avoid pulling Cesium/ECharts in.
- **Runtime-only proof** — Tooltip (floating-ui) and Toast/Dialog (PrimeVue passthrough) need Playwright click-through, not static checks.
- **Under-testing interactive controls** — ColorPicker/Slider/Checkbox need live two-way refs to demo correctly.
- **ADR-0004 precedent** — the panel lives in `src/components/panels/**` (not guarded by `scripts/check-single-source.mjs`), so inlining demo swatches with hex/Tailwind-palette literals sets a bad precedent; enforce token-only discipline.
- **Dual-registration + closed category** — must register in both `builtin.ts` and `main.ts`; a wrong/invented `PanelCategory` breaks the type and View-menu grouping (`docs` is correct).
- **Moving target** — the showcase grows across A1c/A2a (see caveat); not a frozen acceptance surface at phase 3.

### Open questions

- Ship in template vs dev-only? _Recommend ship as `category:docs`._
- Discoverable from the Add Component menu / Components browser, or hidden? (`ComponentsPanel` filters itself out of its own list.)
- Single scrolling panel with internal Tabs vs multiple per-family panels? _Recommend one Tabs-organized panel._
- Does the toast-trigger UI live here, or does the toast phase own its own demo surface (overlap risk)?
- Icon: Lucide `palette` vs `swatch-book` vs `flask-conical`.
- Serialize/restore (remember active tab / last toast position) or stateless? _Recommend stateless._
- `singleton: true` like `components-browser`? _Recommend yes._
- Add a `DemoView` route alias for standalone preview, or dock-only?
- Land A-Showcase before A1c (QA surface sooner, retrofit palette rows) or after A1c (one-pass richer demo)?

---

## 4. Recommended sequencing / roadmap delta

Treat the three initiatives against the existing Track A dependency graph, not as net-new tracks: **tab-segregation is absorbed into A2a/A2b; toast and showcase are two small new phases inserted into the spine, ordered toast → showcase.** Both new phases are theming-**adjacent** (no theme-data, no schema, no DB change) and must be documented as such so a future agent does not treat `A-Toast` as gating the `A1a.5` keystone.

**A1a.5 is no longer greenfield — it now carries A1b migration debt.** Because A1b shipped ahead of it (see the reconciliation section up top), A1a.5's 1→2 schema migration must additionally **upcast already-persisted v1 generated themes carrying `generation.statusOverrides`** into the v2 `base`+`overrides` model. This is reflected in A1a.5's row, scope, and file list below. The chain order is otherwise unchanged, but the keystone's framing shifts from "clean foundation" to "reconciling foundation."

**Concrete linear recommendation (lowest risk, no interleave):**

| #   | Phase                                                                                                                                                                                                                                                                                                                                                                             | Depends on                  | Why here                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A1a.5** — v2 `base`+`overrides`+mandatory-cache data model, `THEME_SCHEMA_VERSION` 1→2, `DB_VERSION` 2→3, `resolve()` materializer, migration, **+ retroactive upcast of v1 themes that already carry `generation.statusOverrides` (A1b debt)**, §3i engine-stability contract                                                                                                  | A1a (done)                  | **Keystone — but now a _reconciling_ keystone.** Must precede A1c so diff-into-overrides + the additive-only contract neutralize A1c's new keys for existing themes. Migration must fold the already-shipped v1 `statusOverrides` into `base.input.statusHues` / `overrides` idempotently. Independent of toast/showcase. |
| 2   | **A-Toast** _(NEW, small, standalone)_ — register `ToastService`, mount `<NotificationOutlets />`, add `useNotify()` (+`key`/`coalesce`) + `useNotificationStore` record seam, z-index 9000 budget, pointer-events guard                                                                                                                                                          | A1b (done) only             | Theming-orthogonal; **no** hard dep on A1a.5. "Finishes the loop" the roadmap describes; independently shippable. **Hard prerequisite for A-Showcase.** Context7-verify the PrimeVue 4 ToastService/`useToast`/message-PT surface first.                                                                                  |
| 3   | **A-Showcase** _(NEW)_ — singleton `showcase` panel (category `docs`); `SHOWCASE_PRIMITIVES` registry + drift-guard test; demos all Volt + `ui/*` primitives, fires toasts via `useNotify()`, shows A1b status Tags                                                                                                                                                               | **A-Toast (hard)**          | Dead trigger buttons without A-Toast. Natural QA surface for the two-stage verification protocol. Grows across A1c/A2a (moving target).                                                                                                                                                                                   |
| 4   | **A1c** — richer "less-flat" palette (bevel + tiered colored borders + accent triad; **additive-only keys**); adds its swatch rows to the showcase Display tab in this PR                                                                                                                                                                                                         | **A1a.5 (hard)**            | The §3i engine-stability contract requires the v2 model.                                                                                                                                                                                                                                                                  |
| 5   | **A2a** — floatable `theme-studio` Dockview panel that live-recolors every window via `APP_ROOT` + `usePopoutThemeSync`. **Absorbs theme-modal tab segregation:** ships the L1 **Generate** container holding all **six L2 section tabs**, lifts logic into `useThemeAuthoring()`, thins the modal (Open Decision 9). Surfaces & Chrome / Effects tabs are read-only-preview here | A1a (done) + Track B (done) | Benefits from A-Showcase existing as a live recolor demo target.                                                                                                                                                                                                                                                          |
| 6   | **A2b** — manifest-driven per-token editor as the **second L1 "Tokens" tab** in the Studio (completes tab-segregation; **this is where the backgrounds/modal-colors tab becomes editable** — ask 1's full satisfaction); sparse `overrides`, advisory WCAG, Tier-2 explicit status color                                                                                          | **A2a + A1a.5 (hard)**      | The manifest `section` field is the shared taxonomy for Generate-L2 + Tokens sections.                                                                                                                                                                                                                                    |
| 7   | **A3** — themeable duotone icons (deferred)                                                                                                                                                                                                                                                                                                                                       | A2                          | As specced.                                                                                                                                                                                                                                                                                                               |

**Linear chain:** `A1a.5 (reconciling) → A-Toast → A-Showcase → A1c → A2a (+ Generate container, 6 L2 tabs) → A2b (+ Tokens tab, editable surfaces) → A3`.

**Hard dependencies (summary):** A-Showcase **requires** A-Toast; A1c **requires** A1a.5; A2a **requires** A1a + Track B (both done); A2b **requires** A2a + A1a.5. **Tab-segregation has no independent dependency** — it is satisfied by A2a (Generate container) + A2b (editable Tokens tab). **A1a.5 additionally owns the v1-statusOverrides upcast** created by A1b shipping early.

**Optional interleave for faster visible wins:** A-Toast and A-Showcase touch **no theme data** and can float **before** A1a.5 if the maintainer wants payoff sooner — at the cost of slipping the keystone migration later. **Caveat (critique):** the keystone has _already_ slipped once — A1b jumped ahead of A1a.5 and created the upcast debt now folded into phase 1. Every additional non-keystone phase that jumps the queue slips A1a.5 further and risks accreting more v1-shape debt the migration must reconcile. Floating A-Toast before A1a.5 is technically safe for toast itself (toast tokens ride on the already-shipped A1b status families), but the recommendation is to **land the reconciling keystone first** precisely because the queue-jumping pattern already bit once. Two ordering choices remain open: (a) strictly-after-keystone (recommended) vs interleaved-before; (b) A-Showcase before A1c (QA surface sooner, palette rows retrofitted in the A1c PR) vs after A1c (one-pass richer-palette demo).

---

## 5. Open decisions for the maintainer

1. **Tab-segregation timing.** Ship a transitional in-modal `ui/Tabs` reorg **before** A2a (visible but throwaway, per Open Decision 9), or defer entirely into A2a's Generate container + A2b's Tokens tab (recommended: defer; zero throwaway)?
2. **Tab structure.** Two-level tabs (L1 Generate/Tokens, L2 sections within Generate) vs a single flat strip mixing curated and per-token controls?
3. **Tab count + labels.** The proposed six (Foundation, Palette, Status & Feedback, Typography, Surfaces & Chrome, Effects & Borders) vs a tighter four (Foundation, Color, Typography, Advanced)?
4. **Tab orientation** in the tall-narrow Studio panel: horizontal scrollable tabs vs a vertical tab rail.
5. **Typography scope.** Does the Typography tab take role-based font stacks (body/mono/heading) now, or stay single-font until the deferred role-based font extension lands?
6. **Mode/Density placement.** Foundation tab, or a separate "Layout" tab?
7. **Persistent preview form.** Keep the scoped-div mockup, or shrink to a confirmation swatch once A2a recolors the whole app live?
8. **Notification producer API surface.** Thin `useNotify()` (with `key`/`coalesce`) only, or a richer model (categories/actions) from the start? (Recommend thin + store seam.)
9. **Supported toast positions.** 7 canonical, with bare `left`/`right` documented as corner aliases — accept this as the honest answer to "any position," or invest in a custom non-PrimeVue overlay layer (ADR-level deviation) to get true arbitrary placement?
10. **Toast defaults.** Default `life` (5000ms?) and default position (`bottom-right`, given the status bar also lives at the bottom)?
11. **Coalesce default.** `replace` as the default for keyed toasts (recommended — required by the WebSocket bridge), with `drop` opt-in for spam guards?
12. **Module-ref install pattern.** Accept the install-once-into-module-ref so stores/watchers can notify, or restrict notifications to component context only?
13. **Notification center.** Confirm deferred to a later phase with only the `useNotificationStore` ring-buffer seam (record shape now fixed) landing now. If/when built: persisted history (idb, like layouts) or in-memory per session?
14. **WebSocket connection notifications.** Active default, or a commented opt-in example only? (Recommend opt-in for template purity.)
15. **Toast Volt vs hand-rolled.** Keep the A1b-themed hand-rolled `ui/Toast.vue`, or migrate to a Volt file? (Recommend keep hand-rolled.)
16. **Showcase: template vs dev-only.** Ship as `category:docs` (recommended) or gate behind `import.meta.env.DEV`?
17. **Showcase discoverability.** Appear in the Add Component menu / Components browser, or hidden like `components-browser` filters itself out?
18. **Showcase shape.** One Tabs-organized panel (recommended) vs multiple per-primitive-family panels?
19. **Toast demo ownership.** Does the toast-trigger UI live in the Showcase Notifications tab, or does the toast phase own its own demo surface (overlap)?
20. **Showcase naming/icon/lifecycle.** `showcase` vs `playground`; icon `palette` vs `swatch-book` vs `flask-conical`; stateless (recommended) vs serialize/restore active tab; `singleton: true` (recommended); optional `DemoView` route alias.
21. **New-phase placement vs the keystone.** Strictly after A1a.5 (linear, lowest-risk, recommended given the keystone already slipped once) or interleaved before it for faster visible wins (toast/showcase touch no theme data)?
22. **Showcase vs A1c ordering.** Land A-Showcase before A1c (QA surface sooner, palette demo retrofitted) or after A1c (one-pass richer-palette demo)?
23. **Track membership.** Are A-Toast and A-Showcase folded into the `.internal/specs/track-a-theming.md` spec, or tracked as a separate small prompt? (They are theming-adjacent but not theming-data work.)
24. **A2a verification coupling.** Wire the Showcase panel as the live recolor demo target for A2a's Stage-1 verification gate, or keep it independent of Theme Studio verification?
25. **Editable surfaces timing (ask-1 deferral).** Accept that the editable backgrounds/surface/modal-colors tab arrives in **A2b** (view-only preview in A2a), or pull a minimal editable subset of surface tokens forward into A2a (scope cost: a slice of the manifest editor lands one phase early)?
26. **A1b reconciliation scope confirmation.** Confirm A1a.5 owns the retroactive upcast of v1 themes carrying `generation.statusOverrides`, and that the migration is idempotent over themes saved both pre- and post-A1b (no double-fold). Are there persisted generated themes in the wild already (affects whether the upcast is theoretical or load-bearing)?

---

## 6. Critique resolutions

What changed in this revision in direct response to the review, mapped to each finding:

**Blocking inconsistency — A1a.5/A1b keystone inversion (the verdict's gating issue).**

- Added a dedicated **"Keystone-ordering reconciliation"** section to the top-level context, verified against the live tree (`theme.ts:22` schema=v1, `db.ts:9` DB=v2, `theme.ts:88` `statusOverrides` bolted onto v1 `ThemeGenerationMeta`). The doc no longer treats A1a.5 as a clean next-in-spine keystone.
- A1a.5's scope, table row, and file list now **explicitly own the retroactive upcast** of already-shipped v1 themes carrying `generation.statusOverrides`. Added Open Decision 26 to confirm idempotency and whether wild persisted themes make the upcast load-bearing.
- The §4 framing shifts from "clean foundation → build forward" to "**reconciling foundation**," and the interleave caveat now notes the queue has already been jumped once.

**Gaps.**

- **Dedup-key vs WebSocket example contradiction:** introduced an explicit `coalesce: 'replace' | 'drop'` parameter. `replace` (default for keyed) makes "Reconnected" supersede the live sticky "Connection lost"; `drop` is the opt-in spam guard. The WebSocket bridge now uses `replace`. Unit test asserts both modes.
- **z-index budget left as a non-value:** replaced with a concrete layering table — toasts at `baseZIndex: 9000` + `autoZIndex`, above the ~1100–2000 overlay band and Dockview's ~1000 range; the wrapper's `z-50` is explicitly replaced; cross-position Playwright check required.
- **Pointer-events on stacked outlets:** added the requirement that all 7 outlet roots are `pointer-events:none` with messages `pointer-events:auto`, plus a Playwright assertion that a button under an empty corner still clicks.
- **`useNotificationStore` under-specified seam:** defined the `NotificationRecord` type now, and specified how `dismissAll`/`dismissPosition`/coalesce-`replace` reconcile with the history buffer (set `dismissedAt`, never delete; unread = `dismissedAt === null`).
- **Showcase Notifications-tab two-incompatible-gates:** picked one — **sequence it** (tab ships in the PR that depends on A-Toast having merged); removed the runtime "service not registered" placeholder path entirely.
- **Default-bottom-right-vs-grouped duality:** resolved — every outlet is grouped, `useNotify` always sets `group` via `POSITION_TO_GROUP` (default position maps to the `cv-toast-bottom-right` group), no ungrouped `add()` exists; a dev assertion + test pin outlet-set == group-set, eliminating the silent-no-op-on-missing-group failure mode.

**Inconsistencies.**

- **Mount-location docstring drift:** added an explicit caveat that `useConfirm.ts:6` and `Toast.vue:8-9` stale "App.vue" docstrings are wrong (real site is `AppShell.vue:130`), and added both docstring fixes to the file list so a future agent mounts in the right place.
- **Inventory drift the draft only half-caught:** the file-list instruction now fixes **both** rows — the `group`-prop row (line 17) **and** the wrong "Position default `top-right`" row (line 68; code defaults to `bottom-right`), verified in-tree.
- **Six-tabs vs "the Generate tab" ambiguity:** clarified that A2a ships the L1 **Generate _container_** holding all **six L2 section tabs** (not a single flat surface); §1 and §4 now use consistent L1/L2 language.

**Missing-from-ask.**

- **Ask 2 "any position":** added an explicit ask-2 note resolving the 7-canonical-positions limit as a conscious recorded decision (Open Decision 9 reframed), with arbitrary placement called out as an ADR-level non-PrimeVue deviation that is out of scope — rather than silently narrowing "any" to 7.
- **Ask 1 editable backgrounds/modal tab:** added a prominent editability caveat in §1 stating the Surfaces & Chrome tab is **view-only until A2b**, plus Open Decision 25 to let the maintainer pull a minimal editable surface-token subset into A2a if the deferral is unacceptable.
- **Ask 3 showcase anti-drift "typed list" that didn't exist:** added the `src/components/showcase/registry.ts` `SHOWCASE_PRIMITIVES` source **and** a CI guard test (`registry.spec.ts`) that fails when a `ui/`/`volt/` primitive has no entry (minus an explicit `SHOWCASE_EXCLUDE` allowlist) — converting the asserted mitigation into an enforced one.

**Sequencing concerns.**

- The false-keystone premise is corrected throughout (see blocking item). A-Toast's "no hard dep on A1a.5" claim is retained (correct) but the interleave caveat now notes each queue-jump slips the keystone and the queue already jumped once. A-Showcase's moving-target nature (renders A1c swatches only after A1c; full A2a-recolor value only at A2a) is now stated explicitly rather than left as an inline "(once A1c lands)." The tab-segregation transitional-throwaway hedge is resolved to a single recommendation (defer) with the throwaway path gated behind explicit maintainer override at Open Decision 1.
