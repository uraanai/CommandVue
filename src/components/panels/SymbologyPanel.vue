<script setup lang="ts">
import { computed } from "vue";

import { DEMO_SYMBOLS } from "@/modules/symbology/codes";
import { renderSidcToSvg } from "@/modules/symbology/render";
import Fieldset from "@/volt/Fieldset.vue";
import Tag from "@/volt/Tag.vue";

/**
 * SymbologyPanel — MIL-STD-2525 / APP-6 symbol code reference.
 *
 * Each dimension (GROUND / AIR / SEA-SURFACE / SUBSURFACE / SPACE) is grouped
 * in a Volt `Fieldset` whose legend is the dimension name. SIDC codes render
 * as Volt `Tag`s — read-only labels.
 */
const groups = computed(() => {
  const byDimension = new Map<string, (typeof DEMO_SYMBOLS)[number][]>();
  for (const sym of DEMO_SYMBOLS) {
    const list = byDimension.get(sym.dimension) ?? [];
    list.push(sym);
    byDimension.set(sym.dimension, list);
  }
  return Array.from(byDimension, ([dimension, items]) => ({ dimension, items }));
});

function svgFor(sidc: string): string {
  return renderSidcToSvg(sidc, { size: 36 });
}
</script>

<template>
  <div class="bg-surface-sunken h-full w-full overflow-auto p-4">
    <p class="text-muted mb-3 text-xs">
      Standardized operational symbology rendered via
      <code class="bg-surface-raised rounded px-1 py-0.5">milsymbol</code>. SIDC codes follow
      MIL-STD-2525 / APP-6.
    </p>
    <Fieldset
      v-for="group in groups"
      :key="group.dimension"
      :legend="group.dimension"
      :pt="{ root: { class: 'mb-4' } }"
    >
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <div
          v-for="sym in group.items"
          :key="sym.sidc"
          class="bg-surface border-border flex flex-col items-center gap-1.5 rounded border px-2 py-3 text-center"
        >
          <!-- eslint-disable-next-line vue/no-v-html -- milsymbol returns sanitized SVG -->
          <span class="flex h-10 items-center justify-center" v-html="svgFor(sym.sidc)" />
          <p class="text-foreground text-[10px] leading-tight font-medium">{{ sym.label }}</p>
          <Tag :value="sym.sidc.slice(0, 10)" />
        </div>
      </div>
    </Fieldset>
  </div>
</template>
