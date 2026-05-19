<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { computed } from "vue";

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

const html = computed(() => md.render(sampleBriefing));
</script>

<template>
  <div class="bg-surface-sunken h-full w-full overflow-auto p-4">
    <!-- eslint-disable-next-line vue/no-v-html -- markdown-it instantiated with html: false; output is sanitized -->
    <article
      class="prose prose-sm prose-invert dark:prose-invert [&_a]:text-accent-400 [&_code]:bg-surface-raised [&_code]:text-foreground [&_table]:border-border [&_th]:border-border [&_td]:border-border [&_blockquote]:border-accent-500 max-w-none [&_blockquote]:border-l [&_blockquote]:pl-3 [&_table]:border [&_td]:border-b [&_th]:border-b"
      v-html="html"
    />
  </div>
</template>
