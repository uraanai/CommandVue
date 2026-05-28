/**
 * Linear-style theme generation engine.
 *
 * Takes 3–4 high-level inputs (base color, accent color, contrast, plus mode /
 * density / optional font) and emits the full semantic token set — surfaces,
 * text, borders, the interactive scale, status colors, the backwards-compat
 * aliases, and the color-bearing component overrides. All color math runs in
 * OKLCH for perceptual uniformity; accessibility is *computed* (a binary search
 * solves text/border lightness to hit a target WCAG ratio) rather than
 * eyeballed.
 *
 * What this engine deliberately does NOT emit:
 *   - `--density-*` tokens — density is applied via the `data-density`
 *     attribute (see `apply.ts` + the `[data-density]` blocks in tokens.css).
 *     Emitting them here would override the cascade and break density switching.
 *   - sizing / radius / font-size component tokens — those cascade from the
 *     density layer and the themeable primitives.
 *
 * Surface-elevation model (refines the prompt's self-contradictory text to
 * match the shipped built-ins, which is the internally-coherent choice):
 *   - Light mode: elevation gets *brighter* (base off-white → raised whiter →
 *     overlay whitest); sunken is darker than base.
 *   - Dark mode: elevation gets *lighter* (base deep-gray → raised → overlay);
 *     sunken is darker than base. Base never reaches pure black.
 *
 * See `docs/theme-generation-algorithm.md` for the full per-scale reference and
 * the Linear blog post that inspired the approach.
 */

import type { Theme, ThemeDensity, ThemeMode } from "@/types/theme";
import type { Oklch } from "culori";

import { clampChroma, converter, inGamut, wcagContrast } from "culori";

const toOklch = converter("oklch");
const isInSrgb = inGamut("rgb");

/** Inputs to {@link generateTheme}. `name`/`description` are metadata the caller
 *  attaches to the resulting {@link Theme}; they don't affect token math. */
export interface ThemeGenerationInput {
  /** Any CSS color; normalized to OKLCH. Drives surface hue + tint. */
  baseColor: string;
  /** Any CSS color; normalized to OKLCH. Drives the interactive scale. */
  accentColor: string;
  /** 30–100. Higher → larger text/surface contrast (steeper WCAG target). */
  contrast: number;
  mode: ThemeMode;
  density: ThemeDensity;
  /** Optional font stack; when present, overrides `--font-family-sans/-body`. */
  fontFamily?: string;
  name: string;
  description?: string;
}

/** One checked color pair and whether it cleared its required ratio. */
export interface ContrastCheck {
  pair: string;
  ratio: number;
  required: number;
}

export interface ThemeContrastReport {
  /** text-primary on surface-base. */
  textOnSurface: number;
  /** text-primary on surface-raised. */
  textOnRaised: number;
  /** on-interactive on interactive. */
  onInteractive: number;
  /** Checks that fell below their required ratio (empty = fully accessible). */
  failures: ContrastCheck[];
}

export interface ThemeGenerationResult {
  tokens: Record<string, string>;
  contrastReport: ThemeContrastReport;
}

// --- OKLCH helpers ----------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Build a gamut-mapped OKLCH color. Chroma is reduced (hue + lightness
 *  preserved) until the color is displayable in sRGB, so every emitted token is
 *  guaranteed in-gamut. `clampChroma` only gets "roughly" in gamut (it uses a
 *  jnd tolerance), so we tighten with a strict `inGamut` step afterward. */
function oklch(l: number, c: number, h: number, alpha?: number): Oklch {
  const L = clamp(l, 0, 1);
  const mapped = clampChroma({ mode: "oklch", l: L, c: Math.max(0, c), h }, "oklch", "rgb");
  let cc = mapped.c ?? 0;
  for (let i = 0; i < 80 && cc > 0 && !isInSrgb({ mode: "oklch", l: L, c: cc, h }); i++) {
    cc -= 0.002;
  }
  const color: Oklch = { mode: "oklch", l: L, c: Math.max(0, cc), h };
  if (alpha !== undefined) color.alpha = alpha;
  return color;
}

