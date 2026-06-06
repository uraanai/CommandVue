<script setup lang="ts">
import type { FontLoadStatus } from "@/composables/useFontLoader";
import type { FontCatalogEntry } from "@/modules/themes/fontCatalog";
import type { FontSpec } from "@/types/theme";

import { computed, nextTick, ref, watch } from "vue";

import {
  CURATED_OFFLINE_FAMILIES,
  ensureFontLoaded,
  FAMILY_NAME_RE,
} from "@/composables/useFontLoader";
import { getCatalogEntry, searchFamilies } from "@/modules/themes/fontCatalog";
import Checkbox from "@/volt/Checkbox.vue";
import Select from "@/volt/Select.vue";

/**
 * FontPicker — Studio control for picking a Google font (Track A C3, body/sans).
 *
 * Built on the Volt `Select` (filterable, grouped by category, themed to the
 * project tokens). Each dropdown option previews in its OWN face (lazy preview
 * `<link>`s injected on first open). Selecting a family **loads it first, then
 * emits** the `FontSpec` — so the live preview only flips once the glyphs are
 * ready (no system-font flash) and the status line shows a real Loading→Loaded.
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
// Monotonic guard so a slow load can't clobber a newer pick (and the "Loading…"
// state of a superseded pick can't win).
let pickToken = 0;

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

/**
 * Inject lazy preview `<link>`s so each option renders in its own font. Only the
 * non-curated families need them (curated ship via @fontsource); requested at
 * weight 400, chunked. `font-display: swap` keeps the woff2 lazy — only the
 * options actually painted download. Cosmetic, origin-locked to googleapis.
 */
function loadPreviewFaces(entries: FontCatalogEntry[]): void {
  if (typeof document === "undefined" || navigator.onLine === false) return;
  const names = entries
    .map((e) => e.family)
    .filter((f) => !CURATED_OFFLINE_FAMILIES.has(f) && FAMILY_NAME_RE.test(f));
  const CHUNK = 24;
  for (let i = 0; i < names.length; i += CHUNK) {
    const key = `pv-${i}`;
    if (document.head.querySelector(`link[data-cv-font-preview="${key}"]`)) continue;
    const q = names
      .slice(i, i + CHUNK)
      .map((f) => `family=${f.replace(/ /g, "+")}`)
      .join("&");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${q}&display=swap`;
    link.crossOrigin = "anonymous";
    link.dataset.cvFontPreview = key;
    document.head.appendChild(link);
  }
}

/** Lazily pull the bundled catalog on first overlay open + arm the previews. */
async function ensureCatalog(): Promise<void> {
  if (catalogLoaded.value) return;
  loading.value = true;
  families.value = await searchFamilies("", 1000);
  catalogLoaded.value = true;
  loading.value = false;
  loadPreviewFaces(families.value);
}

/** Load the chosen family BEFORE flipping the app token, so the swap is clean. */
async function applyFamily(fam: string, token: number): Promise<void> {
  const spec: FontSpec = {
    family: fam,
    source: "google",
    weights: [...weights.value],
    fallback: FALLBACK,
  };
  status.value = "loading";
  await nextTick(); // let "Loading…" paint before we await the (possibly fast) load
  if (token !== pickToken) return;
  const result = await ensureFontLoaded(spec);
  if (token !== pickToken) return; // a newer pick superseded this one
  status.value = result.status;
  emit("update:modelValue", spec); // NOW flip the token — glyphs are ready
}

watch(family, async (fam) => {
  const token = ++pickToken;
  if (!fam) {
    variants.value = [];
    status.value = "idle";
    emit("update:modelValue", null);
    return;
  }
  const entry = await getCatalogEntry(fam);
  if (token !== pickToken) return;
  variants.value = entry?.variants ?? [];
  const intersect = DEFAULT_WEIGHTS.filter((w) => variants.value.includes(w));
  weights.value = intersect.length > 0 ? intersect : [400];
  await applyFamily(fam, token);
});

function toggleWeight(w: number): void {
  weights.value = weights.value.includes(w)
    ? weights.value.filter((x) => x !== w)
    : [...weights.value, w].sort((a, b) => a - b);
  if (weights.value.length === 0) weights.value = [400];
  if (family.value) void applyFamily(family.value, ++pickToken);
}

const isCurated = computed(() =>
  family.value ? CURATED_OFFLINE_FAMILIES.has(family.value) : false,
);
const statusLine = computed<{ text: string; tone: string }>(() => {
  switch (status.value) {
    case "error":
      return { text: "Couldn't load — using fallback", tone: "text-status-warning" };
    case "loaded":
      return { text: isCurated.value ? "Loaded (offline-ready)" : "Loaded", tone: "text-faint" };
    case "loading":
      return { text: "Loading…", tone: "text-muted" };
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
        <span class="truncate" :style="{ fontFamily: `'${option.family}', ${FALLBACK}` }">{{
          option.family
        }}</span>
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
