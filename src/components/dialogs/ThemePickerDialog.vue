<script setup lang="ts">
import type { Theme, ThemeId, ThemeSource, ThemeSwatches } from "@/types/theme";

import { Check, Download, Pencil, Sparkles, Trash2 } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";

import ThemeCustomizerDialog from "@/components/dialogs/ThemeCustomizerDialog.vue";
import ThemeImportDialog from "@/components/dialogs/ThemeImportDialog.vue";
import Button from "@/components/ui/Button.vue";
import { themeRepo } from "@/modules/storage/themeRepo";
import { downloadThemeFile } from "@/modules/themes/export";
import { themeRegistry } from "@/modules/themes/registry";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";
import Checkbox from "@/volt/Checkbox.vue";
import Dialog from "@/volt/Dialog.vue";

/**
 * Theme picker dialog (Phase 3.3).
 *
 * Renders one card per registered theme — name, description, mode + density
 * badges, four color swatches sampled from the theme's tokens, an "Apply"
 * button, and a "Set as workspace default" checkbox.
 *
 * Why sample swatches from the JSON instead of mounting the theme into an
 * iframe preview? The token files reference primitives via `var()`, so a
 * static parse can't resolve them. Instead, we resolve via the live
 * `getComputedStyle(root)` against a `:root` scope after writing the
 * variables to a hidden helper element... no, even simpler: we resolve the
 * primitive references against an in-memory map. Or — pragmatically — we
 * just show the FOUR token names as labels alongside their final resolved
 * colors fetched from the current document root after a one-time hidden
 * mount. For this PR we use a simpler heuristic: pick the registry-known
 * surface / interactive / success / danger token values and pass them
 * through a getComputedStyle resolver at render time.
 */

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const themes = shallowRef<readonly Theme[]>([]);
const themeStore = useThemeStore();
const workspaceStore = useWorkspaceStore();

const setAsWorkspaceDefault = ref(false);

let unsubscribe: (() => void) | null = null;
onMounted(() => {
  unsubscribe = themeRegistry.subscribe((list) => {
    themes.value = [...list].sort((a, b) => a.name.localeCompare(b.name));
  });
});
onUnmounted(() => {
  unsubscribe?.();
});

const currentId = computed(() => themeStore.currentThemeId);

/**
 * Resolve the four-swatch preview by writing the theme's token references
 * temporarily into a hidden helper element, then reading the computed values.
 * This handles `var(--color-slate-800)` references that wouldn't be readable
 * from the raw JSON string.
 */
function resolveSwatches(theme: Theme): ThemeSwatches {
  const helper = document.createElement("div");
  helper.style.position = "absolute";
  helper.style.visibility = "hidden";
  helper.style.pointerEvents = "none";
  for (const [k, v] of Object.entries(theme.tokens)) {
    helper.style.setProperty(`--${k}`, v);
  }
  document.body.appendChild(helper);
  const cs = getComputedStyle(helper);
  const read = (key: string): string => {
    const raw = cs.getPropertyValue(`--${key}`).trim();
    // Resolve var() chains by reading via a temporary `color` property on
    // the helper — the browser resolves it for us when we set it.
    if (raw.startsWith("var(")) {
      helper.style.color = raw;
      return getComputedStyle(helper).color;
    }
    return raw;
  };
  const swatches: ThemeSwatches = {
    surface: read("color-surface-base") || "#ffffff",
    surfaceRaised: read("color-surface-raised") || "#ffffff",
    text: read("color-text-primary") || "#000000",
    interactive: read("color-interactive") || "#3b82f6",
    success: read("color-status-success") || "#16a34a",
    danger: read("color-status-danger") || "#dc2626",
  };
  helper.remove();
  return swatches;
}

const swatchesById = computed(() => {
  const out: Record<ThemeId, ThemeSwatches> = {};
  for (const t of themes.value) out[t.id] = resolveSwatches(t);
  return out;
});

/**
 * Group themes by source for display. Phase C surfaces three groups today —
 * Built-in (shipped variants), Generated (Phase E customizer output), Imported
 * (Phase G JSON import) — plus a future `Custom` slot reserved for hand-authored
 * `user` themes. Empty groups are hidden so the picker stays compact until
 * the first custom theme exists.
 */
const GROUP_ORDER: Array<{ key: ThemeSource; label: string }> = [
  { key: "built-in", label: "Built-in" },
  { key: "generated", label: "Generated" },
  { key: "imported", label: "Imported" },
  { key: "user", label: "Custom" },
];

