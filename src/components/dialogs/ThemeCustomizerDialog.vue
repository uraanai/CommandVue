<script setup lang="ts">
import type { Theme, ThemeDensity, ThemeId, ThemeMode } from "@/types/theme";

import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import ColorSwatchPicker from "@/components/ui/ColorSwatchPicker.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import { themeRepo } from "@/modules/storage/themeRepo";
import {
  ACCENT_COLOR_SWATCHES,
  BASE_COLOR_SWATCHES,
  BLANK_DEFAULTS,
  CURATED_FONTS,
} from "@/modules/themes/curated-swatches";
import { generateTheme } from "@/modules/themes/generate";
import { themeRegistry } from "@/modules/themes/registry";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";
import Checkbox from "@/volt/Checkbox.vue";
import Dialog from "@/volt/Dialog.vue";
import Slider from "@/volt/Slider.vue";

/**
 * Theme customizer dialog — the Linear-style authoring surface.
 *
 * Three to four high-level inputs (base + accent colors, contrast, plus
 * mode / density / font) drive `generateTheme()` and the resulting tokens
 * are written to a scoped `<div>` for the live preview. Save persists via
 * `themeRepo.create` (auto-syncs `themeRegistry` via Phase C); the paired-
 * variant checkbox additionally generates the opposite-mode counterpart and
 * cross-links both via `generation.paired`.
 *
 * Edit mode: when `themeToEdit` is a generated theme, the dialog opens with
 * inputs pre-filled from its `generation` block. **Save always creates a new
 * theme** — per the prompt's spec, the original isn't mutated. The pre-fill
 * pattern is intentionally "duplicate to edit".
 *
 * Wired into `View → Create new theme…` and `View → Edit current theme…`
 * from `MenuBar.vue`.
 */

interface Props {
  visible: boolean;
  /** Generated theme whose inputs pre-fill the form. Save still creates a new
   *  theme; the original is untouched. */
  themeToEdit?: Theme | null;
}
const props = withDefaults(defineProps<Props>(), { themeToEdit: null });
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const themeStore = useThemeStore();
const workspaceStore = useWorkspaceStore();

// --- Inputs --------------------------------------------------------------
const name = ref("");
const description = ref("");
const mode = ref<ThemeMode>("light");
const baseColor = ref<string>(BLANK_DEFAULTS.baseColor);
const accentColor = ref<string>(BLANK_DEFAULTS.accentColor);
const contrast = ref<number>(BLANK_DEFAULTS.contrast);
const density = ref<ThemeDensity>("comfortable");
const fontFamily = ref<string>(BLANK_DEFAULTS.fontFamily);
const generatePaired = ref(true);
const applyAfterSave = ref(true);

const saveError = ref<string | null>(null);
const saving = ref(false);

// --- Start-from selector -------------------------------------------------
type StartFromMode = "blank" | "built-in" | "custom";
const startFromMode = ref<StartFromMode>("blank");
const startFromBuiltInId = ref<ThemeId | null>(null);
const startFromCustomId = ref<ThemeId | null>(null);

const builtInOptions = computed(() =>
  themeRegistry.listBuiltIn().map((t) => ({ label: t.name, value: t.id })),
);
// Only generated themes carry a meaningful generation block to start from.
const customOptions = computed(() =>
  themeRegistry.listGenerated().map((t) => ({ label: t.name, value: t.id })),
);

function applyDefaults(): void {
  baseColor.value = BLANK_DEFAULTS.baseColor;
  accentColor.value = BLANK_DEFAULTS.accentColor;
  contrast.value = BLANK_DEFAULTS.contrast;
  fontFamily.value = BLANK_DEFAULTS.fontFamily;
}

function loadFromBuiltIn(id: ThemeId): void {
  const t = themeRegistry.get(id);
  if (!t) return;
  // Built-ins have no `generation` block — we can only copy mode + density.
  // Colors default to swatches; user adjusts from there.
  mode.value = t.mode;
  density.value = t.density;
  applyDefaults();
  if (!name.value) name.value = `Based on ${t.name}`;
}

