# 0002. Volt vs hand-rolled PrimeVue wrappers

- **Status:** Proposed
- **Date:** 2026-05-24
- **Deciders:** Project maintainer
- **Decision gate:** This ADR is the gate for Prompt 2 (Volt evaluation, PrimeVue audit and migration). Phases 2.2–2.4 do not begin until the user accepts one of the three options below.

## Context

CommandVue uses PrimeVue 4 in unstyled mode. Today, every UI primitive the app needs is a hand-rolled wrapper in `src/components/ui/*` — eight of them: `Button`, `IconButton`, `Input`, `Select`, `Tabs`, `Dialog`, `Toast`, `Tooltip`. Each is a thin (~50–75 line) Vue SFC that imports a PrimeVue Unstyled component, applies project Tailwind classes via `:pt` (PassThrough), and narrows the public API to what CommandVue actually uses.

PrimeTek now ships **Volt** — a Tailwind-first distribution of pre-styled unstyled-PrimeVue components. You don't depend on Volt; you copy its source into your repo with `npx volt-vue add <Component>`. The component lives at `@/volt/<Component>.vue` and is yours to own from that point. Volt's overview describes 50+ components covering PrimeVue's everyday surface — buttons, form controls, dialogs, menus, tables, navigation, overlays, charts — with WCAG AA accessibility and Tailwind v4 throughout. It is not yet at full PrimeVue parity (PrimeVue has 80+ components), but the gap is in advanced / niche components (Editor, Galleria, OrderList, Carousel, etc.) that CommandVue does not currently use.

Inventory evidence is in two companion documents:

- [`docs/audits/ui-wrappers-inventory.md`](../audits/ui-wrappers-inventory.md) — every file in `src/components/ui/*` (excluding `DataTable.vue` which is owned by ADR 0001).
- [`docs/audits/primevue-component-usage.md`](../audits/primevue-component-usage.md) — every PrimeVue import anywhere in `src/`.

The headline numbers from those inventories:

- 8 hand-rolled wrappers in `src/components/ui/*` (excluding DataTable). All 8 have a Volt equivalent confirmed in Volt's documentation.
- 10 distinct PrimeVue components used in the app (counting the Tabs family as one). 12 confirmed in Volt's docs; 3 likely-but-not-yet-verified (Menubar, ContextMenu, FileUpload); 1 uncertain (ColorPicker — uncommon).
- 4 files (`MapOverlayPresetEditor`, `SaveLayoutAsDialog`, `MarkdownPanel`, `SymbologyPanel`, `WorkspaceSwitcher`, `MenuBar`, `AppIconItem`) use `primevue/*` components **directly, without going through a wrapper**. Today these are treated as one-off consumers; under any of the options below, they become a candidate to either wrap or to move into `@/volt/`.
- The four `primevue/datatable` consumers are out of scope for this ADR — they're already governed by ADR 0001 with their own migration plan.

The decision now affects every existing wrapper, every direct-`primevue/*` consumer, and the trajectory of every future UI primitive added to the project. It also feeds into Phase 2.2's audit and Phase 2.4's lint rules.

## Decision

To be decided by the user. The three options are A, B, and C below; the recommendation at the bottom of this ADR is C with explicit criteria.

## Options considered

### Option A — Adopt Volt wholesale

Run `npx volt-vue add` for every Volt-covered component CommandVue uses, replacing the eight hand-rolled wrappers in `src/components/ui/*`. The seven files that currently import `primevue/*` directly also move to `@/volt/` imports. The new tree at `src/volt/*` becomes the canonical home for UI primitives. The existing `src/components/ui/*` wrappers are deleted (the DataTable wrapper stays — ADR 0001 governs it).

**Pros:**

- One source of truth for UI primitives, maintained upstream by PrimeTek as Volt evolves.
- Larger community of users running into the same edge cases; bugfixes flow upstream.
- WCAG AA accessibility audited by PrimeTek rather than us.
- Less code we own. Eight 50–75 line wrappers go away.
- PrimeTek's stated Tailwind-first direction means Volt gets first-class treatment when PrimeVue changes.

**Cons:**

