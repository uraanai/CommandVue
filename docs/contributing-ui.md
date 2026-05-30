# UI primitives — contributor guide

CommandVue is **PrimeVue-first**. Every UI surface — buttons, dialogs, menus, file pickers, color pickers, range sliders, textareas, tags, fieldsets, popovers, toasts — is built on top of PrimeVue (in unstyled mode) and styled with Tailwind v4 via the `:pt` (passthrough) prop or via Volt's Tailwind class strings. Don't reinvent the wheel; the wrapper already exists.

The rule applies to **every** new piece of UI you build, including for panels and demo pages.

If you're an AI agent: the canonical source for the rule is `CLAUDE.md` (top of repo). This page expands the rule for human contributors.

## Why a PrimeVue-first rule

| Without the rule                             | With the rule                                   |
| -------------------------------------------- | ----------------------------------------------- |
| Hand-rolled menus, dialogs, dropdowns        | One menu component, one dialog component        |
| Accessibility re-implemented per surface     | Accessibility solved upstream                   |
| Inconsistent keyboard nav, focus, ARIA roles | Consistent across every surface                 |
| 200+ lines for a context menu                | 20 lines, mostly `:pt` styling                  |
| `<input type=color>` browser-default UI      | `ColorPicker` with palette and a popover swatch |

PrimeVue ships 80+ unstyled components. CommandVue extends them via the `:pt` prop or via copy-in Volt files — never via PrimeVue's bundled CSS themes.

## The two installation targets

Per [ADR 0002](./decisions/0002-volt-vs-handrolled-wrappers.md), primitives live in one of two places:

### `src/components/ui/*` — hand-rolled wrappers

For primitives that are:

- **density-critical** (used heavily in dense lists, dense forms, toolbars where vertical rhythm matters) — `Button`, `IconButton`, `Select`
- **specialized** beyond what Volt offers — `Tooltip` (floating-ui), `ColorPicker` (palette + popover), `Toast`
- **API-masked** — we want to expose a narrower or more opinionated surface than PrimeVue's

These wrappers use PrimeVue directly via `:pt` and live next to each other. Look at `src/components/ui/Button.vue` as a reference template.

### `src/volt/*` — Volt-vendored primitives

For general-purpose primitives that:

- Map 1:1 to a PrimeVue surface with no project-specific narrowing
- Are unlikely to need density tuning beyond what Volt's `p-small:` / `p-large:` variants already cover
- Get installed with `npx volt-vue add <Name>` — PrimeTek owns the canonical version; we own the copy

Today this is: `Dialog`, `Input` (PrimeVue `InputText`), `Checkbox`, `Slider`, `Textarea`, `Fieldset`, `Tag`, `Menu`, `Menubar`, `ContextMenu`, `FileUpload`. The exhaustive list is the `src/volt/` directory.

### Which target should I use?

Decision flow when adding a new primitive:

