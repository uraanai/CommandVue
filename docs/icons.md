# Icons

CommandVue ships three icon libraries. Each has a defined role; mixing
them haphazardly defeats the tree-shaker.

| Library                        | Use for      | Import                                                        |
| ------------------------------ | ------------ | ------------------------------------------------------------- |
| `@lucide/vue`                  | UI chrome    | `import { Search, X } from "@lucide/vue"`                     |
| `@iconify-prerendered/vue-mdi` | Domain icons | `import { MdiTank } from "@iconify-prerendered/vue-mdi"`      |
| `@heroicons/vue`               | Sparingly    | `import { ShieldCheckIcon } from "@heroicons/vue/24/outline"` |

**Always use named imports.** Never `import * as Icons`. Tree-shaking
depends on it.

## Lucide — UI chrome

For buttons, toolbars, panel controls, status indicators. Lucide's
stroke-style aesthetic matches the template's chrome.

```vue
<script setup lang="ts">
import { Search, Moon, Sun } from "@lucide/vue";
</script>

<template>
  <Search class="size-4" />
  <Sun v-if="isDark" class="size-4" />
  <Moon v-else class="size-4" />
</template>
```

Size with Tailwind's `size-*` utilities. Don't mix `:size` props and
class-based sizing — pick one.

Examples in the scaffold:

- `TitleBar.vue` — Search / Moon / Sun / RotateCcw / Ruler / Hexagon
- `CommandPalette.vue` — Search / X
- Placeholder panels — Globe2, Map, ListChecks, LineChart, Radio, Shield, FileText

## Iconify MDI — domain icons

For the operations domain (vehicles, weather, sensors, infrastructure).
The `@iconify-prerendered/vue-mdi` package emits each MDI icon as a
pre-built Vue component, so it tree-shakes cleanly.

```vue
<script setup lang="ts">
import { MdiAirplane, MdiShipWheel, MdiSatellite } from "@iconify-prerendered/vue-mdi";
</script>

<template>
  <MdiAirplane class="size-5" />
</template>
```

MDI uses a filled / solid aesthetic — distinct from Lucide's stroke,
which is intentional. Domain icons read at a glance against the chrome.

## Heroicons — accents only

Heroicons ships in `outline` and `solid` variants under separate paths.
Use sparingly; the aesthetic differs from Lucide and the mix can feel
inconsistent if overused.

```vue
<script setup lang="ts">
import { ShieldCheckIcon } from "@heroicons/vue/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/vue/24/solid";
</script>
```

## Why the strict named-import rule

A `import * as Icons from "@lucide/vue"` pulls every icon into the
bundle (~600 KB for Lucide alone). Named imports let the bundler drop
everything you don't reference. CI lint enforces this via the
`@typescript-eslint/no-explicit-any` plus `eslint-plugin-perfectionist`
import sort; if you find a way to defeat tree-shaking, document the
exception in a comment.

## When you need a custom icon

Drop an SVG file under `src/assets/images/` and import it as a Vue SFC
or via `?component`. Don't bake project-specific SVGs into the icon
libraries — they shouldn't be re-exported from anywhere downstream
consumers think is canonical.
