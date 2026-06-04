# A1a.5 — Theme data-model v2 + schema/DB bump (reconciling keystone)

> **Branch:** `feat/theme-data-model-v2` → PR to `develop`.
> **Authoritative design:** `.internal/specs/track-a-theming.md` §3a/§3h/§3i + §5; reconciliation in
> `.internal/specs/track-a-post-a1b-ux-systems.md` §Keystone-ordering. A1a + A1b are **merged**.
> This doc is the execution sequence + the one scope decision the spec left open.

## Goal

Land the `base + sparse overrides + mandatory resolved-cache` model, `THEME_SCHEMA_VERSION` 1→2,
`DB_VERSION` 2→3, a memoized `resolve()`, the IndexedDB migration, the import v1→v2 upcast, the
§3i engine-stability contract — and **retroactively upcast already-shipped v1 generated themes that
carry `generation.statusOverrides`** (the A1b migration debt).

## The one scope decision (mine, within spec authority)

`theme.generation` is read by **5 consumers** (`ThemeCustomizerDialog`, `ThemePickerDialog`,
`MenuBar`, `WorkspaceSwitcher`, `useTheme`) + `generatePairedVariant`. The spec's A1a.5 file list
under-counts this. Rewriting all of them inside a data-migration PR balloons the blast radius.

