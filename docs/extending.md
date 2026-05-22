# Extending CommandVue

This page is for teams forking the template to build their own operations dashboard. It covers the extension contracts and how to stay close enough to upstream that you can pull future updates.

## What you're extending

CommandVue ships these extension points:

| Extension              | Add via                                                             | Doc                       |
| ---------------------- | ------------------------------------------------------------------- | ------------------------- |
| New panel type         | `panelRegistry.register()` + `app.component()`                      | [Panels](/panels)         |
| New preset type        | `presetTypeRegistry.register()` + edit-component file               | [Presets](/presets)       |
| New chrome item        | `chromeItemRegistry.register()`                                     | [Chrome](/chrome)         |
| Auth permission gating | Replace `useChromeStore.canEdit` computed                           | [Chrome](/chrome)         |
| Custom workspace logic | Wrap repo / store calls in your own helpers                         | [Workspaces](/workspaces) |
| Custom tool            | `useToolsStore.toggle('your-tool-id')` + activate in TOOLS registry | (existing Tools doc)      |

The four singleton registries (panels, chrome items, preset types, tools) are the primary surface — they're all callable from your own bootstrap file alongside the built-in `register*()` calls.

## Recommended fork structure

```
my-fleet-app/
├── src/
│   ├── extensions/                  ← Your code lives here
│   │   ├── panels/
│   │   │   └── FleetMapPanel.vue
│   │   ├── presets/
│   │   │   ├── FleetThemePresetEditor.vue
│   │   │   └── builtin.ts           ← FLEET_THEME_PRESET = …
│   │   ├── chrome/
│   │   │   └── AlertBellItem.vue
│   │   └── bootstrap.ts             ← register*() calls
│   ├── (the rest is unmodified CommandVue)
│   └── main.ts                      ← imports './extensions/bootstrap'
```

`src/extensions/bootstrap.ts`:

```typescript
import { defineAsyncComponent } from "vue";

import { chromeItemRegistry } from "@/modules/chrome/registry";
import { panelRegistry } from "@/modules/panels/registry";
import { presetTypeRegistry } from "@/modules/presets/registry";

import { FLEET_THEME_PRESET } from "./presets/builtin";

export function registerExtensions(): void {
  panelRegistry.register({
    id: "fleet-map",
    title: "Fleet Map",
    description: "Live vessel positions.",
    icon: "ship",
    category: "maps",
    component: () => import("./panels/FleetMapPanel.vue"),
  });

  chromeItemRegistry.register({
    id: "alert-bell",
    title: "Alert Bell",
    description: "Active-alarm count.",
    icon: "bell",
    allowedSlots: ["status-right", "status-center"],
    component: () => import("./chrome/AlertBellItem.vue"),
    removable: true,
    singleton: true,
  });

  presetTypeRegistry.register(FLEET_THEME_PRESET);
}
```

Then in `src/main.ts`, after the built-in registrations:

```typescript
import { registerExtensions } from "@/extensions/bootstrap";

// …
registerBuiltinPanels();
registerUnassignedPanel();
registerMissingPanel();
registerBuiltinChromeItems();
registerBuiltinPresetTypes();
registerExtensions(); // ← your additions

// Don't forget the app.component() calls for your panels:
app.component(
  "fleet-map",
  defineAsyncComponent(() => import("@/extensions/panels/FleetMapPanel.vue")),
);
```

## Auth integration

Replace `useChromeStore.canEdit`:

```typescript
// Option A: patch src/stores/chrome.ts directly.
// (Recommended for a hard fork — keeps imports simple.)

// Before:
const canEdit = computed(() => true);

// After:
import { useSessionAuthStore } from "@/extensions/stores/sessionAuth";
const sessionAuth = useSessionAuthStore();
const canEdit = computed(
  () => sessionAuth.user?.role === "admin" || sessionAuth.user?.role === "editor",
);
```

Every place that reads `chrome.canEdit` now respects the role check. No other changes needed; the chrome store's actions already gate on it.

## Auto-creating customized seed data

Replace or wrap `seedIfEmpty`:

```typescript
// src/extensions/seed.ts
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

export async function seedFleetWorkspace(): Promise<void> {
  const existing = await workspaceRepo.list();
  if (existing.length > 0) return;

  const ws = await workspaceRepo.create({ name: "Fleet Ops", isGlobalDefault: true });
  const layout = await layoutRepo.create({ workspaceId: ws.id, name: "Default" });
  await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });

  await panelStateRepo.create({
    layoutId: layout.id,
    panelType: "fleet-map",
    assignmentState: "configured",
  });
  await panelStateRepo.create({
    layoutId: layout.id,
    panelType: "entities",
    assignmentState: "configured",
  });

  // Optionally create a workspace-scoped preset and apply it.
}

// In src/main.ts:
await seedFleetWorkspace(); // ← replaces seedIfEmpty()
```

## Customizing branding

`src/components/chrome/items/AppIconItem.vue` controls the app icon and brand name. Either edit it in place or register a custom replacement and remove the built-in via the chrome registry — but note `app-icon` is `removable: false`, so a replacement must reuse the `app-icon` id (re-register after `chromeItemRegistry.__resetForTests()` in tests, or fork the file).

Brand colors come from `src/assets/styles/tokens.css` — edit those CSS variables to retheme everything.

## Staying close to upstream

CommandVue's structure is deliberately conservative: every extension point is on a clear seam.

- **Don't fork in-place.** Put your code in `src/extensions/` and register it through the public APIs. This way `git pull upstream main` merges cleanly.
- **Don't reach past the stores into the repos** from app code — the store layer is the API. Repo signatures can change between versions; store signatures are more stable.
- **Don't rely on internal data layout** that isn't documented. The portable JSON export shape (`schemaVersion: 2`) is a public contract; the internal `panel-states.state` shape per panel type is not.
- **Pin the version** in your `package.json` (we don't publish to npm yet; pin via a git tag). When you decide to pull, the CHANGELOG calls out breaking changes.

## When you've outgrown the registry pattern

If you find yourself wanting to fork core code rather than register new things, that's a signal — open an issue. The most common reasons:

- **You need a non-singleton chrome item** (multiple clocks?). The `singleton: false` flag exists but UI doesn't fully support it yet. Surface the use-case.
- **You need preset cascading semantics other than CSS-like later-wins.** This would be a breaking change to the preset API; worth discussing first.
- **You need server-side persistence today.** See [Supabase migration](/supabase-migration) — the contract is in place, the implementation isn't.

## Testing your extensions

The test seams the framework exposes:

```typescript
import { chromeItemRegistry } from "@/modules/chrome/registry";
import { panelRegistry } from "@/modules/panels/registry";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { resetForStoreTest } from "tests/unit/stores/helpers";

beforeEach(async () => {
  await resetForStoreTest(); // wipes IDB + fresh Pinia
  panelRegistry.__resetForTests();
  chromeItemRegistry.__resetForTests();
  presetTypeRegistry.__resetForTests();
  // Now re-register only what your test needs.
});
```

Use `tests/unit/storage/helpers.ts → resetStorage()` if you're testing repo-level code without Pinia.
