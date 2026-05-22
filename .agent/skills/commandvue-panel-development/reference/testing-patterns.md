# Testing patterns for panels

## Registry-level tests

```typescript
import { beforeEach, describe, expect, it } from "vitest";

import {
  __unregisterBuiltinPanelsForTests,
  registerBuiltinPanels,
} from "@/modules/panels/builtin";
import { panelRegistry } from "@/modules/panels/registry";

describe("my custom registration", () => {
  beforeEach(() => {
    __unregisterBuiltinPanelsForTests();
    panelRegistry.__resetForTests();
  });

  it("adds my-panel to the registry", () => {
    registerBuiltinPanels();
    panelRegistry.register({ id: "my-panel", ... });
    expect(panelRegistry.get("my-panel")).toBeDefined();
  });
});
```

## Component-mount tests

```typescript
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import MyPanel from "@/components/panels/MyPanel.vue";

describe("MyPanel", () => {
  it("renders with no api prop", () => {
    const wrapper = mount(MyPanel);
    expect(wrapper.find("[data-testid='my-panel']").exists()).toBe(true);
  });
});
```

## Tests that touch panelStateStore / usePanelState

Use the shared store-test helper:

```typescript
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import MyPanel from "@/components/panels/MyPanel.vue";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { usePanelStateStore } from "@/stores/panelState";

import { resetForStoreTest } from "../stores/helpers";

describe("MyPanel state", () => {
  beforeEach(async () => {
    await resetForStoreTest(); // wipes IDB + fresh Pinia
  });

  it("restores zoom from persisted state", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
    const panel = await panelStateRepo.create({
      layoutId: layout.id,
      panelType: "my-panel",
      state: { zoom: 5 },
    });
    const store = usePanelStateStore();
    await store.loadForLayout(layout.id);

    // Mount with the panel id as a fake api prop
    const wrapper = mount(MyPanel, {
      props: { api: { id: panel.id } as any },
    });
    // Assert restore happened
    // ...
  });
});
```

## Tests that touch preset application

Spy on the preset type's `applyToPanel` to verify it was called:

```typescript
import {
  __unregisterBuiltinPresetTypesForTests,
  registerBuiltinPresetTypes,
} from "@/modules/presets/builtin";
import { presetTypeRegistry } from "@/modules/presets/registry";

beforeEach(() => {
  __unregisterBuiltinPresetTypesForTests();
  registerBuiltinPresetTypes();
});

it("calls applyToPanel on preset apply", async () => {
  const spy = vi.fn();
  const original = presetTypeRegistry.get("map-style")!.applyToPanel;
  presetTypeRegistry.get("map-style")!.applyToPanel = spy;
  try {
    await presetStore.applyToPanel(panelId, presetId);
  } finally {
    presetTypeRegistry.get("map-style")!.applyToPanel = original;
  }
  expect(spy).toHaveBeenCalledWith(panelId, expect.any(Object));
});
```

See `tests/unit/presets/store.spec.ts` for the canonical pattern.
