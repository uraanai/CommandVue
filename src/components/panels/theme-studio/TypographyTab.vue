<script setup lang="ts">
import type { ThemeAuthoring } from "@/composables/useThemeAuthoring";

import { RotateCcw } from "@lucide/vue";
import { computed } from "vue";

import FontPicker from "@/components/panels/theme-studio/FontPicker.vue";
import Button from "@/components/ui/Button.vue";
import IconButton from "@/components/ui/IconButton.vue";
import Select from "@/components/ui/Select.vue";
import {
  deriveTypeScale,
  FIXED_RAMP_FALLBACK,
  TYPE_SCALE_BOUNDS,
  TYPE_SCALE_STEPS,
} from "@/modules/themes/typeScale";
import Checkbox from "@/volt/Checkbox.vue";
import InputNumber from "@/volt/InputNumber.vue";

/**
 * TypographyTab — the Typography-tab body (Track A C2).
 *
 * Four sections: font roles (Body/Sans + Mono + Heading), the modular type-scale
 * generator (base size + ratio → the whole `--text-*` ramp), per-step size
 * overrides, and a live preview sample. It works directly on the shared
 * `useThemeAuthoring` instance — changing `baseSize`/`ratio` recomputes
 * `generationResult` and per-step/role edits mutate `overrides`, both of which the
 * panel's single live-apply writer already watches (no second preview path here).
 *
 * Token-pure: every value is a project utility class or a `var(--token)`; no raw
 * color/length literals (it lives under `src/components/panels/**`, outside the
 * single-source scan, but follows the same rule).
 */
const props = defineProps<{ authoring: ThemeAuthoring }>();

const a = props.authoring;

// --- Font roles ------------------------------------------------------------
/** Mono/Heading write straight to the override map (their value isn't a
 *  generation input). Empty string → clear (back to the tokens.css default). */
function roleValue(token: string): string {
  return a.overrides.value[token] ?? "";
}
function setRole(token: string, value: string | number | null): void {
  const v = value == null ? "" : String(value).trim();
  if (v.length === 0) return;
  a.setOverride(token, v);
}

// --- Type scale ------------------------------------------------------------
/** Effective ramp: derived from the live base/ratio when enabled, else the fixed
 *  tokens.css ramp. Pure — the same value the engine emits, no getComputedStyle. */
const sizeRamp = computed<Record<string, string>>(() =>
  a.typeScaleEnabled.value
    ? deriveTypeScale({ baseSize: a.baseSize.value, ratio: a.ratio.value })
    : FIXED_RAMP_FALLBACK,
);

const rampReadout = computed(() =>
  TYPE_SCALE_STEPS.map((s) => `${s.token.replace("--text-", "")} ${sizeRamp.value[s.token]}`).join(
    " · ",
  ),
);

const RATIO_LEGEND =
  "1.125 major-second · 1.2 minor-third · 1.25 major-third · 1.333 perfect-fourth";

