<script setup lang="ts">
import type { NotifySeverity, ToastPosition } from "@/components/ui/toastTheme";
import type { PanelApiProps } from "@/composables/usePanelApi";

import { Copy, Pencil, Plus, Trash2 } from "@lucide/vue";
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import ColorPicker from "@/components/ui/ColorPicker.vue";
import ColorSwatchPicker from "@/components/ui/ColorSwatchPicker.vue";
import ContextMenu from "@/components/ui/ContextMenu.vue";
import FileUpload from "@/components/ui/FileUpload.vue";
import IconButton from "@/components/ui/IconButton.vue";
import Input from "@/components/ui/Input.vue";
import Menubar from "@/components/ui/Menubar.vue";
import Select from "@/components/ui/Select.vue";
import Tabs from "@/components/ui/Tabs.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import { useConfirm } from "@/composables/useConfirm";
import { useNotify } from "@/composables/useNotify";
import Checkbox from "@/volt/Checkbox.vue";
import Dialog from "@/volt/Dialog.vue";
import Fieldset from "@/volt/Fieldset.vue";
import InputText from "@/volt/InputText.vue";
import Menu from "@/volt/Menu.vue";
import SecondaryButton from "@/volt/SecondaryButton.vue";
import Slider from "@/volt/Slider.vue";
import Tag from "@/volt/Tag.vue";
import Textarea from "@/volt/Textarea.vue";

/**
 * ShowcasePanel — a live gallery of every UI primitive (Track A — A-Showcase).
 * Doubles as living documentation and a theming smoke test: because it renders
 * the project's ACTUAL `ui/*` + `volt/*` wrappers, a token change (A1a/A1b/A1c)
 * recolors the whole panel in one scroll. Coverage is enforced by
 * `src/components/showcase/registry.ts` + its drift test.
 *
 * Stateless playground — no serialize/restore; just local demo refs.
 */
defineProps<PanelApiProps>();

const notify = useNotify();
const confirm = useConfirm();

const TABS = [
  { id: "display", label: "Display" },
  { id: "inputs", label: "Inputs" },
  { id: "buttons", label: "Buttons" },
  { id: "overlays", label: "Overlays" },
  { id: "notifications", label: "Notifications" },
];
const activeTab = ref("display");

// --- Display ---------------------------------------------------------------
const TAG_SEVERITIES = ["success", "info", "warn", "danger", "secondary", "contrast"] as const;
const innerTab = ref("one");

// --- Inputs ----------------------------------------------------------------
const inputVal = ref("Tracked");
const voltInputVal = ref("");
const textareaVal = ref("");
const selectVal = ref<null | string>("alpha");
const SELECT_OPTIONS = [
  { label: "Alpha unit", value: "alpha" },
  { label: "Bravo unit", value: "bravo" },
  { label: "Charlie unit (disabled)", value: "charlie", disabled: true },
];
const checkVal = ref(true);
const sliderVal = ref(60);
const colorVal = ref("#10c4a2");
const swatchVal = ref("oklch(0.55 0.18 250)");
const SWATCH_OPTIONS = [
  { label: "Teal", value: "oklch(0.55 0.13 195)" },
  { label: "Blue", value: "oklch(0.55 0.18 250)" },
  { label: "Violet", value: "oklch(0.55 0.2 305)" },
  { label: "Amber", value: "oklch(0.65 0.16 75)" },
];

// --- Overlays --------------------------------------------------------------
const dialogOpen = ref(false);
const contextMenu = ref<InstanceType<typeof ContextMenu> | null>(null);
const popupMenu = ref<InstanceType<typeof Menu> | null>(null);

const MENU_MODEL = [
  { label: "Edit", command: () => notify.info("Edit clicked") },
  { label: "Duplicate", command: () => notify.success("Duplicated") },
  { separator: true },
  { label: "Delete", command: () => notify.danger("Deleted") },
];
const MENUBAR_MODEL = [
  {
    label: "File",
    items: [
      { label: "New", command: () => notify.info("File ▸ New") },
      { label: "Open", command: () => notify.info("File ▸ Open") },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", command: () => notify.info("Edit ▸ Undo") },
      { label: "Redo", command: () => notify.info("Edit ▸ Redo") },
    ],
  },
  { label: "View", command: () => notify.info("View clicked") },
];

async function openConfirm(): Promise<void> {
  const ok = await confirm.confirm({
    title: "Delete this item?",
    message: "This action can’t be undone.",
    confirmLabel: "Delete",
    danger: true,
  });
  notify.show({ severity: ok ? "danger" : "info", summary: ok ? "Confirmed delete" : "Cancelled" });
}