const groupedThemes = computed(() => {
  const buckets = new Map<ThemeSource, Theme[]>(GROUP_ORDER.map((g) => [g.key, []]));
  for (const t of themes.value) {
    buckets.get(t.source)?.push(t);
  }
  for (const list of buckets.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return GROUP_ORDER.map(({ key, label }) => ({
    key,
    label,
    themes: buckets.get(key) ?? [],
  })).filter((g) => g.themes.length > 0);
});

function close(): void {
  emit("update:visible", false);
}

async function apply(theme: Theme): Promise<void> {
  if (setAsWorkspaceDefault.value && workspaceStore.currentWorkspaceId) {
    await themeStore.setWorkspaceTheme(
      workspaceStore.currentWorkspaceId,
      theme.id,
      workspaceStore.currentWorkspaceId,
    );
  } else {
    await themeStore.setTheme(theme.id, workspaceStore.currentWorkspaceId);
  }
  close();
}

/**
 * Delete affordance for custom (non-built-in) themes. Built-ins are
 * registered, not stored, so they can't be deleted. We use a two-click
 * confirm (the first click arms the button, the second deletes) rather than
 * a native `confirm()` (blocked in this app) or wiring PrimeVue's
 * ConfirmationService for a single call site. Arming a different card, or
 * clicking elsewhere via `disarmDelete`, resets the pending state.
 *
 * `themeRepo.delete` cleans up workspace bindings (Phase A) and unregisters
 * from `themeRegistry` (Phase C), which the `subscribe` listener above turns
 * into a live card removal.
 */
const pendingDeleteId = ref<ThemeId | null>(null);

function isDeletable(theme: Theme): boolean {
  return theme.source !== "built-in";
}

async function onDeleteClick(theme: Theme): Promise<void> {
  if (pendingDeleteId.value !== theme.id) {
    pendingDeleteId.value = theme.id;
    return;
  }
  // Second click — confirm. If the theme is currently applied, fall back to
  // the global default first so we never sit on a deleted id.
  if (themeStore.currentThemeId === theme.id) {
    await themeStore.setTheme("compact-light", workspaceStore.currentWorkspaceId);
  }
  await themeRepo.delete(theme.id);
  pendingDeleteId.value = null;
}

function disarmDelete(): void {
  pendingDeleteId.value = null;
}

// --- Export / Edit / Import (Prompt 4 Phase G) ----------------------------

/** Download a theme as `<slug>.commandvue-theme.json`. Available for every
 *  theme (built-ins are exportable too — handy as a starting point). */
function exportTheme(theme: Theme): void {
  downloadThemeFile(theme);
}

/** Only generated themes carry the `generation` block the customizer needs to
 *  pre-fill its inputs, so Edit is offered for those only. */
function isEditable(theme: Theme): boolean {
  return theme.source === "generated" && !!theme.generation;
}

const customizerOpen = ref(false);
const themeToEdit = ref<Theme | null>(null);

function editTheme(theme: Theme): void {
  themeToEdit.value = theme;
  customizerOpen.value = true;
}

function onCustomizerVisible(visible: boolean): void {
  customizerOpen.value = visible;
  if (!visible) themeToEdit.value = null;
}

const importOpen = ref(false);
function openImport(): void {
  importOpen.value = true;
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    :style="{ width: '60rem', maxWidth: '90vw' }"
    header="Themes"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <p class="text-foreground/80 text-sm">
          Pick a theme. Each one bundles its own surface palette, accent color, density, and
          component-level tweaks. Apply once for the whole app, or tick the box below to bind the
          choice to the active workspace.
        </p>
        <Button size="sm" variant="secondary" class="shrink-0" @click="openImport">
          <Download class="size-3 rotate-180" />
          Import…
        </Button>
      </div>

      <section v-for="group in groupedThemes" :key="group.key" class="flex flex-col gap-2">
        <h3 class="text-faint text-[10px] font-medium tracking-wider uppercase">
          {{ group.label }}
        </h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="theme in group.themes"
            :key="theme.id"
            :class="[
              'border-border-default flex flex-col gap-3 rounded-md border p-3 text-sm transition-colors',
              currentId === theme.id
                ? 'border-accent-500 ring-accent-500 ring-1'
                : 'hover:border-border-strong',
            ]"
          >
            <header class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-0.5">
                <span class="text-foreground font-medium">{{ theme.name }}</span>
                <span
                  class="text-faint flex items-center gap-1.5 text-[10px] tracking-wider uppercase"
                >
                  {{ theme.mode }} · {{ theme.density }}
                </span>
              </div>
              <Check v-if="currentId === theme.id" class="text-accent-500 size-4 shrink-0" />
            </header>

            <p class="text-muted text-xs leading-snug">{{ theme.description }}</p>

            <!-- Token swatches -->
            <div v-if="swatchesById[theme.id]" class="flex items-center gap-1.5" aria-hidden="true">
              <span
                class="border-border h-5 w-5 rounded border"
                :style="{ backgroundColor: swatchesById[theme.id]?.surface }"
                title="Surface"
              />
              <span
                class="border-border h-5 w-5 rounded border"
                :style="{ backgroundColor: swatchesById[theme.id]?.surfaceRaised }"
                title="Surface raised"
              />
              <span
                class="h-5 w-5 rounded"
                :style="{ backgroundColor: swatchesById[theme.id]?.text }"
                title="Text"
              />
              <span
                class="h-5 w-5 rounded"
                :style="{ backgroundColor: swatchesById[theme.id]?.interactive }"
                title="Interactive"
              />
              <span
                class="h-5 w-5 rounded"
                :style="{ backgroundColor: swatchesById[theme.id]?.success }"
                title="Success"
              />
              <span
                class="h-5 w-5 rounded"
                :style="{ backgroundColor: swatchesById[theme.id]?.danger }"
                title="Danger"
              />
            </div>

            <footer class="mt-auto flex items-center justify-between gap-2 pt-1">
              <span class="text-faint text-[10px]">{{ theme.author }}</span>
              <div class="flex items-center gap-1">
                <!-- Export (all themes — built-ins make handy starting points). -->
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Export theme"
                  title="Export theme as JSON"
                  @click="exportTheme(theme)"
                >
                  <Download class="size-3.5" />
                </Button>
                <!-- Edit (generated themes only — they carry the generation block). -->
                <Button
                  v-if="isEditable(theme)"
                  size="sm"
                  variant="ghost"
                  aria-label="Edit theme"
                  title="Edit theme in the customizer"
                  @click="editTheme(theme)"
                >
                  <Pencil class="size-3.5" />
                </Button>
                <!-- Delete (custom themes only). Two-click confirm: the first
                     click arms, the second deletes. Built-ins are registered,
                     not stored, so they have no delete affordance. -->
                <Button
                  v-if="isDeletable(theme) && pendingDeleteId === theme.id"
                  size="sm"
                  variant="danger"
                  title="Click again to permanently delete this theme"
                  @click="onDeleteClick(theme)"
                  @blur="disarmDelete"
                >
                  <Trash2 class="size-3" />
                  Delete?
                </Button>
                <Button
                  v-else-if="isDeletable(theme)"
                  size="sm"
                  variant="ghost"
                  aria-label="Delete theme"
                  title="Delete theme"
                  @click="onDeleteClick(theme)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  :variant="currentId === theme.id ? 'secondary' : 'primary'"
                  @click="apply(theme)"
                >
                  <Sparkles class="size-3" />
                  {{ currentId === theme.id ? "Re-apply" : "Apply" }}
                </Button>
              </div>
            </footer>
          </article>
        </div>
      </section>

      <div class="border-border-subtle flex items-center justify-between gap-3 border-t pt-3">
        <label class="flex items-center gap-2 text-sm">
          <Checkbox
            v-model="setAsWorkspaceDefault"
            :binary="true"
            :disabled="!workspaceStore.currentWorkspaceId"
          />
          <span :class="workspaceStore.currentWorkspaceId ? 'text-foreground' : 'text-faint'">
            Set as default for this workspace
            <span v-if="workspaceStore.currentWorkspace" class="text-faint">
              ({{ workspaceStore.currentWorkspace.name }})
            </span>
          </span>
        </label>
        <Button variant="ghost" size="sm" @click="close">Close</Button>
      </div>
    </div>
  </Dialog>

  <!-- Import + edit surfaces, mounted as siblings so they layer above the picker. -->
  <ThemeImportDialog v-model:visible="importOpen" />
  <ThemeCustomizerDialog
    :visible="customizerOpen"
    :theme-to-edit="themeToEdit"
    @update:visible="onCustomizerVisible"
  />
</template>
