// `@/modules/cesium/init` must be the FIRST import — it sets
// `window.CESIUM_BASE_URL` + clears the Ion access token before any other
// Cesium module loads.
import "@/modules/cesium/init";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { ViewerOptions } from "@/modules/cesium/types";

import {
  buildModuleUrl,
  EllipsoidTerrainProvider,
  ImageryLayer,
  TileMapServiceImageryProvider,
  Viewer,
  type Viewer as ViewerType,
} from "cesium";
import { onBeforeUnmount, shallowRef } from "vue";

/**
 * Cesium viewer composable.
 *
 * Holds the viewer in a `shallowRef` (Cesium's internals break under
 * reactive proxies) and exposes imperative `mount` / `destroy` actions.
 * `destroy()` is registered with `onBeforeUnmount` so the GL context is
 * always released when the calling component tears down.
 *
 * Usage from a panel:
 *   const container = ref<HTMLDivElement | null>(null);
 *   const { viewer, mount } = useCesium();
 *   onMounted(() => container.value && mount(container.value));
 */
export function useCesium() {
  const viewer = shallowRef<ViewerType | null>(null);

  function mount(container: HTMLElement, options: Partial<ViewerOptions> = {}): ViewerType {
    if (viewer.value) {
      throw new Error("useCesium: viewer is already mounted on a container.");
    }
    // Defaults below replace Cesium's Ion-backed base layer and terrain
    // with offline-safe equivalents that ship with the cesium package:
    //   - `NaturalEarthII` low-res world tiles (under `Assets/Textures/`)
    //   - `EllipsoidTerrainProvider` (no terrain network requests)
    // Consumers wanting Ion-backed imagery / terrain can override either by
    // passing `baseLayer` or `terrainProvider` in `options` and setting a
    // valid `Ion.defaultAccessToken` earlier in their bootstrap.
    const instance = new Viewer(container, {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: ImageryLayer.fromProviderAsync(
        TileMapServiceImageryProvider.fromUrl(buildModuleUrl("Assets/Textures/NaturalEarthII")),
        {},
      ),
      terrainProvider: new EllipsoidTerrainProvider(),
      ...options,
    });
    viewer.value = instance;
    return instance;
  }

  function destroy(): void {
    if (viewer.value && !viewer.value.isDestroyed()) {
      viewer.value.destroy();
    }
    viewer.value = null;
  }

  onBeforeUnmount(destroy);

  return { viewer, mount, destroy };
}
