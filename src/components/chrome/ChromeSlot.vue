<script setup lang="ts">
import type { ChromeItemId, ChromeSlot } from "@/types/chrome";
import type { MenuItem } from "primevue/menuitem";
import type { ComponentPublicInstance } from "vue";

import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Plus, X } from "@lucide/vue";
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import { chromeItemRegistry } from "@/modules/chrome/registry";
import { useChromeStore } from "@/stores/chrome";
import Menu from "@/volt/Menu.vue";

interface Props {
  slotName: ChromeSlot;
  align?: "start" | "center" | "end";
}

const props = withDefaults(defineProps<Props>(), { align: "start" });

const chrome = useChromeStore();
const addMenu = ref<InstanceType<typeof Menu> | null>(null);

const itemIds = computed<ChromeItemId[]>(() => chrome.slotItems(props.slotName));

const alignClass = computed(() =>
  props.align === "center"
    ? "justify-center"
    : props.align === "end"
      ? "justify-end"
      : "justify-start",
);

function loadItem(id: ChromeItemId) {
  const def = chromeItemRegistry.get(id);
  if (!def) return null;
  return defineAsyncComponent(def.component);
}

const addableItems = computed<{ id: ChromeItemId; title: string }[]>(() => {
  const present = new Set(itemIds.value);
  return chromeItemRegistry
    .listForSlot(props.slotName)
    .filter((def) => !present.has(def.id))
    .map((def) => ({ id: def.id, title: def.title }));
});

const addMenuItems = computed<MenuItem[]>(() =>
  addableItems.value.map((entry) => ({
    label: entry.title,
    command: () => void addItem(entry.id),
  })),
);

function toggleAddMenu(event: MouseEvent): void {
  addMenu.value?.toggle(event);
}

async function addItem(id: ChromeItemId): Promise<void> {
  await chrome.addItemToSlot(id, props.slotName);
}

async function removeItem(id: ChromeItemId): Promise<void> {
  const def = chromeItemRegistry.get(id);
  if (def && !def.removable) return;
  await chrome.removeItemFromSlot(id, props.slotName);
}

/* ---------------------------------------------------------------------------
 * Drag-and-drop reorder (edit mode only, same-slot only).
 *
 * Uses @atlaskit/pragmatic-drag-and-drop. Every item wrapper acts as both
 * `draggable` and `dropTargetForElements`. The hitbox helper reports which
 * side of the target the cursor is closest to ("left" / "right" because slots
 * are horizontal); a vertical accent-coloured bar marks the prospective
 * insertion point.
 *
 * On drop, the store's `addItemToSlot(itemId, slot, position)` is reused
 * (it already removes the item from any prior slot, including itself, and
 * re-inserts at the chosen position). We adjust the post-removal index when
 * the source was originally before the target.
 *
 * Cross-slot drag is intentionally out of scope for this PR. `canDrop`
 * filters by matching `slotName` so dragging from one slot to another is a
 * no-op.
 * ------------------------------------------------------------------------- */
type ItemDragData = { itemId: ChromeItemId; slotName: ChromeSlot };

const itemRefs = ref<Record<string, HTMLElement | null>>({});
const dragSourceId = ref<ChromeItemId | null>(null);
const dropTargetId = ref<ChromeItemId | null>(null);
const dropTargetEdge = ref<Edge | null>(null);

const cleanupsByItem: Record<string, () => void> = {};

function setItemRef(id: ChromeItemId, el: Element | ComponentPublicInstance | null): void {
  itemRefs.value[id] = el instanceof HTMLElement ? el : null;
}

function teardownItemDnD(id: ChromeItemId): void {
  cleanupsByItem[id]?.();
  delete cleanupsByItem[id];
}

function teardownAll(): void {
  for (const id of Object.keys(cleanupsByItem)) {
    cleanupsByItem[id]?.();
  }
  for (const k of Object.keys(cleanupsByItem)) delete cleanupsByItem[k];
  dragSourceId.value = null;
  dropTargetId.value = null;
  dropTargetEdge.value = null;
}