**Decision:** keep `generation?` as a **derived write-through compat cache** (deprecated), exactly
parallel to how `tokens` is already a derived cache. v2 source-of-truth becomes
`base` + `overrides` + `tokens` + `paired`. `generation` is re-derived from `base.input`+`paired`
on every write (repo / builtin / import / migration) for `base.kind === "generated"`. UI consumers
stay byte-for-byte unchanged this PR; they get rewritten when they become the Theme Studio panel in
A2a (mirrors Open Decision 9's "one transition release"). `useTheme` switches to `theme.paired`
(trivial), keeping `generation.paired` as a derived backup.

## v2 types (`src/types/theme.ts`)

```ts
export const THEME_SCHEMA_VERSION = 2 as const;
export const ENGINE_VERSION = 1 as const; // bumps when generateTheme's MATH changes (§3i)

export interface StatusHues {
  success?: number;
  warning?: number;
  danger?: number;
  info?: number;
}

export interface GenerationInputV2 {
  schemaVersion: 2;
  baseColor: string;
  accentColor: string;
  contrast: number; // 30-100
  mode: ThemeMode;
  density: ThemeDensity;
  fontFamily?: string; // omitted (not defaulted) when unset — §3i
  statusHues?: StatusHues; // pinned to STATUS_HUES on migration; engine ignores today (forward-compat)
  statusOverrides?: StatusOverrides; // A1b live hue lever (statusOverrides[x].hue)
}

export type ThemeBase =
  | { kind: "generated"; input: GenerationInputV2 }
  | { kind: "static"; tokens: ThemeTokens };

export interface Theme {
  readonly id;
  name;
  description;
  author;
  source;
  mode;
  density; // unchanged
  readonly base: ThemeBase;
  readonly overrides: ThemeTokens; // sparse; {} for fresh-generated
  readonly tokens: ThemeTokens; // MANDATORY resolved cache (write-through, §3h)
  readonly paired?: ThemeId; // moved off generation
  /** @deprecated derived from base.input+paired for transition; removed in A2a. NOT source of truth. */
  readonly generation?: ThemeGenerationMeta;
  readonly createdAt;
  updatedAt;
}
```

`ThemeGenerationMeta` stays (compat shape, `schemaVersion: 1` sub-version is fine — it's not the theme
schema version). `ThemeDefinition` = `Omit<Theme,"source"|"createdAt"|"updatedAt"|"generation"|"base"|"overrides"|"tokens"> & { tokens }`
— built-in JSONs keep only `tokens`; `base`/`overrides`/cache synthesized at load.

## Task sequence (TDD, one commit each)

1. **types** — v2 `Theme`/`ThemeBase`/`GenerationInputV2`/`StatusHues`/`ENGINE_VERSION`/`THEME_SCHEMA_VERSION=2`.
   No test of its own; downstream specs cover it. `pnpm type-check` will go red until repo/builtin updated — expected.
2. **resolve.ts (NEW)** + `resolve.spec.ts` — `resolve(theme)`: static→`base.tokens`;
   generated→`generateTheme(toGenInput(base.input, name)).tokens` memoized on
   `${ENGINE_VERSION}:${JSON.stringify(base.input)}`; then `{...baseTokens, ...overrides}`.
   `toGenInput` maps `GenerationInputV2`→`ThemeGenerationInput` (adds `name`, passes `statusOverrides`;
   `statusHues` not consumed by engine today — documented). Helper `deriveGenerationMeta(theme)` →
   `ThemeGenerationMeta | undefined` for the compat cache.
   Tests: static returns base.tokens; generated matches `generateTheme`; overrides win; memo hit
   returns same ref for same input; different statusOverrides ⇒ different cache key.
3. **migrate.ts (NEW)** + `migrate.spec.ts` — `migrateThemeV1ToV2(record): Theme`:
   - already-v2 (`"base" in record`) → return as-is (idempotent).
   - `source==="generated"` w/ `generation` → `input = {schemaVersion:2, baseColor, accentColor,
contrast, mode: record.mode, density: record.density, fontFamily: (record.tokens["--font-family-body"] ? that : omit),
statusHues: {...STATUS_HUES}, statusOverrides: generation.statusOverrides}`;
     `base={kind:"generated",input}`; `try { gen = generateTheme(toGenInput(input, name)).tokens } catch { fall back to static }`;
     `overrides = diff(record.tokens, gen)` (keys whose value differs or absent in gen); `paired = generation.paired`;
     `tokens = record.tokens` (byte-identical); derive `generation` compat. **statusOverrides upcast is automatic** (copied into base.input).
   - generate-throws → `base={kind:"static",tokens:record.tokens}`, `overrides:{}` (preserve look), log.
   - `source` in {`imported`,`user`} (no generation) → `base={kind:"static",tokens:record.tokens}`, `overrides:{}`, `tokens=record.tokens`.
   - strip legacy `generation` from the record before building (we re-derive).
     Tests: generated round-trips pixel-identical (`resolve(migrated)` deep-equals `record.tokens`);
     statusOverrides folded into `base.input.statusOverrides`; imported→static; idempotent on a v2 record;
     bad-color generated → static fallback, no throw; `paired` moved to top level; font omitted when absent.
4. **db.ts** — `DB_VERSION=3`; `upgrade` add `if (oldVersion < 3)` branch: open `custom-themes` via the
   upgrade `transaction`, `store.getAll()`, for each run `migrateThemeV1ToV2`, `store.put(migrated)`;
   wrap each record in try/catch skip-and-log (never abort the whole upgrade). Idempotent. + db migration spec.
5. **themeRepo.ts** — invariants:
   - keep 1-3, 5-7. Invariant 4 → validate keys of **`overrides`** (sparse) are known tokens.
   - Invariant 8 → `base` shape: `base.kind==="generated"` ⇒ `base.input` shaped (baseColor/accentColor strings,
     contrast 30-100, mode/density valid); `base.kind==="static"` ⇒ non-empty `tokens`.
   - Invariant 9 → exactly one of generated-input / static-tokens.
   - Invariant 10 (§3h) → `tokens` cache present + non-empty.
   - `create`/`update`: after `assertValid`, set `theme.tokens = resolve(theme)` and
     `theme.generation = deriveGenerationMeta(theme)` (write-through). `CreateThemeInput` gains `base`/`overrides`
     (defaults `overrides:{}`); drop the requirement to pass `tokens`/`generation` (repo derives them).
   - **Downgrade tolerance:** `getAll`/`getById` map any record missing `base` through `migrateThemeV1ToV2`
     on read (treat as legacy) rather than stripping — closes the downgrade-write hazard. + spec.
6. **import.ts + portableSchema.ts** — Zod v2 schema: `base` (discriminated union via `z.discriminatedUnion`
   or refine), `overrides` record, `tokens` record (required), `paired` optional, `generation` optional
   (ignored/re-derived), `schemaVersion` literal 2. `import.ts`: accept `schemaVersion` 1 **and** 2; if 1,
   run `migrateThemeV1ToV2(file.theme)` **before** Zod-v2 (upcast-before-validate, §3j) — note v1 file may carry
   `--color-p-surface-*` keys; A1a retained them in knownTokens so they still validate, and migrate keeps them in
   `tokens` cache + static/overrides (harmless). Persist via repo (re-derives cache).
   PortableTheme: embed resolved `tokens` cache (Open Decision 7). + portable.spec, import round-trip.
7. **builtin.ts** — wrap: `base={kind:"static",tokens:normalized}`, `overrides:{}`, `tokens=normalized`,
   no `generation`. + registry/builtin spec touch-ups.
8. **generate.ts** — `generatePairedVariant(theme)` reads `theme.base` (kind generated → `base.input`) instead of
   `theme.generation`; throws if not generated. (Engine math untouched — ENGINE_VERSION stays 1.)
9. **useTheme.ts** — `currentTheme.paired` instead of `currentTheme.generation?.paired` (keep derived fallback).
10. **engine-stability test** (§3i) — migrate a v1 generated theme; assert `resolve()` output unchanged for all
    keys; assert memo keyed on ENGINE_VERSION (changing the prefix busts cache). `tests/unit/themes/engine-stability.spec.ts`.
11. **docs + LLM guard** — `theme-schema-for-llms.md` + its guard spec: advertise flat sparse-token contract →
    `base:{kind:"static"}` + `overrides:{}`; document `base.input` reference-only. `docs/design-tokens.md` schema note.
12. **Update existing specs to v2 shape** — `themeRepo.spec`, `portable.spec`, `generate.spec`, `apply.spec`
    (apply still reads `theme.tokens` — should mostly pass), `theme-schema-for-llms.spec`. Audit note in PR:
    `src/utils/storage.ts` second IndexedDB (`DB_VERSION=1`) holds **no** theme data — out of scope.

## Gauntlet + verification

`pnpm lint && pnpm type-check && pnpm test && pnpm spell && pnpm build && pnpm docs:build` green after each
logical commit (type-check may be red mid-sequence between tasks 1 and 7 — that's fine within the branch).
Stage 1 Playwright (mandatory, §verification): fixture DB of v1 records (generated+imported+built-in-shaped)
→ upgrade → every record renders pixel-identical (cache == stored); import a real v1 `.commandvue-theme.json`
(with `--color-p-surface-*`) → succeeds (upcast-before-validate); reload with a generated custom theme active →
**no unthemed first-paint frame** (§3h). Console counts = 0. Screenshots to `.verification-screenshots/<branch>/`.
Stage 2 checklist in PR body.
