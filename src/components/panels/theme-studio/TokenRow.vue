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

function emitLength(value: number | null): void {
  if (value !== null) lengthNum.value = value;
  emit("set", props.entry.name, `${lengthNum.value}${lengthUnit.value}`);
}
function emitLengthUnit(): void {
  emit("set", props.entry.name, `${lengthNum.value}${lengthUnit.value}`);
}
function emitNumber(value: number | null): void {
  emit("set", props.entry.name, String(value ?? 0));
}
function emitFreeText(): void {
  const v = freeText.value.trim();
  if (!TokenValueSchema.safeParse(v).success) {
    freeTextError.value = true;
    return;
  }
  freeTextError.value = false;
  emit("set", props.entry.name, v);
}
function emitFont(value: string | number | null): void {
  const v = value == null ? "" : String(value);
  if (v.trim().length > 0) emit("set", props.entry.name, v);
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
    class="border-border-subtle flex items-center gap-3 border-b py-1.5 last:border-b-0"
    :title="entry.name"
  >
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="text-foreground truncate text-sm">{{ entry.label }}</span>
        <span
          v-if="edited"
          class="bg-interactive size-1.5 shrink-0 rounded-full"
          aria-hidden="true"
        />
      </div>
      <code class="text-faint block truncate font-mono text-[10px]">{{ entry.name }}</code>
      <div v-if="isDensity" class="text-faint text-[10px]">Overrides the density attribute</div>
    </div>

    <!-- WCAG advisory chip (color rows with a contrast partner) -->
    <span
      v-if="wcagChip"
      :class="['shrink-0 font-mono text-[10px]', wcagChip.tone]"
      title="Advisory WCAG contrast — does not block"
      >{{ wcagChip.text }}</span
    >

    <!-- kind-specific control -->
    <div class="flex shrink-0 items-center gap-1.5">
      <TokenColorField
        v-if="entry.kind === 'color'"
        :resolved-value="resolvedValue"
        :edited="edited"
        :label="entry.label"
        @change="(v: string) => $emit('set', entry.name, v)"
      />

      <template v-else-if="entry.kind === 'length'">
        <template v-if="isPlainLength">
          <InputNumber
            :model-value="lengthNum"
            :max-fraction-digits="4"
            class="w-20"
            @update:model-value="emitLength"
          />
          <Select
            v-model="lengthUnit"
            :options="UNIT_OPTIONS"
            class="w-16"
            @update:model-value="emitLengthUnit"
          />
        </template>
        <Input
          v-else
          v-model="freeText"
          :invalid="freeTextError"
          class="w-40"
          spellcheck="false"
          title="var()/calc() chain — edit raw"
          @keyup.enter="emitFreeText"
          @blur="emitFreeText"
        />
      </template>

      <InputNumber
        v-else-if="entry.kind === 'number'"
        :model-value="Number(resolvedValue) || 0"
        class="w-24"
        @update:model-value="emitNumber"
      />

      <Select
        v-else-if="entry.kind === 'font-stack'"
        :model-value="resolvedValue"
        :options="FONT_OPTIONS"
        class="w-44"
        placeholder="Font…"
        @update:model-value="emitFont"
      />

      <Input
        v-else-if="entry.kind === 'shadow'"
        v-model="freeText"
        :invalid="freeTextError"
        class="w-44"
        spellcheck="false"
        title="box-shadow value"
        @keyup.enter="emitFreeText"
        @blur="emitFreeText"
      />

      <IconButton
        v-if="edited"
        label="Reset this token"
        size="sm"
        @click="$emit('reset', entry.name)"
      >
        <RotateCcw />
      </IconButton>
    </div>
  </div>
</template>
