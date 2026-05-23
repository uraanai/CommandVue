<script setup lang="ts">
import type { DockviewPanelApi } from "dockview-vue";

import { Pencil, Save } from "@lucide/vue";
import MarkdownIt from "markdown-it";
import Textarea from "primevue/textarea";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import { usePanelState } from "@/composables/usePanelState";
import { cn } from "@/utils/cn";

interface Props {
  api?: DockviewPanelApi;
}

interface MarkdownState extends Record<string, unknown> {
  content: string;
}

const props = defineProps<Props>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

const sampleBriefing = `# Operations briefing — sample template

> This is example markdown content shipped with CommandVue. Replace it
> with your own briefing model wired through the realtime feed or a
> static asset.

## Status

- WebSocket: \`wss://echo.websocket.events\` (echo demo)
- Default map center: **30.0° N, 70.0° E** at zoom 4
- Active panels: Cesium globe, MapLibre map, entity list, telemetry chart

## Today

1. Confirm overlay rendering on Cesium and MapLibre.
2. Verify entity sync between the realtime feed and the table panel.
3. Rotate operator on-call (see [\`docs/realtime.md\`](#)).

## Notes

Markdown is rendered with \`markdown-it\` plus \`@tailwindcss/typography\`
for prose styles. Inline \`code\`, **emphasis**, _italics_, and links all
render as expected.

| Asset | Status | Notes |
| --- | --- | --- |
| Cesium globe | nominal | imagery layer pending Phase 6 entity overlay |
| MapLibre | nominal | OpenFreeMap Liberty style |
| WebSocket | echo | replace VITE_WS_URL for production |
`;

const content = ref<string>(sampleBriefing);
const editing = ref(false);

const html = computed(() => md.render(content.value));

let saveFn: (() => void) | null = null;
if (props.api) {
  const { save } = usePanelState<MarkdownState>(props.api.id, {
    serialize: () => ({ content: content.value }),
    restore: (state) => {
      if (typeof state.content === "string" && state.content.length > 0) {
        content.value = state.content;
      }
    },
  });
  saveFn = save;
}

function toggleEdit(): void {
  if (editing.value) {
    saveFn?.();
  }
  editing.value = !editing.value;
}
</script>

<template>
  <div class="bg-surface-sunken flex h-full w-full flex-col">
    <header
      class="border-border bg-surface-raised flex items-center justify-between border-b px-3 py-1.5 text-xs"
    >
      <span class="text-faint">Markdown briefing</span>
      <Button variant="ghost" size="sm" @click="toggleEdit">
        <Save v-if="editing" class="size-3" />
        <Pencil v-else class="size-3" />
        <span>{{ editing ? "Done" : "Edit" }}</span>
      </Button>
    </header>
    <Textarea
      v-if="editing"
      v-model="content"
      :auto-resize="false"
      placeholder="# Briefing…"
      :pt="{
        root: {
          class: cn(
            'bg-surface text-foreground placeholder:text-faint',
            'min-h-0 flex-1 resize-none p-3 font-mono text-xs',
            'focus:outline-none focus-visible:outline-none',
            'border-0',
          ),
        },
      }"
      @input="saveFn?.()"
    />
    <div v-else class="min-h-0 flex-1 overflow-auto p-4">
      <!-- eslint-disable-next-line vue/no-v-html -- markdown-it instantiated with html: false; output is sanitized -->
      <article
        class="prose prose-sm prose-invert dark:prose-invert [&_a]:text-accent-400 [&_code]:bg-surface-raised [&_code]:text-foreground [&_table]:border-border [&_th]:border-border [&_td]:border-border [&_blockquote]:border-accent-500 max-w-none [&_blockquote]:border-l [&_blockquote]:pl-3 [&_table]:border [&_td]:border-b [&_th]:border-b"
        v-html="html"
      />
    </div>
  </div>
</template>
