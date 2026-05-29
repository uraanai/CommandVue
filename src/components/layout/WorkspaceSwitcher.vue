<script setup lang="ts">
import type { Ulid } from "@/types/workspace";
import type { MenuItem } from "primevue/menuitem";

import { Check, ChevronDown, FolderCog, Plus } from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";

import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import UnsavedChangesDialog, {
  type UnsavedChoice,
} from "@/components/dialogs/UnsavedChangesDialog.vue";
import Button from "@/components/ui/Button.vue";
import { themeRegistry } from "@/modules/themes/registry";
import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";
import Menu from "@/volt/Menu.vue";

const workspace = useWorkspaceStore();
const layoutStore = useLayoutStore();
const session = useSessionStore();
const themeStore = useThemeStore();

const menuRef = ref<InstanceType<typeof Menu> | null>(null);
const manageOpen = ref(false);
const unsavedOpen = ref(false);
const saveAsOpen = ref(false);
const pendingWorkspaceId = ref<null | Ulid>(null);

/**
 * The *effective* theme id each workspace displays — explicit binding if it
 * has one, otherwise the global default. `undefined` = not yet resolved.
 * Never holds the `null` "no-binding" sentinel: an unbound workspace stores
 * the global-default id it resolves to, so its dot is stable and correct
 * regardless of which workspace is currently active.
 */
const workspaceThemeIds = ref<Record<string, string | undefined>>({});

async function hydrateBindings(): Promise<void> {
  const next: Record<string, string> = {};
  for (const ws of workspace.workspaces) {
    // Always fully resolve (explicit binding → global pointer → fallback).
    // We deliberately do NOT short-circuit on `getWorkspaceBinding`: that
    // cache returns a `null` sentinel for "no explicit binding", which used
    // to leak into the dot map and make `dotColor` fall back to the active
    // theme — so every unbound workspace's dot wrongly mirrored whichever
    // workspace was currently active. Resolving fully gives each dot a
    // stable color decoupled from the active workspace.
    next[ws.id] = await themeStore.resolveForWorkspace(ws.id);
  }
  workspaceThemeIds.value = next;
}

onMounted(() => void hydrateBindings());
watch(
  () => workspace.workspaces.length,
  () => void hydrateBindings(),
);
watch(
  () => themeStore.currentThemeId,
  () => void hydrateBindings(),
);

/**
 * Pre-baked accent color per built-in theme id. Built-ins reference primitive
 * scales via `var(--color-blue-600)` etc. in their token JSON, so the raw
 * value isn't directly usable as `background-color` — the static map gives us
 * a known-good OKLCH instead. Generated / imported themes are handled via
 * the live token lookup below.
 */
const THEME_DOT_COLORS: Record<string, string> = {
  "compact-light": "oklch(54.6% 0.245 262.881)", // blue-600
  "compact-dark": "oklch(70.7% 0.165 254.624)", // blue-400
  "command-center-light": "oklch(51.1% 0.096 186.391)", // teal-700
  "command-center-dark": "oklch(85.5% 0.138 181.071)", // teal-300
  "admin-panel-light": "oklch(54.1% 0.281 293.009)", // violet-600
  "admin-panel-dark": "oklch(70.2% 0.183 293.541)", // violet-400
};

/**
 * Resolve a usable color for the theme indicator dot. Precedence:
 *
 *   1. **Built-in static map** — bundled themes use primitive `var()` references
 *      in their tokens that the browser can't resolve outside the active
 *      cascade; the static OKLCH map is the only reliable source.
 *   2. **`generation.accentColor`** — generated themes (Phase E customizer)
 *      carry a literal OKLCH accent string usable directly as a CSS color.
 *   3. **`--color-interactive` token** — imported themes carry the resolved
 *      interactive color as a literal value in their tokens; use it when
 *      it's not a `var()` reference.
 *   4. **Fallback** — neutral grey.
 */
function dotColor(workspaceId: string): string {
  // Read purely from the resolved map — NEVER fall back to
  // `themeStore.currentThemeId`. The current theme reflects the *active*
  // workspace, so using it here would paint every not-yet-resolved or
  // unbound workspace with the active workspace's color (the Phase F bug).
  const themeId = workspaceThemeIds.value[workspaceId];
  if (!themeId) return "var(--color-slate-400)";
  // 1. Built-in fast path.
  const builtIn = THEME_DOT_COLORS[themeId];
  if (builtIn) return builtIn;
  const theme = themeRegistry.get(themeId);
  if (!theme) return "var(--color-slate-400)";
  // 2. Generated themes carry the accent literally on the generation block.
  if (theme.generation?.accentColor) return theme.generation.accentColor;
  // 3. Imported themes carry --color-interactive as a literal token value.
  const interactive = theme.tokens["--color-interactive"];
  if (interactive && !interactive.startsWith("var(")) return interactive;
  return "var(--color-slate-400)";
}

