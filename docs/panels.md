# Panels

Panels are the dockable units inside the main view. The dock is
[Dockview Vue](https://dockview.dev/) wrapped by
`src/components/layout/DockLayout.vue`.

## Anatomy of a panel

A panel is just a Vue component placed under `src/components/panels/`.
It owns its container (`h-full w-full`) and any composables it needs.
Nothing inside the component knows it's mounted in a dock — it just
fills its parent.

Example skeleton:

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
</script>

<template>
  <div class="bg-surface-sunken h-full w-full">
    <!-- panel content -->
  </div>
</template>
```

## How DockLayout wires them

`DockLayout.vue` registers each panel by a string key:

```ts
const components = {
  cesium: defineAsyncComponent(() => import("@/components/panels/CesiumPanel.vue")),
  maplibre: defineAsyncComponent(() => import("@/components/panels/MapLibrePanel.vue")),
  entities: defineAsyncComponent(() => import("@/components/panels/EntityListPanel.vue")),
  chart: defineAsyncComponent(() => import("@/components/panels/ChartPanel.vue")),
  telemetry: defineAsyncComponent(() => import("@/components/panels/TelemetryPanel.vue")),
  symbology: defineAsyncComponent(() => import("@/components/panels/SymbologyPanel.vue")),
  markdown: defineAsyncComponent(() => import("@/components/panels/MarkdownPanel.vue")),
};
```

`defineAsyncComponent` keeps each panel in its own lazy chunk — Cesium
weighs 1+ MB, MapLibre ~286 KB, and they only download when the user
actually mounts that panel.

The dock then adds panels by referencing the key:

```ts
api.addPanel({ id: "cesium", component: "cesium", title: "3D Globe" });
```

## Default layout + persistence

`buildDefaultLayout(api)` lays out the dock the first time a user
loads the app. The result is serialized via `api.toJSON()` and persisted
to idb under the key `layout:dockview` (via `useLayoutStore` and
`@/utils/storage`).

Two rules made the implementation robust:

1. **Rehydrate on `@ready`, not `onMounted`.** Dockview emits
   `@ready` once its panel API is wired. Calling `api.fromJSON()`
   before that races the component registration.
2. **Debounce persistence.** `onDidLayoutChange` fires on every drag
   tick. The store's `save()` is wrapped in a 400 ms `setTimeout`
   that's cleared each time a new change arrives.

## Reset

The TitleBar's "Reset layout" icon invokes a `resetLayout()` function
that `DockLayout.vue` provides via `provide(resetLayoutKey, ...)`. The
implementation is `api.clear()` + `buildDefaultLayout(api)` +
`layout.reset()` (which clears the idb entry).

## Adding a new panel

1. Create `src/components/panels/MyPanel.vue` with `h-full w-full` root.
2. Register it in `DockLayout.vue`'s `components` map:

   ```ts
   mypanel: defineAsyncComponent(() => import("@/components/panels/MyPanel.vue")),
   ```

3. Add it to the default layout (or just let the user drag it in via
   the API):

   ```ts
   api.addPanel({
     id: "mypanel",
     component: "mypanel",
     title: "My panel",
     position: { referencePanel: "entities", direction: "below" },
   });
   ```

4. Update the `DemoView.vue` switch so `/demo?panel=mypanel` mounts it
   in isolation (handy for development).

5. Update the `Panels` category in `CommandPalette.vue` if you want
   palette access to switching panels.

## Theming the dock chrome

The dock's tab strip / separators / drop indicators are styled via the
`.dockview-theme-commandvue` class on the root container. Variable
mappings live in `src/assets/styles/dockview.css` — they reference the
project's semantic tokens (`--color-surface`, `--color-border`, etc.)
so dark mode flips automatically.

## Common pitfalls

- **Don't store the Dockview API in a Pinia store.** Stores must stay
  serializable; the API is held in a `shallowRef` inside the component.
- **Don't import heavy panels eagerly.** Always go through
  `defineAsyncComponent` so the chunk stays lazy.
- **Don't call `api.fromJSON` in `onMounted`.** Wait for `@ready`.
- **Don't forget the title.** Panels without `title` look broken in
  the tab strip.
