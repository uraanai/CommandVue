# Supabase migration notes

CommandVue's workspace / layout / panel-state / preset / chrome subsystem persists to **IndexedDB** today via the `idb` library. The data shapes, invariants, and access patterns are deliberately designed to migrate to **Supabase (Postgres + RLS)** later without rewriting application code. This document captures the decisions that make that migration cheap.

This file is **agent-only reference**, not part of the shipped template. It is updated at the end of each phase with any migration-relevant decision that landed.

---

## Overview

| Layer         | Today                        | Future (Supabase)                             |
| ------------- | ---------------------------- | --------------------------------------------- |
| Storage       | IndexedDB (`idb`)            | Postgres                                      |
| Access        | Repository modules (typed)   | Same repository modules, swapped backend      |
| Invariants    | Enforced in repos            | Enforced in repos + DB constraints + triggers |
| Multi-tenancy | Single-user                  | RLS policies keyed on `auth.uid()` / `org_id` |
| Realtime sync | None                         | Supabase Realtime (postgres_changes)          |
| Auth          | Stubbed (`canEdit === true`) | Supabase Auth (`auth.users`)                  |

The repository abstraction is the migration contract. Stores, components, and dialogs all go through `workspaceRepo` / `layoutRepo` / `panelStateRepo` / `presetRepo` / `chromeProfileRepo` / `appMetaRepo`. Swapping the implementation under those exports moves the entire app from IndexedDB to Supabase.

---

## Store → Table mapping

Six IndexedDB stores map 1:1 to six Postgres tables.

| IndexedDB store   | Postgres table    | Key          | Notes                                                              |
| ----------------- | ----------------- | ------------ | ------------------------------------------------------------------ |
| `workspaces`      | `workspaces`      | `id` (ULID)  | `is_global_default` unique partial index `WHERE is_global_default` |
| `layouts`         | `layouts`         | `id` (ULID)  | `workspace_id` FK; cascade delete                                  |
| `panel-states`    | `panel_states`    | `id` (ULID)  | `layout_id` FK; cascade delete; `applied_preset_ids text[]`        |
| `presets`         | `presets`         | `id` (ULID)  | `workspace_id` nullable FK; cascade delete when non-null           |
| `chrome-profiles` | `chrome_profiles` | `id` (ULID)  | `is_default` unique partial index `WHERE is_default`               |
| `app-meta`        | `app_meta`        | `key` (text) | Per-user scratch; will be keyed on (user_id, key) under RLS        |

### Suggested DDL sketch

```sql
-- workspaces
create table workspaces (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  default_layout_id text references layouts(id),
  is_global_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workspaces_one_default_per_user
  on workspaces(user_id) where is_global_default;

-- layouts
create table layouts (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  dockview_state jsonb,
  panel_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- panel_states
create table panel_states (
  id text primary key,
  layout_id text not null references layouts(id) on delete cascade,
  panel_type text,
  assignment_state text not null check (assignment_state in ('empty','assigned','configured')),
  state jsonb not null default '{}'::jsonb,
  applied_preset_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- presets
create table presets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_type_id text not null,
  workspace_id text references workspaces(id) on delete cascade, -- null = global
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- chrome_profiles
create table chrome_profiles (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  slot_assignments jsonb not null default '{}'::jsonb,
  hidden_items text[] not null default '{}',
  menu_bar_visible boolean not null default true,
  status_bar_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index chrome_profiles_one_default_per_user
  on chrome_profiles(user_id) where is_default;

-- app_meta
create table app_meta (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  primary key (user_id, key)
);
```

---

## ULID strategy

IDs are **ULIDs** (`src/modules/storage/ids.ts`), not nanoids — chosen for time-ordered prefix (cheap pagination, natural insertion ordering) and for Postgres-friendliness:

