<script setup lang="ts">
import type { Theme } from "@/types/theme";

import { UploadIcon } from "@lucide/vue";
import { fileOpen } from "browser-fs-access";
import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import {
  importThemeFromJson,
  type ImportConflictPolicy,
  type ImportResult,
} from "@/modules/themes/import";
import { PortableThemeSchema } from "@/modules/themes/portableSchema";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";
import { THEME_SCHEMA_VERSION } from "@/types/theme";
import Checkbox from "@/volt/Checkbox.vue";
import Dialog from "@/volt/Dialog.vue";
import Textarea from "@/volt/Textarea.vue";

/**
 * Theme import dialog (Prompt 4 Phase G).
 *
 * Three ways to supply a `PortableTheme` JSON: drag-and-drop a `.json` file,
 * "Browse…" (native picker via `browser-fs-access` — the locked-stack file
 * helper, so no raw `<input type="file">`), or paste into the textarea.
 *
 * Live preview validation mirrors the first three steps of
 * `importThemeFromJson` (JSON.parse → schema-version check → Zod) so the user
 * sees errors / the theme name before committing. The actual persist on
 * "Import" calls `importThemeFromJson` — the single source of truth — which
 * re-runs the same validation plus the repo's invariants and handles the
 * conflict policy + ULID auto-mint. The small duplication of the preview
 * logic is intentional: it keeps validation off the persist path so typing
 * never writes to IndexedDB.
 */

interface Props {
  visible: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  "update:visible": [value: boolean];
  imported: [theme: Theme];
}>();

const themeStore = useThemeStore();
const workspaceStore = useWorkspaceStore();

const jsonText = ref("");
const fileName = ref<string | null>(null);
const dragOver = ref(false);
const importing = ref(false);
const result = ref<ImportResult | null>(null);
const conflictPolicy = ref<ImportConflictPolicy>("rename");
const applyAfterImport = ref(true);

const CONFLICT_OPTIONS: Array<{ value: ImportConflictPolicy; label: string; hint: string }> = [
  {
    value: "rename",
    label: "Import a copy",
    hint: "Keep both — the import is renamed if it clashes",
  },
  {
    value: "replace",
    label: "Replace existing",
    hint: "Overwrite a theme with the same id or name",
  },
  {
    value: "abort",
    label: "Skip on clash",
    hint: "Don't import if a matching theme already exists",
  },
];

/** Reset transient state whenever the dialog is (re)opened. */
watch(
  () => props.visible,
  (visible, was) => {
    if (visible && !was) {
      jsonText.value = "";
      fileName.value = null;
      result.value = null;
      dragOver.value = false;
      conflictPolicy.value = "rename";
    }
  },
);

/**
 * Live preview validation — parse + version + Zod, no persistence. Mirrors
 * `importThemeFromJson` steps 1–3 so the inline error list matches what the
 * real import would report.
 */