1. **Does PrimeVue have it?** (https://primevue.org). If yes, continue. If no, surface the gap to maintainers; don't roll your own.
2. **Is Volt's version close enough?** (https://volt.primevue.org). If yes and you don't need a narrower API, install it via `npx volt-vue add <Name>`.
3. **Do you need a narrower API or density-critical defaults?** Hand-roll a wrapper in `src/components/ui/` that delegates to `<PvX>` and exposes only the props you want consumers to use.
4. **In doubt?** Install via Volt first. You can always promote to hand-rolled later if a consumer surface demands it.

## How the rule is enforced

Three layers, all warn-level (your build won't fail; the warnings are visible during local lint and CI):

| Layer          | What it does                                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint         | `vue/no-restricted-html-elements` flags raw `<button>`, `<input>`, `<select>`, `<textarea>` in any `.vue` file outside `src/components/ui/**` and `src/volt/**`.                                                             |
| ESLint         | `@typescript-eslint/no-restricted-imports` flags direct `primevue/*` component imports from consumer files. Helper modules (`primevue/config`, `primevue/menuitem`, etc.) and type-only imports are allowed.                 |
| GitHub Actions | The `UI primitive governance` workflow scans the PR diff for raw HTML interactive elements outside the primitive directories and applies the `governance: raw-html-element` label. The label is informational, not blocking. |
| PR template    | The Governance flags section has checkboxes for raw-HTML and direct `primevue/*` deviations. Tick them and write the justification.                                                                                          |

## Allowed deviations

These do **not** trigger warnings or labels:

- Raw `<button>`, `<input>`, `<select>`, `<textarea>` **inside** `src/components/ui/**` or `src/volt/**`. Those files _are_ the primitives.
- `import type { ... } from "primevue/*"` — type-only imports never run the PrimeVue runtime, so they're allowed everywhere.
- `import ... from "primevue/menuitem"` / `primevue/config` / `primevue/api` / `primevue/usetoast` / `primevue/useconfirm` — these are not components.
- `import ... from "primevue/datatable"` / `primevue/column` — governed separately by [ADR 0001](./decisions/0001-datatable-library.md); the DataTable warning takes precedence over the broader pattern.

## Documented escape valves

When the rule is genuinely the wrong call for your situation:

1. Add an `eslint-disable-next-line` comment with a one-line justification.
2. Tick the corresponding PR-template checkbox and write the justification in the body.
3. Land the change.

The warning, the disable comment, and the PR-template justification together form a single audit trail.

Today's documented escape valves:

- **TreeTable / row-edit-in-place / hierarchical grouping** → `primevue/datatable` (ADR 0001).
- **Cesium / MapLibre internal DOM** that conflicts with passthrough Tailwind — keep raw HTML inside the relevant composable. (None today; this is a pre-emptive note.)

## Common mappings (memorize these before reaching for raw HTML)

| Need                                           | Use                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Button                                         | `src/components/ui/Button.vue` (hand-rolled, density-critical)                                                            |
| Icon-only button                               | `src/components/ui/IconButton.vue`                                                                                        |
| Text input                                     | `src/volt/Input.vue` (PrimeVue `InputText`)                                                                               |
| Number input                                   | `src/volt/InputNumber.vue` (install via `npx volt-vue add InputNumber` if missing)                                        |
| Textarea                                       | `src/volt/Textarea.vue` — never raw `<textarea>`                                                                          |
| Select / dropdown                              | `src/components/ui/Select.vue` (hand-rolled)                                                                              |
| Multi-select                                   | `src/volt/MultiSelect.vue` (install via `npx volt-vue add MultiSelect` if missing)                                        |
| Checkbox                                       | `src/volt/Checkbox.vue` (`binary` prop for single)                                                                        |
| Radio                                          | `src/volt/RadioButton.vue` (install via `npx volt-vue add RadioButton` if missing)                                        |
| Range / slider                                 | `src/volt/Slider.vue` — never `<input type=range>`                                                                        |
| Color picker                                   | `src/components/ui/ColorPicker.vue` (hand-rolled — palette + popover)                                                     |
| Date picker                                    | `src/volt/DatePicker.vue` (install via `npx volt-vue add DatePicker` if missing)                                          |
| File upload                                    | `src/volt/FileUpload.vue` (`mode="basic"` + ref-triggered `choose()`)                                                     |
| Modal / dialog                                 | `src/volt/Dialog.vue`                                                                                                     |
| Confirm dialog                                 | `src/volt/ConfirmDialog.vue` (install if missing)                                                                         |
| Right-click context menu                       | `src/volt/ContextMenu.vue`                                                                                                |
| Top menu bar / nested submenus                 | `src/volt/Menubar.vue`                                                                                                    |
| Popup menu (workspace switcher, action menu)   | `src/volt/Menu.vue` (`popup` mode)                                                                                        |
| Tabbed UI                                      | `src/components/ui/Tabs.vue` (wraps PrimeVue `Tabs` + `TabList` + `Tab` + `TabPanels`)                                    |
| Tabular data (sortable, filterable, paginated) | `src/components/ui/DataTable.vue` (TanStack default — see ADR 0001). `primevue/datatable` is the documented escape valve. |
| Card grid / item gallery                       | `src/volt/DataView.vue` (`layout="grid"`)                                                                                 |
| Section grouping                               | `src/volt/Fieldset.vue`                                                                                                   |
| Inline label / badge                           | `src/volt/Tag.vue`                                                                                                        |
| Toast notification                             | `src/components/ui/Toast.vue` (hand-rolled wrapper around PrimeVue `Toast`)                                               |
| Popover                                        | `src/volt/Popover.vue` (install if missing)                                                                               |
| Divider                                        | `src/volt/Divider.vue` (install if missing)                                                                               |
| Tooltip                                        | `src/components/ui/Tooltip.vue` (placeholder — `title` attribute today; floating-ui in flight)                            |
| Chart                                          | `vue-echarts` (the chart library is separate from the UI primitive rule)                                                  |

If something you need isn't on this list, check the PrimeVue and Volt catalogues before inventing custom markup. New mappings discovered during work should be added here.

## Styling a primitive

### Hand-rolled wrapper (`src/components/ui/*`)

Use the `:pt` (passthrough) prop to apply Tailwind classes to each named section. The project's `cn()` helper at `src/utils/cn.ts` merges classes via `tailwind-merge`:

```vue
<script setup lang="ts">
import PvButton from "primevue/button";
import { computed } from "vue";

import { cn } from "@/utils/cn";

const rootClass = computed(() =>
  cn(
    "inline-flex items-center justify-center rounded-md",
    "px-3 py-1.5 text-sm font-medium",
    "bg-accent-600 text-white hover:bg-accent-500",
  ),
);
</script>

<template>
  <PvButton :pt="{ root: { class: rootClass } }">
    <slot />
  </PvButton>
</template>
```

Consumers override styling per use site by passing `class="..."` — the wrapper's `cn()` will merge their classes into the root via `tailwind-merge` if you set `defineOptions({ inheritAttrs: false })` and forward via `:pt` (see `src/components/ui/IconButton.vue` for the pattern).

### Volt primitive (`src/volt/*`)

Volt files ship a `theme` object with Tailwind class strings keyed by section. Override the per-section strings to match the project palette:

```vue
const theme = ref<TextareaPassThroughOptions>({ root: ` bg-surface-0 dark:bg-surface-950 text-surface-700 dark:text-surface-0 ... `, });
```

Consumers can layer additional classes via `:pt={ root: { class: '...' } }`; the wrapper's `ptViewMerge` (in `src/volt/utils.ts`) feeds both into `tailwind-merge`.

## Theming tokens

All colors are CSS variables defined in `src/assets/styles/tokens.css`. Use the semantic names:

- `--color-surface` / `bg-surface`
- `--color-surface-raised` / `bg-surface-raised`
- `--color-surface-sunken` / `bg-surface-sunken`
- `--color-foreground` / `text-foreground`
- `--color-muted` / `text-muted`
- `--color-border` / `border-border`
- `--color-accent-{50..900}` / `bg-accent-500`

The `dark:` variant resolves on `data-theme="dark"` (set by `useTheme()` on `<html>`). Both light and dark values are token-driven; never hardcode hex values in components.

Brand colors are overridable defaults — see [`docs/theming.md`](./theming.md).

## Adding a new primitive

1. **Check PrimeVue** at https://primevue.org. If absent: stop and ask in an issue.
2. **Check Volt** at https://volt.primevue.org. If present and general-purpose, install: `npx volt-vue add <Name>`. The CLI drops a file at `src/volt/<Name>.vue` — review it, edit the theme strings to match project tokens, commit.
3. **If hand-rolling**, create `src/components/ui/<Name>.vue` modelled on the existing wrappers. Keep the API narrow (typed props, no PrimeVue-specific concepts leaking out unless the consumer specifically needs them).
4. **Update the mappings table above** in the same PR.
5. **If the primitive is density-critical** (used in lists/forms where height matters), make sure its `sm`/`md`/`lg` defaults match the rest of the wrappers — `sm` is 24px tall (`py-1 text-xs`).
6. **Update CLAUDE.md** if the new primitive belongs in the library-first table near the top of that file.

## Adding a deviation to a published primitive

If you need a one-off variant (e.g. `Button` in `success` color for one screen):

1. **Don't** add a new variant to the wrapper unless it has at least two callers.
2. **Do** pass `class="..."` from the consumer to override styling. The wrapper's `cn()` will merge it.
3. **If two+ callers need the same variant**, promote it into the wrapper's `variant` enum.

## Questions to ask before adding raw HTML

If you find yourself reaching for `<button>` or `<input>`:

- Have I checked the mappings table above?
- Have I checked the PrimeVue catalogue for the component I think doesn't exist?
- Have I checked Volt for a Tailwind-ready version of the PrimeVue component?
- Is the only reason I want raw HTML "to keep it simple"? (That reason is usually wrong — the wrappers _are_ simple.)
- If the answer to all of the above is "yes I really need raw HTML", does it belong inside `src/components/ui/` or `src/volt/`?

## References

- [ADR 0001 — DataTable library](./decisions/0001-datatable-library.md)
- [ADR 0002 — Volt vs hand-rolled wrappers](./decisions/0002-volt-vs-handrolled-wrappers.md)
- [`CLAUDE.md` library-first table](https://github.com/uraanai/CommandVue/blob/main/CLAUDE.md)
- PrimeVue (unstyled mode) — https://primevue.org/unstyled/
- Volt overview — https://volt.primevue.org/overview
- Volt catalogue — https://volt.primevue.org/ (browse from the sidebar)
- Tailwind v4 — https://tailwindcss.com/docs
