<script setup lang="ts">
import type { NotifySeverity, ToastPosition } from "@/components/ui/toastTheme";

import { TriangleAlert, X } from "@lucide/vue";
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import IconButton from "@/components/ui/IconButton.vue";
import Select from "@/components/ui/Select.vue";
import { useNotify } from "@/composables/useNotify";
import Fieldset from "@/volt/Fieldset.vue";
import Message from "@/volt/Message.vue";

/**
 * NotificationsTab — the "Notifications" tab of the Component Showcase.
 *
 * Ported verbatim from `ShowcasePanel.vue`'s NOTIFICATIONS block: a position
 * Select + per-severity fire buttons (plus Dismiss all), and a sticky/coalesce
 * pair that demonstrates how a keyed success replaces a keyed sticky danger.
 *
 * Stateless playground — no props, no serialize/restore; just local demo refs.
 */
const notify = useNotify();

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

// Inline alerts + banner -----------------------------------------------------
const INLINE_ALERTS = [
  { severity: "info", text: "12 new contacts entered the area of interest." },
  { severity: "success", text: "Mission plan saved and synced to all stations." },
  { severity: "warn", text: "Telemetry link degraded — retrying on backup channel." },
  { severity: "error", text: "Failed to reach sensor grid. Last update 4m ago." },
] as const;
const bannerVisible = ref<boolean>(true);
</script>

<template>
  <div class="flex flex-col gap-4">
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
          <Button size="sm" variant="ghost" @click="notify.dismissAll()">Dismiss all</Button>
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

    <Fieldset legend="Inline alerts">
      <div class="flex flex-col gap-2">
        <Message v-for="a in INLINE_ALERTS" :key="a.severity" :severity="a.severity" closable>
          {{ a.text }}
        </Message>
      </div>
    </Fieldset>

    <Fieldset legend="Banner (dismissible)">
      <div
        v-if="bannerVisible"
        class="flex items-center gap-3 rounded-md border p-3"
        :style="{
          borderColor: 'var(--color-status-warning-border)',
          background: 'var(--color-status-warning-subtle)',
        }"
      >
        <TriangleAlert :size="18" :style="{ color: 'var(--color-status-warning)' }" />
        <div class="min-w-0 flex-1">
          <p class="text-foreground text-sm font-medium">Scheduled maintenance window</p>
          <p class="text-muted text-xs">Telemetry ingest pauses 02:00–02:30Z tonight.</p>
        </div>
        <Button size="sm" variant="secondary">Details</Button>
        <IconButton label="Dismiss banner" @click="bannerVisible = false">
          <X :size="16" />
        </IconButton>
      </div>
      <Button v-else size="sm" variant="ghost" @click="bannerVisible = true">
        Restore banner
      </Button>
    </Fieldset>
  </div>
</template>