// --- Per-step size overrides ----------------------------------------------
/** Effective per-step value: an explicit override wins, else the live ramp. */
function effectiveSize(token: string): number {
  return parseFloat(a.overrides.value[token] ?? sizeRamp.value[token] ?? "1rem") || 0;
}
function setSize(token: string, n: number | null): void {
  if (n != null) a.setOverride(token, `${n}rem`);
}
function isEdited(token: string): boolean {
  return token in a.overrides.value;
}
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto px-3 pt-1 pb-4">
    <!-- Section A — Font roles -->
    <section class="flex flex-col gap-2">
      <h3 class="text-faint text-[10px] font-semibold tracking-wider uppercase">Font roles</h3>

      <div class="flex flex-col gap-1">
        <span class="text-foreground text-sm font-medium">Body / Sans</span>
        <!-- Quick-stack picker writes the legacy fontFamily; choosing one clears
             any Google fontSpec so the stack takes effect (§0.4). -->
        <Select
          v-model="a.fontFamily.value"
          :options="a.FONT_OPTIONS"
          @update:model-value="a.fontSpec.value = null"
        />
        <span class="text-faint mt-1 text-xs">…or pick any Google font</span>
        <FontPicker v-model="a.fontSpec.value" />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-foreground text-sm font-medium">Heading</span>
        <div class="flex items-center gap-1">
          <Select
            class="min-w-0 flex-1"
            :model-value="roleValue('--font-family-heading')"
            :options="a.FONT_OPTIONS"
            placeholder="Inherits Body…"
            @update:model-value="(v) => setRole('--font-family-heading', v)"
          />
          <IconButton
            v-if="isEdited('--font-family-heading')"
            label="Reset heading font"
            size="sm"
            class="shrink-0"
            @click="a.clearOverride('--font-family-heading')"
          >
            <RotateCcw />
          </IconButton>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-foreground text-sm font-medium">Mono</span>
        <div class="flex items-center gap-1">
          <Select
            class="min-w-0 flex-1"
            :model-value="roleValue('--font-family-mono')"
            :options="a.FONT_OPTIONS"
            placeholder="Default mono…"
            @update:model-value="(v) => setRole('--font-family-mono', v)"
          />
          <IconButton
            v-if="isEdited('--font-family-mono')"
            label="Reset mono font"
            size="sm"
            class="shrink-0"
            @click="a.clearOverride('--font-family-mono')"
          >
            <RotateCcw />
          </IconButton>
        </div>
      </div>
    </section>

    <!-- Section B — Type scale -->
    <section class="border-border-subtle flex flex-col gap-2 border-t pt-3">
      <h3 class="text-faint text-[10px] font-semibold tracking-wider uppercase">Type scale</h3>
      <label class="flex items-center gap-2">
        <Checkbox
          :model-value="a.typeScaleEnabled.value"
          :binary="true"
          @update:model-value="(on: boolean) => (on ? a.enableTypeScale() : a.disableTypeScale())"
        />
        <span class="text-sm">Generate type scale from base size + ratio</span>
      </label>

      <template v-if="a.typeScaleEnabled.value">
        <p class="text-faint text-xs">Enabling regenerates all text sizes from the formula.</p>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-faint text-xs">Base size (px)</span>
            <div class="w-28">
              <InputNumber
                v-model="a.baseSize.value"
                :min="TYPE_SCALE_BOUNDS.baseSize.min"
                :max="TYPE_SCALE_BOUNDS.baseSize.max"
                :step="TYPE_SCALE_BOUNDS.baseSize.step"
                :max-fraction-digits="1"
                fluid
              />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-faint text-xs">Ratio</span>
            <div class="w-28">
              <InputNumber
                v-model="a.ratio.value"
                :min="TYPE_SCALE_BOUNDS.ratio.min"
                :max="TYPE_SCALE_BOUNDS.ratio.max"
                :step="TYPE_SCALE_BOUNDS.ratio.step"
                :max-fraction-digits="3"
                fluid
              />
            </div>
          </div>
        </div>
        <p class="text-faint text-[10px]">{{ RATIO_LEGEND }}</p>
        <p class="text-muted font-mono text-[11px] leading-relaxed">{{ rampReadout }}</p>
      </template>
      <Button
        v-else
        size="sm"
        variant="secondary"
        class="self-start"
        @click="a.matchCurrentTypeScale()"
      >
        Match current
      </Button>
    </section>

    <!-- Section C — Per-step size overrides -->
    <section class="border-border-subtle flex flex-col gap-1 border-t pt-3">
      <h3 class="text-faint text-[10px] font-semibold tracking-wider uppercase">
        Per-step sizes
        <span class="ml-1 normal-case opacity-70">(advanced — overrides the ramp)</span>
      </h3>
      <div
        v-for="step in TYPE_SCALE_STEPS"
        :key="step.token"
        class="grid grid-cols-[1fr_7rem_auto] items-center gap-2 py-0.5"
      >
        <span class="text-foreground flex items-center gap-1.5 text-sm">
          {{ step.token.replace("--text-", "") }}
          <span
            v-if="isEdited(step.token)"
            class="bg-interactive size-1.5 rounded-full"
            aria-hidden="true"
          />
        </span>
        <InputNumber
          :model-value="effectiveSize(step.token)"
          :min="0"
          :max-fraction-digits="4"
          suffix=" rem"
          fluid
          @update:model-value="(n: number | null) => setSize(step.token, n)"
        />
        <IconButton
          v-if="isEdited(step.token)"
          label="Reset this size"
          size="sm"
          @click="a.clearOverride(step.token)"
        >
          <RotateCcw />
        </IconButton>
        <span v-else aria-hidden="true" />
      </div>
    </section>

    <!-- Section D — Preview -->
    <section class="border-border-subtle flex flex-col gap-1 border-t pt-3">
      <h3 class="text-faint text-[10px] font-semibold tracking-wider uppercase">Preview</h3>
      <div :style="{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--text-2xl)' }">
        Heading — operations at a glance
      </div>
      <div :style="{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--text-base)' }">
        Body text renders panel content and reading copy across the dashboard.
      </div>
      <div
        class="text-muted"
        :style="{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-sm)' }"
      >
        mono 0123456789 · LAT 30.04 LON 70.12
      </div>
    </section>
  </div>
</template>
