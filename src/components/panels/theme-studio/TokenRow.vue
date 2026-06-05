<script setup lang="ts">
import type { TokenManifestEntry } from "@/modules/themes/tokenManifest";

import { RotateCcw } from "@lucide/vue";
import { wcagContrast } from "culori";
import { computed, ref, watch } from "vue";

import TokenColorField from "@/components/panels/theme-studio/TokenColorField.vue";
import IconButton from "@/components/ui/IconButton.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import { CURATED_FONTS } from "@/modules/themes/curated-swatches";
import { TokenValueSchema } from "@/modules/themes/portableSchema";
import InputNumber from "@/volt/InputNumber.vue";

/**
 * TokenRow — one token's editor row (Track A C1). Presentation only: it takes
 * the entry + resolved values and emits set/reset; it never imports the store or
 * the composable. The control is chosen by `entry.kind`.
 *
 * Layout is a strict two-column grid — a min-w-0 label column (label + raw name
 * + advisory chip stacked) and a fixed-width control column — so rows never push
 * a horizontal scrollbar in the narrow controls pane.
 */
interface Props {
  entry: TokenManifestEntry;
  /** getComputedStyle resolved value for entry.name. */
  resolvedValue: string;
  /** getComputedStyle resolved value for entry.contrastAgainst (color rows only). */
  resolvedContrastBg?: string;
  /** entry.name in overrides. */
  edited: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ set: [token: string, value: string]; reset: [token: string] }>();

const FONT_OPTIONS = CURATED_FONTS.map((f) => ({ label: f.label, value: f.value }));
const UNIT_OPTIONS = ["rem", "px", "em", "%"].map((u) => ({ label: u, value: u }));

// --- length / number parsing ----------------------------------------------
const LENGTH_RE = /^(-?[\d.]+)\s*(rem|px|em|%)?$/;
const lengthNum = ref(0);
const lengthUnit = ref("rem");
const isPlainLength = ref(true);
const freeText = ref("");
const freeTextError = ref(false);

watch(
  () => props.resolvedValue,
  (v) => {
    const m = LENGTH_RE.exec((v ?? "").trim());
    if (m) {
      lengthNum.value = parseFloat(m[1] ?? "0");
      lengthUnit.value = m[2] ?? "rem";
      isPlainLength.value = true;
    } else {
      isPlainLength.value = false;
    }
    freeText.value = v ?? "";
    freeTextError.value = false;
  },
  { immediate: true },
);

/** A control commits on blur, so focusing then leaving it must NOT mark the token
 *  edited unless the value actually changed from the resolved value. */
function unchanged(value: string): boolean {
  return value === (props.resolvedValue ?? "").trim();
}
function emitLength(value: number | null): void {
  if (value !== null) lengthNum.value = value;
  const composed = `${lengthNum.value}${lengthUnit.value}`;
  if (!unchanged(composed)) emit("set", props.entry.name, composed);
}
function emitLengthUnit(): void {
  const composed = `${lengthNum.value}${lengthUnit.value}`;
  if (!unchanged(composed)) emit("set", props.entry.name, composed);
}
function emitNumber(value: number | null): void {
  const s = String(value ?? 0);
  if (!unchanged(s)) emit("set", props.entry.name, s);
}
function emitFreeText(): void {
  const v = freeText.value.trim();
  if (unchanged(v)) {
    freeTextError.value = false;
    return;
  }
  if (!TokenValueSchema.safeParse(v).success) {
    freeTextError.value = true;
    return;
  }
  freeTextError.value = false;
  emit("set", props.entry.name, v);
}
function emitFont(value: string | number | null): void {
  const v = value == null ? "" : String(value);
  if (v.trim().length === 0 || unchanged(v)) return;
  emit("set", props.entry.name, v);
}