function loadFromGenerated(id: ThemeId): void {
  const t = themeRegistry.get(id);
  if (!t || !t.generation) return;
  baseColor.value = t.generation.baseColor;
  accentColor.value = t.generation.accentColor;
  contrast.value = t.generation.contrast;
  mode.value = t.mode;
  density.value = t.density;
  // fontFamily isn't persisted in the generation block today — leave at current.
}

watch(startFromMode, (m) => {
  if (m === "blank") applyDefaults();
});
watch(startFromBuiltInId, (id) => {
  if (id) loadFromBuiltIn(id);
});
watch(startFromCustomId, (id) => {
  if (id) loadFromGenerated(id);
});

// --- Pre-fill on open ----------------------------------------------------
watch(
  () => props.visible,
  (visible, wasVisible) => {
    if (!visible || wasVisible) return; // only fire on the transition false → true
    saveError.value = null;
    const t = props.themeToEdit;
    if (t && t.source === "generated" && t.generation) {
      // Edit mode — pre-fill from `generation`. Default name to the original
      // so the primary "Update" action overwrites cleanly; if the user
      // prefers "Save as new theme" they can change the name first to avoid
      // the name-uniqueness invariant tripping.
      name.value = t.name;
      description.value = t.description ?? "";
      baseColor.value = t.generation.baseColor;
      accentColor.value = t.generation.accentColor;
      contrast.value = t.generation.contrast;
      mode.value = t.mode;
      density.value = t.density;
      generatePaired.value = !!t.generation.paired;
      startFromMode.value = "custom";
      startFromCustomId.value = t.id;
    } else {
      name.value = "";
      description.value = "";
      startFromMode.value = "blank";
      startFromBuiltInId.value = null;
      startFromCustomId.value = null;
      applyDefaults();
    }
  },
);

// --- Generation result (powers live preview + contrast report) -----------
const generationResult = computed(() => {
  try {
    return generateTheme({
      name: name.value || "Preview",
      baseColor: baseColor.value,
      accentColor: accentColor.value,
      contrast: contrast.value,
      mode: mode.value,
      density: density.value,
      fontFamily: fontFamily.value || undefined,
    });
  } catch {
    // Bad input shouldn't crash the dialog — show nothing in the preview.
    return null;
  }
});

const previewStyle = computed<Record<string, string>>(() => {
  const r = generationResult.value;
  return r ? { ...r.tokens } : {};
});

const contrastReport = computed(() => generationResult.value?.contrastReport ?? null);

const isEditMode = computed(
  () => props.themeToEdit !== null && props.themeToEdit?.source === "generated",
);

const dialogHeader = computed(() =>
  isEditMode.value ? `Edit ${props.themeToEdit?.name ?? "theme"}` : "Create new theme",
);

const canSave = computed(() => !saving.value && name.value.trim().length > 0);