- "Pre-styled" still means we'll be customizing. Volt's defaults target general admin UIs; CommandVue's compact-operational density and dark-by-default surface are not Volt's defaults.
- Once customized, the "upstream maintenance" benefit erodes — modifications to a copied Volt file diverge from upstream the same way wrapper modifications diverge from PrimeVue.
- Two parallel trees disappears (good) but the project still needs to decide what to do with `Tooltip.vue` (placeholder, no PrimeVue equivalent until floating-ui is wired up — Volt has a `Tooltip` that may or may not match the planned implementation).
- `Volt-vue add` is a CLI install step that has to be re-run when bumping Volt; that's a workflow change for contributors.
- Volt's components are typically larger (Volt's `Button.vue` is several hundred lines vs CommandVue's 71-line wrapper) because they ship the full PrimeVue PassThrough class graph upfront. More code to read when debugging.

### Option B — Continue with hand-rolled wrappers

Keep `src/components/ui/*` as the home for every UI primitive. The seven files that currently import `primevue/*` directly get matching wrappers (`Checkbox`, `ColorPicker`, `Slider`, `Textarea`, `Menu`, `Menubar`, `ContextMenu`, `FileUpload`, `Fieldset`, `Tag`) — each a thin 40–70 LOC wrapper following the pattern of the existing eight. Volt remains a reference for ideas, not a source.

**Pros:**

- One way to do things. Every UI primitive sits at `@/components/ui/*`.
- Total control. Wrapper surfaces are tailored to CommandVue's needs (e.g. `Select`'s pre-baked `optionLabel`/`optionValue`, `Tabs`' flat array API).
- Wrappers stay minimal — they consume PrimeVue's Unstyled components and expose only what we need. No "ship the full PassThrough class graph" overhead.
- No CLI install step for contributors. PrimeVue is a regular dependency.
- The PrimeVue-first / library-first rule already in CLAUDE.md continues to apply unchanged.

**Cons:**

- Every wrapper is our code to maintain — bugs, accessibility, edge cases.
- When PrimeVue's internals change (rare but real — see CLAUDE.md's runtime-verification notes on major bumps), the wrappers have to track.
- New UI primitives require writing a new wrapper before they can be used. That's friction for "I just want a button in this color".
- Accessibility audits land on us.

### Option C — Hybrid: hand-rolled for density-critical, Volt for general-purpose

Apply explicit criteria to pick per component:

**Stays hand-rolled in `src/components/ui/*`:**

- Components where CommandVue's operational density differs materially from Volt's defaults: `Button`, `IconButton`, `Tabs`, `Toast`.
- Components with a project-specific API surface that masks PrimeVue's: `Tabs` (flat `tabs[]` array vs PrimeVue's 5-component composition), `Select` (pre-baked `optionLabel`/`optionValue`).
- Placeholders that are explicitly scheduled to swap (`Tooltip`, until floating-ui).

**Adopts Volt at `src/volt/*`:**

- Components with a one-shot surface where Volt's defaults are fine or trivially overridable: `Dialog`, `Input`, `Checkbox`, `Slider`, `Textarea`, `Fieldset`, `Tag`, `ColorPicker` (if Volt covers it).
- Menu-family components where Volt's keyboard / ARIA behavior is harder to roll than to adopt: `Menu`, `Menubar`, `ContextMenu`, `FileUpload`.

**Pros:**

- Each component lands in the place that best matches its trade-off.
- Density-critical primitives keep their tight, project-tailored surface.
- General-purpose primitives that we currently inline (`Checkbox`, `ColorPicker`, `Slider`, `Textarea`, etc.) get a Volt-installed home immediately — no need to write new wrappers from scratch.
- Volt becomes a tool we reach for when it fits, not a foreign convention to learn end-to-end.

**Cons:**

- Two patterns in the codebase. Contributors need a one-line rule: "wrapper if density-critical or project-API-masked; Volt otherwise."
- Risk of style drift between the two trees. Mitigated by enforcing the same CSS variable / `--color-*` token usage in both (Volt uses Tailwind classes that resolve to the same tokens; wrappers use `:pt` that does the same).
- ESLint rules need to know about both directories.

## Decision criteria

Six criteria, weighted by what actually bites contributors in practice:

1. **Density (heavy weight).** CommandVue targets compact-by-default operational UIs. The default density of every primitive matters because consumers should not have to override on every use site. The hand-rolled wrappers were sized for this; Volt's defaults are more spacious.
2. **Operational aesthetic (heavy weight).** Project tokens (`--color-surface`, `--color-accent-500`, etc.) need to apply uniformly. Both approaches resolve to the same tokens — Volt via Tailwind class lookup, wrappers via `:pt` — so this is largely a wash.
3. **Coverage (medium weight).** Both options cover 100% of confirmed usage. ColorPicker is the only uncertain item; either option handles it cleanly. This criterion does not differentiate the options.
4. **Maintenance (medium weight).** Hand-rolled wrappers are ours to maintain forever. Volt components are ours to maintain only when modified. Without modifications, Volt drifts forward with upstream; with modifications, parity erodes the same way wrappers do.
5. **Contributor onboarding (medium weight).** Hand-rolled wrappers follow a 50-line pattern every contributor learns in five minutes. Volt has its own conventions (PassThrough class graphs, file size, install workflow) that a new contributor learns separately. One pattern is friendlier than two — but two patterns isn't expensive if the criteria for choosing between them is one line in CLAUDE.md.
6. **Future-proofing (light weight).** PrimeTek's stated direction is Tailwind-first. Volt is the favored child. Wrappers will continue to work but won't benefit from PrimeTek-side investment.

## Recommendation

**Option C — hybrid.** Rationale:

- **Coverage is not the limiting factor.** All three options cover what CommandVue uses. The decision is shaped by other factors.
- **Density matters here.** Operational UIs are denser than admin UIs. The current `Button` size is `small` by default; Volt's `Button` is `comfortable`. Switching wholesale (Option A) means either (a) accepting a less-dense default, which conflicts with the project's command-center aesthetic, or (b) immediately modifying every Volt component, which loses the upstream-maintenance benefit before we've banked it.
- **Project-API masking is a real win.** `Select`'s pre-baked `optionLabel`/`optionValue` and `Tabs`' flat-array API are quality-of-life improvements that consumers feel. Replacing them with Volt's verbose composition is a regression — even if functionally equivalent.
- **But Volt is the right answer for components we don't currently wrap.** Adding ten new hand-rolled wrappers (`Checkbox`, `ColorPicker`, `Slider`, `Textarea`, `Menu`, `Menubar`, `ContextMenu`, `FileUpload`, `Fieldset`, `Tag`) just to comply with "everything goes through `src/components/ui/*`" is busywork — these are general-purpose primitives where Volt's defaults are fine.
- **The two-directory cost is real but small.** One CLAUDE.md line documents the rule; one ESLint rule documents the boundary; one CONTRIBUTING.md paragraph onboards new contributors. That's the entire ongoing cost.

If the user rejects Option C, the next-best is **Option B** — the inertia of the existing hand-rolled tree is real, and writing ten new thin wrappers is a one-time cost that buys back single-pattern simplicity. Option A is feasible but is the bigger swing; the case for it is "PrimeTek's Tailwind-first direction will pay off in 12+ months" rather than anything visible today.

## Consequences

### If Option C is accepted

