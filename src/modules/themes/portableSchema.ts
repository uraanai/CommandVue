/**
 * Zod schemas for the {@link PortableTheme} envelope.
 *
 * The structural shape of an exported / imported theme JSON file is validated
 * here at the *import* boundary. Defense-in-depth: anything that survives Zod
 * then passes through `themeRepo`'s invariants again before persisting, so a
 * buggy validator or a future schema change can't slip a malformed theme into
 * IndexedDB.
 *
 * Token names are validated against the {@link ALL_KNOWN_TOKEN_NAMES} allowlist
 * — unknown names are rejected with a specific per-key error path. Token
 * values are length-bounded and filtered for CSS-injection vectors that match
 * the same patterns `themeRepo` rejects (`<script`, `javascript:`,
 * `expression(`, raw HTML).
 *
 * Schema version is checked *explicitly* before Zod parsing in
 * `importThemeFromJson` so a stale-version file produces a clear "this app
 * supports version N" error instead of a Zod literal-mismatch deep inside
 * `.issues`.
 */

import { z } from "zod";

import { isKnownToken } from "@/modules/themes/knownTokens";
import { THEME_SCHEMA_VERSION } from "@/types/theme";

/** Token *values* — bounded length + no CSS-injection patterns. Mirrors the
 *  CSS_INJECTION_PATTERNS set used by `themeRepo`'s invariant 5. */
export const TokenValueSchema = z
  .string()
  .min(1, "Token value must be non-empty")
  .max(500, "Token value exceeds 500 characters")
  .refine((v) => !/<script/i.test(v), "Token value rejected: contains <script")
  .refine((v) => !/javascript:/i.test(v), "Token value rejected: contains javascript:")
  .refine((v) => !/expression\(/i.test(v), "Token value rejected: contains expression(")
  .refine((v) => !/<\/?[a-z]/i.test(v), "Token value rejected: contains HTML-like markup");

/** Token *names* — must be in the known-token allowlist (`--`-prefixed form).
 *  Uses Zod 4's `error` callback form to include the offending name in the
 *  message (the record-key path also surfaces it, but a self-describing
 *  message keeps `import.ts`'s flat error list readable). */
export const TokenNameSchema = z.string().refine((n) => isKnownToken(n), {
  error: (issue) => `Unknown token name: ${String(issue.input)}`,
});

/** Per-family status override (Track A A1b). Tier 1 = `hue`; `color`/`subtle`
 *  are reserved for Tier 2 (A2b) and carried so persisted themes round-trip. */
const StatusFamilyOverrideSchema = z.object({
  hue: z.number().min(0).max(360).optional(),
  color: z.string().min(1).max(100).optional(),
  subtle: z.string().min(1).max(100).optional(),
});

/** Per-family status overrides keyed by family. */
const StatusOverridesSchema = z.object({
  success: StatusFamilyOverrideSchema.optional(),
  warning: StatusFamilyOverrideSchema.optional(),
  danger: StatusFamilyOverrideSchema.optional(),
  info: StatusFamilyOverrideSchema.optional(),
});

/** Per-family status hue pins (forward-compat; pinned on migration). */
const StatusHuesSchema = z.object({
  success: z.number().min(0).max(360).optional(),
  warning: z.number().min(0).max(360).optional(),
  danger: z.number().min(0).max(360).optional(),
  info: z.number().min(0).max(360).optional(),
});

/**
 * Legacy generation metadata (data-model v1). In v2 this is a **derived** compat
 * block, re-derived from `base.input` on import; accepted here (optional, lenient)
 * only so a round-tripped file validates. `base.input` is the source of truth.
 */
const GenerationMetaSchema = z.object({
  schemaVersion: z.literal(1),
  baseColor: z.string().min(1),
  accentColor: z.string().min(1),
  contrast: z.number().min(30).max(100),
  paired: z.string().optional(),
  statusOverrides: StatusOverridesSchema.optional(),
});

/** The v2 generation input persisted as a `generated` base. Lossless — carries
 *  fontFamily + status inputs so the theme is fully re-derivable. */
const GenerationInputV2Schema = z.object({
  schemaVersion: z.literal(2),
  baseColor: z.string().min(1),
  accentColor: z.string().min(1),
  contrast: z.number().min(30).max(100),
  mode: z.enum(["light", "dark"]),
  density: z.enum(["compact", "comfortable", "spacious"]),
  fontFamily: z.string().min(1).max(200).optional(),
  statusHues: StatusHuesSchema.optional(),
  statusOverrides: StatusOverridesSchema.optional(),
});

/** Discriminated theme base (v2): re-derivable generated input, or frozen tokens. */
const ThemeBaseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("generated"), input: GenerationInputV2Schema }),
  z.object({ kind: z.literal("static"), tokens: z.record(TokenNameSchema, TokenValueSchema) }),
]);

/** Inner Theme object (v2). `source` is validated here; the importer additionally
 *  *forces* it to `"imported"` after Zod passes, so even an exported `"user"`
 *  theme is re-stamped as imported on the way in. The `tokens` cache is embedded
 *  (Open Decision 7) so a fork with a divergent engine can still render the
 *  original; `generation` is accepted but re-derived from `base.input`. */
export const ThemeSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  author: z.string().max(100).optional().default(""),
  source: z.enum(["built-in", "user", "imported", "generated"]),
  mode: z.enum(["light", "dark"]),
  density: z.enum(["compact", "comfortable", "spacious"]),
  base: ThemeBaseSchema,
  overrides: z.record(TokenNameSchema, TokenValueSchema).optional().default({}),
  tokens: z.record(TokenNameSchema, TokenValueSchema),
  paired: z.string().optional(),
  generation: GenerationMetaSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/** The outer export / import envelope. */
export const PortableThemeSchema = z.object({
  schemaVersion: z.literal(THEME_SCHEMA_VERSION),
  exportedAt: z.number(),
  exportedBy: z.literal("commandvue"),
  exportedByVersion: z.string().min(1),
  theme: ThemeSchema,
});

export type PortableThemeParsed = z.infer<typeof PortableThemeSchema>;