// --- WCAG advisory chip -----------------------------------------------------
const wcag = computed<number | undefined>(() => {
  if (props.entry.kind !== "color" || !props.entry.contrastAgainst || !props.resolvedContrastBg) {
    return undefined;
  }
  const r = wcagContrast(props.resolvedValue, props.resolvedContrastBg);
  return typeof r === "number" && Number.isFinite(r) ? r : undefined;
});
const wcagChip = computed(() => {
  const r = wcag.value;
  if (r === undefined) return null;
  if (r >= 4.5) return { text: `${r.toFixed(1)} AA`, tone: "text-status-success" };
  if (r >= 3) return { text: `${r.toFixed(1)} AA Large`, tone: "text-status-warning" };
  return { text: `${r.toFixed(1)} ⚠ low`, tone: "text-status-danger" };
});

const isDensity = computed(() => props.entry.section === "density");
</script>

<template>
  <div
    class="border-border-subtle grid grid-cols-[1fr_10rem] items-center gap-x-3 gap-y-0.5 border-b px-3 py-1.5 last:border-b-0"
    :title="entry.name"
  >
    <!-- Column 1 — label / raw name / advisory chip (min-w-0; no width pressure) -->
    <div class="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5">
      <span class="text-foreground truncate text-sm">{{ entry.label }}</span>
      <span
        v-if="edited"
        class="bg-interactive size-1.5 shrink-0 rounded-full"
        aria-hidden="true"
      />
    </div>
    <div class="col-start-1 row-start-2 flex min-w-0 items-center gap-2">
      <code class="text-faint min-w-0 truncate font-mono text-[10px]">{{ entry.name }}</code>
      <span
        v-if="wcagChip"
        :class="['shrink-0 font-mono text-[10px]', wcagChip.tone]"
        title="Advisory WCAG contrast (this color vs its background) — does not block"
        >{{ wcagChip.text }}</span
      >
      <span v-if="isDensity" class="text-faint shrink-0 text-[10px]">overrides density attr</span>
    </div>

    <!-- Column 2 — the kind-specific control + reset (fixed width; never overflows) -->
    <div class="col-start-2 row-span-2 flex w-40 shrink-0 items-center justify-end gap-1">
      <TokenColorField
        v-if="entry.kind === 'color'"
        :resolved-value="resolvedValue"
        :edited="edited"
        :label="entry.label"
        @change="(v: string) => $emit('set', entry.name, v)"
      />

      <div v-else-if="entry.kind === 'length'" class="flex min-w-0 flex-1 items-center gap-1">
        <template v-if="isPlainLength">
          <InputNumber
            :model-value="lengthNum"
            :max-fraction-digits="4"
            fluid
            class="min-w-0 flex-1"
            @update:model-value="emitLength"
          />
          <Select
            v-model="lengthUnit"
            :options="UNIT_OPTIONS"
            class="w-14 shrink-0"
            @update:model-value="emitLengthUnit"
          />
        </template>
        <Input
          v-else
          v-model="freeText"
          :invalid="freeTextError"
          class="min-w-0 flex-1"
          spellcheck="false"
          title="var()/calc() chain — edit raw"
          @keyup.enter="emitFreeText"
          @blur="emitFreeText"
        />
      </div>

      <InputNumber
        v-else-if="entry.kind === 'number'"
        :model-value="Number(resolvedValue) || 0"
        fluid
        class="min-w-0 flex-1"
        @update:model-value="emitNumber"
      />

      <Select
        v-else-if="entry.kind === 'font-stack'"
        :model-value="resolvedValue"
        :options="FONT_OPTIONS"
        class="min-w-0 flex-1"
        placeholder="Font…"
        @update:model-value="emitFont"
      />

      <Input
        v-else-if="entry.kind === 'shadow'"
        v-model="freeText"
        :invalid="freeTextError"
        class="min-w-0 flex-1"
        spellcheck="false"
        title="box-shadow value"
        @keyup.enter="emitFreeText"
        @blur="emitFreeText"
      />

      <IconButton
        v-if="edited"
        label="Reset this token"
        size="sm"
        class="shrink-0"
        @click="$emit('reset', entry.name)"
      >
        <RotateCcw />
      </IconButton>
    </div>
  </div>
</template>
