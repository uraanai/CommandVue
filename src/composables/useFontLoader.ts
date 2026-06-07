/**
 * Google-font runtime loader (Track A C3).
 *
 * Turns a {@link FontSpec} into a loaded webfont: a de-duplicated, charset- and
 * origin-locked `<link rel="stylesheet">` into the top realm, mirrored into
 * every dockview pop-out, with a glyph-ready "loaded" signal via the CSS Font
 * Loading API. Hard security boundary — family names are charset-allowlisted,
 * the css2 URL is built in exactly one place ({@link buildFontHref}) with the
 * weight clamped to the catalog, and the only origin ever injected is
 * `fonts.googleapis.com`.
 *
 * Offline-graceful: a curated family renders from its self-hosted (`@fontsource`)
 * face with no network; a non-curated family offline falls back to the system
 * stack (never tofu).
 */
import type { FontSpec } from "@/types/theme";

import { mirrorFontLinkToAllPopouts } from "@/composables/usePopoutThemeSync";
import { getCatalogEntry } from "@/modules/themes/fontCatalog";

/** The only origin the loader will ever inject a css2 stylesheet from. Hard lock. */
const ALLOWED_STYLE_ORIGIN = "https://fonts.googleapis.com";
/** Charset allowlist (mirrors FontFamilyNameSchema in portableSchema.ts). */
export const FAMILY_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]*$/;
/** Stable `<link>` de-dup / mirror attribute. */
const FONT_KEY_ATTR = "data-cv-font-key";

/**
 * Hardcoded curated set — keeps the catalog JSON off the boot/apply path (§0.3).
 * MUST set-equal the `offline: true` families in google-catalog.json (a unit
 * test in fontCatalog.spec drift-guards this). Faces ship via `@fontsource*`.
 */
export const CURATED_OFFLINE_FAMILIES: ReadonlySet<string> = new Set([
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Source Sans 3",
  "IBM Plex Sans",
  "Merriweather",
  "Lora",
]);

export type FontLoadStatus = "error" | "idle" | "loaded" | "loading" | "offline-fallback";
export interface FontLoadResult {
  status: FontLoadStatus;
  href: null | string;
}

/** De-dup concurrent loads + cache resolved results, keyed by family. */
const loadCache = new Map<string, Promise<FontLoadResult>>();

/**
 * Build the canonical css2 href. Clamps `weights` to `variants` (defaulting to
 * `[400]` when the intersection is empty), de-dupes, sorts ascending, encodes
 * spaces as `+`, and only ever prefixes `https://fonts.googleapis.com`. Throws
 * on a disallowed family name (defense in depth — the caller already checks).
 * Synchronous: the caller passes `variants` after the catalog lookup.
 */
export function buildFontHref(
  family: string,
  weights: number[] | undefined,
  variants: number[],
): string {
  if (!FAMILY_NAME_RE.test(family)) throw new Error(`Disallowed font family: ${family}`);
  const allowed = new Set(variants.length > 0 ? variants : [400]);
  const requested = (weights ?? []).filter((w) => allowed.has(w));
  const final = requested.length > 0 ? requested : [400];
  const sorted = [...new Set(final)].sort((a, b) => a - b);
  const fam = family.replace(/ /g, "+");
  return `${ALLOWED_STYLE_ORIGIN}/css2?family=${fam}:wght@${sorted.join(";")}&display=swap`;
}

/** Curated-offline check via the hardcoded set (no catalog access). */
export function familyIsOfflineReady(family: string): boolean {
  return CURATED_OFFLINE_FAMILIES.has(family.trim());
}

/** Injected hrefs (tests + pop-out backfill). */
export function activeFontHrefs(): readonly string[] {
  if (typeof document === "undefined") return [];
  return [...document.head.querySelectorAll<HTMLLinkElement>(`link[${FONT_KEY_ATTR}]`)].map(
    (l) => l.href,
  );
}

/** Idempotent `<link>` injection into the top realm, guarded by the font key. */
function injectLink(href: string, family: string): HTMLLinkElement {
  const existing = document.head.querySelector<HTMLLinkElement>(
    `link[${FONT_KEY_ATTR}="${family}"]`,
  );
  if (existing) return existing;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.crossOrigin = "anonymous";
  link.dataset.cvFontKey = family;
  document.head.appendChild(link);
  return link;
}

/** Resolve when the GLYPHS are ready (Font Loading API), or error on a failed
 *  stylesheet / an 8s hung-CDN timeout. */
function waitForGlyphs(
  link: HTMLLinkElement,
  family: string,
  href: string,
): Promise<FontLoadResult> {
  return new Promise<FontLoadResult>((resolve) => {
    let settled = false;
    const settle = (r: FontLoadResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => settle({ status: "error", href }), 8000);
    link.addEventListener("error", () => settle({ status: "error", href }), { once: true });

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts && typeof fonts.load === "function") {
      fonts.load(`1em '${family}'`).then(
        () => settle({ status: "loaded", href }),
        () => settle({ status: "error", href }),
      );
    } else {
      // No Font Loading API — the stylesheet's own load is the only signal.
      link.addEventListener("load", () => settle({ status: "loaded", href }), { once: true });
    }
  });
}

async function doLoad(spec: FontSpec): Promise<FontLoadResult> {
  const family = spec.family;
  // Offline branch first — uses the hardcoded set, never the catalog (§0.3).
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return familyIsOfflineReady(family)
      ? { status: "loaded", href: null } // opener has the @fontsource face
      : { status: "offline-fallback", href: null }; // system stack renders
  }
  // Online: look up variants → build the single css2 href → inject + mirror →
  // await glyph-readiness. Curated families inject too, so pop-outs get the
  // face (§0.5).
  const entry = await getCatalogEntry(family);
  const href = buildFontHref(family, spec.weights, entry?.variants ?? [400]);
  const link = injectLink(href, family);
  mirrorFontLinkToAllPopouts(href, family);
  return waitForGlyphs(link, family, href);
}

/**
 * Ensure a Google webfont's glyphs are ready into the top realm and registered
 * for pop-out mirroring. Idempotent + de-duplicated by family. `system`/`stack`
 * sources are a no-op. A disallowed family name resolves `{status:"error"}`.
 */
export function ensureFontLoaded(spec: FontSpec): Promise<FontLoadResult> {
  if (spec.source !== "google") return Promise.resolve({ status: "idle", href: null });
  if (!FAMILY_NAME_RE.test(spec.family)) {
    return Promise.resolve({ status: "error", href: null });
  }
  const cached = loadCache.get(spec.family);
  if (cached) return cached;
  const p = doLoad(spec);
  loadCache.set(spec.family, p);
  return p;
}

/** Load the body family (and, forward-compat, the heading if a future C2 spec
 *  sets it — C3 callers only set body). */
export async function ensureFontSpecLoaded(spec: FontSpec): Promise<void> {
  await ensureFontLoaded(spec);
  if (spec.heading) {
    await ensureFontLoaded({
      family: spec.heading.family,
      source: spec.heading.source,
      weights: spec.heading.weights,
      fallback: spec.heading.fallback,
    });
  }
}

/** Test seam: remove injected `<link>`s + clear the de-dup cache. */
export function __resetFontLoaderForTests(): void {
  loadCache.clear();
  if (typeof document !== "undefined") {
    for (const l of document.head.querySelectorAll(`link[${FONT_KEY_ATTR}]`)) l.remove();
  }
}
