/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  readonly VITE_WS_URL?: string
  readonly VITE_DEFAULT_MAP_CENTER_LAT?: string
  readonly VITE_DEFAULT_MAP_CENTER_LON?: string
  readonly VITE_DEFAULT_MAP_ZOOM?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
