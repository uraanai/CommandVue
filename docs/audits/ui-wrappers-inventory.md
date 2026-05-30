# UI wrappers inventory

Snapshot of `src/components/ui/*` (excluding `DataTable.vue`, owned by ADR 0001) captured at the start of the Volt-vs-hand-rolled evaluation (Prompt 2, Phase 2.1).

The `DataTable.vue` wrapper is intentionally excluded: it is TanStack-based per ADR 0001 and is not in scope for Volt adoption regardless of the outcome of ADR 0002. The `Tooltip.vue` wrapper is a placeholder native-`title` implementation (not yet wired to PrimeVue) and is included for completeness.

## Wrappers in `src/components/ui/`

| Wrapper file     | PrimeVue component wrapped                                     | LOC | Slots exposed            | Props exposed                                                                                                       | Volt equivalent                                          | Notes                                                                                                                 |
| ---------------- | -------------------------------------------------------------- | --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Button.vue`     | `primevue/button`                                              | 71  | default                  | `label`, `severity`, `size`, `variant`, `loading`, `disabled`, `iconPos`, plus pass-through attrs                   | **yes** — `npx volt-vue add Button`                      | Operational density: project uses `size="small"` defaults                                                             |
| `IconButton.vue` | `primevue/button` (icon mode)                                  | 61  | default                  | `icon`, `label` (aria), `size`, `variant`, `disabled`, plus attrs                                                   | **yes** — covered by Volt `Button` with icon-only render | Currently a separate file because the project chose to ship two affordances; Volt collapses both into a single Button |
| `Input.vue`      | `primevue/inputtext`                                           | 56  | (none)                   | `modelValue`, `placeholder`, `disabled`, `type`, `size`                                                             | **yes** — `npx volt-vue add InputText`                   | Often used inside the new `<DataTable>` toolbar; identical surface to PrimeVue InputText                              |
| `Select.vue`     | `primevue/select`                                              | 73  | (none)                   | `modelValue` (string\|number\|null), `options` (`{label,value,disabled}[]`), `placeholder`, `disabled`, `showClear` | **yes** — `npx volt-vue add Select`                      | Project pre-bakes `optionLabel="label"`/`optionValue="value"`; Volt's defaults differ                                 |
| `Tabs.vue`       | `primevue/tabs` + `tablist` + `tab` + `tabpanel` + `tabpanels` | 70  | default (per-active-tab) | `modelValue`, `tabs` (`{id,label,disabled}[]`)                                                                      | **yes** — `npx volt-vue add Tabs` (plus sibling files)   | Project exposes a flat-tabs API that masks the 5-component composition                                                |
| `Dialog.vue`     | `primevue/dialog`                                              | 69  | header, default, footer  | `visible`, `header`, `modal`, `closable`, `dismissableMask`, `width`, plus attrs                                    | **yes** — `npx volt-vue add Dialog`                      | Used by manage-X dialogs and the panel-create flow                                                                    |
| `Toast.vue`      | `primevue/toast`                                               | 41  | (none — service-driven)  | `position`, `group`                                                                                                 | **yes** — `npx volt-vue add Toast`                       | Backed by PrimeVue's `useToast` service from `primevue/usetoast`                                                      |
| `Tooltip.vue`    | (none — native `title`)                                        | 20  | default                  | `label`                                                                                                             | **yes** — `npx volt-vue add Tooltip`                     | Placeholder per the file's docstring; was always planned to move to a floating-ui-backed impl                         |

## Tally

- **Total wrappers (excluding DataTable):** 8
- **Wrap PrimeVue directly:** 7 (`Button`, `IconButton`, `Input`, `Select`, `Tabs`, `Dialog`, `Toast`)
- **Placeholder (no PrimeVue yet):** 1 (`Tooltip`)
- **All 8 have a documented Volt equivalent.**

## File-by-file shape

### `Button.vue`

- Pass-through-styled via `:pt` overrides (root + label classes)
- Severity → Tailwind class map (8 severities: primary, secondary, info, success, warn, danger, help, contrast)
- Variant: solid / outlined / text
- Size: small / normal / large
- Custom focus ring via `--color-accent-500`

### `IconButton.vue`

- Same PrimeVue base as Button but renders icon-only
- Accepts a Lucide / Iconify SVG slot or an `icon` prop
- `aria-label` required (enforced via prop)

### `Input.vue`

- Thin wrapper — passes `v-model:modelValue` and forwards attrs
- One project-specific class: `bg-surface text-foreground border-border`

### `Select.vue`

- Hard-codes PrimeVue's `optionLabel="label"` / `optionValue="value"` so consumers pass a typed `Option[]`
- `showClear` prop added on May 23 during the PrimeVue audit
- `modelValue` widened to accept `null` (for clear)

### `Tabs.vue`

- Custom flat `tabs[]` API hides PrimeVue's 5-component composition
- Provides a default slot that emits the active tab id
- Custom tab styling (border-bottom highlight, focus ring) via `tabClass()` helper

### `Dialog.vue`

- Default modal close-on-mask = true (project convention; differs from PrimeVue default)
- Header / footer slots forwarded
- Width prop maps to Tailwind `max-w-*` classes

### `Toast.vue`

- Position default `top-right`
- Group prop for scoped toast queues

### `Tooltip.vue`

- Placeholder; uses native `title` attribute
- File docstring explicitly notes future floating-ui-backed replacement

## Implication for the ADR

Volt covers 100% of the project's hand-rolled wrappers. The decision is not "does Volt have enough coverage?" — that's settled. The decision is "for the components Volt covers, is owning Volt-installed files better than owning project-tailored wrappers?"
