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

/** ULID format (Crockford base32, 26 chars, excludes I/L/O/U). Matches the
 *  regex `themeRepo`'s invariant 1 enforces. */
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Policy for collisions on import. A "collision" is either an existing record
 * with the same id OR an existing imported record with the same name (the
 * repo's invariant 2 is name-unique-within-source, so two imports of the same
 * exported theme — from different sessions with different ULIDs — would
 * otherwise trip the name check at create time).
 *
 *   - `abort`    — bail out and return `conflictWithExistingId` (pointing at
 *                  whichever record collided — id-match wins precedence) so
 *                  the UI can prompt the user; **default** when no option
 *                  is supplied.
 *   - `rename`   — mint a fresh ULID and append " (Imported)" to the name,
 *                  iteratively suffixing (" (Imported 2)", " (Imported 3)",
 *                  …) until the name is unique among imported themes. The
 *                  existing theme is untouched.
 *   - `replace`  — delete whatever collides (the id-matching record and / or
 *                  the name-matching record) along with any workspace
 *                  bindings, then create the imported theme.
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
  const warnings: string[] = [];

  // 4. Auto-mint a ULID if the imported id isn't one. Storage requires ULIDs
  // (`themeRepo` invariant 1); imported files — especially LLM-authored or
  // hand-written — often use friendly ids like "my-cool-theme". Renaming
  // silently here means import "just works" for any JSON the schema accepts,
  // and the user is told what happened via `warnings`. Note: a non-ULID id
  // can't collide with anything in storage (every stored id is a ULID), so
  // auto-mint always precedes the conflict check without ambiguity.
  if (!ULID_RE.test(theme.id)) {
    const minted = newId();
    warnings.push(
      `Imported id "${theme.id}" is not a valid ULID — reassigned to ${minted}. ` +
        `Storage requires ULIDs; the original id was discarded.`,
    );
    theme = { ...theme, id: minted };
  }

  // 5. Conflict resolution — id OR name match against existing imported themes.
  //    Name match is checked because `themeRepo`'s invariant 2 enforces name
  //    uniqueness within source; two exports of the same theme from different
  //    sessions would have different ULIDs but the same name, and we want the
  //    `rename` / `replace` policies to handle that case the way a user
  //    intuitively expects ("re-importing this file should just work").
  const policy: ImportConflictPolicy = options.onConflict ?? "abort";
  const idExists = await themeRepo.exists(theme.id);
  const all = await themeRepo.getAll();
  const targetName = theme.name.trim().toLowerCase();
  const nameConflictRecord = all.find(
    (t) =>
      t.source === "imported" && t.id !== theme.id && t.name.trim().toLowerCase() === targetName,
  );
  const hasConflict = idExists || nameConflictRecord !== undefined;

  if (hasConflict) {
    if (policy === "abort") {
      const conflictId = idExists ? theme.id : nameConflictRecord!.id;
      const reason = idExists
        ? `A theme with id "${theme.id}" already exists.`
        : `An imported theme named "${theme.name}" already exists.`;
      return {
        success: false,
        conflictWithExistingId: conflictId,
        errors: [`${reason} Choose "rename" or "replace" to resolve.`],
      };
    }
    if (policy === "rename") {
      // Mint a fresh ULID (so any id collision is moot) and iteratively suffix
      // the name until it's unique among imported themes.
      const nameTaken = (n: string): boolean => {
        const lower = n.trim().toLowerCase();
        return all.some((t) => t.source === "imported" && t.name.trim().toLowerCase() === lower);
      };
      const base = theme.name;
      let candidate = `${base} (Imported)`;
      let attempt = 2;
      while (nameTaken(candidate) && attempt < 100) {
        candidate = `${base} (Imported ${attempt})`;
        attempt += 1;
      }
      warnings.push(`Conflict resolved by renaming to "${candidate}".`);
      theme = { ...theme, id: newId(), name: candidate };
    } else {
      // policy === "replace" — drop whichever record(s) collide. The same
      // record might match both id and name; delete only once in that case.
      if (idExists) await themeRepo.delete(theme.id);
      if (nameConflictRecord && nameConflictRecord.id !== theme.id) {
        await themeRepo.delete(nameConflictRecord.id);
      }
    }
  }

  // 6. Force source to "imported" — provenance always reflects the import
  // event, even if the file claimed `source: "user"` or `"generated"`.
  // The `generation` block (if present) carries through so the customizer
  // can re-edit a re-imported generated theme without losing its inputs.
  // 7. Persist via the repo — runs all 8 invariants again as defense-in-depth.
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
    return { success: true, theme: created, warnings: warnings.length ? warnings : undefined };
  } catch (e) {
    return { success: false, errors: [(e as Error).message] };
  }
}
