<script setup lang="ts">
import type { ChromeItemId, ChromeSlot } from "@/types/chrome";

import { Plus, X } from "@lucide/vue";
import { computed, defineAsyncComponent, ref } from "vue";

import { chromeItemRegistry } from "@/modules/chrome/registry";
import { useChromeStore } from "@/stores/chrome";

interface Props {
  slotName: ChromeSlot;
  align?: "start" | "center" | "end";
}

const props = withDefaults(defineProps<Props>(), { align: "start" });

const chrome = useChromeStore();
const addOpen = ref(false);

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

function addableItems(): { id: ChromeItemId; title: string }[] {
  const present = new Set(itemIds.value);
  return chromeItemRegistry
    .listForSlot(props.slotName)
    .filter((def) => !present.has(def.id))
    .map((def) => ({ id: def.id, title: def.title }));
}

async function addItem(id: ChromeItemId): Promise<void> {
  addOpen.value = false;
  await chrome.addItemToSlot(id, props.slotName);
}

async function removeItem(id: ChromeItemId): Promise<void> {
  const def = chromeItemRegistry.get(id);
  if (def && !def.removable) return;
  await chrome.removeItemFromSlot(id, props.slotName);
}
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
      class="relative"
      :class="chrome.editMode ? 'ring-accent-500/40 rounded px-0.5 ring-1' : ''"
    >
      <component :is="loadItem(id)" v-if="loadItem(id)" />
      <button
        v-if="chrome.editMode && chromeItemRegistry.get(id)?.removable"
        type="button"
        class="bg-danger absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] text-white"
        title="Remove from slot"
        @click="removeItem(id)"
      >
        <X class="size-2.5" />
      </button>
    </div>

    <div v-if="chrome.editMode" class="relative">
      <button
        type="button"
        class="text-muted hover:bg-surface-sunken flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
        title="Add item to this slot"
        @click="addOpen = !addOpen"
      >
        <Plus class="size-3" />
      </button>
      <div
        v-if="addOpen"
        class="border-border bg-surface-raised absolute z-50 mt-1 min-w-[200px] rounded-md border py-1 shadow-lg"
        :class="align === 'end' ? 'right-0' : 'left-0'"
      >
        <div v-if="addableItems().length === 0" class="text-muted px-3 py-2 text-xs">
          No more items available
        </div>
        <button
          v-for="entry in addableItems()"
          :key="entry.id"
          type="button"
          class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm"
          @click="addItem(entry.id)"
        >
          {{ entry.title }}
        </button>
      </div>
    </div>
  </div>
</template>
