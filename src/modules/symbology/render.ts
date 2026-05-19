// Namespace import to keep Rollup's CJS interop happy — milsymbol publishes
// its exports through `module.exports`, and the named-import form trips
// Rollup's binding tracer on a production build.
import * as milsymbol from "milsymbol";

export interface RenderOptions {
  size?: number;
  fillColor?: string;
  iconColor?: string;
  monoColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
}

/**
 * Render an SIDC code to an inline SVG string suitable for `v-html`.
 * milsymbol returns sanitized, deterministic SVG, so there is no XSS risk
 * when the SIDC input is trusted application data (not free-text user input).
 */
export function renderSidcToSvg(sidc: string, options: RenderOptions = {}): string {
  return new milsymbol.Symbol(sidc, {
    size: options.size ?? 32,
    fillColor: options.fillColor,
    iconColor: options.iconColor,
    monoColor: options.monoColor,
    outlineColor: options.outlineColor,
    outlineWidth: options.outlineWidth,
  }).asSVG();
}

/** Render to a base64 data URL — useful when you need an `<img>` source. */
export function renderSidcToDataUrl(sidc: string, options: RenderOptions = {}): string {
  const svg = renderSidcToSvg(sidc, options);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
