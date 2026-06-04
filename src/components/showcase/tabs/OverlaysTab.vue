<script setup lang="ts">
import { Menu as MenuIcon, MoreHorizontal, Trash2 } from "@lucide/vue";
import { useConfirm } from "primevue/useconfirm";
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import ContextMenu from "@/components/ui/ContextMenu.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import ConfirmDialog from "@/volt/ConfirmDialog.vue";
import ConfirmPopup from "@/volt/ConfirmPopup.vue";
import Dialog from "@/volt/Dialog.vue";
import Drawer from "@/volt/Drawer.vue";
import Fieldset from "@/volt/Fieldset.vue";
import Menu from "@/volt/Menu.vue";
import Popover from "@/volt/Popover.vue";

/**
 * OverlaysTab — Overlays section of the Component Showcase.
 *
 * Demonstrates the project's floating-surface primitives: modal Dialog,
 * service-driven ConfirmDialog / ConfirmPopup, edge Drawers, anchored Popover,
 * hover Tooltips, right-click ContextMenu, and a popup Menu.
 *
 * ConfirmationService is registered globally in main.ts; the <ConfirmDialog />
 * and <ConfirmPopup /> outlets are mounted once below so confirm.require() has
 * somewhere to render.
 */

const confirm = useConfirm();

// --- Dialog ----------------------------------------------------------------
const dialogOpen = ref<boolean>(false);

// --- ConfirmDialog ---------------------------------------------------------
const confirmDialogResult = ref<string>("—");

function openConfirmDialog(): void {
  confirm.require({
    header: "Delete this item?",
    message: "This action can't be undone.",
    icon: "pi pi-exclamation-triangle",
    acceptProps: { label: "Delete" },
    rejectProps: { label: "Cancel" },
    accept: () => {
      confirmDialogResult.value = "Confirmed — item deleted";
    },
    reject: () => {
      confirmDialogResult.value = "Cancelled";
    },
  });
}

// --- ConfirmPopup ----------------------------------------------------------
const confirmPopupResult = ref<string>("—");

function openConfirmPopup(event: MouseEvent): void {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    message: "Save changes before closing?",
    icon: "pi pi-exclamation-triangle",
    acceptProps: { label: "Save" },
    rejectProps: { label: "Discard" },
    accept: () => {
      confirmPopupResult.value = "Saved";
    },
    reject: () => {
      confirmPopupResult.value = "Discarded";
    },
  });
}

// --- Drawer ----------------------------------------------------------------
const leftDrawerOpen = ref<boolean>(false);
const rightDrawerOpen = ref<boolean>(false);

// --- Popover ---------------------------------------------------------------
const popover = ref<InstanceType<typeof Popover> | null>(null);

function togglePopover(event: MouseEvent): void {
  popover.value?.toggle(event);
}

// --- ContextMenu -----------------------------------------------------------
const contextMenu = ref<InstanceType<typeof ContextMenu> | null>(null);
const contextResult = ref<string>("—");

const CONTEXT_MODEL = [
  {
    label: "Rename",
    command: () => {
      contextResult.value = "Rename";
    },
  },
  {
    label: "Duplicate",
    command: () => {
      contextResult.value = "Duplicate";
    },
  },
  { separator: true },
  {
    label: "Delete",
    command: () => {
      contextResult.value = "Delete";
    },
  },
];

function showContextMenu(event: MouseEvent): void {
  contextMenu.value?.show(event);
}

// --- Menu (popup) ----------------------------------------------------------
const popupMenu = ref<InstanceType<typeof Menu> | null>(null);
const menuResult = ref<string>("—");

const MENU_MODEL = [
  {
    label: "Settings",
    command: () => {
      menuResult.value = "Settings";
    },
  },
  {
    label: "Export",
    command: () => {
      menuResult.value = "Export";
    },
  },
  { separator: true },
  {
    label: "Remove",
    command: () => {
      menuResult.value = "Remove";
    },
  },
];

