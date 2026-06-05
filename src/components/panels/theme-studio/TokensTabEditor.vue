<script setup lang="ts">
import type { TokenManifestEntry } from "@/modules/themes/tokenManifest";

import fuzzysort from "fuzzysort";
import { computed, ref } from "vue";

import TokenRow from "@/components/panels/theme-studio/TokenRow.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import {
  populatedSections,
  TOKEN_MANIFEST_LIST,
  TOKEN_SECTION_LABELS,
} from "@/modules/themes/tokenManifest";

/**
 * TokensTabEditor — the Tokens-tab body (Track A C1). The per-token "change
 * anything" surface: search, an "edited N" chip, "Reset all", and a
 * section-grouped list of TokenRows. Presentation only — no store/composable
 * imports; it takes a resolved-values snapshot + the sparse override map and
 * emits set/reset/reset-all up to the panel, which forwards them to the
 * C6-owned override seam.
 */
interface Props {
  /** Resolved current value for EVERY manifest token (getComputedStyle snapshot). */
  resolved: Record<string, string>;
  /** Sparse override map (token → value) for edited badges + reset state. */
  overrides: Record<string, string>;
}
const props = defineProps<Props>();
defineEmits<{
  set: [token: string, value: string];
  reset: [token: string];
  "reset-all": [];
}>();

const search = ref("");

const filtered = computed<TokenManifestEntry[]>(() => {
  const q = search.value.trim();
  if (!q) return [...TOKEN_MANIFEST_LIST];
  return fuzzysort
    .go(q, TOKEN_MANIFEST_LIST, { keys: ["label", "name"], threshold: -10000 })
    .map((r) => r.obj);
});

const sections = computed(() =>
  populatedSections()
    .map((section) => ({
      section,
      label: TOKEN_SECTION_LABELS[section],
      entries: filtered.value.filter((e) => e.section === section),
    }))
    .filter((g) => g.entries.length > 0),
);

const editedCount = computed(() => Object.keys(props.overrides).length);
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col">
    <!-- Top bar -->
    <div class="flex items-center gap-2 px-3 pt-1 pb-2">
      <Input
        v-model="search"
        type="search"
        class="min-w-0 flex-1"
        placeholder="Search tokens…"
        spellcheck="false"
      />
      <span class="text-muted shrink-0 text-xs tabular-nums">{{ editedCount }} edited</span>
      <Button
        size="sm"
        variant="secondary"
        :disabled="editedCount === 0"
        @click="$emit('reset-all')"
      >
        Reset all
      </Button>
    </div>

    <!-- Body -->
    <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3">
      <section v-for="group in sections" :key="group.section">
        <h3
          class="bg-surface text-faint sticky top-0 z-10 py-1.5 text-[10px] font-semibold tracking-wider uppercase"
        >
          {{ group.label }}
        </h3>
        <TokenRow
          v-for="entry in group.entries"
          :key="entry.name"
          :entry="entry"
          :resolved-value="resolved[entry.name] ?? ''"
          :resolved-contrast-bg="
            entry.contrastAgainst ? resolved[entry.contrastAgainst] : undefined
          "
          :edited="entry.name in overrides"
          @set="(token, value) => $emit('set', token, value)"
          @reset="(token) => $emit('reset', token)"
        />
      </section>

      <div
        v-if="sections.length === 0"
        class="text-muted flex flex-col items-center gap-1 py-8 text-sm"
      >
        <span>No tokens match “{{ search }}”.</span>
        <Button size="sm" variant="secondary" @click="search = ''">Clear search</Button>
      </div>
    </div>
  </div>
</template>
