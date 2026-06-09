# UI & components

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Library-first rule (MANDATORY)

**Before building any UI component, check if PrimeVue — or another already-installed library in the locked stack — has a pre-built equivalent. If it does, use it. Do not roll your own.**

This rule applies to every UI surface: menus, dropdowns, dialogs, close buttons, tables, tabs, popovers, context menus, file pickers, form controls (select / checkbox / color / range / textarea), tags / chips, fieldsets, dividers, toasts, file uploads — all of it. PrimeVue 4 ships 80+ unstyled components; the project consumes them with `:pt` (passthrough) for Tailwind theming. Charts come from `vue-echarts`; maps from `cesium` / `maplibre-gl`; symbology from `milsymbol` / `@orbat-mapper/convert-symbology`. The locked-stack table (in [`project-and-stack.md`](./project-and-stack.md)) names everything available.

### Workflow

1. **Before writing markup** for a new UI element, scan PrimeVue's component list (https://primevue.org — fetch via Context7 with library id `/websites/primevue`). The full reference workflow lives in [`.agent/workflows/library-first.md`](../workflows/library-first.md).
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

## Styling rules

- Tailwind v4 utility-first. No CSS modules, no scoped styles for layout/spacing.
- Use the `cn()` helper from `src/utils/cn.ts` (clsx + tailwind-merge) when composing dynamic classes.
- Design tokens live in `src/assets/styles/tokens.css` as CSS variables.
- Override brand colors by editing `tokens.css`. Do not hardcode hex values in components.
- Dark mode toggles via `data-theme="dark"` on `<html>`.