function setupItemDnD(id: ChromeItemId): void {
  const el = itemRefs.value[id];
  if (!el) return;
  teardownItemDnD(id);
  const def = chromeItemRegistry.get(id);
  const removable = def?.removable ?? true;
  // Non-removable items (the always-on app icon) shouldn't drag — keep them
  // anchored at their canonical position.
  if (!removable) return;
  const cleanup = combine(
    draggable({
      element: el,
      getInitialData: () => ({ itemId: id, slotName: props.slotName }) as ItemDragData,
      onDragStart: () => {
        dragSourceId.value = id;
      },
      onDrop: () => {
        dragSourceId.value = null;
        dropTargetId.value = null;
        dropTargetEdge.value = null;
      },
    }),
    dropTargetForElements({
      element: el,
      canDrop: ({ source }) => (source.data as ItemDragData).slotName === props.slotName,
      getData: ({ input, element }) =>
        attachClosestEdge({ itemId: id }, { input, element, allowedEdges: ["left", "right"] }),
      onDrag: ({ self, source }) => {
        const sourceId = (source.data as ItemDragData).itemId;
        if (sourceId === id) return;
        dropTargetId.value = id;
        dropTargetEdge.value = extractClosestEdge(self.data);
      },
      onDragLeave: () => {
        if (dropTargetId.value === id) {
          dropTargetId.value = null;
          dropTargetEdge.value = null;
        }
      },
      onDrop: ({ source, self }) => {
        const sourceId = (source.data as ItemDragData).itemId;
        const targetEdge = extractClosestEdge(self.data);
        if (sourceId === id) return;
        const list = itemIds.value;
        const sourceIdx = list.indexOf(sourceId);
        const targetIdx = list.indexOf(id);
        if (sourceIdx === -1 || targetIdx === -1) return;
        let newIdx = targetEdge === "right" ? targetIdx + 1 : targetIdx;
        if (sourceIdx < newIdx) newIdx -= 1;
        if (newIdx === sourceIdx) return;
        void chrome.addItemToSlot(sourceId, props.slotName, newIdx);
      },
    }),
  );
  cleanupsByItem[id] = cleanup;
}

function reconcileDnD(): void {
  if (!chrome.editMode) {
    teardownAll();
    return;
  }
  // Tear down items that no longer exist
  for (const id of Object.keys(cleanupsByItem)) {
    if (!itemIds.value.includes(id as ChromeItemId)) teardownItemDnD(id as ChromeItemId);
  }
  // Wire up newly present items
  for (const id of itemIds.value) {
    if (!cleanupsByItem[id]) setupItemDnD(id);
  }
}

watch(
  [() => chrome.editMode, itemIds],
  () => {
    void nextTick(() => reconcileDnD());
  },
  { immediate: true, flush: "post" },
);

onBeforeUnmount(() => teardownAll());
</script>

<template>
  <div
    :class="[
      'flex items-center gap-2 px-2',
      alignClass,
      chrome.editMode ? 'border-accent-500/40 bg-accent-500/5 rounded border border-dashed' : '',
    ]"
    :data-chrome-slot="slotName"
  >
    <div
      v-for="id in itemIds"
      :key="id"
      :ref="(el) => setItemRef(id, el)"
      class="relative"
      :class="[
        chrome.editMode ? 'ring-accent-500/40 rounded px-0.5 ring-1' : '',
        chrome.editMode && chromeItemRegistry.get(id)?.removable
          ? 'cursor-grab active:cursor-grabbing'
          : '',
        dragSourceId === id ? 'opacity-40' : '',
      ]"
    >
      <!-- Drop indicator: vertical bar on left/right of the hovered target -->
      <span
        v-if="dropTargetId === id && dropTargetEdge === 'left'"
        aria-hidden="true"
        class="bg-accent-500 pointer-events-none absolute top-0 -left-1 z-10 h-full w-0.5 rounded"
      />
      <span
        v-if="dropTargetId === id && dropTargetEdge === 'right'"
        aria-hidden="true"
        class="bg-accent-500 pointer-events-none absolute top-0 -right-1 z-10 h-full w-0.5 rounded"
      />
      <component :is="loadItem(id)" v-if="loadItem(id)" />
      <IconButton
        v-if="chrome.editMode && chromeItemRegistry.get(id)?.removable"
        label="Remove from slot"
        size="sm"
        class="bg-danger absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full p-0 text-white hover:bg-red-500"
        @click="removeItem(id)"
      >
        <X class="size-2.5" />
      </IconButton>
    </div>

    <div v-if="chrome.editMode" class="relative">
      <IconButton
        label="Add item to this slot"
        variant="ghost"
        size="sm"
        :disabled="addableItems.length === 0"
        @click="toggleAddMenu"
      >
        <Plus class="size-3" />
      </IconButton>
      <Menu ref="addMenu" :model="addMenuItems" popup />
    </div>
  </div>
</template>
