<script setup lang="ts">
import { converter, formatCss, formatHex } from "culori";
import { nextTick, onBeforeUnmount, ref, type Ref, watch } from "vue";

import Input from "@/components/ui/Input.vue";
import { type ElementLike, useOverlayTarget } from "@/composables/useOverlayTarget";
import { TokenValueSchema } from "@/modules/themes/portableSchema";
import { cn } from "@/utils/cn";
import InputNumber from "@/volt/InputNumber.vue";

/**
 * TokenColorField — OKLCH-aware single-token color control (Track A C1).
 *
 * Why custom (not ui/ColorSwatchPicker): that picker needs a non-empty curated
 * `options` grid and its custom path is an sRGB-hex `<input type="color">` — it
 * cannot author the ~70 arbitrary color tokens, gamut-clamps wide-gamut OKLCH on
 * every pick, and cannot preserve `color-mix()` / `var()` defaults. This control
 * takes no options, seeds from a computed resolved value, edits in OKLCH (or raw
 * via Advanced), and preserves an unedited value verbatim. There is NO
 * `<input type="color">` here.
 *
 * The popover is TELEPORTED to `<body>` and `fixed`-positioned from the swatch's
 * rect (right-aligned, flips up near the viewport bottom). A plain `absolute`
 * popover gets clipped by the Tokens-tab `overflow-y-auto` scroll body and the
 * narrow panel edge — teleporting escapes both so the editor is always usable.
 */
interface Props {
  /** Computed resolved CSS value for this token (getComputedStyle(APP_ROOT)). Seeds the control. */
  resolvedValue: string;
  /** True when an override exists for this token. */
  edited: boolean;
  /** Accessible name for the swatch trigger. */
  label: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{ change: [value: string] }>();

const toOklch = converter("oklch");

const POPOVER_WIDTH = 240; // matches the popover's fixed width below

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const popStyle = ref<Record<string, string>>({});

// Pop-out: teleport the popover into the panel's OWN window (the swatch trigger
// moves with the panel on pop-out; the teleported popover does not, so bind the
// target to the trigger and re-resolve at open time).
const { target: overlayTarget, resolve: resolveOverlay } = useOverlayTarget(
  triggerRef as Ref<ElementLike>,
);

// Close-on-outside-click is bound to the panel's CURRENT window at open time
// (see openPopover). @vueuse/core's onClickOutside can't serve the pop-out case:
// it captures the setup-time (opener) window and exposes no way to redirect the
// listener to the child window dockview moves the panel into — so an outside
// click in a popped-out window never closed the popover (only clicking back on
// the opener did). A pointerdown listener on the trigger's OWNING window fixes
// that and is identical docked (owning window === opener).
let outsideWindow: Window | null = null;
function onOutsidePointer(event: Event): void {
  const node = event.target as Node | null;
  if (!node) return;
  if (triggerRef.value?.contains(node) || popoverRef.value?.contains(node)) return;
  closePopover();
}

const l = ref(0.7);
const c = ref(0);
const h = ref(0);
const parsedOklch = ref(false);
const advanced = ref("");
const advancedError = ref(false);
const hexSeed = ref("#888888"); // seeds the native picker (sRGB approximation of the value)

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function seed(): void {
  const parsed = toOklch(props.resolvedValue);
  if (parsed) {
    l.value = round(parsed.l ?? 0, 4);
    c.value = round(parsed.c ?? 0, 4);
    h.value = Math.round(parsed.h ?? 0);
    parsedOklch.value = true;
  } else {
    // Unresolvable (e.g. a var() chain) → neutral seed; the user edits raw.
    l.value = 0.7;
    c.value = 0;
    h.value = 0;
    parsedOklch.value = false;
  }
  advanced.value = props.resolvedValue;
  advancedError.value = false;
  hexSeed.value = formatHex(props.resolvedValue) ?? "#888888";
}

// Re-seed when the resolved value changes from outside (e.g. a reset), but only
// while the popover is closed so an open edit isn't clobbered mid-stroke.
watch(
  () => props.resolvedValue,
  () => {
    if (!open.value) seed();
  },
  { immediate: true },
);

function reposition(): void {
  const t = triggerRef.value;
  if (!t) return;
  const r = t.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popH = popoverRef.value?.offsetHeight ?? 240;
  // Horizontal: right-align the popover to the swatch (extend left), clamp to the viewport.
  let left = r.right - POPOVER_WIDTH;
  if (left < 8) left = 8;
  if (left + POPOVER_WIDTH > vw - 8) left = Math.max(8, vw - 8 - POPOVER_WIDTH);
  // Vertical: below the swatch if it fits, otherwise above.
  let top = r.bottom + 4;
  if (top + popH > vh - 8) {
    const above = r.top - popH - 4;
    top = above >= 8 ? above : Math.max(8, vh - 8 - popH);
  }
  popStyle.value = {
    position: "fixed",
    top: `${top}px`,
    left: `${left}px`,
    width: `${POPOVER_WIDTH}px`,
    zIndex: "2000",
  };
}

function openPopover(): void {
  seed();
  resolveOverlay(); // resolve the owning-window body before the teleport mounts
  open.value = true;
  void nextTick(() => {
    reposition();
    // Bind outside-click to the window that owns the panel right now (pop-out
    // aware). Read at open time: dockview's DOM move fires no reactive signal,
    // so the owning window is only known once the popover is actually opening.
    outsideWindow = triggerRef.value?.ownerDocument.defaultView ?? window;
    outsideWindow.addEventListener("pointerdown", onOutsidePointer, true);
    // Keep the popover anchored to the swatch as the body scrolls / window resizes.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
  });
}
function closePopover(): void {
  if (!open.value) return;
  open.value = false;
  (outsideWindow ?? window).removeEventListener("pointerdown", onOutsidePointer, true);
  outsideWindow = null;
  window.removeEventListener("scroll", reposition, true);
  window.removeEventListener("resize", reposition);
}
function toggle(): void {
  if (open.value) closePopover();
  else openPopover();
}
onBeforeUnmount(closePopover);

function onChannel(channel: "l" | "c" | "h", value: number | null): void {
  const n = value ?? 0;
  if (channel === "l") l.value = n;
  else if (channel === "c") c.value = n;
  else h.value = n;
  emit("change", formatCss({ mode: "oklch", l: l.value, c: c.value, h: h.value }));
}

// Native visual picker → convert the chosen sRGB hex to OKLCH (the user picked an
// sRGB color, so gamut-mapping to it is the intent, not corruption) and sync the
// fine-tune channels.
function onNativePick(event: Event): void {
  const hex = (event.target as HTMLInputElement).value;
  const oklch = toOklch(hex);
  if (!oklch) return;
  l.value = round(oklch.l ?? 0, 4);
  c.value = round(oklch.c ?? 0, 4);
  h.value = Math.round(oklch.h ?? 0);
  parsedOklch.value = true;
  hexSeed.value = hex;
  emit("change", formatCss({ mode: "oklch", l: l.value, c: c.value, h: h.value }));
}

function commitAdvanced(): void {
  const v = advanced.value.trim();
  if (!TokenValueSchema.safeParse(v).success) {
    advancedError.value = true;
    return;
  }
  advancedError.value = false;
  emit("change", v);
}
</script>

<template>
  <div class="inline-flex">
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -- custom color swatch trigger (mirrors ui/ColorSwatchPicker); not a Button surface -->
    <button
      ref="triggerRef"
      type="button"
      :aria-label="label"
      :title="resolvedValue"
      :class="
        cn(
          'size-6 rounded-md border transition-shadow',
          'focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-1 focus-visible:outline-none',
          edited ? 'border-foreground' : 'border-border hover:border-foreground/60',
        )
      "
      :style="{ backgroundColor: resolvedValue }"
      @click="toggle"
    />

