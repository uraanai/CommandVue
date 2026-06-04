<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";

import { onMounted, onUnmounted, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import ColorSwatchPicker from "@/components/ui/ColorSwatchPicker.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import { usePanelApi } from "@/composables/usePanelApi";
import { useThemeAuthoring } from "@/composables/useThemeAuthoring";
import { ACCENT_COLOR_SWATCHES, BASE_COLOR_SWATCHES } from "@/modules/themes/curated-swatches";
import { themeRegistry } from "@/modules/themes/registry";
import { useThemeStore } from "@/stores/theme";
import Checkbox from "@/volt/Checkbox.vue";
import Slider from "@/volt/Slider.vue";

/**
 * Theme Studio panel (Track A A2a) — the floatable authoring surface (dock it,
 * float it, or pop it out to a second monitor) that replaces the modal
 * customizer. Unlike the dialog (which previews
 * into a scoped `<div>`), this panel writes the freshly-generated tokens to the
 * **top-window root** via `themeStore.previewThemeTokens` — so every edit live-
 * recolors the main window, every float, and every pop-out at once (including a
 * popped-out Studio, because the store targets the captured `APP_ROOT`, never the
 * child realm's `document`).
 *
 * Idle by default: a blank panel does NOT apply a preview on mount (so a restored
 * layout doesn't recolor the app just because the Studio was left open). The
 * preview activates when opened to edit a theme, or on the first control change.
 * Save persists via the composable (which applies the committed theme); the panel
 * then drops the preview overlay. Closing the panel discards an uncommitted
 * preview (`onUnmounted → cancelPreview`).
 */
const props = defineProps<PanelApiProps>();
usePanelApi(props);

const themeStore = useThemeStore();
const a = useThemeAuthoring();

/** Live-apply the current generation to the top root when the preview is active. */
let previewActive = false;
function applyPreview(): void {
  const result = a.generationResult.value;
  if (result && previewActive) themeStore.previewThemeTokens(result.tokens);
}

onMounted(() => {
  const id = props.params?.params?.themeToEditId as string | undefined;
  const theme = id ? (themeRegistry.get(id) ?? null) : null;
  a.seedFromTheme(theme);
  // Opening to EDIT a theme previews it immediately; a blank panel stays idle.
  if (theme) {
    previewActive = true;
    applyPreview();
  }
});

// Any regeneration after mount is a user action → activate + apply the preview.
watch(a.generationResult, () => {
  previewActive = true;
  applyPreview();
});

onUnmounted(() => {
  // Discard any uncommitted live preview, restoring the committed theme.
  themeStore.cancelPreview();
});

async function onSave(): Promise<void> {
  const saved = a.isEditMode.value ? await a.updateExisting() : await a.save();
  if (saved) {
    // The committed theme is now applied (setTheme); drop the preview overlay.
    themeStore.endPreview();
    previewActive = false;
  }
}

function onDiscard(): void {
  themeStore.cancelPreview();
  previewActive = false;
  a.reset();
}
</script>

<template>
  <div class="bg-surface text-foreground flex h-full w-full flex-col overflow-hidden">
    <header class="border-border-subtle flex items-center justify-between border-b px-3 py-2">
      <h2 class="text-foreground text-sm font-semibold">
        {{ a.isEditMode.value ? `Edit ${a.themeToEdit.value?.name ?? "theme"}` : "Theme Studio" }}
      </h2>
      <span class="text-faint text-[10px] tracking-wider uppercase">Live preview</span>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 text-sm">
      <!-- Start from -->
      <section class="flex flex-wrap items-center gap-2">
        <span class="text-faint mr-1 text-[10px] tracking-wider uppercase">Start from</span>
        <Button
          size="sm"
          :variant="a.startFromMode.value === 'blank' ? 'primary' : 'secondary'"
          @click="a.startFromMode.value = 'blank'"
        >
          Blank
        </Button>
        <Button
          size="sm"
          :variant="a.startFromMode.value === 'built-in' ? 'primary' : 'secondary'"
          @click="a.startFromMode.value = 'built-in'"
        >
          Built-in
        </Button>
        <Button
          size="sm"
          :variant="a.startFromMode.value === 'custom' ? 'primary' : 'secondary'"
          :disabled="a.customOptions.value.length === 0"
          @click="a.startFromMode.value = 'custom'"
        >
          Custom
        </Button>
        <div v-if="a.startFromMode.value === 'built-in'" class="w-full">
          <Select
            v-model="a.startFromBuiltInId.value"
            :options="a.builtInOptions.value"
            placeholder="Choose a built-in…"
          />
        </div>
        <div v-if="a.startFromMode.value === 'custom'" class="w-full">
          <Select
            v-model="a.startFromCustomId.value"
            :options="a.customOptions.value"
            placeholder="Choose a generated theme…"
          />
        </div>
      </section>

      <label class="flex flex-col gap-1">
        <span class="text-foreground font-medium">Name</span>
        <Input v-model="a.name.value" placeholder="e.g. Ocean Sunrise" />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-foreground font-medium">Description (optional)</span>
        <Input v-model="a.description.value" placeholder="A short note for the picker" />
      </label>

      <div class="flex flex-col gap-1">
        <span class="text-foreground font-medium">Mode</span>
        <div class="flex gap-1" role="radiogroup" aria-label="Mode">
          <Button
            v-for="m in a.MODES"
            :key="m"
            size="sm"
            :variant="a.mode.value === m ? 'primary' : 'secondary'"
            :aria-checked="a.mode.value === m"
            role="radio"
            @click="a.mode.value = m"
          >
            {{ m === "light" ? "Light" : "Dark" }}
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-foreground font-medium">Base color</span>
        <ColorSwatchPicker
          v-model="a.baseColor.value"
          :options="BASE_COLOR_SWATCHES"
          aria-label="Base color"
        />
        <span class="text-faint font-mono text-[10px]">{{ a.baseColor.value }}</span>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-foreground font-medium">Accent color</span>
        <ColorSwatchPicker
          v-model="a.accentColor.value"
          :options="ACCENT_COLOR_SWATCHES"
          aria-label="Accent color"
        />
        <span class="text-faint font-mono text-[10px]">{{ a.accentColor.value }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-foreground font-medium">Status hues</span>
        <div v-for="fam in a.STATUS_FAMILIES" :key="fam" class="flex items-center gap-2">
          <span class="text-muted w-16 shrink-0 text-xs capitalize">{{ fam }}</span>
          <ColorSwatchPicker
            v-model="a.statusSwatch.value[fam]"
            :options="a.statusOptions.value[fam]"
            :allow-custom="false"
            :aria-label="`${fam} hue`"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-foreground font-medium">Contrast</span>
          <span class="text-muted text-xs">{{ a.contrast.value }}</span>
        </div>
        <Slider v-model="a.contrast.value" :min="30" :max="100" :step="1" />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-foreground font-medium">Density</span>
        <div class="flex gap-1" role="radiogroup" aria-label="Density">
          <Button
            v-for="d in a.DENSITIES"
            :key="d"
            size="sm"
            :variant="a.density.value === d ? 'primary' : 'secondary'"
            :aria-checked="a.density.value === d"
            role="radio"
            @click="a.density.value = d"
          >
            {{ d.charAt(0).toUpperCase() + d.slice(1) }}
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-foreground font-medium">Font family</span>
        <Select v-model="a.fontFamily.value" :options="a.FONT_OPTIONS" />
      </div>

      <div class="border-border-subtle flex flex-col gap-2 border-t pt-3">
        <label class="flex items-center gap-2">
          <Checkbox v-model="a.generatePaired.value" :binary="true" />
          <span>Generate paired {{ a.mode.value === "light" ? "Dark" : "Light" }} variant</span>
        </label>
        <label class="flex items-center gap-2">
          <Checkbox v-model="a.applyAfterSave.value" :binary="true" />
          <span>Apply after saving</span>
        </label>
      </div>

      <p v-if="a.contrastReport.value" class="text-faint text-[10px]">
        Text/surface contrast {{ a.contrastReport.value.textOnSurface.toFixed(1) }}:1 ·
        on-interactive {{ a.contrastReport.value.onInteractive.toFixed(1) }}:1
      </p>
      <p v-if="a.saveError.value" class="text-danger text-xs">{{ a.saveError.value }}</p>
    </div>

    <footer class="border-border-subtle flex items-center justify-end gap-2 border-t px-3 py-2">
      <Button size="sm" variant="secondary" @click="onDiscard">Discard</Button>
      <Button size="sm" variant="primary" :disabled="a.saving.value" @click="onSave">
        {{ a.isEditMode.value ? "Update theme" : "Save theme" }}
      </Button>
    </footer>
  </div>
</template>
