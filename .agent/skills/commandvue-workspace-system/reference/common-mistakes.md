# Common mistakes

## 1. Storing DockviewApi in Pinia state

**Wrong:**

```typescript
export const useSessionStore = defineStore("session", () => {
  const dockviewApi = ref<DockviewApi | null>(null); // ← leaks into devtools, breaks serialization
  return { dockviewApi };
});
```

**Right:**

```typescript
const dockviewApi = shallowRef<DockviewApi | null>(null); // ← module-scope, NOT returned

export const useSessionStore = defineStore("session", () => {
  function bindDockview(api: DockviewApi) {
    dockviewApi.value = api;
  }
  function getDockviewApi() {
    return dockviewApi.value;
  }
  return { bindDockview, getDockviewApi }; // ← dockviewApi itself isn't in the surface
});
```

Same rule applies to MapLibre maps, Cesium viewers, ECharts charts — those live in `src/modules/panels/instances.ts`, not in Pinia state. CLAUDE.md rule 4.

## 2. Creating a workspace without a layout

**Wrong:**

```typescript
const ws = await workspaceRepo.create({ name: "QA" });
// user picks QA from the switcher → session.loadLayout throws because there's no layout
```

**Right:**

```typescript
const ws = await workspaceRepo.create({ name: "QA" });
const layout = await layoutRepo.create({ workspaceId: ws.id, name: "Default" });
await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });
```

`ManageWorkspacesDialog.create` does this. Invariant 6.

## 3. Calling repos directly from components

**Wrong:**

```vue
<script setup>
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
const list = await workspaceRepo.list(); // ← bypasses cache + reactive updates
</script>
```

**Right:**

```vue
<script setup>
import { useWorkspaceStore } from "@/stores/workspace";
const workspace = useWorkspaceStore();
await workspace.loadAll();
// `workspace.workspaces` is reactive and re-renders on mutations.
</script>
```

The store layer is the API for UI code. Direct repo calls bypass the cache and breaks the Supabase swap path.

## 4. Mutating store state directly

**Wrong:**

```typescript
const workspace = useWorkspaceStore();
workspace.workspaces.value = [...workspace.workspaces.value, newWs]; // ← skips persistence
```

**Right:**

```typescript
await workspace.createWorkspace({ name: "..." }); // ← writes to IDB + updates cache
```

The store actions are the public surface. State is exposed for reads only.

## 5. Storing reactive values in panel-state `state`

**Wrong:**

```typescript
await panelStateStore.updateState(panelId, {
  state: { map: someMapInstance }, // ← non-serializable, breaks export
});
```

**Right:**

```typescript
// Persist serializable values:
await panelStateStore.updateState(panelId, {
  state: { center: [70, 30], zoom: 4 },
});
// Live instance goes in panel-instance registry:
registerPanelInstance(panelId, someMapInstance);
```

## 6. Manually walking cascade chains

**Wrong:**

```typescript
const layouts = await layoutRepo.listByWorkspace(workspaceId);
for (const layout of layouts) {
  await panelStateRepo.bulkDeleteByLayout(layout.id);
  await layoutRepo.delete(layout.id);
}
await workspaceRepo.delete(workspaceId);
// ← multiple transactions; partial failure leaves orphans
```

**Right:**

```typescript
await workspaceRepo.delete(workspaceId);
// One transaction, cascade is automatic.
```

The parent repo's `delete` handles the entire cascade in one transaction.

## 7. Re-implementing dirty tracking

The session store already tracks dirty via `onDidLayoutChange`. If you need to mark dirty from elsewhere (e.g. after a per-panel state write), call `session.markDirty()`. Don't track your own boolean.

## 8. Skipping the `ready` guard

The boot path:

```
seedIfEmpty() → registerBuiltinPanels() → app.mount()
  → App.vue onMounted → workspaceStore.loadAll() → setReady(true)
    → AppShell renders → DockLayout binds Dockview
```

If you render workspace-aware UI before `workspaceStore.ready === true`, you'll see empty lists. Either gate via `v-if="workspaceStore.ready"` (App.vue does this) or `await workspaceStore.loadAll()` first.
