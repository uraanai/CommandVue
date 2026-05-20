// milsymbol 3.x is ESM-only (`"type": "module"`) but exports only `ms` as
// default. The class lives at `ms.Symbol` (the .d.ts file's `export class
// Symbol` declaration is misleading — there is no top-level named export).
import ms from "milsymbol";

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
 *
 * IMPORTANT: only include keys in the options object when the caller actually
 * supplied them. Passing `outlineWidth: undefined` (or any other explicit
 * `undefined`) corrupts milsymbol's internal layout math — `asSVG()` then
 * returns `width="NaN" height="NaN" viewBox="X Y NaN NaN"` with all colors
 * stripped. "Not specified" must be expressed by leaving the key off, not by
 * setting it to `undefined`.
 */
export function renderSidcToSvg(sidc: string, options: RenderOptions = {}): string {
  const symbolOptions: Record<string, number | string | undefined> = {
    size: options.size ?? 32,
  };
  if (options.fillColor !== undefined) symbolOptions.fillColor = options.fillColor;
  if (options.iconColor !== undefined) symbolOptions.iconColor = options.iconColor;
  if (options.monoColor !== undefined) symbolOptions.monoColor = options.monoColor;
  if (options.outlineColor !== undefined) symbolOptions.outlineColor = options.outlineColor;
  if (options.outlineWidth !== undefined) symbolOptions.outlineWidth = options.outlineWidth;
  return new ms.Symbol(sidc, symbolOptions).asSVG();
}

/** Render to a base64 data URL — useful when you need an `<img>` source. */
export function renderSidcToDataUrl(sidc: string, options: RenderOptions = {}): string {
  const svg = renderSidcToSvg(sidc, options);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
