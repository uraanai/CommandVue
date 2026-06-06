<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";

import { LayoutPanelTop, Sparkles } from "@lucide/vue";
import { useDebounceFn, useElementSize } from "@vueuse/core";
// PrimeVue's Splitter identifies its panes by child component TYPE, so SplitterPanel
// can't be wrapped in a Volt component (a wrapper breaks pane detection → empty
// splitter). It's a structural sub-component, like the styled Volt Splitter's
// counterpart; the parent <Splitter> supplies the visuals.
import SplitterPanel from "primevue/splitterpanel"; // eslint-disable-line @typescript-eslint/no-restricted-imports
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import StudioTabPlaceholder from "@/components/panels/theme-studio/StudioTabPlaceholder.vue";
import { STUDIO_L1_TABS } from "@/components/panels/theme-studio/studioTabs";
import TokensTabEditor from "@/components/panels/theme-studio/TokensTabEditor.vue";
import TypographyTab from "@/components/panels/theme-studio/TypographyTab.vue";
import Button from "@/components/ui/Button.vue";
import ColorSwatchPicker from "@/components/ui/ColorSwatchPicker.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Tabs from "@/components/ui/Tabs.vue";
import { ensureFontSpecLoaded } from "@/composables/useFontLoader";
import { usePanelApi } from "@/composables/usePanelApi";
import { useThemeAuthoring } from "@/composables/useThemeAuthoring";
import { APP_ROOT } from "@/modules/themes/appRoot";
import { ACCENT_COLOR_SWATCHES, BASE_COLOR_SWATCHES } from "@/modules/themes/curated-swatches";
import { themeRegistry } from "@/modules/themes/registry";
import { TOKEN_MANIFEST_LIST } from "@/modules/themes/tokenManifest";
import { useThemeStore } from "@/stores/theme";
import Checkbox from "@/volt/Checkbox.vue";
import Slider from "@/volt/Slider.vue";
import Splitter from "@/volt/Splitter.vue";

/**
 * Theme Studio panel (Track A A2a) — the floatable authoring surface (dock it,
 * float it, or pop it out to a second monitor) that replaces the modal
 * customizer.
 *
 * Layout: a pinned header + a COMMON band (Start-from / Name / Description that
 * apply to the whole theme), then a draggable `Splitter` between the detailed
 * controls and an in-panel preview pane, then the action footer. The split is
 * user-resizable (drag the gutter). Detailed controls will move into tabs in a
 * later phase; the common band + preview stay outside the tabs.
 *
 * Two complementary previews:
 *  - The in-panel **preview pane** renders a scoped sample of the theme — always
 *    on, immediate visual feedback even before the app recolors.
 *  - **Live across app** (toggle, default on) additionally writes the generated
 *    tokens to the captured top-window root via `themeStore.previewThemeTokens`,
 *    so the main window + every float + every pop-out recolor at once (works even
 *    from a popped-out Studio). Turn it off to keep the rest of the app stable.
 *
 * Idle by default: a blank panel doesn't push a preview on mount. Save persists +
 * applies; Discard / unmount cancels the app preview.
 */
const props = defineProps<PanelApiProps>();
usePanelApi(props);

const themeStore = useThemeStore();
const a = useThemeAuthoring();

const activeTab = ref<string>("generate");

// Responsive Splitter: stack controls above preview when the panel is too narrow
// for a usable side-by-side split. Observed on the panel root (per-window — a
// narrow pop-out stacks, a wide one splits).
const panelRoot = ref<HTMLElement | null>(null);
const { width: panelWidth } = useElementSize(panelRoot);
const STACK_BELOW_PX = 560; // below this total width → vertical stack
const splitterLayout = computed<"horizontal" | "vertical">(() =>
  panelWidth.value > 0 && panelWidth.value < STACK_BELOW_PX ? "vertical" : "horizontal",
);

// Preview = generated tokens with per-token overrides layered on top (override
// wins). The C6 Tokens tab is a placeholder, so `overrides` is empty today; the
// merge is the seam C1 builds on.
const previewStyle = computed<Record<string, string>>(() => ({
  ...(a.generationResult.value?.tokens ?? {}),
  ...a.overrides.value,
}));

