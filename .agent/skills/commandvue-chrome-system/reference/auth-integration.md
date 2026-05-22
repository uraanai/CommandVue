# Auth integration (the `canEdit` seam)

`useChromeStore.canEdit` is the single integration point for downstream apps that wire authentication.

## The current stub

```typescript
// src/stores/chrome.ts
const canEdit = computed(() => true);
```

Returns `true` unconditionally in the open-source template. Every action in the chrome store already gates on this computed.

## Replacing it — three approaches

### Option A: patch in place (recommended for hard forks)

```typescript
// src/stores/chrome.ts
import { useSessionAuthStore } from "@/extensions/stores/sessionAuth";

export const useChromeStore = defineStore("chrome", () => {
  const session = useSessionAuthStore();
  const canEdit = computed(() => session.user?.role === "admin" || session.user?.role === "editor");
  // …rest unchanged
});
```

The seam is one line. Patching in place keeps imports simple and downstream tracking clean.

### Option B: wrapper store (recommended for soft forks)

```typescript
// src/extensions/stores/chrome.ts
import { computed } from "vue";

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

// Then update imports in your extension components to use this wrapper
// instead of @/stores/chrome.
```

This keeps the core file untouched but requires you to swap imports across the codebase. Use this when you want clean upstream merges.

### Option C: server-driven config

```typescript
// src/stores/chrome.ts
const canEdit = computed(() => {
  const appConfig = useAppConfigStore();
  return appConfig.featureFlags.allowChromeEdit === true;
});
```

Useful when the permission isn't tied to user identity (e.g., enterprise deployments where every user can customize, or no users can).

## What gates on `canEdit`

| Surface                                    | Behavior when `canEdit === false`              |
| ------------------------------------------ | ---------------------------------------------- |
| `useChromeStore.enterEditMode`             | No-op                                          |
| `useChromeStore.toggleEditMode`            | No-op (via enterEditMode gate)                 |
| `EditModeToggleItem`                       | Component returns null (doesn't render at all) |
| App-icon context menu "Edit Chrome…" entry | Disabled (gated on `chrome.canEdit`)           |

The slot mutation actions (`addItemToSlot`, `removeItemFromSlot`, `moveItem`, `toggleMenuBar`, `toggleStatusBar`) currently **don't** gate on `canEdit` themselves — they assume the UI already prevented the user from reaching them. If you need defense-in-depth, add `if (!canEdit.value) return;` to each action.

## Custom items that need permission

If your custom chrome item should hide for read-only users, consult `chrome.canEdit` (or your own permission computed) in the item's template:

```vue
<script setup lang="ts">
import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
</script>

<template>
  <button v-if="chrome.canEdit" @click="doSomethingMutating">…</button>
</template>
```

## Testing the auth seam

```typescript
import { useChromeStore } from "@/stores/chrome";

it("respects canEdit for enterEditMode", () => {
  const store = useChromeStore();
  // Override the computed via spy or by setActivePinia + a mocked auth store.
  // (Exact pattern depends on which override approach you used.)
  expect(store.canEdit).toBe(true); // Phase E baseline
});
```

Phase E ships with `canEdit === true` and tests that match. When you wire downstream auth, update the relevant tests to seed a fake session and assert `canEdit === false` blocks edit mode.