const preview = computed<{ ok: boolean; errors: string[]; themeName?: string }>(() => {
  const text = jsonText.value.trim();
  if (!text) return { ok: false, errors: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
  if (typeof raw === "object" && raw !== null && "schemaVersion" in raw) {
    const v = (raw as { schemaVersion: unknown }).schemaVersion;
    if (v !== THEME_SCHEMA_VERSION) {
      return {
        ok: false,
        errors: [
          `Unsupported schema version: ${JSON.stringify(v)}. This app supports version ${THEME_SCHEMA_VERSION}.`,
        ],
      };
    }
  }
  const parsed = PortableThemeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.length > 0 ? i.path.join(".") : "<root>"}: ${i.message}`,
      ),
    };
  }
  return { ok: true, errors: [], themeName: parsed.data.theme.name };
});

const canImport = computed(() => preview.value.ok && !importing.value);

async function browse(): Promise<void> {
  try {
    const blob = await fileOpen({
      extensions: [".json"],
      mimeTypes: ["application/json"],
      description: "CommandVue theme JSON",
    });
    fileName.value = blob.name ?? "theme.json";
    jsonText.value = await blob.text();
    result.value = null;
  } catch {
    // User dismissed the picker — nothing to do.
  }
}

async function readDroppedFile(file: File): Promise<void> {
  fileName.value = file.name;
  jsonText.value = await file.text();
  result.value = null;
}

function onDrop(event: DragEvent): void {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void readDroppedFile(file);
}

async function doImport(): Promise<void> {
  if (!canImport.value) return;
  importing.value = true;
  result.value = null;
  try {
    const r = await importThemeFromJson(jsonText.value, { onConflict: conflictPolicy.value });
    result.value = r;
    if (r.success && r.theme) {
      if (applyAfterImport.value) {
        await themeStore.setTheme(r.theme.id, workspaceStore.currentWorkspaceId);
      }
      emit("imported", r.theme);
      close();
    }
  } finally {
    importing.value = false;
  }
}

function close(): void {
  emit("update:visible", false);
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    :style="{ width: '40rem', maxWidth: '92vw' }"
    header="Import theme"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-4">
      <p class="text-foreground/80 text-sm">
        Import a CommandVue theme JSON — drop a file, browse, or paste it below. Imported themes are
        re-stamped as <span class="font-medium">imported</span> and appear in the Themes picker.
      </p>

      <!-- Drop zone -->
      <div
        :class="[
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors',
          dragOver ? 'border-accent-500 bg-interactive-subtle' : 'border-border-strong',
        ]"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <UploadIcon class="text-muted size-6" />
        <p class="text-muted text-sm">Drag a <code>.commandvue-theme.json</code> file here</p>
        <Button size="sm" variant="secondary" @click="browse">Browse…</Button>
        <p v-if="fileName" class="text-faint text-xs">Loaded: {{ fileName }}</p>
      </div>

      <!-- Paste -->
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-foreground font-medium">…or paste JSON</span>
        <Textarea
          v-model="jsonText"
          rows="6"
          spellcheck="false"
          class="font-mono text-xs"
          placeholder='{ "schemaVersion": 1, "exportedBy": "commandvue", ... }'
        />
      </label>

      <!-- Live validation feedback -->
      <div v-if="preview.errors.length" class="flex flex-col gap-1">
        <span class="text-danger text-xs font-medium">This JSON can't be imported:</span>
        <ul class="text-muted ml-4 list-disc text-[11px]">
          <li v-for="(err, i) in preview.errors" :key="i">{{ err }}</li>
        </ul>
      </div>
      <p v-else-if="preview.ok" class="text-success text-xs">
        Looks good — ready to import “{{ preview.themeName }}”.
      </p>

      <!-- Conflict policy -->
      <div class="flex flex-col gap-1.5">
        <span class="text-foreground text-sm font-medium">If a matching theme already exists</span>
        <div class="flex flex-wrap gap-1" role="radiogroup" aria-label="Conflict policy">
          <Button
            v-for="opt in CONFLICT_OPTIONS"
            :key="opt.value"
            size="sm"
            :variant="conflictPolicy === opt.value ? 'primary' : 'secondary'"
            :title="opt.hint"
            role="radio"
            :aria-checked="conflictPolicy === opt.value"
            @click="conflictPolicy = opt.value"
          >
            {{ opt.label }}
          </Button>
        </div>
        <span class="text-faint text-[11px]">
          {{ CONFLICT_OPTIONS.find((o) => o.value === conflictPolicy)?.hint }}
        </span>
      </div>

      <!-- Import-failure result (success closes the dialog) -->
      <div v-if="result && !result.success" class="flex flex-col gap-1">
        <span class="text-danger text-xs font-medium">Import failed:</span>
        <ul class="text-muted ml-4 list-disc text-[11px]">
          <li v-for="(err, i) in result.errors ?? []" :key="i">{{ err }}</li>
        </ul>
      </div>

      <!-- Footer -->
      <footer class="border-border-subtle flex items-center justify-between gap-3 border-t pt-3">
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="applyAfterImport" :binary="true" />
          <span>Apply after importing</span>
        </label>
        <div class="flex items-center gap-2">
          <Button variant="secondary" size="sm" :disabled="importing" @click="close">Cancel</Button>
          <Button size="sm" :disabled="!canImport" @click="doImport">
            {{ importing ? "Importing…" : "Import" }}
          </Button>
        </div>
      </footer>
    </div>
  </Dialog>
</template>