- ULIDs are 26-char Crockford base32 → stored as `text primary key`.
- Migration tool: `pg_ulid` extension if/when we want native `ulid` columns; not required for v1 — `text` works.
- Existing client-generated ids round-trip cleanly into Postgres (server doesn't need to generate them).
- ULID's lexicographic sort matches creation order — most "ORDER BY created_at" queries can fall back to ordering on `id` when timestamps are equal.

`src/utils/id.ts` (nanoid) is unaffected — it still owns ephemeral ids (message ids, correlation tokens). Anything that lands in IndexedDB / Postgres uses ULID.

---

## Multi-tenancy hooks

Today every record is single-user. The migration adds a `user_id` column to every table except `panel_states` (parent-scoped via `layout_id → workspace_id → user_id`) and `layouts` (parent-scoped via `workspace_id → user_id`).

### RLS policy sketch

```sql
alter table workspaces enable row level security;
create policy workspaces_owner on workspaces
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table layouts enable row level security;
create policy layouts_via_workspace on layouts
  for all using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

-- panel_states and presets follow the same parent-chain pattern.
```

**Org-level vs system-level globals** is an open question for presets:

- Today `workspaceId: null` means "global to this user."
- In a multi-tenant deployment, "global" could mean (a) user-global, (b) org-global, (c) system-global (shipped by the template / admin).
- Decision deferred to Phase F when the preset UI lands; the schema field stays `workspace_id text references workspaces(id)` and we add `org_id` / `is_system` as nullable columns at migration time if needed.

---

## Invariant enforcement

Repository-layer enforcement today maps to DB-level enforcement after migration. Every invariant has both layers — repos for fast client-side feedback, DB constraints for guaranteed correctness.

| Invariant                                                | Repo enforcement                            | DB enforcement (post-migration)                             |
| -------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| 1. Exactly one workspace has `isGlobalDefault: true`     | `workspaceRepo.setGlobalDefault` atomic txn | Unique partial index `WHERE is_global_default`              |
| 2. Workspace has valid `defaultLayoutId`                 | Repo updates on layout delete               | FK `workspaces.default_layout_id → layouts.id` (nullable)   |
| 3. Layout belongs to exactly one workspace               | `layouts.workspaceId` non-null              | FK `layouts.workspace_id → workspaces.id NOT NULL`          |
| 4. Panel-state belongs to exactly one layout             | `panelStates.layoutId` non-null             | FK `panel_states.layout_id → layouts.id NOT NULL`           |
| 5. At least one workspace always exists                  | `workspaceRepo.delete` count check          | App-level (no clean DB constraint); same repo check         |
| 6. At least one layout per workspace                     | `layoutRepo.delete` count check             | Trigger: `BEFORE DELETE ON layouts` raise if peer count = 0 |
| 7. Exactly one chrome profile is `isDefault: true`       | `chromeProfileRepo.setDefault` atomic txn   | Unique partial index `WHERE is_default`                     |
| 8. Workspace-scoped presets cascade with workspace       | `workspaceRepo.delete` cascades             | FK `presets.workspace_id ON DELETE CASCADE`                 |
| 9. Dangling preset refs in panel-states silently dropped | Phase F: applied at preset-apply time       | App-level (text[] FK enforcement is awkward in Postgres)    |

Cascade behavior is implemented in the repo today; in Postgres it's free via `ON DELETE CASCADE`.

---

## Cascade behavior

| Parent delete    | Cascades to                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `workspace`      | All `layouts` for that workspace → all `panel-states` for those layouts; all workspace-scoped `presets` |
| `layout`         | All `panel-states` for that layout; clears `workspaces.defaultLayoutId` if it pointed here              |
| `preset`         | If `force: true`: strips refs from every `panel-states.appliedPresetIds`. Otherwise refuses on conflict |
| `chrome-profile` | None (profiles are standalone)                                                                          |

Repository tests cover every cascade path. The Postgres FK definitions above mirror these exactly.

---

## Open questions

1. **Org-level vs system-level globals for presets** — see Multi-tenancy hooks. Decision deferred to Phase F.
2. **App-meta scope** — single-user today; in multi-tenant Supabase deployments, each `app_meta` row needs to key on `(user_id, key)`. The repo API stays `get/set/delete(key)`; the implementation reads `auth.uid()` server-side.
3. **Realtime sync** — does layout-edit conflict between two browser tabs need Last-Write-Wins or CRDT? Today we don't have realtime at all. Phase G adds an import/export round-trip that surfaces the question; resolution is post-Supabase.
4. **`panel_states.applied_preset_ids` as `text[]` vs join table** — `text[]` keeps ordering free and matches the current shape, but it can't enforce FK integrity (hence invariant 9 stays app-level). A join table `panel_preset_applications(panel_id, preset_id, position)` would give us FK integrity at the cost of ordering complexity. Lean toward `text[]` for v1.
5. **Soft-delete vs hard-delete** — currently hard-delete with cascade. If we want recovery for "I deleted the wrong workspace," add `deleted_at` columns and exclude from queries — but that complicates the unique-default partial indexes.

---

## Ready-to-migrate checklist

This section grows as phases land. Phase A baseline:

- [x] All entities have stable ULID ids generated client-side.
- [x] Repository layer is the only path that touches IndexedDB.
- [x] Cascade behavior is centralized in the repos that own the parent.
- [x] No reactive state references repository internals.
- [ ] All UI flows pass through stores → repos (Phase C onward).
- [ ] Schema version handling for portable JSON (Phase G).
- [ ] Auth `canEdit` check stub is in place (Phase E).

---

## Phase B note — Panel Registry

The Panel Registry (`src/modules/panels/registry.ts`, Phase B) is **client-side only and does not migrate**. The registry is repopulated on every app boot via `registerBuiltinPanels()` and any downstream extension hooks. Only the `panel_states.panel_type` column carries a registry-id reference into storage — and that column is just `text`, validated client-side against the registry at restore time.

Implication for Supabase migration: if a downstream app removes a panel type from its registry, all `panel_states` rows referencing that type render the `MissingPanelPlaceholder` (Phase G). No DB-side enforcement needed; the placeholder + reassign UI handles the case.
