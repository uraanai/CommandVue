---
name: commandvue-chrome-system
description: Use when working with chrome items, slots, edit mode, the app-icon fallback, or wiring downstream auth into the chrome store.
when_to_use: |
  - Editing src/modules/chrome/ (types, registry, builtin)
  - Editing src/stores/chrome.ts
  - Editing src/components/chrome/ (items, ChromeBar, ChromeSlot, EditModeOverlay)
  - Adding a custom chrome item
  - Wiring an auth-based canEdit permission check
  - Anyone says "chrome", "menu bar", "status bar", "edit mode", "slot", or "app icon"
---

# CommandVue Chrome System

The persistent UI surrounding the dock — top bar, status bar, every item in them — is the **chrome**. It's slot-driven and user-configurable via edit mode.

## Slots and bars

```
Top bar:        [top-left] [top-center] [top-right]      ← ChromeBar position="top"
Status bar:     [status-left] [status-center] [status-right]   ← ChromeBar position="status"
```

Six slots total. Defined in `src/types/chrome.ts` as `CHROME_SLOTS`. Items in a slot render left-to-right.

## The Chrome Item Registry

```typescript
import { chromeItemRegistry } from "@/modules/chrome/registry";

chromeItemRegistry.register({
  id: "build-version",
  title: "Build Version",
  description: "Shows the current build SHA.",
  icon: "hash",
  allowedSlots: ["status-right", "status-center"],
  defaultSlot: "status-right",
  component: () => import("@/components/chrome/items/BuildVersionItem.vue"),
  removable: true,
  singleton: true,
});

chromeItemRegistry.listForSlot("status-right");
chromeItemRegistry.unregister("build-version"); // refuses non-removable items
```

Copy-paste template: [`reference/chrome-item-template.ts`](./reference/chrome-item-template.ts).

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
| `edit-mode-toggle`        | status-\*                             | yes       | Renders only when `chrome.canEdit === true`.                    |

## The always-on rule

`app-icon` is the ONLY `removable: false` item. Its right-click context menu mirrors the MenuBar's File / Edit / View structure. When the user hides the menu bar, the app icon remains the only path to those actions.

- **Never** make `app-icon` removable.
- **Never** allow it in slots other than `top-left`.
- **Never** unregister it; the registry refuses.

See [`reference/slot-semantics.md`](./reference/slot-semantics.md) for the full slot constraints.

## The `canEdit` auth seam

```typescript
// src/stores/chrome.ts
const canEdit = computed(() => true); // ← Phase E stub — replace in downstream apps
```

This single computed gates everything:

- `enterEditMode()` no-ops when `false`.
- `EditModeToggleItem` doesn't render.
- Future: per-item rendering can opt out for read-only users.

Wiring downstream auth: [`reference/auth-integration.md`](./reference/auth-integration.md).

## Slot mutations

```typescript
import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
await chrome.addItemToSlot("clock", "status-right");
// ↑ Strips the item from any other slot first (singleton across slots), then appends.
await chrome.removeItemFromSlot("clock", "status-right");
// ↑ Adds the item to hiddenItems so it doesn't reappear on profile reload.
await chrome.moveItem("clock", "status-right", "status-left", 0);
// ↑ Same as addItemToSlot with explicit position.
await chrome.toggleMenuBar();
await chrome.toggleStatusBar();
```

All mutations auto-persist to the active `ChromeProfile`.

## Chrome profiles

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

Exactly one profile has `isDefault: true`. The chrome profile repository enforces this atomically via `setDefault`.

## Common mistakes

- **Making `app-icon` removable.** Hard violation of the always-on rule.
- **Allowing `app-icon` outside `top-left`.** The right-click context menu UX assumes it's there.
- **Hardcoding chrome layout in AppShell.** AppShell mounts two ChromeBars; everything else is driven by the active profile.
- **Reading directly from the registry from a component.** Read via `useChromeStore.slotItems(slot)` so reactivity flows naturally.
- **Skipping `canEdit` checks in custom items.** Items that mutate state should consult `chrome.canEdit`.

## Test seam

```typescript
import { chromeItemRegistry } from "@/modules/chrome/registry";
import {
  __unregisterBuiltinChromeItemsForTests,
  registerBuiltinChromeItems,
} from "@/modules/chrome/builtin";

beforeEach(() => {
  __unregisterBuiltinChromeItemsForTests();
});
```

For chrome-store tests, see `tests/unit/chrome/store.spec.ts` — it uses `resetForStoreTest` + seeds a default profile.

## Reference files

- [`reference/chrome-item-template.ts`](./reference/chrome-item-template.ts)
- [`reference/slot-semantics.md`](./reference/slot-semantics.md)
- [`reference/auth-integration.md`](./reference/auth-integration.md)
