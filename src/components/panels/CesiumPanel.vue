<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";

import { Cartesian3 } from "cesium";
import { onBeforeUnmount, onMounted, ref } from "vue";

import { useCesium } from "@/composables/useCesium";
import { usePanelApi } from "@/composables/usePanelApi";
import { usePanelState } from "@/composables/usePanelState";
import { registerPanelInstance, unregisterPanelInstance } from "@/modules/panels/instances";

/**
 * Cesium camera pose persisted across minimize→restore (and reload), mirroring the
 * 2D map's `usePanelState` round-trip. Stored as cartographic lon/lat (radians) +
 * height (metres) + heading/pitch/roll (radians) — portable and human-readable.
 */
interface CesiumState extends Record<string, unknown> {
  lon: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
}

const props = defineProps<PanelApiProps>();

// dockview-vue passes the panel api inside the `params` bag — see usePanelApi.
const { api } = usePanelApi(props);

const container = ref<HTMLDivElement | null>(null);
const { mount } = useCesium();

onMounted(() => {
  if (!container.value) return;
  const instance = mount(container.value);
  const panelApi = api.value;

  // Cache the pose on `moveEnd` while the viewer is ALIVE; `serialize` returns the
  // cache rather than reading the viewer. This matters because `useCesium`'s
  // `onBeforeUnmount(destroy)` is registered first and so tears the viewer down
  // BEFORE `usePanelState`'s flush hook runs — reading it there would throw / wipe.
  let lastCamera: CesiumState | undefined;
  const capture = (): void => {
    if (instance.isDestroyed()) return;
    const c = instance.camera;
    const p = c.positionCartographic;
    lastCamera = {
      lon: p.longitude,
      lat: p.latitude,
      height: p.height,
      heading: c.heading,
      pitch: c.pitch,
      roll: c.roll,
    };
  };

  let restored = false;
  if (panelApi) {
    registerPanelInstance(panelApi.id, instance);
    const { save } = usePanelState<CesiumState>(panelApi.id, {
      serialize: () => lastCamera ?? ({} as CesiumState),
      restore: (state) => {
        // Seeded panels persist `{}`; a present-but-partial state must NOT be
        // half-applied (NaN into setView). Require every field before restoring.
        const { lon, lat, height, heading, pitch, roll } = state;
        if (
          ![lon, lat, height, heading, pitch, roll].every(
            (n) => typeof n === "number" && Number.isFinite(n),
          )
        ) {
          return; // fall through to the default camera below
        }
        instance.camera.setView({
          destination: Cartesian3.fromRadians(lon, lat, height),
          orientation: { heading, pitch, roll },
        });
        restored = true;
      },
    });
    // `moveEnd` (the 2D map's `moveend` analog) fires when a user pan/zoom/tilt/
    // rotate settles; cache the pose then persist (debounced + flushed on unmount).
    instance.camera.moveEnd.addEventListener(() => {
      capture();
      save();
    });
    // `changed` (threshold-based) backstops `moveEnd` through inertial settling: it
    // keeps re-capturing as the camera coasts to rest, so the debounced persist lands
    // on the FINAL pose even if `moveEnd` fired slightly early. Lowered threshold for
    // finer tracking (default 0.5 = 50%).
    instance.camera.percentageChanged = 0.1;
    instance.camera.changed.addEventListener(() => {
      capture();
      save();
    });
  }

  // Default camera only on a FIRST mount with no persisted pose — looking down on
  // the demo area (lon 70 / lat 30, ~5000 km alt). A restored pose wins.
  if (!restored) {
    instance.camera.setView({ destination: Cartesian3.fromDegrees(70, 30, 5_000_000) });
  }

  // Two demo entities so the panel isn't empty on first paint. Real symbology
  // (milsymbol billboards) lights up in Phase 6 when the symbology module is wired.
  instance.entities.add({
    id: "demo-alpha",
    name: "Alpha",
    position: Cartesian3.fromDegrees(70.5, 30.2),
    point: { pixelSize: 10 },
  });
  instance.entities.add({
    id: "demo-bravo",
    name: "Bravo",
    position: Cartesian3.fromDegrees(69.5, 29.7),
    point: { pixelSize: 10 },
  });
});

onBeforeUnmount(() => {
  const panelApi = api.value;
  if (panelApi) unregisterPanelInstance(panelApi.id);
});
</script>

<template>
  <div ref="container" class="bg-brand-950 h-full w-full" data-testid="cesium-container" />
</template>
