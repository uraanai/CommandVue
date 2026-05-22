# Slot semantics

## The six slots

| Slot            | Visual region             | Typical contents                               |
| --------------- | ------------------------- | ---------------------------------------------- |
| `top-left`      | Top bar, left-aligned     | App icon (required), menu bar                  |
| `top-center`    | Top bar, centered         | (Usually empty — opens space)                  |
| `top-right`     | Top bar, right-aligned    | Workspace switcher, user menu                  |
| `status-left`   | Status bar, left-aligned  | Workspace label, layout label, dirty indicator |
| `status-center` | Status bar, centered      | (Usually empty)                                |
| `status-right`  | Status bar, right-aligned | WS status, clock, edit-mode toggle             |

## The singleton-across-slots rule

`useChromeStore.addItemToSlot(itemId, slot)`:

1. Strips `itemId` from every slot (top + status).
2. Appends `itemId` to the target slot.

An item can only live in one slot at a time. This is the "singleton" semantics — even though every built-in has `singleton: true`, the across-slots rule is enforced by the store regardless of the flag.

## The `allowedSlots` filter

Each `ChromeItemDefinition` declares `allowedSlots`. The store and the edit-mode "Add Item" dropdown both honor this:

- The "+" dropdown in slot X only shows items where `X ∈ allowedSlots`.
- (Suggested) Custom code that calls `addItemToSlot` should validate against `allowedSlots` — the store doesn't enforce this today, but downstream apps should.

`app-icon` is the strictest: `allowedSlots: ["top-left"]`. Don't widen it.

## The `removable: false` rule

`chromeItemRegistry.unregister()` refuses items with `removable: false`. The store's `removeItemFromSlot` doesn't gate on removable directly — it just hides the item via `hiddenItems`. Components rendering the slot should check the flag when deciding whether to show the `×` badge:

```typescript
<button
  v-if="chrome.editMode && chromeItemRegistry.get(id)?.removable"
  @click="removeItem(id)"
>
  ×
</button>
```

`app-icon` therefore can be "added/moved" across `top-left` only, but its `×` badge never renders.

## The `hiddenItems` field

`ChromeProfile.hiddenItems` lists items that have been removed from slots. They're not in any slot, but they're not gone — they appear in the edit-mode "Add Item" dropdown so the user can put them back.

`addItemToSlot` automatically removes the item from `hiddenItems` (it's now visible again).

## Persistence

Every mutation auto-persists to the active `ChromeProfile` via `chromeProfileRepo.update`. The `useChromeStore` is a read-through cache — re-reads the profile after every mutation.

## Bar visibility

`menuBarVisible` and `statusBarVisible` are per-profile booleans. The MenuBarItem renders `<MenuBar v-if="chrome.menuBarVisible" />`; the AppShell renders `<ChromeBar v-if="chrome.statusBarVisible" position="status" />`.

Hiding the menu bar removes the menu UI but leaves the menu-bar item slot assignment intact. Hiding the status bar removes the entire ChromeBar — its items don't render at all until shown again.

## Boot order

The boot order matters: `seedIfEmpty` creates a default profile with the canonical slot assignments before any chrome code runs. If you re-seed in tests, mirror that structure (see `tests/unit/chrome/store.spec.ts` → `seedDefaultProfile()`).
