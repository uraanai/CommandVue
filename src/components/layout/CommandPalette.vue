<script setup lang="ts">
import { Search, X } from "@lucide/vue";
import fuzzysort from "fuzzysort";
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { formatCombo, SHORTCUTS } from "@/modules/shortcuts/catalog";
import { TOOLS } from "@/modules/tools";
import { useToolsStore } from "@/stores/tools";
import { useUiStore } from "@/stores/ui";

interface CommandItem {
  id: string;
  category: "Tools" | "Routes" | "Theme";
  label: string;
  hint?: string;
  action: () => void;
}

const ui = useUiStore();
const tools = useToolsStore();
const router = useRouter();

const query = ref("");
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

function shortcutHint(actionId: string): string | undefined {
  const s = SHORTCUTS.find((x) => x.action === actionId);
  if (!s || s.keys.length === 0) return undefined;
  return formatCombo(s.keys[0]!);
}

const commands = computed<CommandItem[]>(() => {
  const toolCommands = TOOLS.map<CommandItem>((tool) => ({
    id: `tool:${tool.id}`,
    category: "Tools",
    label: tool.label,
    hint: shortcutHint(`tool.${tool.id}`),
    action() {
      tools.activate(tool.id);
      close();
    },
  }));

  const routeCommands: CommandItem[] = [
    {
      id: "route:home",
      category: "Routes",
      label: "Dock (home)",
      action() {
        void router.push({ name: "home" });
        close();
      },
    },
    {
      id: "route:demo",
      category: "Routes",
      label: "Panel showcase",
      action() {
        void router.push({ name: "demo" });
        close();
      },
    },
    {
      id: "route:about",
      category: "Routes",
      label: "About",
      action() {
        void router.push({ name: "about" });
        close();
      },
    },
  ];

  return [...toolCommands, ...routeCommands];
});

const filtered = computed<CommandItem[]>(() => {
  const q = query.value.trim();
  if (!q) return commands.value;
  const results = fuzzysort.go(q, commands.value, {
    keys: ["label", "category"],
  });
  return results.map((r) => r.obj);
});

const grouped = computed(() => {
  const map = new Map<string, CommandItem[]>();
  for (const item of filtered.value) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return Array.from(map, ([category, items]) => ({ category, items }));
});

// Reset selection when the filtered set changes.
watch(filtered, () => {
  selectedIndex.value = 0;
});

// Open: focus the input; close: clear query.
watch(
  () => ui.commandPaletteOpen,
  (open) => {
    if (open) {
      query.value = "";
      selectedIndex.value = 0;
      void nextTick(() => inputRef.value?.focus());
    }
  },
);

function close(): void {
  ui.closeCommandPalette();
}

function moveSelection(direction: 1 | -1): void {
  const count = filtered.value.length;
  if (count === 0) return;
  selectedIndex.value = (selectedIndex.value + direction + count) % count;
}

function runSelected(): void {
  const item = filtered.value[selectedIndex.value];
  if (item) item.action();
}

function onInputKey(event: KeyboardEvent): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    runSelected();
  } else if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.commandPaletteOpen"
      class="bg-brand-950/70 fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      @click.self="close"
    >
      <div
        class="bg-surface-raised border-border w-full max-w-lg overflow-hidden rounded-lg border shadow-2xl"
      >
        <div class="border-border flex items-center gap-2 border-b px-3 py-2">
          <Search class="text-faint size-4 shrink-0" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Search tools, routes, actions…"
            class="text-foreground placeholder:text-faint flex-1 bg-transparent text-sm focus:outline-none"
            @keydown="onInputKey"
          />
          <button
            type="button"
            class="text-faint hover:text-foreground rounded p-0.5"
            aria-label="Close command palette"
            @click="close"
          >
            <X class="size-4" />
          </button>
        </div>

        <div class="max-h-[50vh] overflow-auto py-1">
          <div v-if="filtered.length === 0" class="text-muted px-4 py-6 text-center text-xs">
            No matches for "{{ query }}"
          </div>
          <template v-else>
            <div v-for="group in grouped" :key="group.category" class="py-1">
              <div class="text-faint px-3 py-1 text-[10px] font-medium tracking-wider uppercase">
                {{ group.category }}
              </div>
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                class="hover:bg-surface-sunken flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors"
                :class="
                  filtered[selectedIndex]?.id === item.id
                    ? 'bg-surface-sunken text-foreground'
                    : 'text-muted'
                "
                @click="item.action()"
                @mouseenter="selectedIndex = filtered.findIndex((i) => i.id === item.id)"
              >
                <span class="truncate">{{ item.label }}</span>
                <span v-if="item.hint" class="text-faint shrink-0 font-mono text-[10px]">
                  {{ item.hint }}
                </span>
              </button>
            </div>
          </template>
        </div>

        <div
          class="border-border text-faint flex items-center justify-between border-t px-3 py-1.5 text-[10px]"
        >
          <span>
            <span class="font-mono">↑↓</span> navigate · <span class="font-mono">↵</span> select ·
            <span class="font-mono">Esc</span> close
          </span>
          <span>{{ filtered.length }} {{ filtered.length === 1 ? "result" : "results" }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