// --- Save ----------------------------------------------------------------
async function save(): Promise<void> {
  saveError.value = null;
  const cleanName = name.value.trim();
  if (!cleanName) {
    saveError.value = "Name is required.";
    return;
  }
  const result = generationResult.value;
  if (!result) {
    saveError.value = "Inputs produced an invalid theme — adjust the base or accent color.";
    return;
  }
  saving.value = true;
  try {
    const generationMeta = {
      schemaVersion: 1 as const,
      baseColor: baseColor.value,
      accentColor: accentColor.value,
      contrast: contrast.value,
    };
    const created = await themeRepo.create({
      name: cleanName,
      description: description.value,
      author: "",
      source: "generated",
      mode: mode.value,
      density: density.value,
      tokens: result.tokens,
      generation: generationMeta,
    });

    if (generatePaired.value) {
      const flippedMode: ThemeMode = mode.value === "light" ? "dark" : "light";
      const pairedSuffix = flippedMode === "dark" ? "Dark" : "Light";
      const pairedName = `${cleanName} (${pairedSuffix})`;
      const pairedResult = generateTheme({
        name: pairedName,
        baseColor: baseColor.value,
        accentColor: accentColor.value,
        contrast: contrast.value,
        mode: flippedMode,
        density: density.value,
        fontFamily: fontFamily.value || undefined,
      });
      const paired = await themeRepo.create({
        name: pairedName,
        description: description.value,
        author: "",
        source: "generated",
        mode: flippedMode,
        density: density.value,
        tokens: pairedResult.tokens,
        generation: { ...generationMeta, paired: created.id },
      });
      // Backfill the primary so the Light/Dark toggle can bridge in both
      // directions. update() also re-syncs `themeRegistry`.
      await themeRepo.update(created.id, {
        generation: { ...generationMeta, paired: paired.id },
      });
    }

    if (applyAfterSave.value) {
      await themeStore.setTheme(created.id, workspaceStore.currentWorkspaceId);
    }
    close();
  } catch (e) {
    saveError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

/**
 * Edit mode only — update the existing theme in place via `themeRepo.update`
 * rather than creating a new one. Preserves the theme id, so any workspace
 * binding pointing at it keeps working; just re-points its tokens + generation
 * block + density/mode/font to whatever the form now describes. The paired
 * variant (if present in the original) is left untouched — re-pairing happens
 * via the user re-saving with the paired-variant checkbox.
 */
async function updateExisting(): Promise<void> {
  if (!props.themeToEdit) return;
  saveError.value = null;
  const cleanName = name.value.trim();
  if (!cleanName) {
    saveError.value = "Name is required.";
    return;
  }
  const result = generationResult.value;
  if (!result) {
    saveError.value = "Inputs produced an invalid theme — adjust the base or accent color.";
    return;
  }
  saving.value = true;
  try {
    const generationMeta = {
      schemaVersion: 1 as const,
      baseColor: baseColor.value,
      accentColor: accentColor.value,
      contrast: contrast.value,
      // Preserve the original paired ref if there was one.
      paired: props.themeToEdit.generation?.paired,
    };
    const updated = await themeRepo.update(props.themeToEdit.id, {
      name: cleanName,
      description: description.value,
      mode: mode.value,
      density: density.value,
      tokens: result.tokens,
      generation: generationMeta,
    });
    if (applyAfterSave.value) {
      await themeStore.setTheme(updated.id, workspaceStore.currentWorkspaceId);
    }
    close();
  } catch (e) {
    saveError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

function close(): void {
  emit("update:visible", false);
}

// --- Helpers for segmented controls --------------------------------------
const MODES: ThemeMode[] = ["light", "dark"];
const DENSITIES: ThemeDensity[] = ["compact", "comfortable", "spacious"];

// Font dropdown options — Select expects `{ label, value }`.
const FONT_OPTIONS = CURATED_FONTS.map((f) => ({ label: f.label, value: f.value }));
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    :style="{ width: '72rem', maxWidth: '95vw' }"
    :header="dialogHeader"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-4">
      <!-- Start-from selector ------------------------------------------ -->
      <section class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-faint mr-1 text-[10px] tracking-wider uppercase">Start from</span>
        <Button
          size="sm"
          :variant="startFromMode === 'blank' ? 'primary' : 'secondary'"
          @click="startFromMode = 'blank'"
        >
          Blank
        </Button>
        <Button
          size="sm"
          :variant="startFromMode === 'built-in' ? 'primary' : 'secondary'"
          @click="startFromMode = 'built-in'"
        >
          Built-in
        </Button>
        <Button
          size="sm"
          :variant="startFromMode === 'custom' ? 'primary' : 'secondary'"
          :disabled="customOptions.length === 0"
          @click="startFromMode = 'custom'"
        >
          Custom
        </Button>

        <div v-if="startFromMode === 'built-in'" class="min-w-[14rem]">
          <Select
            v-model="startFromBuiltInId"
            :options="builtInOptions"
            placeholder="Choose a built-in…"
          />
        </div>

        <div v-if="startFromMode === 'custom'" class="min-w-[14rem]">
          <Select
            v-model="startFromCustomId"
            :options="customOptions"
            placeholder="Choose a generated theme…"
          />
        </div>
      </section>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr]">
        <!-- Inputs panel ------------------------------------------------ -->
        <div class="flex flex-col gap-4 text-sm">
          <label class="flex flex-col gap-1">
            <span class="text-foreground font-medium">Name</span>
            <Input v-model="name" placeholder="e.g. Ocean Sunrise" />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-foreground font-medium">Description (optional)</span>
            <Input v-model="description" placeholder="A short note for the picker" />
          </label>

          <!-- Mode segmented -->
          <div class="flex flex-col gap-1">
            <span class="text-foreground font-medium">Mode</span>
            <div class="flex gap-1" role="radiogroup" aria-label="Mode">
              <Button
                v-for="m in MODES"
                :key="m"
                size="sm"
                :variant="mode === m ? 'primary' : 'secondary'"
                :aria-checked="mode === m"
                role="radio"
                @click="mode = m"
              >
                {{ m === "light" ? "Light" : "Dark" }}
              </Button>
            </div>
          </div>

          <!-- Base color -->
          <div class="flex flex-col gap-1">
            <span class="text-foreground font-medium">Base color</span>
            <ColorSwatchPicker
              v-model="baseColor"
              :options="BASE_COLOR_SWATCHES"
              aria-label="Base color"
            />
            <span class="text-faint font-mono text-[10px]">{{ baseColor }}</span>
          </div>

          <!-- Accent color -->
          <div class="flex flex-col gap-1">
            <span class="text-foreground font-medium">Accent color</span>
            <ColorSwatchPicker
              v-model="accentColor"
              :options="ACCENT_COLOR_SWATCHES"
              aria-label="Accent color"
            />
            <span class="text-faint font-mono text-[10px]">{{ accentColor }}</span>
          </div>

          <!-- Contrast slider -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-foreground font-medium">Contrast</span>
              <span class="text-muted text-xs">{{ contrast }}</span>
            </div>
            <Slider v-model="contrast" :min="30" :max="100" :step="1" />
            <span class="text-faint text-[10px]">
              Higher contrast = steeper text/surface ratio (4.5:1 → 12:1)
            </span>
          </div>

          <!-- Density segmented -->
          <div class="flex flex-col gap-1">
            <span class="text-foreground font-medium">Density</span>
            <div class="flex gap-1" role="radiogroup" aria-label="Density">
              <Button
                v-for="d in DENSITIES"
                :key="d"
                size="sm"
                :variant="density === d ? 'primary' : 'secondary'"
                :aria-checked="density === d"
                role="radio"
                @click="density = d"
              >
                {{ d.charAt(0).toUpperCase() + d.slice(1) }}
              </Button>
            </div>
          </div>

          <!-- Font family -->
          <div class="flex flex-col gap-1">
            <span class="text-foreground font-medium">Font family</span>
            <Select v-model="fontFamily" :options="FONT_OPTIONS" />
          </div>

          <!-- Options checkboxes -->
          <div class="border-border-subtle flex flex-col gap-2 border-t pt-3">
            <label class="flex items-center gap-2 text-sm">
              <Checkbox v-model="generatePaired" :binary="true" />
              <span>Generate paired {{ mode === "light" ? "Dark" : "Light" }} variant</span>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <Checkbox v-model="applyAfterSave" :binary="true" />
              <span>Apply after saving</span>
            </label>
          </div>

          <p v-if="saveError" class="text-danger text-xs">{{ saveError }}</p>
        </div>

        <!-- Live preview ---------------------------------------------- -->
        <div class="flex flex-col gap-3">
          <!--
            The preview wrapper carries `data-density` so the cascade in
            `tokens.css` (`[data-density="compact"]` / `…="spacious"`) re-binds
            `--density-*` for descendants — this is why changing the Density
            control affects spacing inside the preview without the generator
            emitting density tokens (it deliberately doesn't, see Phase B).

            `font-family: var(--font-family-body)` on the inner container is
            what makes the Font dropdown actually visible in the preview;
            without it the preview inherits the dialog's Inter and the
            control has no observable effect.
          -->
          <div
            class="border-border-subtle relative overflow-hidden rounded-lg border"
            :style="previewStyle"
            :data-density="density"
            data-theme-preview
          >
            <div
              class="flex flex-col gap-3 p-4"
              :style="{
                backgroundColor: 'var(--color-surface-base)',
                fontFamily: 'var(--font-family-body)',
              }"
            >
              <!-- Menubar -->
              <div
                class="flex items-center gap-4 rounded-md px-3 py-2 text-xs"
                :style="{
                  backgroundColor: 'var(--color-surface-raised)',
                  color: 'var(--color-text-primary)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }"
              >
                <span>File</span>
                <span>Edit</span>
                <span>View</span>
              </div>

              <!-- Panel + rows -->
              <div
                class="overflow-hidden rounded-md"
                :style="{
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border-default)',
                }"
              >
                <div
                  class="px-3 py-1.5 text-[10px] tracking-wider uppercase"
                  :style="{
                    color: 'var(--color-text-secondary)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }"
                >
                  Telemetry
                </div>
                <div
                  v-for="(row, i) in [
                    { name: 'Alpha unit', range: '142 nm', status: 'OK' },
                    { name: 'Bravo unit', range: '88 nm', status: 'OK' },
                    { name: 'Charlie unit', range: '67 nm', status: 'WARN' },
                  ]"
                  :key="i"
                  class="flex items-center justify-between px-3 py-1.5 text-xs"
                  :style="{
                    backgroundColor: i % 2 === 1 ? 'var(--color-surface-sunken)' : 'transparent',
                    color: 'var(--color-text-primary)',
                  }"
                >
                  <span>{{ row.name }}</span>
                  <span :style="{ color: 'var(--color-text-secondary)' }">{{ row.range }}</span>
                  <span :style="{ color: 'var(--color-text-tertiary)' }">{{ row.status }}</span>
                </div>
              </div>

              <!-- Sample buttons (non-interactive — preview only) -->
              <div class="flex flex-wrap items-center gap-2" aria-hidden="true">
                <div
                  class="rounded-md px-3 py-1.5 text-xs"
                  :style="{
                    backgroundColor: 'var(--color-interactive)',
                    color: 'var(--color-on-interactive)',
                  }"
                >
                  Engage
                </div>
                <div
                  class="rounded-md border px-3 py-1.5 text-xs"
                  :style="{
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border-default)',
                  }"
                >
                  Cancel
                </div>
                <div
                  class="rounded-md px-3 py-1.5 text-xs"
                  :style="{
                    backgroundColor: 'var(--color-status-danger)',
                    color: 'var(--color-text-inverse)',
                  }"
                >
                  Abort
                </div>
              </div>

              <!-- Status badges. Status colors use fixed semantic hue
                   families (success ≈ 145°, warning ≈ 75°, danger ≈ 27°,
                   info ≈ 250°) so meaning is preserved regardless of the
                   accent — by design. They do shift L/C with Mode. -->
              <div class="flex flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    v-for="s in [
                      {
                        label: 'SUCCESS',
                        bg: '--color-status-success-subtle',
                        fg: '--color-status-success',
                      },
                      {
                        label: 'WARNING',
                        bg: '--color-status-warning-subtle',
                        fg: '--color-status-warning',
                      },
                      {
                        label: 'DANGER',
                        bg: '--color-status-danger-subtle',
                        fg: '--color-status-danger',
                      },
                      {
                        label: 'INFO',
                        bg: '--color-status-info-subtle',
                        fg: '--color-status-info',
                      },
                    ]"
                    :key="s.label"
                    class="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider"
                    :style="{ backgroundColor: `var(${s.bg})`, color: `var(${s.fg})` }"
                  >
                    {{ s.label }}
                  </span>
                </div>
                <span class="text-[10px] italic" :style="{ color: 'var(--color-text-tertiary)' }">
                  Status hues are fixed semantic families — independent of the accent so meaning is
                  preserved.
                </span>
              </div>

              <!-- Text hierarchy -->
              <div class="flex flex-col gap-0.5 text-xs">
                <span :style="{ color: 'var(--color-text-primary)' }">
                  Primary text — body content reads against the base surface.
                </span>
                <span :style="{ color: 'var(--color-text-secondary)' }">
                  Secondary text — captions, metadata, dimmer hierarchy.
                </span>
                <span :style="{ color: 'var(--color-text-tertiary)' }">
                  Tertiary text — placeholders, the least prominent step.
                </span>
              </div>
            </div>
          </div>

          <!-- Contrast report -->
          <div
            v-if="contrastReport"
            class="border-border-subtle flex flex-col gap-1 rounded-md border px-3 py-2 text-xs"
          >
            <div class="text-faint text-[10px] tracking-wider uppercase">Contrast check</div>
            <div class="grid grid-cols-3 gap-2">
              <div class="flex flex-col">
                <span class="text-muted">text / surface</span>
                <span
                  :class="
                    contrastReport.textOnSurface >= 4.5
                      ? 'text-success font-mono font-semibold'
                      : 'text-danger font-mono font-semibold'
                  "
                >
                  {{ contrastReport.textOnSurface }}:1
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-muted">text / raised</span>
                <span
                  :class="
                    contrastReport.textOnRaised >= 4.5
                      ? 'text-success font-mono font-semibold'
                      : 'text-danger font-mono font-semibold'
                  "
                >
                  {{ contrastReport.textOnRaised }}:1
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-muted">on-interactive</span>
                <span
                  :class="
                    contrastReport.onInteractive >= 4.5
                      ? 'text-success font-mono font-semibold'
                      : 'text-danger font-mono font-semibold'
                  "
                >
                  {{ contrastReport.onInteractive }}:1
                </span>
              </div>
            </div>
            <div
              v-if="contrastReport.failures.length"
              class="border-border-subtle mt-1 border-t pt-1"
            >
              <span class="text-danger font-medium">
                {{ contrastReport.failures.length }} pair(s) below AA target:
              </span>
              <ul class="text-muted ml-3 list-disc text-[11px]">
                <li v-for="f in contrastReport.failures" :key="f.pair">
                  {{ f.pair }} — {{ f.ratio }}:1 (need {{ f.required }}:1)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer ----------------------------------------------------- -->
      <footer class="border-border-subtle flex items-center justify-end gap-2 border-t pt-3">
        <Button variant="secondary" size="sm" :disabled="saving" @click="close">Cancel</Button>
        <Button
          v-if="isEditMode"
          variant="secondary"
          size="sm"
          :disabled="!canSave"
          :title="`Save as a new theme; the original ${props.themeToEdit?.name ?? ''} stays untouched`"
          @click="save"
        >
          {{ saving ? "Saving…" : "Save as new theme" }}
        </Button>
        <Button
          v-if="isEditMode"
          size="sm"
          :disabled="!canSave"
          :title="`Overwrite ${props.themeToEdit?.name ?? 'the current theme'} in place — workspace bindings stay attached`"
          @click="updateExisting"
        >
          {{ saving ? "Saving…" : `Update ${props.themeToEdit?.name ?? "theme"}` }}
        </Button>
        <Button v-else size="sm" :disabled="!canSave" @click="save">
          {{ saving ? "Saving…" : "Save as new theme" }}
        </Button>
      </footer>
    </div>
  </Dialog>
</template>
