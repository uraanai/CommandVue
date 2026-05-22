# Chrome system

The **chrome** is the persistent UI surrounding the dock — top bar, status bar, and every item in them. This page is for engineers building chrome items or integrating auth. For a system-level overview, see [Architecture](/architecture).

## The shape

```
┌─────────────────────────────────────────────────────────────────┐
│ top-left:     [app-icon] [menu-bar]      ┌────[top-right: [workspace-switcher]]
│  ↑                                       │   ChromeBar (position="top")
└──┴───────────────────────────────────────┴──────────────────────┘
                            …dock…
┌─────────────────────────────────────────────────────────────────┐
│ status-left:                             │   status-right:
│  [workspace-label] [layout-label] [dirty]│   [ws-status] [clock] [edit-toggle]
│                                          │   ChromeBar (position="status")
└──────────────────────────────────────────┴──────────────────────┘
```

Each bar has three slots: `<position>-left`, `<position>-center`, `<position>-right`. Items in a slot render left-to-right (or stacked on small screens).

## The Chrome Item Registry

`src/modules/chrome/registry.ts` is the singleton.

```typescript
import { chromeItemRegistry } from "@/modules/chrome/registry";

chromeItemRegistry.register({
  id: "build-version",
  title: "Build Version",
  description: "Shows the current build SHA in the status bar.",
  icon: "hash",
  allowedSlots: ["status-right", "status-center"],
  defaultSlot: "status-right",
  component: () => import("@/components/chrome/items/BuildVersionItem.vue"),
  removable: true,
  singleton: true,
});

chromeItemRegistry.listForSlot("status-right"); // → items that can live in this slot
chromeItemRegistry.unregister("build-version"); // refuses non-removable items
```

## The nine built-in items

| ID                        | Allowed slots                         | Removable | Notes                                                           |
| ------------------------- | ------------------------------------- | --------- | --------------------------------------------------------------- |
| `app-icon`                | `top-left`                            | **no**    | Always-on. Right-click context menu mirrors File / Edit / View. |
| `menu-bar`                | `top-left`, `top-center`              | yes       | The File / Edit / View PrimeVue Menubar.                        |
| `workspace-switcher`      | `top-left`, `top-center`, `top-right` | yes       | Dropdown.                                                       |
| `current-workspace-label` | status-\*                             | yes       | Reads `useWorkspaceStore`.                                      |
| `current-layout-label`    | status-\*                             | yes       | Reads `useLayoutStore`.                                         |
| `dirty-indicator`         | status-\*                             | yes       | Lights up on `session.dirty`.                                   |
| `websocket-status`        | status-\*                             | yes       | Reads `useConnectionStore`.                                     |
| `clock`                   | status-\*                             | yes       | System time + GMT, ticks every second.                          |
| `edit-mode-toggle`        | status-\*                             | yes       | Renders only when `chrome.canEdit` is `true`.                   |

## The always-on rule

`app-icon` is the only `removable: false` item. Its right-click context menu mirrors the MenuBar's File / Edit / View — when the user hides the menu bar (View → Hide Menu Bar in the icon's context menu), the app icon remains the only path to those actions.

**Never** make `app-icon` removable. **Never** allow it in slots other than `top-left`. The registry enforces unregister-refuses-non-removable, but slot constraints are honored by callers — don't bypass them.

## The `canEdit` auth seam

```typescript
// src/stores/chrome.ts
const canEdit = computed(() => true); // ← Phase E stub
```

In Phase E this returns `true` unconditionally. Downstream apps that wire authentication replace this single computed:

```typescript
// In a downstream app's extension layer:
const canEdit = computed(() => {
  const session = useSessionAuthStore(); // your own store
  return session.user?.role === "admin" || session.user?.role === "editor";
});
```

Every action in the chrome store already gates on `canEdit`:

- `enterEditMode()` no-ops when `canEdit` is `false`.
- `EditModeToggleItem` doesn't render at all.
- Per-item rendering can consult it too (e.g., a "destructive" item can opt out for read-only users).

## Edit mode

Toggled via the `edit-mode-toggle` chrome item or the app-icon context menu's "Edit Chrome…" entry. In edit mode:

