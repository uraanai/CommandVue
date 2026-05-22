<script setup lang="ts">
import MenuBar from "@/components/layout/MenuBar.vue";
import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
</script>

<template>
  <MenuBar v-if="chrome.menuBarVisible" />
</template>
