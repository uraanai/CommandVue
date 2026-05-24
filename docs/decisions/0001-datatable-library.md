# 0001. TanStack Vue Table is the default data-table library

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Project maintainer
- **Supersedes:** the May 23, 2026 PrimeVue-first migration outcome for tabular data (PRs #64–#66) — see "Context" below

## Context

CommandVue is a high-density operations-dashboard template. Tables are a primary surface: entity lists, telemetry feeds, manage-X dialogs, asset rosters, alert queues. The codebase has been through two complete table-library iterations in the past week:

1. **Original state:** `@tanstack/vue-table` (headless) drove `EntityListPanel`; `@tanstack/vue-virtual` handled virtualization.
2. **May 22–23, 2026 — "PrimeVue-first audit" (PRs #64, #65, #66):** every table site was migrated to PrimeVue `DataTable` + `Column`. `@tanstack/vue-table` was removed from `package.json`. `CLAUDE.md` was updated to make PrimeVue the default and codified a "library-first rule" preferring batteries-included PrimeVue components over custom code.
3. **Current decision:** revert to `@tanstack/vue-table` as the default. The PrimeVue-first audit was the right reflex for one-off form controls and dialogs, but it over-applied to high-density tabular data — where headless control of the visual layer is worth the extra wrapper code.

Surfaces affected by this reversal are bounded: five files in `src/components/panels/` and `src/components/dialogs/`. None of the form controls, menus, dialogs, file pickers, color pickers, or other PrimeVue swaps from PRs #64–#66 are in scope; the library-first rule remains in force for everything _except_ tabular data.

## Decision

`@tanstack/vue-table` is the default data-table library for CommandVue.

All new tables use the project's `<DataTable>` wrapper (built on `@tanstack/vue-table` + `@tanstack/vue-virtual`, added in Phase 1.2). Existing PrimeVue `DataTable` usages migrate to the wrapper case by case — `EntityListPanel` first (Phase 1.3); other panels and dialogs in follow-up PRs.

`primevue/datatable` remains installed and may still be used in narrow cases where its built-in features (TreeTable, full row-edit-in-place, hierarchical grouping) materially reduce code volume. Every such use:

- Justifies the choice in the PR description (see PR template governance section).
- Is auto-labeled `governance: primevue-datatable` by the repository labeler.
- Is flagged by an ESLint warning so reviewers see the deviation during code review.

## Rationale

**Visual control without fighting library CSS.** PrimeVue `DataTable` ships with opinionated layout and spacing. CommandVue's density targets (≥30 visible rows in the default operations workspace) and design-token vocabulary (`src/assets/styles/tokens.css`) want a layer that does layout _our_ way without `:pt` (passthrough) override stacks. Headless TanStack delivers state management; the visual layer is ours.

**Bundle weight.** `@tanstack/vue-table` + `@tanstack/vue-virtual` weigh in around 15 KB minified. PrimeVue `DataTable` with its sub-modules and shared service dependencies is several times that. CommandVue's bundle budget is tight because the map and symbology layers already cost a lot.

**Header layout precision.** The May 23 migration left a header-alignment quirk in `EntityListPanel`: title text and filter icons were laid out in subtly different flex contexts and never lined up perfectly across columns. With a headless library the header is a CSS-grid cell we own — title `1fr`, filter icon `auto`, perfectly aligned by definition.

**Domain precedent.** The orbat-mapper reference project (closest open-source analogue in this domain) uses TanStack Vue Table for the same operational-symbology + entity-list use case, at the same scale.

**Virtualization stays free.** `@tanstack/vue-virtual` is already in the locked stack and was not touched by the PrimeVue audit. The wrapper integrates it natively; no extra dependency.

**Library-first rule still applies elsewhere.** The May 23 library-first rule is correct for menus, dialogs, color pickers, file uploads, form controls, fieldsets, tags, tabs, popovers — everything PrimeVue ships a focused component for. It is _only_ relaxed for tabular data, and only because the cost/benefit math changes at high row density.

## Consequences

**We commit to building and maintaining UI for:**

- Sorting (with `aria-sort` and keyboard activation).
- Column resize via TanStack's `enableColumnResizing` and a draggable handle in each `<th>`.
- Column visibility toggle exposed via a toolbar slot.
- Density modes (`compact` / `comfortable` / `spacious`) as a CSS data-attribute switch.
- Sticky header and optional sticky first column with correct `z-index` layering.
- Per-column filter inputs and an optional global filter.

**We lose:**

- TreeTable (hierarchical rows). If a future panel needs it, `primevue/datatable` is the escape valve.
- Row-edit-in-place with built-in save/cancel buttons. Same escape valve.
- PrimeVue's Excel-style cell-by-cell editing.

**We accept:**

- The wrapper is project-specific code. Wrapper bugs are our bugs to fix, not PrimeVue's.
- Contributors learn the wrapper API once. Subsequent panels are faster to build because the wrapper is shaped around CommandVue's patterns (panel-state serialization of sort/filter/visibility, density default, operational symbology cell helpers).

## Governance

The reversal is enforced so future contributors don't drift back:

- **PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) includes a governance checkbox for `primevue/datatable` usage requiring written justification.
- **PR labeler** (`.github/labeler.yml` + workflow) auto-applies `governance: primevue-datatable` when a diff touches `primevue/datatable`.
- **ESLint rule** (`no-restricted-imports`, severity `warn`) surfaces the import during local lint and CI.
- **Agent skill** (`.agent/skills/commandvue-panel-development/SKILL.md`) teaches future agent sessions to reach for the wrapper first.
- **CLAUDE.md** updated to point at the wrapper as the canonical path and to link to this decision record.

## Alternatives considered

- **PrimeVue `DataTable` as default (status quo from May 23).** Rejected for the reasons above: visual control, density, header alignment, bundle weight, header-grid precision.
- **AG Grid Community.** Rejected. License complexity at the enterprise tier and a substantially larger bundle than TanStack. Migration cost is comparable; we don't gain enough to justify the switch.
- **Hand-rolled table from scratch.** Rejected. TanStack already solves state management (sort, filter, group, expand, pin, column sizing, column ordering, row selection). Re-deriving that without bugs is not worth the engineering hours.
- **Two parallel defaults (PrimeVue for dialogs, TanStack for panels).** Rejected. Splitting the default creates a "which one do I reach for?" question on every PR; the cost of consistency is one wrapper.

## References

- TanStack Vue Table docs — https://tanstack.com/table/v8/docs/framework/vue/vue-table
- TanStack Vue Virtual docs — https://tanstack.com/virtual/latest/docs/framework/vue/vue-virtual
- Vue + virtualization example — https://tanstack.com/table/v8/docs/framework/vue/examples/virtualized-rows
- orbat-mapper reference project — https://github.com/orbat-mapper/orbat-mapper
- May 22–23, 2026 PrimeVue-first audit PRs — #64, #65, #66 (this decision narrows their scope)
- Phase 1.2 wrapper implementation — `src/components/ui/DataTable.vue`
- Usage inventory at the time of decision — `docs/audits/datatable-usage-inventory.md`
