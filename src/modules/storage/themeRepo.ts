import type {
  Theme,
  ThemeDensity,
  ThemeId,
  ThemeMode,
  ThemeSource,
  ThemeTokens,
} from "@/types/theme";

import { listUnknownTokens } from "@/modules/themes/knownTokens";
import { migrateThemeV1ToV2 } from "@/modules/themes/migrate";
import { themeRegistry } from "@/modules/themes/registry";
import { deriveGenerationMeta, resolve } from "@/modules/themes/resolve";

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
 * caller can't persist a malformed theme), then derives the two write-through
 * caches — the resolved `tokens` (load-bearing for anti-FOUC, §3h) and the
 * deprecated `generation` compat block — via `resolve()` / `deriveGenerationMeta()`.
 *
 * Token-key convention: keys are `--`-prefixed (matches `knownTokens` and the
 * apply engine).
 *
 * Data-model v2 invariants (each throws `InvariantError` with a descriptive
 * message):
 *   1. `id` is a ULID (26-char Crockford base32). Built-in slugs rejected.
 *   2. `name` non-empty and unique within the same `source` (case-insensitive).
 *   3. `source` ∈ { "user", "imported", "generated" } — never "built-in".
 *   4. every `overrides` key (and, for a `static` base, every `base.tokens` key)
 *      is a known overridable token.
 *   5. every `overrides` / static-`base.tokens` value is a syntactically-plausible
 *      CSS value (no `<script>`, `javascript:`, or `expression(` injection vectors).
 *   6. `mode` ∈ { "light", "dark" }.
 *   7. `density` ∈ { "compact", "comfortable", "spacious" }.
 *   8/9. `base` matches its discriminant: `generated` ⇒ a shaped `base.input`
 *      (baseColor/accentColor strings, contrast 30-100, valid mode/density);
 *      `static` ⇒ a non-empty `base.tokens` map. Exactly one of the two.
 *   10. the resolved `tokens` cache is present and non-empty (§3h) — enforced in
 *      `create`/`update` after `resolve()`.
 *
 * Downgrade tolerance: `getAll`/`getById` map any legacy record missing `base`
 * (written by a pre-v2 build after a v3 upgrade) through `migrateThemeV1ToV2` on
 * read, rather than stripping it.
 */

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const VALID_SOURCES: readonly ThemeSource[] = ["user", "imported", "generated"];
const VALID_MODES: readonly ThemeMode[] = ["light", "dark"];
const VALID_DENSITIES: readonly ThemeDensity[] = ["compact", "comfortable", "spacious"];
const CSS_INJECTION_PATTERNS = [/<script/i, /javascript:/i, /expression\(/i, /<\/?[a-z]/i];

const WORKSPACE_THEME_KEY_PREFIX = "commandvue:workspace-theme-";

/** The validated subset of a theme — everything except the derived caches. */
type ThemeCandidate = Omit<Theme, "createdAt" | "updatedAt" | "tokens" | "generation">;

export type CreateThemeInput = Omit<
  Theme,
  "id" | "createdAt" | "updatedAt" | "tokens" | "generation" | "overrides"
> & {
  /** Optional explicit id (used by import to preserve the source id). */
  id?: ThemeId;
  /** Sparse hand-edited overrides; defaults to `{}` for fresh themes. */
  overrides?: ThemeTokens;
};

/** Invariants 4 + 5 over one token bag. */
function validateTokenBag(bag: ThemeTokens, label: string): void {
  const unknown = listUnknownTokens(Object.keys(bag));
  if (unknown.length > 0) {
    throw new InvariantError(`Unknown ${label} token name(s): ${unknown.join(", ")}.`);
  }
  for (const [key, value] of Object.entries(bag)) {
    if (typeof value !== "string" || value.length === 0 || value.length > 500) {
      throw new InvariantError(`${label} token "${key}" has an invalid value.`);
    }
    if (CSS_INJECTION_PATTERNS.some((re) => re.test(value))) {
      throw new InvariantError(`${label} token "${key}" value contains a disallowed pattern.`);
    }
  }
}

/** Throws InvariantError unless the candidate satisfies invariants 2-9. */
async function assertValid(
  candidate: ThemeCandidate,
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

  // Invariants 4 + 5 — sparse overrides (always) + static base tokens (if any)
  validateTokenBag(candidate.overrides, "override");
  if (candidate.base.kind === "static") {
    validateTokenBag(candidate.base.tokens, "base");
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

  // Invariants 8 + 9 — base shape matches discriminant
  const base = candidate.base;
  if (base.kind === "generated") {
    const inp = base.input;
    if (
      !inp ||
      typeof inp.baseColor !== "string" ||
      typeof inp.accentColor !== "string" ||
      typeof inp.contrast !== "number" ||
      inp.contrast < 30 ||
      inp.contrast > 100 ||
      !VALID_MODES.includes(inp.mode) ||
      !VALID_DENSITIES.includes(inp.density)
    ) {
      throw new InvariantError(
        "A generated base requires a valid input (baseColor, accentColor, contrast 30-100, mode, density).",
      );
    }
  } else if (base.kind === "static") {
    if (!base.tokens || Object.keys(base.tokens).length === 0) {
      throw new InvariantError("A static base requires a non-empty tokens map.");
    }
  } else {
    throw new InvariantError(`Theme base.kind must be "generated" or "static".`);
  }
}

/**
 * Resolve the write-through caches and assemble the persisted record. Invariant
 * 10 (non-empty resolved cache) is enforced here, after `resolve()`.
 */
function materialize(
  candidate: ThemeCandidate,
  timestamps: { createdAt: number; updatedAt: number },
): Theme {
  const tokens = resolve(candidate);
  if (Object.keys(tokens).length === 0) {
    throw new InvariantError("Resolved token cache must be non-empty.");
  }
  const generation = deriveGenerationMeta(candidate);
  return {
    ...candidate,
    tokens,
    ...(generation ? { generation } : {}),
    ...timestamps,
  };
}

/** Idempotently bring a possibly-legacy stored record to the v2 shape on read. */
function normalizeOnRead(record: Theme): Theme {
  return migrateThemeV1ToV2(record);
}

export const themeRepo = {
  async getAll(): Promise<Theme[]> {
    const db = await getDb();
    const all = await db.getAll("custom-themes");
    return all.map(normalizeOnRead).sort((a, b) => a.createdAt - b.createdAt);
  },

  async getById(id: ThemeId): Promise<Theme | null> {
    const db = await getDb();
    const record = await db.get("custom-themes", id);
    return record ? normalizeOnRead(record) : null;
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
    const candidate: ThemeCandidate = {
      id,
      name: input.name,
      description: input.description,
      author: input.author,
      source: input.source,
      mode: input.mode,
      density: input.density,
      base: input.base,
      overrides: input.overrides ?? {},
      ...(input.paired !== undefined ? { paired: input.paired } : {}),
    };
    await assertValid(candidate);

    const theme = materialize(candidate, { createdAt: now, updatedAt: now });
    const db = await getDb();
    await db.add("custom-themes", theme);
    // Keep the registry in sync so picker / apply consumers see it without a
    // reload. unregister-then-register is idempotent: tests that reuse the
    // registry singleton across cases don't trip on a stale entry.
    themeRegistry.unregister(theme.id);
    themeRegistry.register(theme);
    return theme;
  },

  async update(id: ThemeId, patch: Partial<Omit<Theme, "id" | "createdAt">>): Promise<Theme> {
    const db = await getDb();
    const stored = await db.get("custom-themes", id);
    if (!stored) throw new NotFoundError("Theme", id);
    const existing = normalizeOnRead(stored);
    const merged = { ...existing, ...patch, id: existing.id };
    const candidate: ThemeCandidate = {
      id: existing.id,
      name: merged.name,
      description: merged.description,
      author: merged.author,
      source: merged.source,
      mode: merged.mode,
      density: merged.density,
      base: merged.base,
      overrides: merged.overrides ?? {},
      ...(merged.paired !== undefined ? { paired: merged.paired } : {}),
    };
    await assertValid(candidate, { excludeId: id });
    const updated = materialize(candidate, {
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    });
    await db.put("custom-themes", updated);
    themeRegistry.unregister(id);
    themeRegistry.register(updated);
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
    themeRegistry.unregister(id);
  },
};
