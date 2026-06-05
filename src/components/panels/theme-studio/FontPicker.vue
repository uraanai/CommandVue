<script setup lang="ts">
import type { FontLoadStatus } from "@/composables/useFontLoader";
import type { FontCatalogEntry } from "@/modules/themes/fontCatalog";
import type { FontSpec } from "@/types/theme";

import { computed, ref, watch } from "vue";

import { CURATED_OFFLINE_FAMILIES, ensureFontLoaded } from "@/composables/useFontLoader";
import { getCatalogEntry, searchFamilies } from "@/modules/themes/fontCatalog";
import Checkbox from "@/volt/Checkbox.vue";
import Select from "@/volt/Select.vue";

/**
 * FontPicker — Studio control for picking a Google font (Track A C3, body/sans).
 *
 * Built on the Volt `Select` (filterable, grouped by category). Emits a
 * `FontSpec` (or null to clear); it does NOT persist. Selecting a family loads
 * it for live preview via `useFontLoader` and surfaces a status line. The
 * catalog is lazily `import()`-ed on first open (code-split off the boot path).
 * Presentation only — no store imports.
 */
interface Props {
  modelValue: FontSpec | null; // null = inherit the curated default / legacy stack
}
const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [FontSpec | null] }>();

const FALLBACK = "system-ui, sans-serif";
const DEFAULT_WEIGHTS = [400, 600, 700];
const CATEGORY_ORDER = ["sans-serif", "serif", "display", "handwriting", "monospace"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  display: "Display",
  handwriting: "Handwriting",
  monospace: "Monospace",
  "sans-serif": "Sans-serif",
  serif: "Serif",
};

const loading = ref(false);
const catalogLoaded = ref(false);
const families = ref<FontCatalogEntry[]>([]);
const family = ref<null | string>(props.modelValue?.family ?? null);
const variants = ref<number[]>([]);
const weights = ref<number[]>(props.modelValue?.weights ?? DEFAULT_WEIGHTS);
const status = ref<FontLoadStatus>("idle");

/** Group the catalog by category, in a stable order, for the Select's optionGroup. */
const grouped = computed(() => {
  const byCat = new Map<string, FontCatalogEntry[]>();
  for (const e of families.value) {
    const list = byCat.get(e.category);
    if (list) list.push(e);
    else byCat.set(e.category, [e]);
  }
  return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
    label: CATEGORY_LABEL[c],
    items: byCat.get(c) ?? [],
  }));
});

/** Lazily pull the bundled catalog on first overlay open. */
async function ensureCatalog(): Promise<void> {
  if (catalogLoaded.value) return;
  loading.value = true;
  families.value = await searchFamilies("", 1000);
  catalogLoaded.value = true;
  loading.value = false;
}

function buildSpec(): FontSpec | null {
  if (!family.value) return null;
  return {
    family: family.value,
    source: "google",
    weights: [...weights.value],
    fallback: FALLBACK,
  };
}

async function loadActive(): Promise<void> {
  const spec = buildSpec();
  if (!spec) {
    status.value = "idle";
    return;
  }
  status.value = "loading";
  status.value = (await ensureFontLoaded(spec)).status;
}

watch(family, async (fam) => {
  if (!fam) {
    variants.value = [];
    status.value = "idle";
    emit("update:modelValue", null);
    return;
  }
  variants.value = (await getCatalogEntry(fam))?.variants ?? [];
  const intersect = DEFAULT_WEIGHTS.filter((w) => variants.value.includes(w));
  weights.value = intersect.length > 0 ? intersect : [400];
  emit("update:modelValue", buildSpec());
  void loadActive();
});

function toggleWeight(w: number): void {
  const next = weights.value.includes(w)
    ? weights.value.filter((x) => x !== w)
    : [...weights.value, w].sort((a, b) => a - b);
  weights.value = next.length > 0 ? next : [400];
  emit("update:modelValue", buildSpec());
  void loadActive();
}

const isCurated = computed(() =>
  family.value ? CURATED_OFFLINE_FAMILIES.has(family.value) : false,
);
const statusLine = computed<{ text: string; tone: string }>(() => {
  switch (status.value) {
    case "error":
      return { text: "Couldn't load — using fallback", tone: "text-status-warning" };
    case "loaded":
      return { text: "Loaded", tone: "text-faint" };
    case "loading":
      return { text: "Loading…", tone: "text-faint" };
    case "offline-fallback":
      return { text: "Needs network — using system fallback", tone: "text-status-warning" };
    default:
      if (!family.value) return { text: "", tone: "text-faint" };
      return isCurated.value
        ? { text: "Offline-ready", tone: "text-faint" }
        : { text: "Loads from Google when online", tone: "text-faint" };
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <Select
      v-model="family"
      :options="grouped"
      option-label="family"
      option-value="family"
      option-group-label="label"
      option-group-children="items"
      filter
      filter-placeholder="Search Google Fonts…"
      :loading="loading"
      show-clear
      reset-filter-on-hide
      placeholder="Pick a Google font…"
      class="w-full"
      @before-show="ensureCatalog"
    >
      <template #option="{ option }">
        <span :style="{ fontFamily: `'${option.family}', ${FALLBACK}` }">{{ option.family }}</span>
      </template>
    </Select>

    <div v-if="family && variants.length > 0" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="text-faint text-xs">Weights</span>
      <label v-for="w in variants" :key="w" class="flex items-center gap-1 text-xs">
        <Checkbox
          :model-value="weights.includes(w)"
          :binary="true"
          @update:model-value="() => toggleWeight(w)"
        />
        <span class="tabular-nums">{{ w }}</span>
      </label>
    </div>

    <span v-if="statusLine.text" :class="['text-xs', statusLine.tone]">{{ statusLine.text }}</span>
  </div>
</template>