/** Format an OKLCH color as a compact `oklch(...)` CSS string. Chroma is
 *  floored (never rounded up) so the printed value can't drift out of gamut. */
function css(color: Oklch): string {
  const l = Math.round((color.l ?? 0) * 1e4) / 1e4;
  const c = Math.floor((color.c ?? 0) * 1e4) / 1e4;
  const h = Math.round((color.h ?? 0) * 1e2) / 1e2;
  return color.alpha !== undefined && color.alpha < 1
    ? `oklch(${l} ${c} ${h} / ${color.alpha})`
    : `oklch(${l} ${c} ${h})`;
}

/**
 * Binary-search the lightness that makes a near-neutral color hit `target`
 * WCAG contrast against `surface`. Contrast is monotonic in L on each side of
 * the surface, so bisection converges. In light mode the result sits below the
 * surface lightness (darker); in dark mode, above it (lighter).
 */
function solveForContrast(
  surface: Oklch,
  target: number,
  dark: boolean,
  hue: number,
  chroma: number,
): Oklch {
  const sl = surface.l ?? (dark ? 0.15 : 0.97);
  let lo = dark ? sl : 0;
  let hi = dark ? 1 : sl;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    const ratio = wcagContrast(oklch(mid, chroma, hue), surface);
    if (dark) {
      // contrast increases with L (lighter text on a dark surface)
      if (ratio < target) lo = mid;
      else hi = mid;
    } else {
      // contrast decreases with L (darker text on a light surface)
      if (ratio > target) lo = mid;
      else hi = mid;
    }
  }
  return oklch((lo + hi) / 2, chroma, hue);
}

/** Map the 30–100 contrast scale to a target WCAG ratio (4.5:1 → 12:1). */
function contrastTarget(contrast: number): number {
  const t = clamp(contrast, 30, 100);
  return 4.5 + ((t - 30) / 70) * (12 - 4.5);
}

/**
 * Solve the lightest near-black text that still clears AA on a (light)
 * interactive color. Used only when white button text can't reach 4.5:1 — e.g.
 * yellow/amber accents, which read better with dark text anyway. A valid
 * solution always exists: the white- and black-contrast curves cross at
 * ~4.58:1, so whenever white falls short, black-ward text clears.
 */
function solveDarkText(interactive: Oklch, hue: number): Oklch {
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (wcagContrast(oklch(mid, 0, hue), interactive) >= 4.5) lo = mid;
    else hi = mid;
  }
  return oklch(lo, 0, hue);
}

// Fixed semantic hue families for status colors (OKLCH degrees).
const STATUS_HUES = { success: 145, warning: 75, danger: 27, info: 250 } as const;

/**
 * Generate a complete theme from high-level inputs.
 *
 * @throws if `baseColor` or `accentColor` can't be parsed as a CSS color.
 */
