<script setup lang="ts">
import type { ThemeAuthoring } from "@/composables/useThemeAuthoring";

import { useDebounceFn } from "@vueuse/core";
import { ref, watch } from "vue";

import { EFFECTS_DEFAULTS } from "@/modules/themes/effects";
import InputNumber from "@/volt/InputNumber.vue";
import Slider from "@/volt/Slider.vue";

/**
 * EffectsTab — the Effects-tab body (Track A C5).
 *
 * Three high-level depth knobs — elevation depth, accent-glow strength, panel
 * blur radius — plus a live elevation-ramp strip and a glow chip. Works directly
 * on the shared `useThemeAuthoring` instance: each knob materializes `a.effects`
 * (lazy-null → `{ ...EFFECTS_DEFAULTS, [knob]: v }` on first touch), the panel's
 * existing `generationResult` watch applies the change (no second writer here).
 * Each knob binds to a LOCAL ref (instant, smooth drag) and commits to `effects`
 * on a trailing debounce, so dragging a slider doesn't run the engine on every
 * pointermove (which froze + stuck the drag); the live preview updates ~16/s.
 *
 * Token-pure: the ramp strip / glow chip read `var(--shadow-N)` /
 * `var(--shadow-accent-glow)` live (so Tokens-tab overrides reflect too); no raw
 * color or length literals.
 */
const props = defineProps<{ authoring: ThemeAuthoring }>();
const a = props.authoring;

function knob<K extends "depth" | "glowAlpha" | "blurRadius">(k: K) {
  const local = ref<number>(a.effects.value?.[k] ?? EFFECTS_DEFAULTS[k]);
  // Back-sync when `effects` changes externally (seedFromTheme / reset).
  watch(
    () => a.effects.value?.[k],
    (v) => {
      if (v !== undefined && v !== local.value) local.value = v;
    },
  );
  // Commit to the shared store on a trailing debounce — the heavy generateTheme
  // cascade runs ~16/s during a drag, not on every pointermove. Materializes
  // `effects` from EFFECTS_DEFAULTS on first touch.
  const commit = useDebounceFn((v: number) => {
    a.effects.value = { ...(a.effects.value ?? EFFECTS_DEFAULTS), [k]: v };
  }, 60);
  watch(local, (v) => commit(v));
  return local;
}
const depth = knob("depth");
const glowAlpha = knob("glowAlpha");
const blurRadius = knob("blurRadius");
const rampSteps = [1, 2, 3, 4, 5];
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto px-3 pt-1 pb-4 text-sm">
    <!-- Elevation depth -->
    <section class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-foreground font-medium">Elevation depth</span>
        <div class="w-20">
          <InputNumber
            v-model="depth"
            :min="0"
            :max="100"
            :step="1"
            :max-fraction-digits="0"
            fluid
          />
        </div>
      </div>
      <Slider v-model="depth" :min="0" :max="100" :step="1" />
      <span class="text-faint text-[10px]">0 = flat · 50 = neutral default · 100 = dramatic.</span>
    </section>

    <!-- Accent glow -->
    <section class="border-border-subtle flex flex-col gap-1 border-t pt-3">
      <div class="flex items-center justify-between">
        <span class="text-foreground font-medium">Accent glow strength</span>
        <div class="w-20">
          <InputNumber
            v-model="glowAlpha"
            :min="0"
            :max="1"
            :step="0.01"
            :max-fraction-digits="2"
            fluid
          />
        </div>
      </div>
      <Slider v-model="glowAlpha" :min="0" :max="1" :step="0.01" />
      <div class="flex items-center gap-2 pt-1">
        <div
          class="h-6 w-12 rounded-md"
          :style="{
            boxShadow: 'var(--shadow-accent-glow)',
            backgroundColor: 'var(--color-interactive)',
          }"
          aria-hidden="true"
        />
        <span class="text-faint text-[10px]"
          >Re-points the accent glow; the accent color drives it.</span
        >
      </div>
    </section>

    <!-- Panel blur -->
    <section class="border-border-subtle flex flex-col gap-1 border-t pt-3">
      <div class="flex items-center justify-between">
        <span class="text-foreground font-medium">Panel blur (glass)</span>
        <div class="w-20">
          <InputNumber
            v-model="blurRadius"
            :min="0"
            :max="24"
            :step="1"
            :max-fraction-digits="0"
            suffix=" px"
            fluid
          />
        </div>
      </div>
      <Slider v-model="blurRadius" :min="0" :max="24" :step="1" />
      <span class="text-faint text-[10px]">Used by glass panels (Panels &amp; Chrome).</span>
    </section>

    <!-- Live elevation ramp -->
    <section class="border-border-subtle flex flex-col gap-1 border-t pt-3">
      <span class="text-faint text-[10px] font-semibold tracking-wider uppercase"
        >Elevation ramp</span
      >
      <div class="flex items-end gap-3 px-1 py-3">
        <div
          v-for="n in rampSteps"
          :key="n"
          class="flex h-10 w-10 items-center justify-center rounded-md text-[10px]"
          :style="{
            backgroundColor: 'var(--color-surface-raised)',
            color: 'var(--color-text-secondary)',
            boxShadow: `var(--shadow-${n})`,
          }"
        >
          {{ n }}
        </div>
      </div>
    </section>
  </div>
</template>