const liveAcrossApp = ref(true);
let interacted = false;
let disposed = false;

// The SINGLE live-apply writer (integration §4): both the generator path and the
// per-token override path push through one merged `previewThemeTokens`. Debounced
// so a burst of edits coalesces into one apply. `disposed` blocks a trailing
// debounce from re-applying after unmount/discard.
const pushPreview = useDebounceFn(() => {
  if (disposed) return;
  const tokens = { ...(a.generationResult.value?.tokens ?? {}), ...a.overrides.value };
  if (Object.keys(tokens).length > 0 && liveAcrossApp.value) {
    themeStore.previewThemeTokens(tokens, a.density.value, a.mode.value);
  }
}, 120);

function applyToApp(): void {
  pushPreview();
}

onMounted(() => {
  const id = props.params?.params?.themeToEditId as string | undefined;
  const theme = id ? (themeRegistry.get(id) ?? null) : null;
  a.seedFromTheme(theme);
  if (theme) {
    interacted = true;
    applyToApp();
  }
  snapshotResolved();
});

watch(a.generationResult, () => {
  interacted = true;
  applyToApp();
});

// C3 — kick the Google-font load in flight before the regenerated --font-family-*
// token flips (display: swap covers the gap). The token push is the existing
// generationResult watch above; this is an additive side-effect keyed on fontSpec.
watch(
  () => a.fontSpec.value,
  (spec) => {
    if (spec) void ensureFontSpecLoaded(spec);
  },
);

// Per-token override edits (C1) re-push through the same merged writer.
watch(
  a.overrides,
  () => {
    interacted = true;
    pushPreview();
  },
  { deep: false },
);

// --- Tokens tab (C1) — read-only resolved-values snapshot ------------------
// Seeds the per-token color controls + WCAG chips from the COMPUTED values on
// APP_ROOT (the generator emits only ~73 of the 138 tokens; the rest resolve
// through var()/color-mix() chains the sparse map omits). This is NOT an apply
// writer — the painting is C6's `watch(a.overrides, pushPreview)`. We only
// re-read after that push settles, and when the user opens the Tokens tab.
const resolvedTokens = ref<Record<string, string>>({});
function snapshotResolved(): void {
  const cs = getComputedStyle(APP_ROOT);
  const out: Record<string, string> = {};
  for (const e of TOKEN_MANIFEST_LIST) out[e.name] = cs.getPropertyValue(e.name).trim();
  resolvedTokens.value = out;
}
watch(a.overrides, () => queueMicrotask(snapshotResolved), { deep: false });
watch(activeTab, (t) => {
  if (t === "tokens") snapshotResolved();
});

// Forward-only handlers: mutate the C6-owned override seam; C6's watcher applies.
function onTokenSet(token: string, value: string): void {
  a.setOverride(token, value);
}
function onTokenReset(token: string): void {
  a.clearOverride(token);
}
function onTokenResetAll(): void {
  a.clearAllOverrides();
}

watch(liveAcrossApp, (on) => {
  if (on) {
    if (interacted) applyToApp();
  } else {
    themeStore.cancelPreview();
  }
});

onUnmounted(() => {
  disposed = true;
  themeStore.cancelPreview();
});

async function onSave(): Promise<void> {
  const saved = a.isEditMode.value ? await a.updateExisting() : await a.save();
  if (saved) {
    themeStore.endPreview();
    interacted = false;
  }
}

function onDiscard(): void {
  themeStore.cancelPreview();
  interacted = false;
  a.reset();
}
</script>

