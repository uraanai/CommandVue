import type {
  GenerationInputV2,
  StatusFamily,
  StatusOverrides,
  Theme,
  ThemeDensity,
  ThemeId,
  ThemeMode,
} from "@/types/theme";

import { computed, ref, watch } from "vue";

import { themeRepo } from "@/modules/storage/themeRepo";
import {
  BLANK_DEFAULTS,
  CURATED_FONTS,
  STATUS_HUE_SWATCHES,
} from "@/modules/themes/curated-swatches";
import { generateTheme } from "@/modules/themes/generate";
import { themeRegistry } from "@/modules/themes/registry";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";

/**
 * Theme-authoring logic, lifted out of `ThemeCustomizerDialog.vue` so the
 * (transitional) dialog and the Theme Studio panel (Track A A2a) share one
 * source of truth instead of forking ~250 lines of generation/validation state.
 *
 * The composable owns the form inputs, the live `generationResult`, the
 * start-from selectors, and the create/update actions. It is presentation-
 * agnostic: `save()` / `updateExisting()` return the persisted {@link Theme}
 * (or `null` on a handled error, with `saveError` set) and never close a UI —
 * the consumer decides what "saved" means (a modal closes; the panel commits
 * its live preview). The Studio panel additionally drives a live preview off
 * `generationResult`; the dialog renders it into a scoped `<div>`.
 */
const STATUS_FAMILIES: readonly StatusFamily[] = ["success", "warning", "danger", "info"];
const MODES: readonly ThemeMode[] = ["light", "dark"];
const DENSITIES: readonly ThemeDensity[] = ["compact", "comfortable", "spacious"];
const FONT_OPTIONS = CURATED_FONTS.map((f) => ({ label: f.label, value: f.value }));

type StartFromMode = "blank" | "built-in" | "custom";

/** Read a theme's generation inputs from the v2 `base.input` (source of truth),
 *  falling back to the deprecated `generation` compat block. `null` for a static
 *  base that was never generated. */
function genInputOf(t: Theme): {
  baseColor: string;
  accentColor: string;
  contrast: number;
  statusOverrides?: StatusOverrides;
  paired?: ThemeId;
} | null {
  if (t.base?.kind === "generated") {
    const i = t.base.input;
    return {
      baseColor: i.baseColor,
      accentColor: i.accentColor,
      contrast: i.contrast,
      statusOverrides: i.statusOverrides,
      paired: t.paired,
    };
  }
  if (t.generation) {
    return {
      baseColor: t.generation.baseColor,
      accentColor: t.generation.accentColor,
      contrast: t.generation.contrast,
      statusOverrides: t.generation.statusOverrides,
      paired: t.paired ?? t.generation.paired,
    };
  }
  return null;
}

