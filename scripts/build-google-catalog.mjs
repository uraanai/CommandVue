// @ts-check
/**
 * One-off generator for `src/assets/fonts/google-catalog.json` (Track A C3).
 *
 * This is a STATIC, hand-curated snapshot — it makes no network call and is NOT
 * wired into CI or `package.json` scripts. Re-run by hand to regenerate:
 *   node scripts/build-google-catalog.mjs
 *
 * It is a representative subset of the Google Fonts catalog (the most-used
 * families across every category), not the full ~1500. That is deliberate: it
 * keeps the bundled JSON small, every entry is hand-verified, and the picker
 * stays useful. Expand the FAMILIES table below to grow it.
 *
 * The `offline: true` families MUST set-equal `CURATED_OFFLINE_FAMILIES` in
 * `src/composables/useFontLoader.ts` (a unit test drift-guards this). Their
 * faces ship via `@fontsource*` packages imported by
 * `src/assets/fonts/local-fonts.css` (Inter via `@fontsource-variable/inter`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../src/assets/fonts/google-catalog.json");

const W_STD = [300, 400, 500, 600, 700];
const W_FULL = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const W_BASIC = [400, 700];
const W_BODY = [400, 600, 700];

/** @type {{ family: string; category: "sans-serif"|"serif"|"display"|"handwriting"|"monospace"; variants: number[]; offline?: boolean }[]} */
const FAMILIES = [
  // --- curated offline (offline: true) — faces self-hosted via @fontsource* ----
  { family: "Inter", category: "sans-serif", variants: W_FULL, offline: true },
  {
    family: "Roboto",
    category: "sans-serif",
    variants: [100, 300, 400, 500, 700, 900],
    offline: true,
  },
  {
    family: "Open Sans",
    category: "sans-serif",
    variants: [300, 400, 500, 600, 700, 800],
    offline: true,
  },
  { family: "Lato", category: "sans-serif", variants: [100, 300, 400, 700, 900], offline: true },
  { family: "Montserrat", category: "sans-serif", variants: W_FULL, offline: true },
  {
    family: "Source Sans 3",
    category: "sans-serif",
    variants: [200, 300, 400, 500, 600, 700, 900],
    offline: true,
  },
  {
    family: "IBM Plex Sans",
    category: "sans-serif",
    variants: [100, 200, 300, 400, 500, 600, 700],
    offline: true,
  },
  { family: "Merriweather", category: "serif", variants: [300, 400, 700, 900], offline: true },
  { family: "Lora", category: "serif", variants: [400, 500, 600, 700], offline: true },

  // --- sans-serif --------------------------------------------------------------
  { family: "Nunito", category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Nunito Sans", category: "sans-serif", variants: [200, 300, 400, 600, 700, 800, 900] },
  { family: "Poppins", category: "sans-serif", variants: W_FULL },
  { family: "Raleway", category: "sans-serif", variants: W_FULL },
  { family: "Work Sans", category: "sans-serif", variants: W_FULL },
  { family: "Mukta", category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Rubik", category: "sans-serif", variants: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Noto Sans", category: "sans-serif", variants: W_FULL },
  { family: "PT Sans", category: "sans-serif", variants: W_BASIC },
  { family: "Oswald", category: "sans-serif", variants: [200, 300, 400, 500, 600, 700] },
  { family: "Karla", category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Mulish", category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "DM Sans", category: "sans-serif", variants: [400, 500, 700] },
  { family: "Manrope", category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Quicksand", category: "sans-serif", variants: [300, 400, 500, 600, 700] },
  { family: "Hind", category: "sans-serif", variants: [300, 400, 500, 600, 700] },
  { family: "Heebo", category: "sans-serif", variants: W_FULL },
  { family: "Barlow", category: "sans-serif", variants: W_FULL },
  { family: "Cabin", category: "sans-serif", variants: [400, 500, 600, 700] },
  { family: "Titillium Web", category: "sans-serif", variants: [200, 300, 400, 600, 700, 900] },
  { family: "Fira Sans", category: "sans-serif", variants: W_FULL },
  { family: "Josefin Sans", category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700] },
  { family: "Archivo", category: "sans-serif", variants: W_FULL },
  { family: "Public Sans", category: "sans-serif", variants: W_FULL },
  {
    family: "Plus Jakarta Sans",
    category: "sans-serif",
    variants: [200, 300, 400, 500, 600, 700, 800],
  },
  { family: "Figtree", category: "sans-serif", variants: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Outfit", category: "sans-serif", variants: W_FULL },
  { family: "Sora", category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: "Space Grotesk", category: "sans-serif", variants: [300, 400, 500, 600, 700] },
  { family: "Albert Sans", category: "sans-serif", variants: W_FULL },
  { family: "Onest", category: "sans-serif", variants: W_FULL },
  { family: "Inter Tight", category: "sans-serif", variants: W_FULL },
  { family: "Geist", category: "sans-serif", variants: W_FULL },
  {
    family: "Hanken Grotesk",
    category: "sans-serif",
    variants: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  },
  { family: "Schibsted Grotesk", category: "sans-serif", variants: [400, 500, 600, 700, 800, 900] },

  // --- serif -------------------------------------------------------------------
  { family: "Playfair Display", category: "serif", variants: [400, 500, 600, 700, 800, 900] },
  { family: "PT Serif", category: "serif", variants: W_BASIC },
  { family: "Noto Serif", category: "serif", variants: W_BASIC },
  { family: "Roboto Slab", category: "serif", variants: W_FULL },
  { family: "Bitter", category: "serif", variants: W_FULL },
  { family: "Crimson Text", category: "serif", variants: [400, 600, 700] },
  { family: "EB Garamond", category: "serif", variants: [400, 500, 600, 700, 800] },
  { family: "Libre Baskerville", category: "serif", variants: [400, 700] },
  { family: "Source Serif 4", category: "serif", variants: [200, 300, 400, 500, 600, 700, 900] },
  { family: "Cormorant Garamond", category: "serif", variants: [300, 400, 500, 600, 700] },
  { family: "Spectral", category: "serif", variants: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Domine", category: "serif", variants: [400, 500, 600, 700] },
  { family: "Frank Ruhl Libre", category: "serif", variants: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Noto Serif Display", category: "serif", variants: W_FULL },
  { family: "DM Serif Display", category: "serif", variants: [400] },
  { family: "Zilla Slab", category: "serif", variants: [300, 400, 500, 600, 700] },
  { family: "Newsreader", category: "serif", variants: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Fraunces", category: "serif", variants: W_FULL },

  // --- display -----------------------------------------------------------------
  { family: "Bebas Neue", category: "display", variants: [400] },
  { family: "Anton", category: "display", variants: [400] },
  { family: "Lobster", category: "display", variants: [400] },
  { family: "Righteous", category: "display", variants: [400] },
  { family: "Comfortaa", category: "display", variants: [300, 400, 500, 600, 700] },
  { family: "Abril Fatface", category: "display", variants: [400] },
  { family: "Archivo Black", category: "display", variants: [400] },
  { family: "Pathway Gothic One", category: "display", variants: [400] },
  { family: "Alfa Slab One", category: "display", variants: [400] },
  { family: "Passion One", category: "display", variants: [400, 700, 900] },
  { family: "Fjalla One", category: "display", variants: [400] },
  { family: "Staatliches", category: "display", variants: [400] },
  { family: "Bungee", category: "display", variants: [400] },
  { family: "Unbounded", category: "display", variants: [200, 300, 400, 500, 600, 700, 800, 900] },

  // --- handwriting -------------------------------------------------------------
  { family: "Dancing Script", category: "handwriting", variants: [400, 500, 600, 700] },
  { family: "Pacifico", category: "handwriting", variants: [400] },
  { family: "Caveat", category: "handwriting", variants: [400, 500, 600, 700] },
  { family: "Satisfy", category: "handwriting", variants: [400] },
  { family: "Shadows Into Light", category: "handwriting", variants: [400] },
  { family: "Indie Flower", category: "handwriting", variants: [400] },
  { family: "Permanent Marker", category: "handwriting", variants: [400] },
  { family: "Sacramento", category: "handwriting", variants: [400] },
  { family: "Great Vibes", category: "handwriting", variants: [400] },
  { family: "Kalam", category: "handwriting", variants: [300, 400, 700] },

  // --- monospace ---------------------------------------------------------------
  { family: "Roboto Mono", category: "monospace", variants: [100, 200, 300, 400, 500, 600, 700] },
  { family: "JetBrains Mono", category: "monospace", variants: W_FULL.slice(2) },
  {
    family: "Source Code Pro",
    category: "monospace",
    variants: [200, 300, 400, 500, 600, 700, 900],
  },
  { family: "Fira Code", category: "monospace", variants: [300, 400, 500, 600, 700] },
  { family: "IBM Plex Mono", category: "monospace", variants: [100, 200, 300, 400, 500, 600, 700] },
  { family: "Space Mono", category: "monospace", variants: [400, 700] },
  {
    family: "Inconsolata",
    category: "monospace",
    variants: [200, 300, 400, 500, 600, 700, 800, 900],
  },
  { family: "Ubuntu Mono", category: "monospace", variants: [400, 700] },
  { family: "DM Mono", category: "monospace", variants: [300, 400, 500] },
];

const catalog = {
  version: 1,
  generatedAt: "2026-06-05",
  families: FAMILIES,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
// eslint-disable-next-line no-console
console.log(`Wrote ${FAMILIES.length} families → ${OUT}`);