- **Phase 2.2 audit** flags every direct `primevue/*` consumer (the seven non-wrapped files) with a target of `@/volt/*`, and every raw `<button>` / `<input>` / `<select>` with a target of `@/components/ui/*` (wrapper). Density-critical wrappers stay; general-purpose ones get Volted.
- **Phase 2.3 migrations** are split into two PRs at minimum: one to install the Volt-targeted components (`Checkbox`, `Slider`, `Textarea`, `Menu`, `Menubar`, `ContextMenu`, `FileUpload`, `Fieldset`, `Tag`, plus `Dialog` and `Input` if they're Volted) and one to refactor consumers to import from `@/volt/`. The four existing density-critical wrappers (`Button`, `IconButton`, `Tabs`, `Toast`) stay where they are.
- **Phase 2.4 lint rules** flag raw HTML interactive elements outside the two allowed UI-primitive directories. ESLint's `no-restricted-syntax` (or a small custom rule) enforces "wrapper or Volt — pick one, not raw HTML." A separate `no-restricted-imports` rule (already exists for `primevue/datatable`) is extended to encourage `@/volt/*` imports over `primevue/*` imports from non-primitive files.
- **CLAUDE.md** gets a one-line rule plus a pointer to this ADR. The library-first table in CLAUDE.md's mapping section is updated so each row lists the canonical primitive: "Dialog → `@/volt/Dialog.vue`", "Button → `@/components/ui/Button.vue` (density-critical, stays hand-rolled)", etc.
- **CONTRIBUTING.md** gets a paragraph explaining the rule for new contributors.
- **Agent skills** (`commandvue-panel-development`, others) get a section pointing at the rule.

### If Option A is accepted

- All eight hand-rolled wrappers (except `DataTable`) are replaced by Volt installs. `src/components/ui/*` shrinks to just `DataTable.vue` and its `datatable/` directory; everything else lives at `src/volt/*`.
- The seven direct-`primevue/*` consumers move their imports to `@/volt/`.
- Phase 2.3 produces one large migration PR (or two grouped by area) replacing every consumer's wrapper import with a `@/volt/` import after the Volt install.
- Phase 2.4 lints raw HTML and forbids `@/components/ui/*` imports for anything except `DataTable`.

### If Option B is accepted

- The eight existing hand-rolled wrappers stay.
- Ten new thin wrappers are added to `src/components/ui/*` for the currently-unwrapped components.
- The seven direct-`primevue/*` consumers refactor to import from `@/components/ui/`.
- Phase 2.3 produces wrapper PRs followed by consumer-refactor PRs.
- Phase 2.4 forbids both raw HTML and direct `primevue/*` imports from non-wrapper files.

## Open questions for the user

These are decisions Claude Code cannot make without input. The user picks an option above, plus answers these:

1. **Density default for components Volted under Option C.** Volt's defaults are general-purpose admin (= roughly "comfortable"). Should the Volt-installed components be modified in-place to default to `compact`, or should they accept Volt's defaults and let consumers pass `size="small"` per use? Modifying upfront aligns with the operational aesthetic; not modifying preserves upstream parity.

2. **`Tooltip.vue` future.** The current `Tooltip` is a `title`-attribute placeholder. Under any option, it eventually needs floating-ui (or PrimeVue's `Tooltip`). Should Phase 2.3 wire that, or defer to a separate prompt?

3. **`ColorPicker` if Volt doesn't have it.** If Volt's catalog confirms no `ColorPicker`, the single consumer (`MapOverlayPresetEditor`) keeps `primevue/colorpicker` direct, with a documented exception. Acceptable, or should we wrap it in `src/components/ui/ColorPicker.vue` under Option C anyway for consistency?

4. **Scope of Phase 2.3 migrations.** With Option C, Phase 2.3 has ~17 consumer files to touch (the seven direct-`primevue/*` consumers plus any raw HTML elements found in Phase 2.2). Is one PR per "area" (layout, dialogs, panels, chrome, presets) right, or should Phase 2.3 produce one large PR for the whole thing?

## Alternatives considered

- **AG Grid-style: vendor a single component, not a whole tree.** Rejected. Volt isn't a single component; trying to vendor pieces of it is more complexity than either A or B.
- **Don't decide; let it grow organically.** Rejected. Without an explicit rule, contributors will reach for whatever feels natural at the time, and the codebase ends up with a mix of all three options without intent. Phase 2.4 lint enforcement is only useful with an explicit decision.
- **Volt as a dependency rather than copy-in.** Not on offer — PrimeTek explicitly designed Volt around the code-ownership model. The `npx volt-vue add` workflow is the supported path.

## References

- Volt overview — https://volt.primevue.org/overview
- Volt component catalog — https://volt.primevue.org/ (browse from the navigation sidebar)
- PrimeVue (Unstyled mode) — https://primevue.org/unstyled/
- CommandVue ADR 0001 (DataTable library) — `docs/decisions/0001-datatable-library.md`
- Audit: `docs/audits/ui-wrappers-inventory.md`
- Audit: `docs/audits/primevue-component-usage.md`

## Process

This ADR is the decision gate for Prompt 2. The user reviews the inventories and recommendation, picks an option (A / B / C), and answers the open questions above. Phase 2.2 then runs with the chosen option in mind; the audit's `Recommended action` column resolves differently under each option.

After user sign-off:

1. Update `Status` from `Proposed` to `Accepted`.
2. Add an `## Accepted decision` section recording the choice, the date, and the user's answers to the open questions.
3. Update `CLAUDE.md`'s UI-primitives placeholder to reference the accepted decision.
4. Phase 2.2 begins.
