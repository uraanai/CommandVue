<script setup lang="ts">
import type { DockviewApi } from "dockview-vue";

import { onUnmounted, ref, watch } from "vue";

import DockMenu from "./DockMenu.vue";
import { useDockMenuModel, type DockMenuItem } from "./useDockMenuModel";

/**
 * Per-pop-out-window dock context menu (Track B Phase 6c). One instance is
 * rendered per open pop-out window (`DockLayout` v-for over `usePopoutWindows`),
 * so right-clicking inside a pop-out shows OUR menu instead of the browser's
 * native one.
 *
 * Two things differ from the main-window `DockContextMenu`, both flowing from the
 * child window being a SEPARATE document:
 *
 *  1. The `contextmenu` listener is attached to the pop-out's OWN `document` — the
 *     main dock-root listener never sees events from the child document.
 *  2. The menu overlay is appended to the pop-out's `document.body` (via `DockMenu`
 *     → `ContextMenu` `appendTo`); PrimeVue otherwise teleports it to the opener's
 *     `<body>`, i.e. the wrong monitor (master-spec D8).
 *
 * The model is the SAME `useDockMenuModel` definition as the main window — group
 * lookup works unchanged because a pop-out group's `element` lives in the pop-out
 * document, so `element.contains(target)` matches there and nowhere else. Items
 * that can't apply in a pop-out (Float / Maximize / Minimize) come back disabled.
 */
const props = defineProps<{ api: DockviewApi; win: Window }>();

const { buildModelForGroup } = useDockMenuModel();

const menuRef = ref<InstanceType<typeof DockMenu> | null>(null);
const model = ref<DockMenuItem[]>([]);
/** The LIVE pop-out `<body>` to mount the overlay into — only known once the
 *  final document is in place (see `bindWhenReady`). */
const appendTo = ref<HTMLElement>();

function onContextMenu(event: MouseEvent): void {
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dv-groupview");
  const group = props.api.groups.find((g) => g.element === el || g.element.contains(el as Node));
  // No dock group under the cursor: do nothing, let the native menu show.
  if (!group) return;

  const next = buildModelForGroup(group, props.api.panels.length);
  if (next.length === 0) return;

  event.preventDefault();
  event.stopPropagation();
  model.value = next;
  menuRef.value?.show(event);
}

/**
 * Bind to the pop-out's LIVE document.
 *
 * dockview fires `onDidOpen` (→ `trackPopoutWindow` → our mount) BEFORE the child
 * window finishes loading `/popout.html`: at that instant `win.document` is the
 * throw-away `about:blank`. dockview moves the group DOM into the FINAL document
 * on the window `load` event and tags it `#dv-popout-window`. So we bind on `load`
 * (re-reading `win.document` then), or immediately when the final document is
 * already present (component mounted after load). Binding eagerly — as the
 * main-window menu does — would attach to the dead `about:blank` doc and silently
 * never fire. `appendTo` is set to the live `<body>` at the same moment so the
 * overlay renders in THIS window, not the opener's.
 */
function bindWhenReady(win: Window): () => void {
  let detach: (() => void) | null = null;
  const bind = (): void => {
    const doc = win.document;
    doc.addEventListener("contextmenu", onContextMenu);
    appendTo.value = doc.body;
    detach = () => doc.removeEventListener("contextmenu", onContextMenu);
  };

  if (win.document.getElementById("dv-popout-window")) {
    bind();
    return () => detach?.();
  }
  win.addEventListener("load", bind, { once: true });
  return () => {
    win.removeEventListener("load", bind);
    detach?.();
  };
}

// Rebind if the window prop ever swaps; the cleanup releases the prior binding.
watch(
  () => props.win,
  (win, _prev, onCleanup) => onCleanup(bindWhenReady(win)),
  {
    immediate: true,
  },
);

onUnmounted(() => menuRef.value?.hide());
</script>

<template>
  <DockMenu ref="menuRef" :model="model" :append-to="appendTo" />
</template>