function themeTooltip(workspaceId: string): string {
  // Same rule as dotColor: read the resolved map only, no currentThemeId
  // fallback, so the tooltip names the theme this workspace actually uses.
  const themeId = workspaceThemeIds.value[workspaceId];
  if (!themeId) return "Theme: (none)";
  const theme = themeRegistry.get(themeId);
  return theme ? `Theme: ${theme.name}` : `Theme: ${themeId}`;
}

const menuItems = computed<MenuItem[]>(() => [
  {
    label: "Workspaces",
    items: workspace.workspaces.map((ws): MenuItem & { wsId: Ulid } => ({
      label: ws.name,
      command: () => void pickWorkspace(ws.id),
      class: ws.id === workspace.currentWorkspaceId ? "is-current" : undefined,
      // Stash workspace id so the #item slot can map back to dot color.
      wsId: ws.id,
    })),
  },
  { separator: true },
  {
    label: "Manage workspaces…",
    command: () => (manageOpen.value = true),
  },
  {
    label: "New workspace…",
    command: () => (manageOpen.value = true),
  },
]);

function toggle(event: MouseEvent): void {
  menuRef.value?.toggle(event);
}

async function pickWorkspace(id: Ulid): Promise<void> {
  if (id === workspace.currentWorkspaceId) return;

  if (session.dirty) {
    pendingWorkspaceId.value = id;
    unsavedOpen.value = true;
    return;
  }
  await session.switchWorkspace(id);
}

async function resolveUnsaved(choice: UnsavedChoice): Promise<void> {
  const target = pendingWorkspaceId.value;
  pendingWorkspaceId.value = null;
  if (choice === "cancel" || !target) return;
  if (choice === "save") {
    await session.updateCurrentLayout();
    await session.switchWorkspace(target);
    return;
  }
  if (choice === "discard") {
    await session.discardChanges();
    await session.switchWorkspace(target);
    return;
  }
  if (choice === "save-as") {
    pendingWorkspaceId.value = target;
    saveAsOpen.value = true;
  }
}

async function onSaveAs(payload: {
  name: string;
  description?: string;
  setAsWorkspaceDefault: boolean;
}): Promise<void> {
  await session.saveCurrentAsNewLayout(payload);
  const target = pendingWorkspaceId.value;
  pendingWorkspaceId.value = null;
  if (target) await session.switchWorkspace(target);
}
</script>

<template>
  <div class="relative">
    <Button
      variant="ghost"
      size="sm"
      aria-haspopup="true"
      aria-controls="workspace-switcher-menu"
      @click="toggle"
    >
      <span class="text-foreground font-medium">
        {{ workspace.currentWorkspace?.name ?? "—" }}
      </span>
      <ChevronDown class="text-muted size-3.5" />
    </Button>

    <Menu id="workspace-switcher-menu" ref="menuRef" :model="menuItems" popup>
      <template #item="{ item, props: itemProps }">
        <!--
          Volt Menu's `itemLink` PT already applies `px-3 py-1.5` padding and
          hover background. The inner span here only owns the flex layout for
          icon + label + check — no padding, no hover bg, no rounded. Adding
          any of those produces a visible nested "frame" on top of Volt's
          hover state.
        -->
        <a
          v-bind="itemProps.action"
          class="flex w-full items-center gap-2 text-[length:var(--density-font-size)]"
        >
          <FolderCog v-if="(item as MenuItem).label === 'Manage workspaces…'" class="size-3.5" />
          <Plus v-else-if="(item as MenuItem).label === 'New workspace…'" class="size-3.5" />
          <span
            v-else-if="(item as MenuItem & { wsId?: string }).wsId"
            :title="themeTooltip((item as MenuItem & { wsId: string }).wsId)"
            class="border-border h-2 w-2 shrink-0 rounded-full border"
            :style="{ backgroundColor: dotColor((item as MenuItem & { wsId: string }).wsId) }"
            aria-hidden="true"
          />
          <span class="flex-1">{{ item.label }}</span>
          <Check
            v-if="(item as MenuItem & { class?: string }).class === 'is-current'"
            class="text-accent-500 size-3.5"
          />
        </a>
      </template>
    </Menu>

    <ManageWorkspacesDialog v-model:visible="manageOpen" />
    <UnsavedChangesDialog
      v-model:visible="unsavedOpen"
      message="The current layout has unsaved changes. What should we do before switching workspaces?"
      @choose="resolveUnsaved"
    />
    <SaveLayoutAsDialog
      v-model:visible="saveAsOpen"
      :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
      @save="onSaveAs"
    />
  </div>
</template>
