/**
 * Dev-only inspection script (not shipped). Generates a handful of sample
 * themes and writes them to the verification folder as JSON so a human can eyeball
 * the generated palettes and contrast reports during the Phase B HARD STOP review.
 *
 *   pnpm theme:demo
 *
 * Output: .verification-screenshots/feat-theme-generation-engine/sample-output.json
 */

import { mkdirSync, writeFileSync } from "node:fs";

import { generateTheme, type ThemeGenerationInput } from "../src/modules/themes/generate";

const SAMPLES: ThemeGenerationInput[] = [
  {
    name: "Blue Light",
    baseColor: "oklch(0.98 0.005 250)",
    accentColor: "oklch(0.55 0.15 250)",
    contrast: 50,
    mode: "light",
    density: "comfortable",
  },
  {
    name: "Blue Dark",
    baseColor: "oklch(0.16 0.01 250)",
    accentColor: "oklch(0.65 0.15 250)",
    contrast: 50,
    mode: "dark",
    density: "compact",
  },
  {
    name: "Green High Contrast",
    baseColor: "oklch(0.99 0.005 145)",
    accentColor: "oklch(0.55 0.15 145)",
    contrast: 90,
    mode: "light",
    density: "comfortable",
  },
  {
    name: "Violet Soft",
    baseColor: "oklch(0.97 0.01 300)",
    accentColor: "oklch(0.6 0.15 300)",
    contrast: 35,
    mode: "light",
    density: "spacious",
  },
];

const OUT_DIR = ".verification-screenshots/feat-theme-generation-engine";
const OUT_FILE = `${OUT_DIR}/sample-output.json`;

const results = SAMPLES.map((input) => ({ input, output: generateTheme(input) }));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));

console.log(`Generated ${results.length} sample themes.`);
for (const { input, output } of results) {
  const f = output.contrastReport.failures.length;
  console.log(
    `  • ${input.name.padEnd(22)} ${Object.keys(output.tokens).length} tokens · ` +
      `text/surface ${output.contrastReport.textOnSurface}:1 · ` +
      `${f === 0 ? "no contrast failures" : `${f} FAILURE(S)`}`,
  );
}
console.log(`\nInspect the full output at ${OUT_FILE}`);