export function generateTheme(input: ThemeGenerationInput): ThemeGenerationResult {
  const base = toOklch(input.baseColor);
  const accent = toOklch(input.accentColor);
  if (!base) throw new Error(`Invalid base color: "${input.baseColor}"`);
  if (!accent) throw new Error(`Invalid accent color: "${input.accentColor}"`);

  const dark = input.mode === "dark";
  const baseHue = base.h ?? 0;
  const baseC = base.c ?? 0;
  const accentHue = accent.h ?? baseHue;
  const target = contrastTarget(input.contrast);

  // --- Surfaces: elevation brightens (light) / lightens (dark). -------------
  // Surfaces stay near-neutral; carry only a whisper of the base hue's chroma.
  const surfChroma = Math.min(baseC, dark ? 0.03 : 0.02);
  const baseL = dark ? clamp(base.l ?? 0.16, 0.14, 0.2) : clamp(base.l ?? 0.97, 0.93, 0.98);
  const surfaceBase = oklch(baseL, surfChroma, baseHue);
  const surfaceRaised = oklch(dark ? baseL + 0.03 : Math.min(baseL + 0.02, 1), surfChroma, baseHue);
  const surfaceOverlay = oklch(
    dark ? baseL + 0.05 : Math.min(baseL + 0.035, 1),
    surfChroma,
    baseHue,
  );
  const surfaceSunken = oklch(dark ? baseL - 0.02 : baseL - 0.04, surfChroma, baseHue);

  // Anchor text/border contrast against the worst-case surface they sit on:
  // the darkest of {base,raised,overlay} in light mode (base), the lightest in
  // dark mode (overlay). Guarantees the AA target everywhere, not just on base.
  const textAnchor = dark ? surfaceOverlay : surfaceBase;
  const textHue = baseHue;
  const textChroma = 0.008;

  // --- Text: solved for target contrast, dimmer steps use lower targets. ----
  const textPrimary = solveForContrast(textAnchor, target, dark, textHue, textChroma);
  const textSecondary = solveForContrast(textAnchor, target * 0.75, dark, textHue, textChroma);
  const textTertiary = solveForContrast(textAnchor, target * 0.6, dark, textHue, textChroma);
  const textDisabled = solveForContrast(
    textAnchor,
    Math.max(target * 0.45, 1.9),
    dark,
    textHue,
    textChroma,
  );
  const textInverse = oklch(dark ? 0.15 : 0.98, 0.004, baseHue);

  // --- Borders: subtle < default(3:1) < strong, anchored to surface-base. ---
  const borderChroma = 0.012;
  const borderSubtle = solveForContrast(surfaceBase, 1.5, dark, baseHue, borderChroma);
  const borderDefault = solveForContrast(surfaceBase, 3.0, dark, baseHue, borderChroma);
  const borderStrong = solveForContrast(surfaceBase, 4.5, dark, baseHue, borderChroma);

  // --- Interactive: from the accent, tuned for legibility in the mode. ------
  // Bias toward white button text: derive the interactive lightness by
  // darkening the accent (down to a floor) until white clears AA. Genuinely
  // light accents (e.g. yellow) keep their lightness and get solved dark text.
  const interChroma = clamp(accent.c ?? 0.15, 0.08, 0.2);
  const interStartL = dark
    ? clamp(accent.l ?? 0.62, 0.5, 0.64)
    : clamp(accent.l ?? 0.55, 0.45, 0.62);
  const whiteText = oklch(0.99, 0, accentHue);
  let interL = interStartL;
  for (
    let i = 0;
    i < 40 && interL > 0.42 && wcagContrast(whiteText, oklch(interL, interChroma, accentHue)) < 4.5;
    i++
  ) {
    interL -= 0.01;
  }
  const interactive = oklch(interL, interChroma, accentHue);
  const interactiveHover = oklch(dark ? interL + 0.07 : interL - 0.07, interChroma, accentHue);
  const interactiveActive = oklch(dark ? interL + 0.13 : interL - 0.13, interChroma, accentHue);
  const interactiveSubtle = oklch(
    dark ? 0.26 : 0.95,
    Math.min(interChroma, dark ? 0.05 : 0.04),
    accentHue,
  );
  const onInteractive =
    wcagContrast(whiteText, interactive) >= 4.5 ? whiteText : solveDarkText(interactive, accentHue);
  const focusRing = interactive;

  // --- Status: fixed hue families, mode-tuned L/C, each with a subtle. ------
  const statusL = dark ? 0.68 : 0.55;
  const statusC = dark ? 0.15 : 0.16;
  const subtleL = dark ? 0.27 : 0.95;
  const subtleC = dark ? 0.055 : 0.045;
  const status = (hue: number) => oklch(statusL, statusC, hue);
  const statusSubtle = (hue: number) => oklch(subtleL, subtleC, hue);

  // --- Accent scale (50–900) ------------------------------------------------
  // The existing UI primitives (Button, IconButton, Input, Select, Tabs,
  // Menubar, DataTable, ColorPicker, dockview borders) consume the
  // `--color-accent-*` aliases that `tokens.css` defines pointing at
  // `--color-blue-*`. The six built-in themes don't override the scale (their
  // interactive accent is also blue, so the default alias matches by
  // coincidence); a generated theme with any non-blue accent would otherwise
  // leave every wrapper visually stuck on the default blue.
  //
  // We derive the full scale from the user's accent hue + chroma, varying
  // lightness across a perceptually-balanced curve. Chroma is capped at the
  // extremes (very light + very dark) since saturated colors in those bands
  // tend to fall out of sRGB; the engine's gamut clamp handles whatever's
  // left over.
  const accentScale: Array<{ step: number; l: number; cCap: number }> = [
    { step: 50, l: 0.97, cCap: 0.03 },
    { step: 100, l: 0.93, cCap: 0.05 },
    { step: 200, l: 0.86, cCap: 0.09 },
    { step: 300, l: 0.77, cCap: 0.13 },
    { step: 400, l: 0.68, cCap: 0.18 },
    { step: 500, l: 0.6, cCap: 0.22 },
    { step: 600, l: 0.52, cCap: 0.22 },
    { step: 700, l: 0.45, cCap: 0.18 },
    { step: 800, l: 0.36, cCap: 0.14 },
    { step: 900, l: 0.28, cCap: 0.1 },
  ];
  const accentBaseC = accent.c ?? 0.15;
  const accentColors: Record<string, string> = {};
  for (const { step, l, cCap } of accentScale) {
    accentColors[`--color-accent-${step}`] = css(oklch(l, Math.min(accentBaseC, cCap), accentHue));
  }

  // --- Assemble. -------------------------------------------------------------
  const tokens: Record<string, string> = {
    // Surfaces
    "--color-surface-base": css(surfaceBase),
    "--color-surface-raised": css(surfaceRaised),
    "--color-surface-overlay": css(surfaceOverlay),
    "--color-surface-sunken": css(surfaceSunken),
    // Borders
    "--color-border-subtle": css(borderSubtle),
    "--color-border-default": css(borderDefault),
    "--color-border-strong": css(borderStrong),
    // Text
    "--color-text-primary": css(textPrimary),
    "--color-text-secondary": css(textSecondary),
    "--color-text-tertiary": css(textTertiary),
    "--color-text-disabled": css(textDisabled),
    "--color-text-inverse": css(textInverse),
    // Interactive
    "--color-interactive": css(interactive),
    "--color-interactive-hover": css(interactiveHover),
    "--color-interactive-active": css(interactiveActive),
    "--color-interactive-subtle": css(interactiveSubtle),
    "--color-on-interactive": css(onInteractive),
    // Status
    "--color-status-success": css(status(STATUS_HUES.success)),
    "--color-status-success-subtle": css(statusSubtle(STATUS_HUES.success)),
    "--color-status-warning": css(status(STATUS_HUES.warning)),
    "--color-status-warning-subtle": css(statusSubtle(STATUS_HUES.warning)),
    "--color-status-danger": css(status(STATUS_HUES.danger)),
    "--color-status-danger-subtle": css(statusSubtle(STATUS_HUES.danger)),
    "--color-status-info": css(status(STATUS_HUES.info)),
    "--color-status-info-subtle": css(statusSubtle(STATUS_HUES.info)),
    // Focus
    "--color-focus-ring": css(focusRing),
    // Accent scale 50–900 — overrides the `tokens.css` blue aliases so every
    // UI primitive that reads `bg-accent-500` / `var(--color-accent-*)` (Button,
    // Input, Select, Tabs, Menubar, DataTable, dockview, …) follows the user's
    // accent. Derived above; spread in here.
    ...accentColors,
    // Backwards-compat aliases (old utility classes still read these).
    "--color-surface": css(surfaceBase),
    "--color-foreground": css(textPrimary),
    "--color-muted": css(textSecondary),
    "--color-faint": css(textTertiary),
    "--color-border": css(borderDefault),
    "--color-success": css(status(STATUS_HUES.success)),
    "--color-warning": css(status(STATUS_HUES.warning)),
    "--color-danger": css(status(STATUS_HUES.danger)),
    "--color-info": css(status(STATUS_HUES.info)),
    // Component color overrides (sizes/radii cascade from density/primitives).
    "--datatable-header-bg": css(surfaceRaised),
    "--datatable-header-fg": css(textSecondary),
    "--datatable-row-hover-bg": css(surfaceSunken),
    "--datatable-row-selected-bg": css(interactiveSubtle),
    "--menubar-bg": css(surfaceRaised),
    "--menubar-fg": css(textPrimary),
    "--menubar-item-hover-bg": css(interactiveSubtle),
    "--statusbar-bg": css(surfaceRaised),
    "--statusbar-fg": css(textSecondary),
    "--dockpanel-bg": css(surfaceBase),
    "--dockpanel-tab-bg": css(surfaceSunken),
    "--dockpanel-tab-active-bg": css(surfaceBase),
    "--dialog-bg": css(surfaceOverlay),
    "--dialog-backdrop": css(oklch(0.15, 0, baseHue, 0.45)),
    "--tooltip-bg": css(textPrimary),
    "--tooltip-text": css(surfaceBase),
  };

  if (input.fontFamily) {
    tokens["--font-family-sans"] = input.fontFamily;
    tokens["--font-family-body"] = input.fontFamily;
  }

  // --- Contrast report. ------------------------------------------------------
  const textOnSurface = wcagContrast(textPrimary, surfaceBase);
  const textOnRaised = wcagContrast(textPrimary, surfaceRaised);
  const onInteractiveRatio = wcagContrast(onInteractive, interactive);
  const checks: ContrastCheck[] = [
    { pair: "text-primary/surface-base", ratio: textOnSurface, required: 4.5 },
    { pair: "text-primary/surface-raised", ratio: textOnRaised, required: 4.5 },
    { pair: "on-interactive/interactive", ratio: onInteractiveRatio, required: 4.5 },
    {
      pair: "border-default/surface-base",
      ratio: wcagContrast(borderDefault, surfaceBase),
      required: 3,
    },
    { pair: "focus-ring/surface-base", ratio: wcagContrast(focusRing, surfaceBase), required: 3 },
  ];
  const round = (n: number) => Math.round(n * 100) / 100;
  const contrastReport: ThemeContrastReport = {
    textOnSurface: round(textOnSurface),
    textOnRaised: round(textOnRaised),
    onInteractive: round(onInteractiveRatio),
    // Allow a hair of float slack so a 4.50 target doesn't trip on 4.499.
    failures: checks
      .filter((c) => c.ratio < c.required - 0.02)
      .map((c) => ({ pair: c.pair, ratio: round(c.ratio), required: c.required })),
  };

  return { tokens, contrastReport };
}

/**
 * Regenerate a generated theme's opposite-mode counterpart from the same
 * inputs. This is what lets the Light/Dark/Auto toggle bridge a user-authored
 * theme: same base/accent/contrast, flipped mode, density carried over.
 *
 * @throws if `theme` is not a generated theme (no `generation` block to read).
 */
export function generatePairedVariant(theme: Theme): ThemeGenerationResult {
  if (theme.source !== "generated" || !theme.generation) {
    throw new Error("Can only pair a generated theme (missing generation block).");
  }
  const flipped: ThemeMode = theme.mode === "light" ? "dark" : "light";
  return generateTheme({
    baseColor: theme.generation.baseColor,
    accentColor: theme.generation.accentColor,
    contrast: theme.generation.contrast,
    mode: flipped,
    density: theme.density,
    name: `${theme.name} (${flipped === "dark" ? "Dark" : "Light"})`,
  });
}