<template>
  <div
    ref="panelRoot"
    class="bg-surface text-foreground flex h-full w-full flex-col overflow-hidden"
  >
    <!-- Header -->
    <header class="border-border flex items-center justify-between border-b px-3 py-2">
      <h2 class="text-foreground text-sm font-semibold">
        {{ a.isEditMode.value ? `Edit ${a.themeToEdit.value?.name ?? "theme"}` : "Theme Studio" }}
      </h2>
      <label class="text-muted flex items-center gap-1.5 text-xs">
        <Checkbox v-model="liveAcrossApp" :binary="true" />
        <span>Live across app</span>
      </label>
    </header>

    <!-- Common band — applies to the whole theme; stays outside the (future)
         tabs and above the preview. -->
    <section class="border-border flex flex-col gap-3 border-b px-3 py-3 text-sm">
      <div class="flex flex-wrap items-center gap-2">
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
        <div v-if="a.startFromMode.value === 'built-in'" class="min-w-[14rem] flex-1">
          <Select
            v-model="a.startFromBuiltInId.value"
            :options="a.builtInOptions.value"
            placeholder="Choose a built-in…"
          />
        </div>
        <div v-if="a.startFromMode.value === 'custom'" class="min-w-[14rem] flex-1">
          <Select
            v-model="a.startFromCustomId.value"
            :options="a.customOptions.value"
            placeholder="Choose a generated theme…"
          />
        </div>
        <span v-if="a.startFromMode.value === 'built-in'" class="text-faint w-full text-[10px]">
          Built-ins seed mode + density; pick colors below.
        </span>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-foreground font-medium">Name</span>
          <Input v-model="a.name.value" placeholder="e.g. Ocean Sunrise" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-foreground font-medium">Description (optional)</span>
          <Input v-model="a.description.value" placeholder="A short note for the picker" />
        </label>
      </div>
    </section>

    <!-- Resizable controls | preview. Drag the gutter to rebalance. -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <Splitter
        :key="splitterLayout"
        :layout="splitterLayout"
        class="!h-full !rounded-none !border-0"
      >
        <SplitterPanel :size="44" :min-size="22">
          <!-- §3E option (3): the editor chrome is pinned to a fixed `comfortable`
               density so its controls never re-space with the AUTHORED density.
               Only the preview pane (the other SplitterPanel) reflects a.density.value. -->
          <div data-density="comfortable" class="flex min-h-0 w-full flex-col overflow-hidden">
            <Tabs
              v-model="activeTab"
              :tabs="STUDIO_L1_TABS"
              scrollable
              panels-class="flex min-h-0 flex-1 flex-col"
              class="flex min-h-0 flex-1 flex-col"
            >
              <template #default="{ active }">
                <!-- GENERATE — today's controls, bindings unchanged. Structural only:
                     was `p-3`, now `px-3 pt-1 pb-3` + `flex-1` so the body scrolls
                     inside the bounded tab panel. -->
                <div
                  v-if="active === 'generate'"
                  class="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto px-3 pt-1 pb-3 text-sm"
                >
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
                    <div
                      v-for="fam in a.STATUS_FAMILIES"
                      :key="fam"
                      class="flex items-center gap-2"
                    >
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

                  <div class="border-border-subtle flex flex-col gap-2 border-t pt-3">
                    <label class="flex items-center gap-2">
                      <Checkbox v-model="a.generatePaired.value" :binary="true" />
                      <span>
                        Generate paired {{ a.mode.value === "light" ? "Dark" : "Light" }} variant
                      </span>
                    </label>
                    <label class="flex items-center gap-2">
                      <Checkbox v-model="a.applyAfterSave.value" :binary="true" />
                      <span>Apply after saving</span>
                    </label>
                  </div>

                  <p v-if="a.saveError.value" class="text-danger text-xs">
                    {{ a.saveError.value }}
                  </p>
                </div>
                <TokensTabEditor
                  v-else-if="active === 'tokens'"
                  :resolved="resolvedTokens"
                  :overrides="a.overrides.value"
                  @set="onTokenSet"
                  @reset="onTokenReset"
                  @reset-all="onTokenResetAll"
                />
                <TypographyTab v-else-if="active === 'typography'" :authoring="a" />
                <StudioTabPlaceholder
                  v-else-if="active === 'panels'"
                  :icon="LayoutPanelTop"
                  title="Panels & Chrome"
                  phase="C4"
                  note="Dockview chrome tokens and per-panel appearance variants."
                />
                <StudioTabPlaceholder
                  v-else-if="active === 'effects'"
                  :icon="Sparkles"
                  title="Effects"
                  phase="C5"
                  note="Elevation, glow, and blur."
                />
              </template>
            </Tabs>
          </div>
        </SplitterPanel>

        <SplitterPanel :size="56">
          <div class="bg-surface-sunken flex min-h-0 w-full flex-col gap-3 overflow-y-auto p-3">
            <span class="text-faint text-[10px] tracking-wider uppercase">Live preview</span>
            <div
              data-testid="studio-preview"
              class="border-border-subtle overflow-hidden rounded-lg border"
              :style="previewStyle"
              :data-density="a.density.value"
            >
              <div
                class="flex flex-col gap-3 p-3"
                :style="{
                  backgroundColor: 'var(--color-surface-base)',
                  fontFamily: 'var(--font-family-body)',
                }"
              >
                <div
                  class="flex items-center gap-4 rounded-md px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-xs"
                  :style="{
                    backgroundColor: 'var(--color-surface-raised)',
                    color: 'var(--color-text-primary)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }"
                >
                  <span>File</span><span>Edit</span><span>View</span>
                </div>

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
                      { name: 'Alpha unit', range: '142 nm' },
                      { name: 'Bravo unit', range: '88 nm' },
                      { name: 'Charlie unit', range: '67 nm' },
                    ]"
                    :key="i"
                    class="flex items-center justify-between px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-xs"
                    :style="{
                      backgroundColor: i % 2 === 1 ? 'var(--color-surface-sunken)' : 'transparent',
                      color: 'var(--color-text-primary)',
                    }"
                  >
                    <span>{{ row.name }}</span>
                    <span :style="{ color: 'var(--color-text-secondary)' }">{{ row.range }}</span>
                  </div>
                </div>

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
                      color: 'var(--color-text-primary)',
                      borderColor: 'var(--color-border-default)',
                    }"
                  >
                    Cancel
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span
                    v-for="s in [
                      {
                        label: 'SUCCESS',
                        fg: '--color-status-success',
                        bg: '--color-status-success-subtle',
                      },
                      {
                        label: 'WARNING',
                        fg: '--color-status-warning',
                        bg: '--color-status-warning-subtle',
                      },
                      {
                        label: 'DANGER',
                        fg: '--color-status-danger',
                        bg: '--color-status-danger-subtle',
                      },
                      {
                        label: 'INFO',
                        fg: '--color-status-info',
                        bg: '--color-status-info-subtle',
                      },
                    ]"
                    :key="s.label"
                    class="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider"
                    :style="{ backgroundColor: `var(${s.bg})`, color: `var(${s.fg})` }"
                  >
                    {{ s.label }}
                  </span>
                </div>

                <div class="flex flex-col gap-0.5 text-xs">
                  <span :style="{ color: 'var(--color-text-primary)' }"
                    >Primary text — body content.</span
                  >
                  <span :style="{ color: 'var(--color-text-secondary)' }"
                    >Secondary — captions, metadata.</span
                  >
                  <span :style="{ color: 'var(--color-text-tertiary)' }"
                    >Tertiary — the dimmest step.</span
                  >
                </div>
              </div>
            </div>

            <p
              v-if="a.contrastReport.value"
              class="border-border-subtle text-muted rounded-md border px-3 py-2 text-[11px]"
            >
              Text/surface {{ a.contrastReport.value.textOnSurface.toFixed(1) }}:1 · on-interactive
              {{ a.contrastReport.value.onInteractive.toFixed(1) }}:1 ·
              {{ a.contrastReport.value.failures.length === 0 ? "AA clear" : "review needed" }}
            </p>
          </div>
        </SplitterPanel>
      </Splitter>
    </div>

    <!-- Footer -->
    <footer class="border-border flex items-center justify-end gap-2 border-t px-3 py-2">
      <Button size="sm" variant="secondary" @click="onDiscard">Discard</Button>
      <Button size="sm" variant="primary" :disabled="a.saving.value" @click="onSave">
        {{ a.isEditMode.value ? "Update theme" : "Save theme" }}
      </Button>
    </footer>
  </div>
</template>
