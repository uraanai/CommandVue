/* eslint-disable */
// Copy-paste template for adding a custom chrome item.
//
// 1. Build src/components/chrome/items/MyItem.vue.
// 2. Register via chromeItemRegistry.register() — typically from your
//    extension bootstrap, after registerBuiltinChromeItems().

// ─── src/components/chrome/items/MyItem.vue ───────────────────────────────
/*
<script setup lang="ts">
import { Hash } from "@lucide/vue";

import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();

const someValue = "demo";
</script>

<template>
  <span
    class="text-muted flex items-center gap-1 font-mono text-xs"
    :title="`Something useful: ${someValue}`"
  >
    <Hash class="size-3" />
    <span>{{ someValue }}</span>
  </span>
</template>
*/

// ─── src/extensions/bootstrap.ts (after registerBuiltinChromeItems) ───────
/*
import { chromeItemRegistry } from "@/modules/chrome/registry";

chromeItemRegistry.register({
  id: "my-item",            // unique id; not underscore-prefixed
  title: "My Item",
  description: "What it shows.",
  icon: "hash",             // Lucide icon name
  allowedSlots: ["status-right", "status-center"],
  defaultSlot: "status-right",
  component: () => import("@/components/chrome/items/MyItem.vue"),
  removable: true,          // false ONLY for app-icon
  singleton: true,          // typically true for built-in patterns
});
*/

// After registration, the item appears in the edit-mode "+" dropdown for the
// allowed slots, and can be added to the active chrome profile.

export {};
