import type { Theme, ThemeDensity, ThemeId, ThemeMode, ThemeSource } from "@/types/theme";

import { listUnknownTokens } from "@/modules/themes/knownTokens";

import { appMetaRepo } from "./appMetaRepo";
import { getDb } from "./db";
import { InvariantError, NotFoundError } from "./errors";
import { newId } from "./ids";

/**
 * Repository for custom {@link Theme} records (source `user` / `imported` /
 * `generated`). Built-in themes never live here — they ship as JSON and are
 * registered, not stored.
 *
 * The repo is the write-time enforcement boundary for theme validity. Every
 * `create` / `update` runs the full invariant set (defense-in-depth: the
 * import path validates with Zod first, but the repo re-checks so a buggy
 * caller can't persist a malformed theme).
 *
 * Token-key convention: keys are `--`-prefixed (matches `knownTokens` and the
 * apply engine).
 *
 * Invariants (each throws `InvariantError` with a descriptive message):
 *   1. `id` is a ULID (26-char Crockford base32). Built-in slugs rejected.
 *   2. `name` non-empty and unique within the same `source` (case-insensitive).
 *   3. `source` ∈ { "user", "imported", "generated" } — never "built-in".
 *   4. every `tokens` key is a known overridable token.
 *   5. every `tokens` value is a syntactically-plausible CSS value (no
 *      `<script>`, `javascript:`, or `expression(` injection vectors).
 *   6. `mode` ∈ { "light", "dark" }.
 *   7. `density` ∈ { "compact", "comfortable", "spacious" }.
 *   8. when `source === "generated"`, `generation` is present and shaped.
 */

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const VALID_SOURCES: readonly ThemeSource[] = ["user", "imported", "generated"];
const VALID_MODES: readonly ThemeMode[] = ["light", "dark"];
const VALID_DENSITIES: readonly ThemeDensity[] = ["compact", "comfortable", "spacious"];
const CSS_INJECTION_PATTERNS = [/<script/i, /javascript:/i, /expression\(/i, /<\/?[a-z]/i];

const WORKSPACE_THEME_KEY_PREFIX = "commandvue:workspace-theme-";

export type CreateThemeInput = Omit<Theme, "id" | "createdAt" | "updatedAt"> & {
  /** Optional explicit id (used by import to preserve the source id). */
  id?: ThemeId;
};

/** Throws InvariantError unless the candidate satisfies invariants 2-8. */
async function assertValid(
  candidate: Omit<Theme, "createdAt" | "updatedAt">,
  opts: { excludeId?: ThemeId } = {},
): Promise<void> {
  // Invariant 2 — name
  if (!candidate.name || candidate.name.trim().length === 0) {
    throw new InvariantError("Theme name must be non-empty.");
  }
  const all = await themeRepo.getAll();
  const nameClash = all.some(
    (t) =>
      t.id !== opts.excludeId &&
      t.source === candidate.source &&
      t.name.trim().toLowerCase() === candidate.name.trim().toLowerCase(),
  );
  if (nameClash) {
    throw new InvariantError(
      `A ${candidate.source} theme named "${candidate.name}" already exists.`,
    );
  }

  // Invariant 3 — source
  if (!VALID_SOURCES.includes(candidate.source)) {
    throw new InvariantError(
      `Theme source must be one of ${VALID_SOURCES.join(", ")} — got "${candidate.source}".`,
    );
  }

  // Invariant 4 — known tokens
  const unknown = listUnknownTokens(Object.keys(candidate.tokens));
  if (unknown.length > 0) {
    throw new InvariantError(`Unknown token name(s): ${unknown.join(", ")}.`);
  }

  // Invariant 5 — CSS safety
  for (const [key, value] of Object.entries(candidate.tokens)) {
    if (typeof value !== "string" || value.length === 0 || value.length > 500) {
      throw new InvariantError(`Token "${key}" has an invalid value.`);
    }
    if (CSS_INJECTION_PATTERNS.some((re) => re.test(value))) {
      throw new InvariantError(`Token "${key}" value contains a disallowed pattern.`);
    }
  }

  // Invariant 6 — mode
  if (!VALID_MODES.includes(candidate.mode)) {
    throw new InvariantError(`Theme mode must be "light" or "dark" — got "${candidate.mode}".`);
  }

  // Invariant 7 — density
  if (!VALID_DENSITIES.includes(candidate.density)) {
    throw new InvariantError(
      `Theme density must be one of ${VALID_DENSITIES.join(", ")} — got "${candidate.density}".`,
    );
  }

  // Invariant 8 — generation shape
  if (candidate.source === "generated") {
    const g = candidate.generation;
    if (
      !g ||
      g.schemaVersion !== 1 ||
      typeof g.baseColor !== "string" ||
      typeof g.accentColor !== "string" ||
      typeof g.contrast !== "number" ||
      g.contrast < 30 ||
      g.contrast > 100
    ) {
      throw new InvariantError(
        'A "generated" theme must include a valid generation block (baseColor, accentColor, contrast 30-100).',
      );
    }
  }
}

export const themeRepo = {
  async getAll(): Promise<Theme[]> {
    const db = await getDb();
    const all = await db.getAll("custom-themes");
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  async getById(id: ThemeId): Promise<Theme | null> {
    const db = await getDb();
    return (await db.get("custom-themes", id)) ?? null;
  },

  async exists(id: ThemeId): Promise<boolean> {
    const db = await getDb();
    return (await db.getKey("custom-themes", id)) !== undefined;
  },

  async create(input: CreateThemeInput): Promise<Theme> {
    // Invariant 1 — id is a ULID (or generate one)
    const id = input.id ?? newId();
    if (!ULID_RE.test(id)) {
      throw new InvariantError(`Theme id must be a ULID — got "${id}".`);
    }
    const now = Date.now();
    const candidate: Omit<Theme, "createdAt" | "updatedAt"> = {
      id,
      name: input.name,
      description: input.description,
      author: input.author,
      source: input.source,
      mode: input.mode,
      density: input.density,
      tokens: input.tokens,
      generation: input.generation,
    };
    await assertValid(candidate);

    const theme: Theme = { ...candidate, createdAt: now, updatedAt: now };
    const db = await getDb();
    await db.add("custom-themes", theme);
    return theme;
  },

  async update(id: ThemeId, patch: Partial<Omit<Theme, "id" | "createdAt">>): Promise<Theme> {
    const db = await getDb();
    const existing = await db.get("custom-themes", id);
    if (!existing) throw new NotFoundError("Theme", id);
    const merged: Omit<Theme, "createdAt" | "updatedAt"> = {
      ...existing,
      ...patch,
      id: existing.id,
    };
    await assertValid(merged, { excludeId: id });
    const updated: Theme = { ...merged, createdAt: existing.createdAt, updatedAt: Date.now() };
    await db.put("custom-themes", updated);
    return updated;
  },

  /**
   * Delete a custom theme. Cleans up any per-workspace binding that points at
   * it (the workspace falls back to the global default on next resolve).
   */
  async delete(id: ThemeId): Promise<void> {
    const bindingKeys = await appMetaRepo.getKeysByPrefix(WORKSPACE_THEME_KEY_PREFIX);
    for (const key of bindingKeys) {
      const boundId = await appMetaRepo.get<ThemeId>(key);
      if (boundId === id) await appMetaRepo.delete(key);
    }
    const db = await getDb();
    await db.delete("custom-themes", id);
  },
};
