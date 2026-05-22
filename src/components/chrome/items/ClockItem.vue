<script setup lang="ts">
import { Clock } from "@lucide/vue";
import dayjs from "dayjs";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const now = ref(dayjs());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => (now.value = dayjs()), 1000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const localTime = computed(() => now.value.format("HH:mm:ss"));
const gmtTime = computed(() => new Date(now.value.valueOf()).toISOString().substring(11, 19));
const fullDate = computed(
  () => `${now.value.format("YYYY-MM-DD HH:mm:ss")} local · ${gmtTime.value} GMT`,
);
</script>

<template>
  <span class="text-muted flex items-center gap-1.5 font-mono text-xs" :title="fullDate">
    <Clock class="size-3" />
    <span>{{ localTime }}</span>
    <span class="text-faint">·</span>
    <span>{{ gmtTime }} GMT</span>
  </span>
</template>
