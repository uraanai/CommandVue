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
 *   - **Animations.** Inside PrimeVue's Portal Vue's TransitionGroup classes
 *     never advance (the message sticks invisible / never removes) and its FLIP
 *     `move` reflow is disabled with them, so `transition: { css: false }` turns
 *     them off and `animateEnter`/`animateLeave` (Web Animations API) drive the
 *     slide/fade + a height grow/collapse — the height change is what makes the
 *     surrounding stack reflow smoothly instead of snapping when a toast closes.
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

/**
 * Enter/leave animations.
 *
 * Inside PrimeVue's Portal, Vue's TransitionGroup CSS transitions never advance
 * (the message sticks invisible / never removes) and its `move` (FLIP) reflow is
 * disabled with them — so a closing toast's neighbors would SNAP to their new
 * positions. We drive both via the Web Animations API in JS hooks
 * (`transition: { css: false, onEnter, onLeave }`), and animate the card's
 * **height** alongside the slide/fade: as a leaving card collapses to 0 (and a
 * new card grows from 0), the surrounding stack reflows smoothly rather than
 * jumping. Direction is per-position (slides toward the docked edge; center
 * scales) via `data-cv-toast-pos` on the outlet root. Reduced-motion → instant.
 */
const GAP = "0.625rem"; // matches the stacking gap in main.css

/** The off-edge transform a toast enters from / leaves toward, per position. */
const SLIDE: Record<string, string> = {
  "top-right": "translateX(1rem)",
  "bottom-right": "translateX(1rem)",
  "top-left": "translateX(-1rem)",
  "bottom-left": "translateX(-1rem)",
  "top-center": "translateY(-0.75rem)",
  "bottom-center": "translateY(0.75rem)",
  center: "scale(0.96)",
};

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const slideFor = (el: Element): string => {
  const pos =
    el.closest("[data-cv-toast-pos]")?.getAttribute("data-cv-toast-pos") ?? "bottom-right";
  return SLIDE[pos] ?? "translateY(0.75rem)";
};

/** Vue `onEnter`: grow height from 0 + slide + fade in. */
function animateEnter(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  const node = el as HTMLElement;
  const off = slideFor(el);
  const h = node.offsetHeight;
  node.style.overflow = "hidden";
  const anim = node.animate(
    [
      { opacity: 0, transform: off, maxHeight: "0px", marginBottom: `-${GAP}` },
      { opacity: 1, transform: "none", maxHeight: `${h}px`, marginBottom: "0px" },
    ],
    { duration: 240, easing: "cubic-bezier(0.21, 1.02, 0.73, 1)", fill: "backwards" },
  );
  let settled = false;
  const finish = (): void => {
    if (settled) return;
    settled = true;
    node.style.overflow = "";
    node.style.maxHeight = "";
    done();
  };
  anim.onfinish = finish;
  window.setTimeout(finish, 360);
}

/** Vue `onLeave`: collapse height to 0 + slide + fade out, then remove. The
 *  height/margin collapse is what makes the rest of the stack reflow smoothly. */
function animateLeave(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  const node = el as HTMLElement;
  const off = slideFor(el);
  const h = node.offsetHeight;
  node.style.overflow = "hidden";
  node.animate(
    [
      { opacity: 1, transform: "none", maxHeight: `${h}px`, marginBottom: "0px" },
      { opacity: 0, transform: off, maxHeight: "0px", marginBottom: `-${GAP}` },
    ],
    { duration: 200, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
  ).onfinish = done;
  window.setTimeout(done, 340); // fallback if onfinish doesn't fire
}

const pt: ToastPassThroughOptions = {
  // Position-aware outlet container. `pointer-events-none` so empty regions
  // never block clicks; the message re-enables them. The translate centers the
  // center / *-center outlets (unstyled mode drops PrimeVue's transform).
  root: ({ props }) => ({
    class: cn(
      "pointer-events-none fixed z-[9000] w-[368px] max-w-[calc(100vw-1.5rem)] p-3",
      props.position === "center" && "-translate-x-1/2 -translate-y-1/2",
      (props.position === "top-center" || props.position === "bottom-center") && "-translate-x-1/2",
    ),
    // Selects the enter/leave animation direction (WAAPI hooks below).
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
  // `css:false` disables Vue's (Portal-broken) CSS transition + move classes;
  // `animateEnter`/`animateLeave` drive enter/leave (incl. the height
  // collapse/grow that makes the stack reflow smoothly) via the Web Animations
  // API. See the hook definitions above.
  transition: { css: false, onEnter: animateEnter, onLeave: animateLeave },
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