- Each slot shows a dashed border.
- Present items get a small `×` badge (only on `removable: true` items).
- Each slot shows a `+` button that opens a dropdown of items that **can** be added — filtered by `allowedSlots` and excluding items already present elsewhere (singleton rule across slots).

The `EditModeOverlay` component renders the "Chrome edit mode" banner with an "Exit" button.

## Slot mutations

```typescript
import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
await chrome.addItemToSlot("clock", "status-right");
// ↑ Strips the item from any other slot first (singleton across slots), then appends.
await chrome.removeItemFromSlot("clock", "status-right");
// ↑ Adds the item to hiddenItems so it doesn't reappear on profile reload.
await chrome.moveItem("clock", "status-right", "status-left", 0);
// ↑ Equivalent to addItemToSlot with explicit position.
await chrome.toggleMenuBar();
await chrome.toggleStatusBar();
```

All mutations auto-persist to the active `ChromeProfile`. The "active profile" is the one with `isDefault: true` unless the user has selected another via `setCurrentProfile`.

## Chrome profiles

A `ChromeProfile` captures the user's complete chrome arrangement:

```typescript
interface ChromeProfile {
  id: Ulid;
  name: string;
  isDefault: boolean;
  slotAssignments: Record<ChromeSlot, ChromeItemId[]>;
  hiddenItems: ChromeItemId[];
  menuBarVisible: boolean;
  statusBarVisible: boolean;
}
```

```typescript
await chrome.createProfile("Compact");
await chrome.setDefaultProfile(compactId);
await chrome.deleteProfile(oldId); // refuses if default or last
```

Exactly one profile has `isDefault: true` at any time (the chrome profile repository enforces this atomically).

## Adding a custom chrome item

```typescript
// src/components/chrome/items/BuildVersionItem.vue
<script setup lang="ts">
import { Hash } from "@lucide/vue";

const version = import.meta.env.VITE_BUILD_SHA ?? "dev";
</script>

<template>
  <span class="text-muted flex items-center gap-1 font-mono text-xs">
    <Hash class="size-3" />
    <span>{{ version }}</span>
  </span>
</template>
```

```typescript
// In your extension bootstrap, after registerBuiltinChromeItems():
import { chromeItemRegistry } from "@/modules/chrome/registry";

chromeItemRegistry.register({
  id: "build-version",
  title: "Build Version",
  description: "Shows VITE_BUILD_SHA.",
  icon: "hash",
  allowedSlots: ["status-right", "status-center"],
  defaultSlot: "status-right",
  component: () => import("@/components/chrome/items/BuildVersionItem.vue"),
  removable: true,
  singleton: true,
});
```

The item now appears in the edit-mode "Add Item" dropdown for the slots it's allowed in.

## Integrating downstream auth

```typescript
// 1. In your downstream app, define a session store.
export const useSessionAuthStore = defineStore("sessionAuth", () => {
  const user = ref<User | null>(null);
  // …login / logout / refresh
  return { user };
});

// 2. Override useChromeStore's canEdit by re-exporting a wrapper.
//    (Or fork chrome.ts directly if you're a hard fork.)
import { useChromeStore as useChromeStoreBase } from "@/stores/chrome";
import { useSessionAuthStore } from "./sessionAuth";

export function useChromeStore() {
  const base = useChromeStoreBase();
  const session = useSessionAuthStore();
  return {
    ...base,
    canEdit: computed(() => session.user?.role === "admin"),
  };
}
```

Components that import `useChromeStore` from your wrapper now respect the permission. For maximum simplicity, just patch `src/stores/chrome.ts` — the seam is intentionally one line.

## Test seam

```typescript
import { chromeItemRegistry } from "@/modules/chrome/registry";
import {
  __unregisterBuiltinChromeItemsForTests,
  registerBuiltinChromeItems,
} from "@/modules/chrome/builtin";

beforeEach(() => {
  __unregisterBuiltinChromeItemsForTests();
  // …then call registerBuiltinChromeItems() if your test needs the defaults.
});
```

See `tests/unit/chrome/{registry,store}.spec.ts` for the full pattern.