    <Teleport :to="overlayTarget">
      <div
        v-if="open"
        ref="popoverRef"
        :style="popStyle"
        class="border-border bg-surface-raised flex flex-col gap-2 rounded-md border p-3 shadow-lg"
      >
        <span class="text-faint text-[10px] tracking-wider uppercase">Pick a color</span>
        <!-- eslint-disable-next-line vue/no-restricted-html-elements -- native visual color picker; the chosen sRGB hex is converted to OKLCH on pick -->
        <input
          type="color"
          :value="hexSeed"
          class="border-border h-8 w-full cursor-pointer rounded-md border bg-transparent p-0"
          aria-label="Pick a color"
          @input="onNativePick"
        />

        <span class="text-faint mt-1 text-[10px] tracking-wider uppercase">OKLCH (fine-tune)</span>
        <label class="flex items-center gap-2 text-xs">
          <span class="text-muted w-12 shrink-0">L · light</span>
          <InputNumber
            :model-value="l"
            :min="0"
            :max="1"
            :step="0.01"
            :max-fraction-digits="4"
            fluid
            @update:model-value="(v: number | null) => onChannel('l', v)"
          />
        </label>
        <label class="flex items-center gap-2 text-xs">
          <span class="text-muted w-12 shrink-0">C · chroma</span>
          <InputNumber
            :model-value="c"
            :min="0"
            :max="0.4"
            :step="0.005"
            :max-fraction-digits="4"
            fluid
            @update:model-value="(v: number | null) => onChannel('c', v)"
          />
        </label>
        <label class="flex items-center gap-2 text-xs">
          <span class="text-muted w-12 shrink-0">H · hue</span>
          <InputNumber
            :model-value="h"
            :min="0"
            :max="360"
            :step="1"
            fluid
            @update:model-value="(v: number | null) => onChannel('h', v)"
          />
        </label>
        <p v-if="!parsedOklch" class="text-faint text-[10px] leading-snug">
          Current value isn't OKLCH — edit it raw below, or use the channels above to overwrite.
        </p>

        <span class="text-faint mt-1 text-[10px] tracking-wider uppercase">Advanced</span>
        <Input
          v-model="advanced"
          :invalid="advancedError"
          :title="advancedError ? 'Invalid or unsafe value' : 'oklch(), color-mix(), var(), #hex…'"
          spellcheck="false"
          @keyup.enter="commitAdvanced"
          @blur="commitAdvanced"
        />
      </div>
    </Teleport>
  </div>
</template>
