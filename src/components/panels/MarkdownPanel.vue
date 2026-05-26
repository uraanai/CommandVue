<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";

import { Pencil, Save } from "@lucide/vue";
import MarkdownIt from "markdown-it";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import { usePanelApi } from "@/composables/usePanelApi";
import { usePanelState } from "@/composables/usePanelState";
import Textarea from "@/volt/Textarea.vue";

interface MarkdownState extends Record<string, unknown> {
  content: string;
}

const props = defineProps<PanelApiProps>();

// dockview-vue passes the panel api inside the `params` bag — see usePanelApi.
const { api } = usePanelApi(props);

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
if (api.value) {
  const { save } = usePanelState<MarkdownState>(api.value.id, {
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
      class="border-border bg-surface-raised flex items-center justify-between border-b px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-[length:var(--density-font-size)]"
    >
      <span class="text-faint">Markdown briefing</span>
      <Button variant="ghost" size="sm" @click="toggleEdit">
        <Save v-if="editing" class="size-3" />
        <Pencil v-else class="size-3" />
        <span>{{ editing ? "Done" : "Edit" }}</span>
      </Button>
    </header>
    <!--
      The Volt Textarea sets its own root `pt` with full color tokens, but the
      consumer `pt` here replaces that root entry rather than merging with it —
      so the surface + text + border colors have to be repeated. Without them
      the textarea falls back to browser-default white background, which makes
      the editor unreadable in dark mode.
    -->
    <Textarea
      v-if="editing"
      v-model="content"
      :auto-resize="false"
      placeholder="# Briefing…"
      :pt="{
        root: {
          class:
            'bg-surface text-foreground placeholder:text-muted min-h-0 flex-1 resize-none rounded-none border-0 p-3 font-mono text-xs',
        },
      }"
      @input="saveFn?.()"
    />
    <div v-else class="min-h-0 flex-1 overflow-auto p-4">
      <!-- eslint-disable-next-line vue/no-v-html -- markdown-it instantiated with html: false; output is sanitized -->
      <article
        class="prose prose-sm dark:prose-invert [&_a]:text-accent-500 dark:[&_a]:text-accent-400 [&_code]:bg-surface-raised [&_code]:text-foreground [&_table]:border-border [&_th]:border-border [&_td]:border-border [&_blockquote]:border-accent-500 max-w-none [&_blockquote]:border-l [&_blockquote]:pl-3 [&_table]:border [&_td]:border-b [&_th]:border-b"
        v-html="html"
      />
    </div>
  </div>
</template>
