# Data-table usage inventory

Snapshot of every site in CommandVue that imports a data-table library, captured at the start of the TanStack-default migration (Prompt 1, Phase 1.1).

This inventory drives the migration scope. Phase 1.3 of Prompt 1 migrates `EntityListPanel` only; the remaining sites are tracked here for follow-up PRs (and noted in their own labels so reviewers can pick them up).

## Counts at decision time

| Library               | Files | Notes                                                   |
| --------------------- | ----- | ------------------------------------------------------- |
| `primevue/datatable`  | 5     | All introduced by PRs #64–#66 (May 22–23, 2026)         |
| `@tanstack/vue-table` | 0     | Removed in PR #66; reinstalled in Phase 1.1 of Prompt 1 |
| Raw `<table>`         | 0     | Forbidden by `CLAUDE.md` library-first mapping          |

## PrimeVue DataTable usages

| File                                                | Import line | Purpose                                                                                                            | Migration target                                                      | Phase                                    |
| --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------- |
| `src/components/panels/EntityListPanel.vue`         | 3           | Operations entity list with operational symbology in the type column; sortable name/type/status; row-click selects | `<DataTable>` wrapper                                                 | Phase 1.3 (in scope)                     |
| `src/components/panels/TelemetryPanel.vue`          | 4           | High-frequency telemetry feed rendered as a virtualized table                                                      | `<DataTable>` wrapper                                                 | Follow-up PR (out of scope for Prompt 1) |
| `src/components/dialogs/ManageLayoutsDialog.vue`    | 4           | Layout-management dialog with row editing for name + description                                                   | `<DataTable>` wrapper or `primevue/datatable` (row-edit escape valve) | Follow-up PR (out of scope for Prompt 1) |
| `src/components/dialogs/ManageWorkspacesDialog.vue` | 4           | Workspace-management dialog with row editing                                                                       | `<DataTable>` wrapper or `primevue/datatable` (row-edit escape valve) | Follow-up PR (out of scope for Prompt 1) |
| `src/components/dialogs/ManagePresetsDialog.vue`    | 6           | Preset-management dialog (read-only listing + actions column)                                                      | `<DataTable>` wrapper                                                 | Follow-up PR (out of scope for Prompt 1) |

## Notes on the manage-X dialogs

`ManageLayoutsDialog.vue` and `ManageWorkspacesDialog.vue` both use PrimeVue's `editMode="row"` with `DataTableRowEditSaveEvent` for the rename-in-place flow. PrimeVue's row-editing UX is the kind of batteries-included feature that the ADR explicitly preserves as an escape valve. When those migrations are scheduled, the wrapper might gain a row-edit slot, or the dialogs might stay on `primevue/datatable` with a `governance: primevue-datatable` justification. The decision is deferred to the follow-up PR — Prompt 1 does not pre-commit it.

`ManagePresetsDialog.vue` is read-only listing; it will migrate cleanly to the wrapper.

## TanStack-side state

After Phase 1.1 reinstalls the package:

- `package.json` includes `@tanstack/vue-table` (latest stable at install time).
- `@tanstack/vue-virtual` is already present (was kept across the PrimeVue audit).
- No source file imports from `@tanstack/vue-table` yet; the first consumer is the wrapper added in Phase 1.2.

## Stale references to update

These mention the old TanStack arrangement and need to be updated as part of the reversal (some in this PR, some in follow-up PRs as the migrations land):

- `CLAUDE.md` "Tables" row in the locked-stack table currently reads `PrimeVue DataTable (uniform across the app — replaces @tanstack/vue-table)` — updated in this PR.
- `CLAUDE.md` library-first mapping table currently lists `PrimeVue DataTable + Column — never raw <table>` for tabular data — updated in this PR to point at the wrapper.
- `README.md` Stack section line 42 already lists `@tanstack/vue-table + @tanstack/vue-virtual` (it was never updated during the PrimeVue audit, so it accidentally describes the post-revert state already). Verified, no change needed.
- `src/components/panels/EntityListPanel.vue` line 15 comment still references the prior TanStack implementation — rewritten in Phase 1.3 when the file is migrated.
