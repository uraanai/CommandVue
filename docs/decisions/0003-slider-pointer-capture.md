# ADR 0003 — Hand-rolled pointer-capture Slider (pop-out exception)

**Status:** Accepted (2026-06-06)

## Context

CommandVue's UI-primitive rule (ADR 0002) mandates PrimeVue for form controls;
the Slider was adopted via Volt at `src/volt/Slider.vue` (a thin wrapper over
`primevue/slider`). The Theme Studio's **Effects** tab (Track A C5) is the first
Studio surface to use a slider.

The Theme Studio can be **popped out** into its own browser window (dockview
`addPopoutGroup`). When it is, dockview moves the panel's DOM into the child
window but the panel's Vue code keeps running in the **opener** realm. PrimeVue's
Slider tracks a drag with listeners bound to the global `document`:

```js
// primevue 4.2.5 — slider/Slider.vue, bindDragListeners()
document.addEventListener("mousemove", this.dragListener);
document.addEventListener("mouseup", this.dragEndListener);
```

That `document` is the **opener's**. A drag performed inside the pop-out window
fires its pointer events on the _child_ window's document, which the opener's
listeners never receive — so the drag doesn't track (it "sticks", and only the
press-release registers as a click-to-position). PrimeVue 4 exposes **no prop,
PassThrough hook, or config** to redirect those listeners to the element's
`ownerDocument`, and it does not use `setPointerCapture`. (Verified against the
installed PrimeVue source.)

## Decision

Add a small **hand-rolled `src/components/ui/Slider.vue`** that drives its drag
with **pointer capture** (`element.setPointerCapture(pointerId)`), and use it in
the Effects tab instead of the Volt Slider.

Pointer capture routes every subsequent pointer event for that pointer to the
captured element **regardless of which window the element lives in** — so the
drag works identically docked and popped out, with **no `document` listeners**.
The component is ~90 lines, token-pure (`var(--…)` utilities only), and keeps the
same `v-model` + `min`/`max`/`step`/`disabled` API plus keyboard (arrows / Home /
End) and ARIA (`role="slider"`, `aria-valuemin/max/now`).

This is a **scoped exception** to the PrimeVue-first rule (ADR 0002), justified
by a concrete PrimeVue limitation with no supported workaround. It is _not_ a
precedent to hand-roll other controls.

## Consequences

- `src/volt/Slider.vue` remains for any non-pop-out usage but the Studio uses the
  hand-rolled one; new sliders should prefer `ui/Slider` so they work in pop-outs.
- The other pop-out interactive-component fixes (overlays mounting in their own
  window via `useOverlayTarget`) ship in the same PR; the Slider is the only one
  that required a replacement rather than a redirect.
- If a future PrimeVue release makes the Slider drag window-aware (or adds
  pointer capture), the Volt Slider can be reinstated and this ADR superseded.
