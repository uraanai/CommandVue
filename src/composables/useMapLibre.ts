import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, type MapOptions } from "maplibre-gl";
import { onBeforeUnmount, shallowRef } from "vue";

import { OPENFREEMAP_LIBERTY } from "@/modules/maplibre/styles";

/**
 * MapLibre map composable.
 *
 * Holds the map in a `shallowRef` (same reactivity-proxy reasoning as
 * `useCesium`) and exposes imperative `mount` / `destroy` actions.
 * `destroy()` is registered with `onBeforeUnmount` so the WebGL context is
 * always released when the calling component tears down.
 *
 * Default style is OpenFreeMap Liberty; override per-mount via the options
 * argument or globally by hosting your own style.json.
 */
export function useMapLibre() {
  const map = shallowRef<MapLibreMap | null>(null);

  function mount(container: HTMLElement, options: Partial<MapOptions> = {}): MapLibreMap {
    if (map.value) {
      throw new Error("useMapLibre: map is already mounted on a container.");
    }
    const instance = new MapLibreMap({
      container,
      style: OPENFREEMAP_LIBERTY,
      center: [70, 30],
      zoom: 4,
      attributionControl: { compact: true },
      ...options,
    });
    map.value = instance;
    return instance;
  }

  function destroy(): void {
    if (map.value) {
      map.value.remove();
    }
    map.value = null;
  }

  onBeforeUnmount(destroy);

  return { map, mount, destroy };
}
