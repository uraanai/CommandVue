<script setup lang="ts">
import { FileText, Plus, RefreshCcw, Trash2 } from "@lucide/vue";
// Splitter detects its panes by child component type, so SplitterPanel can't be
// wrapped in a Volt component (a wrapper renders an empty splitter). The styled
// Volt <Splitter> parent supplies the visuals.
import SplitterPanel from "primevue/splitterpanel"; // eslint-disable-line @typescript-eslint/no-restricted-imports
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import Accordion from "@/volt/Accordion.vue";
import AccordionContent from "@/volt/AccordionContent.vue";
import AccordionHeader from "@/volt/AccordionHeader.vue";
import AccordionPanel from "@/volt/AccordionPanel.vue";
import Card from "@/volt/Card.vue";
import Divider from "@/volt/Divider.vue";
import Fieldset from "@/volt/Fieldset.vue";
import Panel from "@/volt/Panel.vue";
import Splitter from "@/volt/Splitter.vue";
import Toolbar from "@/volt/Toolbar.vue";

/**
 * PanelsLayoutTab — the "Panels & Layout" tab of the Component Showcase.
 * Demos the Volt layout primitives (Fieldset, Panel, Card, Divider, Accordion,
 * Toolbar) so a token change recolors them all in one scroll. Demo-only file;
 * not scanned by the single-source color guard.
 */

// Modern Accordion keeps its open panels as an array of `value` strings.
const openSections = ref<string[]>(["0"]);
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ================= FIELDSET ================= -->
    <Fieldset legend="Fieldset">
      <div class="flex flex-col gap-3">
        <p class="text-muted text-sm">
          Every section in this panel is a Volt <code class="text-foreground">Fieldset</code>. The
          one below is <code class="text-foreground">:toggleable</code> — click its legend to
          collapse it.
        </p>
        <Fieldset legend="Toggleable section" :toggleable="true">
          <p class="text-muted text-sm">
            Collapsible body content. Fieldsets group related controls under a labelled legend and
            animate their height open and closed.
          </p>
        </Fieldset>
      </div>
    </Fieldset>

    <!-- ================= PANEL ================= -->
    <Fieldset legend="Panel">
      <Panel header="Mission briefing" :toggleable="true">
        <p class="text-muted text-sm">
          A Volt <code class="text-foreground">Panel</code> with a header and a collapse toggle in
          the top-right corner. Useful for a titled, self-contained block that the user can fold
          away.
        </p>
      </Panel>
    </Fieldset>

    <!-- ================= CARD ================= -->
    <Fieldset legend="Card">
      <Card class="sm:w-80">
        <template #title>Sensor array</template>
        <template #content>
          <p class="text-muted text-sm">
            Cards compose <code class="text-foreground">#title</code>,
            <code class="text-foreground">#content</code>, and
            <code class="text-foreground">#footer</code> slots into a raised, rounded surface.
          </p>
        </template>
        <template #footer>
          <div class="flex gap-2">
            <Button variant="secondary" size="sm">Details</Button>
            <Button variant="primary" size="sm">Deploy</Button>
          </div>
        </template>
      </Card>
    </Fieldset>

    <!-- ================= DIVIDER ================= -->
    <Fieldset legend="Divider">
      <div class="flex flex-col gap-3">
        <p class="text-muted text-sm">Horizontal — default</p>
        <Divider />

        <p class="text-muted text-sm">Horizontal — with content</p>
        <Divider>
          <span class="text-faint text-xs">OR</span>
        </Divider>

        <p class="text-muted text-sm">Vertical — between two blocks</p>
        <div class="bg-surface-sunken border-border flex items-stretch rounded-md border">
          <div class="text-muted flex-1 p-3 text-sm">Left block</div>
          <Divider layout="vertical" />
          <div class="text-muted flex-1 p-3 text-sm">Right block</div>
        </div>
      </div>
    </Fieldset>

    <!-- ================= ACCORDION ================= -->
    <Fieldset legend="Accordion">
      <Accordion v-model:value="openSections" :multiple="true">
        <AccordionPanel value="0">
          <AccordionHeader>Section A — Overview</AccordionHeader>
          <AccordionContent>
            <p class="text-muted text-sm">
              The modern Accordion API composes <code class="text-foreground">AccordionPanel</code>,
              <code class="text-foreground">AccordionHeader</code>, and
              <code class="text-foreground">AccordionContent</code>. Open panels are tracked by
              their <code class="text-foreground">value</code>.
            </p>
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="1">
          <AccordionHeader>Section B — Telemetry</AccordionHeader>
          <AccordionContent>
            <p class="text-muted text-sm">
              With <code class="text-foreground">:multiple</code> enabled, more than one section can
              be expanded at once.
            </p>
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="2">
          <AccordionHeader>Section C — Logs</AccordionHeader>
          <AccordionContent>
            <p class="text-muted font-mono text-xs">
              [12:04:11] link established<br />
              [12:04:12] handshake ok
            </p>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </Fieldset>

    <!-- ================= TOOLBAR ================= -->
    <Fieldset legend="Toolbar">
      <Toolbar>
        <template #start>
          <div class="flex items-center gap-2">
            <Button variant="primary" size="sm">
              <Plus :size="16" />
              New
            </Button>
            <Button variant="secondary" size="sm">
              <RefreshCcw :size="16" />
              Refresh
            </Button>
          </div>
        </template>
        <template #center>
          <span class="text-faint flex items-center gap-1.5 text-xs">
            <FileText :size="14" />
            12 records
          </span>
        </template>
        <template #end>
          <Button variant="danger" size="sm">
            <Trash2 :size="16" />
            Clear
          </Button>
        </template>
      </Toolbar>
    </Fieldset>

    <!-- ================= SPLITTER ================= -->
    <Fieldset legend="Splitter (resizable)">
      <p class="text-muted mb-2 text-sm">Drag the gutter to rebalance the two panes.</p>
      <div class="h-40">
        <Splitter class="!h-full">
          <SplitterPanel :size="40" :min-size="20">
            <div class="text-muted h-full overflow-auto p-3 text-sm">
              Left pane — controls, a list, or a form.
            </div>
          </SplitterPanel>
          <SplitterPanel :size="60">
            <div class="text-muted h-full overflow-auto p-3 text-sm">
              Right pane — a preview, detail view, or map.
            </div>
          </SplitterPanel>
        </Splitter>
      </div>
    </Fieldset>
  </div>
</template>
