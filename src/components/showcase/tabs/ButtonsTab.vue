<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import { ChevronDown, Copy, Pencil, Plus, Trash2 } from "@lucide/vue";
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import IconButton from "@/components/ui/IconButton.vue";
import Fieldset from "@/volt/Fieldset.vue";
import Menu from "@/volt/Menu.vue";
import SecondaryButton from "@/volt/SecondaryButton.vue";
import SplitButton from "@/volt/SplitButton.vue";

/**
 * ButtonsTab — Buttons section of the Component Showcase.
 * Demo-only file under src/components/showcase/; uses semantic utility classes
 * and CSS-var status colors, never raw palette. Commands are harmless no-ops
 * that update a local ref so the action is observable without side effects.
 */

// Records the most recent harmless action so SplitButton / Menu clicks are
// visibly observable in the demo without any real side effect.
const lastAction = ref<string>("none");

const SPLIT_MODEL: MenuItem[] = [
  { label: "Save and close", command: () => (lastAction.value = "Save and close") },
  { label: "Save as draft", command: () => (lastAction.value = "Save as draft") },
  { separator: true },
  { label: "Discard", command: () => (lastAction.value = "Discard") },
];

const MENU_MODEL: MenuItem[] = [
  { label: "Edit", command: () => (lastAction.value = "Edit") },
  { label: "Duplicate", command: () => (lastAction.value = "Duplicate") },
  { separator: true },
  { label: "Delete", command: () => (lastAction.value = "Delete") },
];

const popupMenu = ref<InstanceType<typeof Menu> | null>(null);
</script>

<template>
  <div class="flex flex-col gap-4">
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

    <Fieldset legend="SplitButton">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <SplitButton
            label="Save"
            size="small"
            :model="SPLIT_MODEL"
            @click="lastAction = 'Save (small)'"
          />
          <SplitButton label="Save" :model="SPLIT_MODEL" @click="lastAction = 'Save (medium)'" />
          <SplitButton
            label="Save"
            size="large"
            :model="SPLIT_MODEL"
            @click="lastAction = 'Save (large)'"
          />
          <span class="text-faint text-xs">small · medium · large</span>
        </div>
        <span class="text-muted text-sm">
          Last action:
          <span class="text-foreground font-mono tabular-nums">{{ lastAction }}</span>
        </span>
      </div>
    </Fieldset>

    <Fieldset legend="Menu button (composed)">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="secondary" @click="popupMenu?.toggle($event)">
          Actions
          <ChevronDown :size="16" />
        </Button>
        <Menu ref="popupMenu" :model="MENU_MODEL" :popup="true" />
        <span class="text-muted text-sm">
          Last action:
          <span class="text-foreground font-mono tabular-nums">{{ lastAction }}</span>
        </span>
      </div>
    </Fieldset>
  </div>
</template>
