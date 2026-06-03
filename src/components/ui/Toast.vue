<script setup lang="ts">
import type { Component } from "vue";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "@lucide/vue";
import PvToast, { type ToastPassThroughOptions } from "primevue/toast";

import { severityAccentClass, type ToastPosition } from "@/components/ui/toastTheme";
import { cn } from "@/utils/cn";

/**
 * Toast outlet. Wraps `primevue/toast` and renders a modern, neutral-surface
 * card (Sonner / Linear style — no colored bar): a small severity-tinted Lucide
 * icon, a semibold title + muted detail, and a subtle close button. Colors come
 * from the `--color-toast-*` / `--color-status-*` theme tokens (Track A A1b/
 * A-Toast), so a theme recolors every toast.
 *
 * Not mounted directly — `NotificationOutlets.vue` (in `AppShell`, alongside
 * `<ConfirmDialog/>`) renders one `<Toast>` per position+group, and producers
 * fire via `useNotify()`.
 *
 * Two unstyled-mode fixes live here:
 *   - **Centering.** PrimeVue emits the position anchor (`top/left: 50%`) but
 *     not the `translate(-50%, -50%)` that styled mode adds, so center / *-center
 *     outlets would sit left-anchored. The position-aware `root` re-adds the
 *     translate.
 *   - **Transitions.** Inside PrimeVue's Portal the message `<TransitionGroup>`
 *     never advances past `enter-from`, so any enter-from styling sticks (toast
 *     renders invisible) and removal lingers. `transition: { css: false }` makes
 *     appear/dismiss instant + reliable; animated transitions are a follow-up.
 */
withDefaults(
  defineProps<{
    position?: ToastPosition;
    group?: string;
    baseZIndex?: number;
    autoZIndex?: boolean;
  }>(),
  { position: "bottom-right", group: undefined, baseZIndex: 9000, autoZIndex: true },
);

const SEVERITY_ICON: Record<string, Component> = {
  success: CircleCheck,
  info: Info,
  warn: TriangleAlert,
  error: CircleAlert,
};
const iconFor = (severity: string | undefined): Component => SEVERITY_ICON[severity ?? ""] ?? Info;

/** Per-position exit keyframe (defined in main.css). Enter is a mount animation
 *  on the card; exit can't use Vue's transition classes (they don't advance in
 *  the Portal), so a JS leave hook applies these and defers removal. */
const LEAVE_ANIM: Record<string, string> = {
  "top-right": "cv-toast-out-right",
  "bottom-right": "cv-toast-out-right",
  "top-left": "cv-toast-out-left",
  "bottom-left": "cv-toast-out-left",
  "top-center": "cv-toast-out-top",
  "bottom-center": "cv-toast-out-bottom",
  center: "cv-toast-out-scale",
};

/** Vue `onLeave` hook: play the position's exit animation, then resolve so
 *  PrimeVue removes the element. Honors reduced-motion (removes instantly). */
function animateLeave(el: Element, done: () => void): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return;
  }
  const pos =
    el.closest("[data-cv-toast-pos]")?.getAttribute("data-cv-toast-pos") ?? "bottom-right";
  const node = el as HTMLElement;
  let settled = false;
  const finish = (): void => {
    if (settled) return;
    settled = true;
    done();
  };
  node.style.animation = `${LEAVE_ANIM[pos] ?? "cv-toast-out-bottom"} 150ms ease-in forwards`;
  node.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, 260); // fallback if animationend doesn't fire
}

const pt: ToastPassThroughOptions = {
  // Position-aware outlet container. `pointer-events-none` so empty regions
  // never block clicks; the message re-enables them. The translate centers the
  // center / *-center outlets (unstyled mode drops PrimeVue's transform).
  root: ({ props }) => ({
    class: cn(
      "pointer-events-none fixed z-[9000] w-[380px] max-w-[calc(100vw-2rem)] p-4",
      props.position === "center" && "-translate-x-1/2 -translate-y-1/2",
      (props.position === "top-center" || props.position === "bottom-center") && "-translate-x-1/2",
    ),
    // Drives the position-aware enter/leave animation (CSS in main.css).
    "data-cv-toast-pos": props.position,
  }),
  // The card.
  message: {
    class: cn(
      "pointer-events-auto rounded-lg border border-[var(--color-toast-border)] bg-[var(--color-toast-bg)] px-4 py-3 text-[var(--color-toast-fg)] shadow-lg",
    ),
  },
  // The flex row: [icon] [text] [close].
  messageContent: { class: "flex items-start gap-2.5" },
  buttonContainer: { class: "-mt-1.5 -mr-1.5 shrink-0" },
  closeButton: {
    class: cn(
      "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--color-toast-fg)] opacity-50 transition",
      "hover:bg-surface-sunken hover:opacity-100",
      "focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:outline-none",
    ),
  },
  closeIcon: { class: "size-4" },
  // `css:false` — inside PrimeVue's Portal, Vue's TransitionGroup never advances
  // its enter/leave *classes* (the message would stick invisible and never get
  // removed). So ENTER is a browser-native CSS animation on the message card
  // (main.css, plays on mount) and EXIT is the `onLeave` JS hook below, which
  // plays the out-animation and defers removal until it ends. Both keyed off
  // `data-cv-toast-pos`.
  transition: { css: false, onLeave: animateLeave },
};
</script>

<template>
  <PvToast
    :position="position"
    :group="group"
    :base-z-index="baseZIndex"
    :auto-z-index="autoZIndex"
    :pt="pt"
  >
    <template #message="{ message }">
      <component
        :is="iconFor(message.severity)"
        :size="18"
        :stroke-width="2.25"
        :class="cn('mt-0.5 shrink-0', severityAccentClass(message.severity))"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <p class="text-sm leading-5 font-semibold text-[var(--color-toast-fg)]">
          {{ message.summary }}
        </p>
        <p
          v-if="message.detail"
          class="mt-0.5 text-[0.8125rem] leading-5 text-[var(--color-toast-fg)] opacity-70"
        >
          {{ message.detail }}
        </p>
      </div>
    </template>
  </PvToast>
</template>
