<script setup lang="ts">
import type { ChromeItemId, ChromeSlot } from "@/types/chrome";
import type { MenuItem } from "primevue/menuitem";

import { Plus, X } from "@lucide/vue";
import { computed, defineAsyncComponent, ref } from "vue";

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

// Per ADR 0002 audit decision 1a: the "+ Add item" popup is a single Volt
// Menu (popup mode) rather than a hand-rolled outside-click dropdown. The
// trigger button is disabled when there's nothing to add — cleaner than
// opening an empty menu.
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
