<script setup lang="ts">
import type { DataTableColumn } from "@/components/ui/datatable/types";
import type { MeterItem } from "primevue/metergroup";
import type { TreeNode } from "primevue/treenode";

import { Bell } from "@lucide/vue";
import { ref } from "vue";

import DataTable from "@/components/ui/DataTable.vue";
import StatCard from "@/components/ui/StatCard.vue";
import Avatar from "@/volt/Avatar.vue";
import AvatarGroup from "@/volt/AvatarGroup.vue";
import Badge from "@/volt/Badge.vue";
import Chip from "@/volt/Chip.vue";
import DataView from "@/volt/DataView.vue";
import Fieldset from "@/volt/Fieldset.vue";
import Inplace from "@/volt/Inplace.vue";
import InputText from "@/volt/InputText.vue";
import MeterGroup from "@/volt/MeterGroup.vue";
import OverlayBadge from "@/volt/OverlayBadge.vue";
import Tag from "@/volt/Tag.vue";
import Timeline from "@/volt/Timeline.vue";
import Tree from "@/volt/Tree.vue";

/**
 * Data Display tab — the data-presentation slice of the Component Showcase
 * (Track A — A-Showcase). Demos the flagship `<DataTable>` (TanStack) plus the
 * Volt data wrappers: DataView, Tag, Chip, Avatar(+Group), Badge(+Overlay),
 * Timeline, Tree, MeterGroup, and Inplace. Stateless playground — local refs.
 */

// --- DataTable (TanStack flagship) -----------------------------------------
interface UnitRow {
  callsign: string;
  type: string;
  status: "Active" | "Standby" | "Offline";
  updated: string;
}

type TagSeverity = "success" | "info" | "warn" | "danger" | "secondary" | "contrast";

const UNIT_STATUS_SEVERITY: Record<UnitRow["status"], TagSeverity> = {
  Active: "success",
  Standby: "warn",
  Offline: "danger",
};

const unitRows = ref<UnitRow[]>([
  { callsign: "Alpha-1", type: "Recon UAV", status: "Active", updated: "12:04:31" },
  { callsign: "Bravo-2", type: "Ground Unit", status: "Standby", updated: "12:03:58" },
  { callsign: "Charlie-3", type: "Patrol Boat", status: "Active", updated: "12:04:12" },
  { callsign: "Delta-4", type: "Relay Node", status: "Offline", updated: "11:58:02" },
  { callsign: "Echo-5", type: "Recon UAV", status: "Standby", updated: "12:02:44" },
]);

const unitColumns: DataTableColumn<UnitRow>[] = [
  { id: "callsign", accessorKey: "callsign", header: "Callsign" },
  { id: "type", accessorKey: "type", header: "Type" },
  { id: "status", accessorKey: "status", header: "Status" },
  { id: "updated", accessorKey: "updated", header: "Updated" },
];

// --- DataView (grid) -------------------------------------------------------
interface SensorCard {
  id: string;
  name: string;
  reading: string;
}

const sensorCards = ref<SensorCard[]>([
  { id: "s-1", name: "North Array", reading: "98.2%" },
  { id: "s-2", name: "East Array", reading: "74.6%" },
  { id: "s-3", name: "South Array", reading: "91.0%" },
  { id: "s-4", name: "West Array", reading: "63.4%" },
]);

// --- Tag -------------------------------------------------------------------
const TAG_SEVERITIES: readonly TagSeverity[] = [
  "success",
  "info",
  "warn",
  "danger",
  "secondary",
  "contrast",
];

// --- Timeline --------------------------------------------------------------
interface TimelineEvent {
  status: string;
  time: string;
}

const timelineEvents = ref<TimelineEvent[]>([
  { status: "Mission tasked", time: "10:30" },
  { status: "Assets en route", time: "10:42" },
  { status: "On station", time: "11:05" },
  { status: "RTB", time: "12:18" },
]);

// --- Tree ------------------------------------------------------------------
const treeNodes = ref<TreeNode[]>([
  {
    key: "fleet-air",
    label: "Air",
    children: [
      { key: "air-uav", label: "Recon UAV ×2" },
      { key: "air-rotor", label: "Rotary ×1" },
    ],
  },
  {
    key: "fleet-ground",
    label: "Ground",
    children: [
      { key: "ground-patrol", label: "Patrol Unit ×3" },
      { key: "ground-relay", label: "Relay Node ×1" },
    ],
  },
]);