function togglePopupMenu(event: MouseEvent): void {
  popupMenu.value?.toggle(event);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Service outlets — mounted once so confirm.require() can render. -->
    <ConfirmDialog />
    <ConfirmPopup />

    <Fieldset legend="Dialog">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="primary" @click="dialogOpen = true">Open dialog</Button>
        <span class="text-faint text-xs">modal — floats above the dock with a backdrop</span>
      </div>
      <Dialog v-model:visible="dialogOpen" header="Example dialog" modal>
        <p class="text-muted text-sm">
          A Volt <code class="text-foreground">Dialog</code>, themed entirely via project tokens. It
          floats above the dock and closes on Escape, the close button, or the footer action.
        </p>
        <template #footer>
          <Button variant="secondary" @click="dialogOpen = false">Close</Button>
        </template>
      </Dialog>
    </Fieldset>

    <Fieldset legend="ConfirmDialog">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="danger" @click="openConfirmDialog">
          <Trash2 :size="16" />
          Delete with confirm…
        </Button>
        <span class="text-muted text-sm">
          Result: <span class="text-foreground font-mono">{{ confirmDialogResult }}</span>
        </span>
      </div>
    </Fieldset>

    <Fieldset legend="ConfirmPopup">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="secondary" @click="openConfirmPopup">Save changes…</Button>
        <span class="text-muted text-sm">
          Result: <span class="text-foreground font-mono">{{ confirmPopupResult }}</span>
        </span>
      </div>
      <p class="text-faint mt-1 text-xs">Anchored to the button via <code>target</code>.</p>
    </Fieldset>

    <Fieldset legend="Drawer">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="secondary" @click="leftDrawerOpen = true">Open left drawer</Button>
        <Button variant="secondary" @click="rightDrawerOpen = true">Open right drawer</Button>
      </div>
      <Drawer v-model:visible="leftDrawerOpen" position="left" header="Left drawer">
        <p class="text-muted text-sm">
          Slides in from the left edge. Useful for navigation trees or layer lists.
        </p>
      </Drawer>
      <Drawer v-model:visible="rightDrawerOpen" position="right" header="Right drawer">
        <p class="text-muted text-sm">
          Slides in from the right edge. Useful for inspector / detail panes.
        </p>
      </Drawer>
    </Fieldset>

    <Fieldset legend="Popover">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="secondary" @click="togglePopover">
          <MoreHorizontal :size="16" />
          Toggle popover
        </Button>
        <span class="text-faint text-xs">anchored to the trigger, dismisses on outside click</span>
      </div>
      <Popover ref="popover">
        <div class="flex flex-col gap-1">
          <span class="text-foreground text-sm font-semibold">Quick details</span>
          <span class="text-muted text-sm">Arbitrary panel content lives in the default slot.</span>
        </div>
      </Popover>
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

    <Fieldset legend="ContextMenu (right-click)">
      <div
        class="border-border bg-surface-sunken text-muted flex h-20 items-center justify-center rounded-md border border-dashed text-sm select-none"
        @contextmenu.prevent="showContextMenu"
      >
        Right-click anywhere in this box
      </div>
      <p class="text-muted mt-2 text-sm">
        Last action: <span class="text-foreground font-mono">{{ contextResult }}</span>
      </p>
      <ContextMenu ref="contextMenu" :model="CONTEXT_MODEL" />
    </Fieldset>

    <Fieldset legend="Menu (popup)">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="secondary" @click="togglePopupMenu">
          <MenuIcon :size="16" />
          Open menu ▾
        </Button>
        <span class="text-muted text-sm">
          Last action: <span class="text-foreground font-mono">{{ menuResult }}</span>
        </span>
      </div>
      <Menu ref="popupMenu" :model="MENU_MODEL" :popup="true" />
    </Fieldset>
  </div>
</template>