export function useThemeAuthoring() {
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

  /** The theme being edited (when seeded from an existing generated theme). */
  const themeToEdit = ref<Theme | null>(null);

  // --- Status hues (A1b) ---------------------------------------------------
  const statusSwatch = ref<Record<StatusFamily, string>>({
    success: STATUS_HUE_SWATCHES.success[0]!.value,
    warning: STATUS_HUE_SWATCHES.warning[0]!.value,
    danger: STATUS_HUE_SWATCHES.danger[0]!.value,
    info: STATUS_HUE_SWATCHES.info[0]!.value,
  });
  const statusOptions = computed<Record<StatusFamily, { label: string; value: string }[]>>(() => ({
    success: STATUS_HUE_SWATCHES.success.map((s) => ({ label: s.label, value: s.value })),
    warning: STATUS_HUE_SWATCHES.warning.map((s) => ({ label: s.label, value: s.value })),
    danger: STATUS_HUE_SWATCHES.danger.map((s) => ({ label: s.label, value: s.value })),
    info: STATUS_HUE_SWATCHES.info.map((s) => ({ label: s.label, value: s.value })),
  }));
  const statusOverrides = computed<StatusOverrides | undefined>(() => {
    const out: StatusOverrides = {};
    for (const fam of STATUS_FAMILIES) {
      const presets = STATUS_HUE_SWATCHES[fam];
      const selected = statusSwatch.value[fam];
      if (selected === presets[0]!.value) continue; // default → no override
      const match = presets.find((s) => s.value === selected);
      if (match) out[fam] = { hue: match.hue };
    }
    return Object.keys(out).length > 0 ? out : undefined;
  });
  function applyStatusOverridesToSwatches(over?: StatusOverrides): void {
    for (const fam of STATUS_FAMILIES) {
      const presets = STATUS_HUE_SWATCHES[fam];
      const hue = over?.[fam]?.hue;
      const match = hue != null ? presets.find((s) => s.hue === hue) : undefined;
      statusSwatch.value[fam] = (match ?? presets[0]!).value;
    }
  }

  // --- Start-from selector -------------------------------------------------
  const startFromMode = ref<StartFromMode>("blank");
  const startFromBuiltInId = ref<ThemeId | null>(null);
  const startFromCustomId = ref<ThemeId | null>(null);
  const builtInOptions = computed(() =>
    themeRegistry.listBuiltIn().map((t) => ({ label: t.name, value: t.id })),
  );
  const customOptions = computed(() =>
    themeRegistry.listGenerated().map((t) => ({ label: t.name, value: t.id })),
  );

  function applyDefaults(): void {
    baseColor.value = BLANK_DEFAULTS.baseColor;
    accentColor.value = BLANK_DEFAULTS.accentColor;
    contrast.value = BLANK_DEFAULTS.contrast;
    fontFamily.value = BLANK_DEFAULTS.fontFamily;
    applyStatusOverridesToSwatches(undefined);
  }

  function loadFromBuiltIn(id: ThemeId): void {
    const t = themeRegistry.get(id);
    if (!t) return;
    mode.value = t.mode;
    density.value = t.density;
    applyDefaults();
    if (!name.value) name.value = `Based on ${t.name}`;
  }

  function loadFromGenerated(id: ThemeId): void {
    const t = themeRegistry.get(id);
    const gen = t ? genInputOf(t) : null;
    if (!t || !gen) return;
    baseColor.value = gen.baseColor;
    accentColor.value = gen.accentColor;
    contrast.value = gen.contrast;
    mode.value = t.mode;
    density.value = t.density;
    applyStatusOverridesToSwatches(gen.statusOverrides);
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

  // --- Generation result (live preview + contrast report) ------------------
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
        statusOverrides: statusOverrides.value,
      });
    } catch {
      return null;
    }
  });
  const contrastReport = computed(() => generationResult.value?.contrastReport ?? null);
  const isEditMode = computed(() => genInputOf(themeToEdit.value ?? ({} as Theme)) !== null);

  // --- Seed / reset --------------------------------------------------------
  /** Pre-fill the form from an existing theme to edit, or reset to blank. */
  function seedFromTheme(t: Theme | null): void {
    saveError.value = null;
    themeToEdit.value = t;
    const gen = t ? genInputOf(t) : null;
    if (t && gen) {
      name.value = t.name;
      description.value = t.description ?? "";
      baseColor.value = gen.baseColor;
      accentColor.value = gen.accentColor;
      contrast.value = gen.contrast;
      mode.value = t.mode;
      density.value = t.density;
      applyStatusOverridesToSwatches(gen.statusOverrides);
      generatePaired.value = !!gen.paired;
      startFromMode.value = "custom";
      startFromCustomId.value = t.id;
    } else {
      reset();
    }
  }

  function reset(): void {
    themeToEdit.value = null;
    saveError.value = null;
    name.value = "";
    description.value = "";
    startFromMode.value = "blank";
    startFromBuiltInId.value = null;
    startFromCustomId.value = null;
    applyDefaults();
  }

  // --- Persist -------------------------------------------------------------
  function buildGenerationInput(forMode: ThemeMode): GenerationInputV2 {
    const input: GenerationInputV2 = {
      schemaVersion: 2,
      baseColor: baseColor.value,
      accentColor: accentColor.value,
      contrast: contrast.value,
      mode: forMode,
      density: density.value,
    };
    if (fontFamily.value) input.fontFamily = fontFamily.value;
    if (statusOverrides.value) input.statusOverrides = statusOverrides.value;
    return input;
  }

  function validate(): boolean {
    saveError.value = null;
    if (!name.value.trim()) {
      saveError.value = "Name is required.";
      return false;
    }
    if (!generationResult.value) {
      saveError.value = "Inputs produced an invalid theme — adjust the base or accent color.";
      return false;
    }
    return true;
  }

  /** Create a new generated theme (+ its paired variant if requested). Returns
   *  the created theme, or `null` on a handled error (`saveError` is set). */
  async function save(): Promise<Theme | null> {
    if (!validate()) return null;
    const cleanName = name.value.trim();
    saving.value = true;
    try {
      const created = await themeRepo.create({
        name: cleanName,
        description: description.value,
        author: "",
        source: "generated",
        mode: mode.value,
        density: density.value,
        base: { kind: "generated", input: buildGenerationInput(mode.value) },
        overrides: {},
      });
      if (generatePaired.value) {
        const flippedMode: ThemeMode = mode.value === "light" ? "dark" : "light";
        const pairedName = `${cleanName} (${flippedMode === "dark" ? "Dark" : "Light"})`;
        const paired = await themeRepo.create({
          name: pairedName,
          description: description.value,
          author: "",
          source: "generated",
          mode: flippedMode,
          density: density.value,
          base: { kind: "generated", input: buildGenerationInput(flippedMode) },
          overrides: {},
          paired: created.id,
        });
        await themeRepo.update(created.id, { paired: paired.id });
      }
      if (applyAfterSave.value) {
        await themeStore.setTheme(created.id, workspaceStore.currentWorkspaceId);
      }
      return created;
    } catch (e) {
      saveError.value = (e as Error).message;
      return null;
    } finally {
      saving.value = false;
    }
  }

  /** Update the seeded theme in place. Returns the updated theme, or `null`. */
  async function updateExisting(): Promise<Theme | null> {
    const editing = themeToEdit.value;
    if (!editing) return null;
    if (!validate()) return null;
    saving.value = true;
    try {
      const existingPaired = editing.paired ?? editing.generation?.paired;
      const updated = await themeRepo.update(editing.id, {
        name: name.value.trim(),
        description: description.value,
        mode: mode.value,
        density: density.value,
        base: { kind: "generated", input: buildGenerationInput(mode.value) },
        ...(existingPaired !== undefined ? { paired: existingPaired } : {}),
      });
      if (applyAfterSave.value) {
        await themeStore.setTheme(updated.id, workspaceStore.currentWorkspaceId);
      }
      return updated;
    } catch (e) {
      saveError.value = (e as Error).message;
      return null;
    } finally {
      saving.value = false;
    }
  }

  return {
    // inputs
    name,
    description,
    mode,
    baseColor,
    accentColor,
    contrast,
    density,
    fontFamily,
    generatePaired,
    applyAfterSave,
    // status
    STATUS_FAMILIES,
    statusSwatch,
    statusOptions,
    statusOverrides,
    // start-from
    startFromMode,
    startFromBuiltInId,
    startFromCustomId,
    builtInOptions,
    customOptions,
    // derived
    generationResult,
    contrastReport,
    isEditMode,
    themeToEdit,
    saveError,
    saving,
    // static option lists
    MODES,
    DENSITIES,
    FONT_OPTIONS,
    // actions
    seedFromTheme,
    reset,
    save,
    updateExisting,
    buildGenerationInput,
  };
}
