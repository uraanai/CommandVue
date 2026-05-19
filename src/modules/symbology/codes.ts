/**
 * SIDC (Symbol Identification Code) helpers for the MIL-STD-2525 / APP-6
 * standardized operational symbology scheme.
 *
 * The `@orbat-mapper/convert-symbology` package handles conversions between
 * 2525B, 2525C, 2525D, and APP-6 dialects. Import it directly from consumers
 * that need conversion — kept un-re-exported here so the bundler can trace
 * its (CommonJS) exports correctly.
 */

/**
 * Demo SIDC codes covering the common APP-6 affiliations × dimensions.
 * Each entry is a generic organizational symbol — no specific real-world
 * units encoded.
 */
export interface DemoSymbol {
  sidc: string;
  label: string;
  affiliation: "friend" | "hostile" | "neutral" | "unknown";
  dimension: "ground" | "air" | "sea-surface" | "subsurface" | "space";
}

export const DEMO_SYMBOLS: readonly DemoSymbol[] = [
  // Friendly (S = SFR...)
  {
    sidc: "SFGPUCI---*****",
    label: "Friendly Ground Unit",
    affiliation: "friend",
    dimension: "ground",
  },
  { sidc: "SFAPMF----*****", label: "Friendly Aircraft", affiliation: "friend", dimension: "air" },
  {
    sidc: "SFSPCLLC--*****",
    label: "Friendly Surface Vessel",
    affiliation: "friend",
    dimension: "sea-surface",
  },
  {
    sidc: "SFUPS-----*****",
    label: "Friendly Subsurface",
    affiliation: "friend",
    dimension: "subsurface",
  },
  { sidc: "SFPP------*****", label: "Friendly Space", affiliation: "friend", dimension: "space" },
  // Hostile (S = SHR...)
  {
    sidc: "SHGPUCI---*****",
    label: "Hostile Ground Unit",
    affiliation: "hostile",
    dimension: "ground",
  },
  { sidc: "SHAPMF----*****", label: "Hostile Aircraft", affiliation: "hostile", dimension: "air" },
  {
    sidc: "SHSPCLLC--*****",
    label: "Hostile Surface Vessel",
    affiliation: "hostile",
    dimension: "sea-surface",
  },
  {
    sidc: "SHUPS-----*****",
    label: "Hostile Subsurface",
    affiliation: "hostile",
    dimension: "subsurface",
  },
  { sidc: "SHPP------*****", label: "Hostile Space", affiliation: "hostile", dimension: "space" },
  // Neutral (S = SNR...)
  {
    sidc: "SNGPUCI---*****",
    label: "Neutral Ground Unit",
    affiliation: "neutral",
    dimension: "ground",
  },
  { sidc: "SNAPMF----*****", label: "Neutral Aircraft", affiliation: "neutral", dimension: "air" },
  {
    sidc: "SNSPCLLC--*****",
    label: "Neutral Surface Vessel",
    affiliation: "neutral",
    dimension: "sea-surface",
  },
  {
    sidc: "SNUPS-----*****",
    label: "Neutral Subsurface",
    affiliation: "neutral",
    dimension: "subsurface",
  },
  { sidc: "SNPP------*****", label: "Neutral Space", affiliation: "neutral", dimension: "space" },
  // Unknown (S = SUR...)
  { sidc: "SUGPUCI---*****", label: "Unknown Ground", affiliation: "unknown", dimension: "ground" },
  { sidc: "SUAPMF----*****", label: "Unknown Air", affiliation: "unknown", dimension: "air" },
  {
    sidc: "SUSPCLLC--*****",
    label: "Unknown Surface",
    affiliation: "unknown",
    dimension: "sea-surface",
  },
  {
    sidc: "SUUPS-----*****",
    label: "Unknown Subsurface",
    affiliation: "unknown",
    dimension: "subsurface",
  },
  { sidc: "SUPP------*****", label: "Unknown Space", affiliation: "unknown", dimension: "space" },
];

/** Read the affiliation character from a SIDC code (position 2). */
export function affiliationFromSidc(sidc: string): DemoSymbol["affiliation"] {
  const char = sidc.charAt(1).toUpperCase();
  switch (char) {
    case "F":
    case "A":
    case "D":
      return "friend";
    case "H":
    case "J":
    case "K":
    case "S":
      return "hostile";
    case "N":
    case "L":
      return "neutral";
    default:
      return "unknown";
  }
}