// --- MeterGroup ------------------------------------------------------------
const meterValue = ref<MeterItem[]>([
  { label: "Active", value: 48, color: "var(--color-status-success)" },
  { label: "Standby", value: 32, color: "var(--color-status-warning)" },
  { label: "Offline", value: 20, color: "var(--color-status-danger)" },
]);

// --- Inplace ---------------------------------------------------------------
const inplaceText = ref<string>("Sector Bravo");

// --- Depth & accent tokens (Track A A1c) -----------------------------------
// The five themeable color tokens behind the "less-flat" palette; each follows
// the active theme (and dark mode) via its tokens.css chain / generator value.
const DEPTH_TOKENS = [
  { token: "--color-surface-bevel-light", label: "bevel-light" },
  { token: "--color-surface-bevel-dark", label: "bevel-dark" },
  { token: "--color-border-accent", label: "border-accent" },
  { token: "--color-interactive-glow", label: "interactive-glow" },
  { token: "--color-interactive-dim", label: "interactive-dim" },
] as const;

// --- Stat cards (configurable KPI tiles) -----------------------------------
// Driven by the reusable <StatCard> primitive — every color treatment is a
// prop, so the same component covers all the dashboard card styles. One tile
// per `variant` here so every option is visible at a glance.
interface StatTile {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  status: "success" | "info" | "warning" | "danger" | "neutral";
  variant: "accent-left" | "accent-top" | "accent-bottom" | "border" | "filled" | "plain";
}
const STAT_CARDS: StatTile[] = [
  { label: "Active units · accent-left", value: "128", delta: "+12%", trend: "up", status: "success", variant: "accent-left" }, // prettier-ignore
  {
    label: "Open alerts · filled",
    value: "7",
    delta: "+3",
    trend: "up",
    status: "danger",
    variant: "filled",
  },
  {
    label: "Avg. uptime · border",
    value: "99.9%",
    delta: "+0.2%",
    trend: "up",
    status: "info",
    variant: "border",
  },
  { label: "Latency · accent-top", value: "42ms", delta: "-8ms", trend: "down", status: "info", variant: "accent-top" }, // prettier-ignore
  { label: "Pending · accent-bottom", value: "24", delta: "-5", trend: "down", status: "warning", variant: "accent-bottom" }, // prettier-ignore
  {
    label: "Signal · plain",
    value: "98%",
    delta: "+1%",
    trend: "up",
    status: "success",
    variant: "plain",
  },
];
</script>