// --- Notifications ---------------------------------------------------------
const toastPosition = ref<ToastPosition>("bottom-right");
const POSITION_OPTIONS: { label: string; value: ToastPosition }[] = [
  { label: "top-left", value: "top-left" },
  { label: "top-center", value: "top-center" },
  { label: "top-right", value: "top-right" },
  { label: "center", value: "center" },
  { label: "bottom-left", value: "bottom-left" },
  { label: "bottom-center", value: "bottom-center" },
  { label: "bottom-right", value: "bottom-right" },
];
const SEVERITIES: { label: string; value: NotifySeverity }[] = [
  { label: "Success", value: "success" },
  { label: "Info", value: "info" },
  { label: "Warning", value: "warning" },
  { label: "Danger", value: "danger" },
];

function fireToast(severity: NotifySeverity): void {
  notify.show({
    severity,
    summary: `${severity[0]!.toUpperCase()}${severity.slice(1)} notification`,
    detail: "Fired from the Component Showcase.",
    position: toastPosition.value,
  });
}
</script>

<template>
  <div class="bg-surface text-foreground flex h-full w-full flex-col">
    <header class="border-border flex items-center gap-2 border-b px-4 py-2">
      <span class="text-foreground text-sm font-semibold">Component Showcase</span>
      <span class="text-faint text-xs">— live gallery + theming smoke test</span>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <Tabs v-model="activeTab" :tabs="TABS">
        <template #default="{ active }">
          <!-- ================= DISPLAY ================= -->
          <div v-if="active === 'display'" class="flex flex-col gap-4">
            <Fieldset legend="Tag — severities">
              <div class="flex flex-wrap items-center gap-2">
                <Tag v-for="s in TAG_SEVERITIES" :key="s" :value="s" :severity="s" />
              </div>
            </Fieldset>

            <Fieldset legend="Fieldset — nested example">
              <p class="text-muted text-sm">
                Sections in this panel are themselves Volt
                <code class="text-foreground">Fieldset</code>s.
              </p>
            </Fieldset>

            <Fieldset legend="Tabs — inline">
              <Tabs
                v-model="innerTab"
                :tabs="[
                  { id: 'one', label: 'First' },
                  { id: 'two', label: 'Second' },
                  { id: 'three', label: 'Disabled', disabled: true },
                ]"
              >
                <template #default="{ active: t }">
                  <p class="text-muted text-sm">Active inner tab: {{ t }}</p>
                </template>
              </Tabs>
            </Fieldset>
          </div>

          <!-- ================= INPUTS ================= -->
          <div v-else-if="active === 'inputs'" class="flex flex-col gap-4">
            <Fieldset legend="Input">
              <div class="flex flex-col gap-2 sm:flex-row">
                <Input v-model="inputVal" placeholder="Callsign…" class="sm:w-56" />
                <Input model-value="Disabled" disabled class="sm:w-56" />
              </div>
            </Fieldset>

            <Fieldset legend="InputText (Volt) + Textarea">
              <div class="flex flex-col gap-2">
                <InputText v-model="voltInputVal" placeholder="Volt InputText…" class="w-full" />
                <Textarea v-model="textareaVal" rows="3" placeholder="Notes…" class="w-full" />
              </div>
            </Fieldset>

            <Fieldset legend="Select">
              <Select
                v-model="selectVal"
                :options="SELECT_OPTIONS"
                placeholder="Choose a unit…"
                show-clear
                class="sm:w-64"
              />
            </Fieldset>

            <Fieldset legend="Checkbox + Slider">
              <div class="flex flex-col gap-3">
                <label class="flex items-center gap-2 text-sm">
                  <Checkbox v-model="checkVal" :binary="true" />
                  <span>Enabled ({{ checkVal ? "on" : "off" }})</span>
                </label>
                <div class="flex items-center gap-3">
                  <Slider v-model="sliderVal" :min="0" :max="100" :step="1" class="w-56" />
                  <span class="text-muted w-10 text-sm tabular-nums">{{ sliderVal }}</span>
                </div>
              </div>
            </Fieldset>

            <Fieldset legend="ColorPicker + ColorSwatchPicker">
              <div class="flex flex-wrap items-center gap-6">
                <div class="flex items-center gap-2">
                  <ColorPicker v-model="colorVal" />
                  <span class="text-muted font-mono text-xs">{{ colorVal }}</span>
                </div>
                <ColorSwatchPicker
                  v-model="swatchVal"
                  :options="SWATCH_OPTIONS"
                  aria-label="Accent"
                />
              </div>
            </Fieldset>

            <Fieldset legend="FileUpload">
              <FileUpload
                accept="image/*"
                @select="(e) => notify.info(`Selected ${e.files?.length ?? 0} file(s)`)"
              />
            </Fieldset>
          </div>

          <!-- ================= BUTTONS ================= -->
          <div v-else-if="active === 'buttons'" class="flex flex-col gap-4">
            <Fieldset legend="Button — variants">
              <div class="flex flex-wrap items-center gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="primary" disabled>Disabled</Button>
              </div>
            </Fieldset>

            <Fieldset legend="Button — sizes">
              <div class="flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </Fieldset>

            <Fieldset legend="IconButton">
              <div class="flex flex-wrap items-center gap-2">
                <IconButton label="Add"><Plus :size="16" /></IconButton>
                <IconButton label="Edit"><Pencil :size="16" /></IconButton>
                <IconButton label="Copy" variant="solid"><Copy :size="16" /></IconButton>
                <IconButton label="Delete" disabled><Trash2 :size="16" /></IconButton>
              </div>
            </Fieldset>

            <Fieldset legend="SecondaryButton (Volt)">
              <SecondaryButton label="Secondary action" />
            </Fieldset>
          </div>

          <!-- ================= OVERLAYS ================= -->
          <div v-else-if="active === 'overlays'" class="flex flex-col gap-4">
            <Fieldset legend="Dialog">
              <Button variant="primary" @click="dialogOpen = true">Open dialog</Button>
              <Dialog v-model:visible="dialogOpen" header="Example dialog" modal>
                <p class="text-muted text-sm">
                  A Volt <code class="text-foreground">Dialog</code>, themed via tokens. It floats
                  above the dock with a backdrop.
                </p>
                <template #footer>
                  <Button variant="secondary" @click="dialogOpen = false">Close</Button>
                </template>
              </Dialog>
            </Fieldset>

            <Fieldset legend="ConfirmDialog (useConfirm)">
              <Button variant="danger" @click="openConfirm">Delete with confirm…</Button>
            </Fieldset>

            <Fieldset legend="ContextMenu (right-click)">
              <div
                class="border-border bg-surface-sunken text-muted flex h-20 items-center justify-center rounded-md border border-dashed text-sm select-none"
                @contextmenu.prevent="contextMenu?.show($event)"
              >
                Right-click anywhere in this box
              </div>
              <ContextMenu ref="contextMenu" :model="MENU_MODEL" />
            </Fieldset>

            <Fieldset legend="Menu (popup)">
              <Button variant="secondary" @click="popupMenu?.toggle($event)">Open menu ▾</Button>
              <Menu ref="popupMenu" :model="MENU_MODEL" :popup="true" />
            </Fieldset>

            <Fieldset legend="Menubar">
              <Menubar :model="MENUBAR_MODEL" />
            </Fieldset>

            <Fieldset legend="Tooltip">
              <div class="flex flex-wrap items-center gap-3">
                <Tooltip label="Tooltip on top" placement="top">
                  <Button variant="secondary">Hover (top)</Button>
                </Tooltip>
                <Tooltip label="Tooltip on the right" placement="right">
                  <Button variant="secondary">Hover (right)</Button>
                </Tooltip>
              </div>
            </Fieldset>
          </div>

          <!-- ================= NOTIFICATIONS ================= -->
          <div v-else-if="active === 'notifications'" class="flex flex-col gap-4">
            <Fieldset legend="Fire a toast">
              <div class="flex flex-col gap-3">
                <label class="flex items-center gap-2 text-sm">
                  <span class="text-muted w-16">Position</span>
                  <Select v-model="toastPosition" :options="POSITION_OPTIONS" class="w-48" />
                </label>
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    v-for="s in SEVERITIES"
                    :key="s.value"
                    size="sm"
                    :variant="s.value === 'danger' ? 'danger' : 'secondary'"
                    @click="fireToast(s.value)"
                  >
                    {{ s.label }}
                  </Button>
                  <Button size="sm" variant="ghost" @click="notify.dismissAll()"
                    >Dismiss all</Button
                  >
                </div>
              </div>
            </Fieldset>

            <Fieldset legend="Sticky + coalesce">
              <div class="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  @click="
                    notify.danger({
                      summary: 'Connection lost',
                      detail: 'Reconnecting…',
                      sticky: true,
                      key: 'demo-conn',
                      position: toastPosition,
                    })
                  "
                >
                  Connection lost (sticky)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  @click="
                    notify.success({
                      summary: 'Reconnected',
                      key: 'demo-conn',
                      position: toastPosition,
                    })
                  "
                >
                  Reconnected (replaces)
                </Button>
              </div>
            </Fieldset>
          </div>
        </template>
      </Tabs>
    </div>
  </div>
</template>
