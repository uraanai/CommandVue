/**
 * Theme import — validate a `PortableTheme` JSON string and persist via
 * `themeRepo`. Defense-in-depth: every imported theme passes through
 * {@link PortableThemeSchema} first (structural shape + token allowlist + CSS
 * safety) and then `themeRepo.create`'s 8 invariants (uniqueness, generation
 * block shape, etc.). A buggy validator or a future schema change therefore
 * can't slip a malformed theme into IndexedDB.
 *
 * Schema-version handling: the version is checked *explicitly* before Zod so a
 * stale-version file produces a clear "this app supports version N" error
 * instead of a Zod literal-mismatch buried in `.issues[0]`.
 *
 * Provenance: imported themes are always re-stamped with `source: "imported"`
 * regardless of what the file claims — exporting then re-importing a generated
 * theme yields an imported theme (the `generation` block carries through so the
 * customizer can still re-edit it).
 *
 * Used by:
 *   - The Phase G import dialog (file drop / paste / browse).
 *   - The Phase G "import from LLM" flow (paste JSON the model produced).
 *   - Tests (round-trip with the matching `exportThemeToJson`).
 */

import { newId } from "@/modules/storage/ids";
import { themeRepo } from "@/modules/storage/themeRepo";
import { PortableThemeSchema } from "@/modules/themes/portableSchema";
import { THEME_SCHEMA_VERSION, type Theme, type ThemeId } from "@/types/theme";

/**
 * Policy for ID collisions on import.
 *
 *   - `abort`    — bail out and return `conflictWithExistingId` so the UI can
 *                  prompt the user; **default** when no option is supplied.
 *   - `rename`   — mint a new ULID + append " (Imported)" to the name, then
 *                  create. The existing theme is untouched.
 *   - `replace`  — delete the existing theme (and its workspace bindings) and
 *                  create the imported one under the original id.
 */
export type ImportConflictPolicy = "abort" | "rename" | "replace";

export interface ImportThemeOptions {
  onConflict?: ImportConflictPolicy;
}

export interface ImportResult {
  success: boolean;
  /** The freshly-persisted theme on success. */
  theme?: Theme;
  /** Human-readable error reasons on failure. */
  errors?: string[];
  /** Non-fatal observations the caller can surface. */
  warnings?: string[];
  /** Present iff failure was specifically an unresolved ID collision. */
  conflictWithExistingId?: ThemeId;
}

/**
 * Parse + validate a `PortableTheme` JSON string and persist the resulting
 * theme via `themeRepo`. The themeRepo sync (Phase C) means a successful
 * import is immediately visible in `themeRegistry` and the picker.
 */
export async function importThemeFromJson(
  jsonText: string,
  options: ImportThemeOptions = {},
): Promise<ImportResult> {
  // 1. JSON parse.
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    return { success: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }

  // 2. Schema-version check BEFORE Zod for a clearer error than a literal
  // mismatch buried in .issues. We don't trust any other field yet, so this
  // is the only top-level property we read pre-validation.
  if (typeof raw === "object" && raw !== null && "schemaVersion" in raw) {
    const v = (raw as { schemaVersion: unknown }).schemaVersion;
    if (v !== THEME_SCHEMA_VERSION) {
      return {
        success: false,
        errors: [
          `Unsupported schema version: ${JSON.stringify(v)}. This app supports version ${THEME_SCHEMA_VERSION}.`,
        ],
      };
    }
  }

  // 3. Zod structural + content validation.
  const parsed = PortableThemeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((i) => {
        const path = i.path.length > 0 ? i.path.join(".") : "<root>";
        return `${path}: ${i.message}`;
      }),
    };
  }
  let theme = parsed.data.theme;

  // 4. ID conflict resolution.
  const existing = await themeRepo.exists(theme.id);
  const policy: ImportConflictPolicy = options.onConflict ?? "abort";
  let renamed = false;
  if (existing) {
    if (policy === "abort") {
      return {
        success: false,
        conflictWithExistingId: theme.id,
        errors: [
          `A theme with id "${theme.id}" already exists. Choose "rename" or "replace" to resolve.`,
        ],
      };
    }
    if (policy === "rename") {
      theme = { ...theme, id: newId(), name: `${theme.name} (Imported)` };
      renamed = true;
    } else {
      // policy === "replace" — drop the existing theme (and its workspace bindings).
      await themeRepo.delete(theme.id);
    }
  }

  // 5. Force source to "imported" — provenance always reflects the import
  // event, even if the file claimed `source: "user"` or `"generated"`.
  // The `generation` block (if present) carries through so the customizer
  // can re-edit a re-imported generated theme without losing its inputs.
  // 6. Persist via the repo — runs all 8 invariants again as defense-in-depth.
  //    The repo also generates fresh createdAt / updatedAt timestamps.
  try {
    const created = await themeRepo.create({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      author: theme.author,
      source: "imported",
      mode: theme.mode,
      density: theme.density,
      tokens: theme.tokens,
      generation: theme.generation,
    });
    const warnings: string[] = [];
    if (renamed) warnings.push(`ID collision resolved by renaming to "${created.name}".`);
    return { success: true, theme: created, warnings: warnings.length ? warnings : undefined };
  } catch (e) {
    return { success: false, errors: [(e as Error).message] };
  }
}