<template>
  <div class="flex flex-col gap-4">
    <Fieldset legend="Stat cards (configurable variants)">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          v-for="s in STAT_CARDS"
          :key="s.label"
          :label="s.label"
          :value="s.value"
          :delta="s.delta"
          :trend="s.trend"
          :status="s.status"
          :variant="s.variant"
        />
      </div>
    </Fieldset>

    <Fieldset legend="Depth & accent (theme palette — A1c)">
      <div class="flex flex-col gap-4">
        <!-- The five themeable color tokens, each following the active theme. -->
        <div class="flex flex-wrap gap-2">
          <div
            v-for="t in DEPTH_TOKENS"
            :key="t.token"
            class="border-border flex items-center gap-2 rounded-md border px-2 py-1.5"
          >
            <span
              class="border-border h-5 w-5 rounded border"
              :style="{ background: `var(${t.token})` }"
            />
            <span class="text-muted font-mono text-xs">{{ t.label }}</span>
          </div>
        </div>
        <!-- The three composed depth shadows on sample surfaces. -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div
            class="bg-surface text-foreground rounded-lg p-4 text-sm shadow-[var(--shadow-bevel-raised)]"
          >
            <div class="font-medium">Bevel — raised</div>
            <div class="text-muted text-xs">--shadow-bevel-raised</div>
          </div>
          <div
            class="bg-surface-sunken text-foreground rounded-lg p-4 text-sm shadow-[var(--shadow-bevel-sunken)]"
          >
            <div class="font-medium">Bevel — sunken</div>
            <div class="text-muted text-xs">--shadow-bevel-sunken</div>
          </div>
          <div
            class="bg-surface text-foreground border-border rounded-lg border p-4 text-sm shadow-[var(--shadow-accent-glow)]"
          >
            <div class="font-medium">Accent glow</div>
            <div class="text-muted text-xs">--shadow-accent-glow</div>
          </div>
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="DataTable (TanStack default)">
      <DataTable
        :data="unitRows"
        :columns="unitColumns"
        row-key="callsign"
        density="compact"
        container-height="auto"
        :enable-column-resize="false"
        class="border-border rounded-md border"
      >
        <template #cell-status="{ value }">
          <Tag
            :value="value as string"
            :severity="UNIT_STATUS_SEVERITY[value as UnitRow['status']]"
          />
        </template>
        <template #cell-callsign="{ value }">
          <span class="font-mono tabular-nums">{{ value }}</span>
        </template>
        <template #cell-updated="{ value }">
          <span class="text-muted font-mono tabular-nums">{{ value }}</span>
        </template>
      </DataTable>
    </Fieldset>

    <Fieldset legend="DataView (grid)">
      <DataView :value="sensorCards" layout="grid" data-key="id">
        <template #grid="{ items }">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div
              v-for="card in items as SensorCard[]"
              :key="card.id"
              class="border-border bg-surface-sunken flex flex-col gap-1 rounded-md border p-3"
            >
              <span class="text-foreground text-sm font-medium">{{ card.name }}</span>
              <span class="text-muted font-mono text-sm tabular-nums">{{ card.reading }}</span>
            </div>
          </div>
        </template>
      </DataView>
    </Fieldset>

    <Fieldset legend="Tag — severities">
      <div class="flex flex-wrap items-center gap-2">
        <Tag v-for="s in TAG_SEVERITIES" :key="s" :value="s" :severity="s" />
      </div>
    </Fieldset>

    <Fieldset legend="Chip">
      <div class="flex flex-wrap items-center gap-2">
        <Chip label="Plain chip" />
        <Chip label="Removable" removable />
        <Chip label="With icon">
          <template #icon>
            <Bell :size="14" />
          </template>
        </Chip>
        <Chip label="HQ" image="https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png" />
      </div>
    </Fieldset>

    <Fieldset legend="Avatar + AvatarGroup">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex items-center gap-2">
          <Avatar label="A" />
          <Avatar label="B" shape="circle" />
          <Avatar label="C" size="large" />
          <Avatar size="xlarge" shape="circle">
            <Bell :size="22" />
          </Avatar>
        </div>
        <AvatarGroup>
          <Avatar label="A1" shape="circle" />
          <Avatar label="B2" shape="circle" />
          <Avatar label="C3" shape="circle" />
          <Avatar label="+5" shape="circle" />
        </AvatarGroup>
      </div>
    </Fieldset>

    <Fieldset legend="Badge + OverlayBadge">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex flex-wrap items-center gap-2">
          <Badge value="8" />
          <Badge value="2" severity="success" />
          <Badge value="5" severity="info" />
          <Badge value="3" severity="warn" />
          <Badge value="9" severity="danger" />
          <Badge value="1" severity="secondary" />
        </div>
        <OverlayBadge value="4" severity="danger">
          <span
            class="border-border bg-surface-sunken text-muted inline-flex h-9 w-9 items-center justify-center rounded-md border"
          >
            <Bell :size="18" />
          </span>
        </OverlayBadge>
      </div>
    </Fieldset>

    <Fieldset legend="Timeline">
      <Timeline :value="timelineEvents" align="left">
        <template #content="{ item }">
          <div class="flex flex-col">
            <span class="text-foreground text-sm">{{ (item as TimelineEvent).status }}</span>
            <span class="text-faint font-mono text-xs tabular-nums">{{
              (item as TimelineEvent).time
            }}</span>
          </div>
        </template>
      </Timeline>
    </Fieldset>

    <Fieldset legend="Tree">
      <Tree :value="treeNodes" class="text-sm" />
    </Fieldset>

    <Fieldset legend="MeterGroup">
      <MeterGroup :value="meterValue" />
    </Fieldset>

    <Fieldset legend="Inplace (click-to-edit)">
      <div class="flex items-center gap-2">
        <span class="text-muted text-sm">Label:</span>
        <Inplace>
          <template #display>
            <span class="text-foreground text-sm">{{ inplaceText || "Click to edit" }}</span>
          </template>
          <template #content="{ closeCallback }">
            <span class="inline-flex items-center gap-2">
              <InputText
                v-model="inplaceText"
                class="w-48"
                autofocus
                @keyup.enter="closeCallback"
              />
            </span>
          </template>
        </Inplace>
      </div>
    </Fieldset>
  </div>
</template>
