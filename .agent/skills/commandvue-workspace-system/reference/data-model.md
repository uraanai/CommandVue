# Data model

Six IndexedDB stores. Six Postgres tables post-migration. The shapes don't change.

## Stores

| IndexedDB store   | Key   | Type interface                          | File                   |
| ----------------- | ----- | --------------------------------------- | ---------------------- |
| `workspaces`      | `id`  | `Workspace` (`src/types/workspace.ts`)  | `workspaceRepo.ts`     |
| `layouts`         | `id`  | `Layout` (`src/types/workspace.ts`)     | `layoutRepo.ts`        |
| `panel-states`    | `id`  | `PanelState` (`src/types/workspace.ts`) | `panelStateRepo.ts`    |
| `presets`         | `id`  | `Preset` (`src/types/preset.ts`)        | `presetRepo.ts`        |
| `chrome-profiles` | `id`  | `ChromeProfile` (`src/types/chrome.ts`) | `chromeProfileRepo.ts` |
| `app-meta`        | `key` | `AppMeta` (`src/types/workspace.ts`)    | `appMetaRepo.ts`       |

## Indexes

| Store          | Index           | Field          | Used by                                                          |
| -------------- | --------------- | -------------- | ---------------------------------------------------------------- |
| `layouts`      | `by-workspace`  | `workspaceId`  | `layoutRepo.listByWorkspace`, cascade in `workspaceRepo.delete`  |
| `panel-states` | `by-layout`     | `layoutId`     | `panelStateRepo.listByLayout`, cascade in `layoutRepo.delete`    |
| `presets`      | `by-workspace`  | `workspaceId`  | `presetRepo.listForWorkspace`, cascade in `workspaceRepo.delete` |
| `presets`      | `by-presetType` | `presetTypeId` | Optional filter in `presetRepo.list`                             |

`workspaces.isGlobalDefault` and `chrome-profiles.isDefault` are **not** indexed (IndexedDB can't index booleans portably). Lookups use full-store scans — both stores are tiny.

## ULIDs

`src/modules/storage/ids.ts` exports `newId()` using `ulid.monotonicFactory()`. Two ULIDs minted in the same millisecond are strictly lexicographically increasing. Without this, IDB key order disagrees with creation order for same-millisecond writes — which breaks "ORDER BY created_at" assumptions in store lists.

## Postgres mapping

| IndexedDB store   | Postgres table    | Notes                                                       |
| ----------------- | ----------------- | ----------------------------------------------------------- |
| `workspaces`      | `workspaces`      | Unique partial index `WHERE is_global_default`              |
| `layouts`         | `layouts`         | FK `workspace_id`; cascade delete                           |
| `panel-states`    | `panel_states`    | FK `layout_id`; cascade delete; `applied_preset_ids text[]` |
| `presets`         | `presets`         | FK `workspace_id` nullable; cascade delete when non-null    |
| `chrome-profiles` | `chrome_profiles` | Unique partial index `WHERE is_default`                     |
| `app-meta`        | `app_meta`        | PK `(user_id, key)`                                         |

See `docs/supabase-migration.md` for the full DDL sketch.
