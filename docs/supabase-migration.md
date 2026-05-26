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
- [x] All UI flows pass through stores → repos (Phase C complete — workspace / layout / panelState / session stores wrap the repos; no component touches a repo directly).
- [ ] Schema version handling for portable JSON (Phase G).
- [ ] Auth `canEdit` check stub is in place (Phase E).

---

## Phase B note — Panel Registry

The Panel Registry (`src/modules/panels/registry.ts`, Phase B) is **client-side only and does not migrate**. The registry is repopulated on every app boot via `registerBuiltinPanels()` and any downstream extension hooks. Only `panel_states.panel_type` carries a registry-id reference into storage — and that column is just `text`, validated client-side against the registry at restore time.

Implication for Supabase migration: if a downstream app removes a panel type from its registry, all `panel_states` rows referencing that type render the `MissingPanelPlaceholder` (Phase G). No DB-side enforcement needed; the placeholder + reassign UI handles the case.

---

## Phase C note — Stores and session

Phase C introduced four Pinia stores (`workspace`, `layout`, `panelState`, `session`) that wrap the repositories. None of the stores hold IndexedDB state directly; they're read-through caches that re-fetch via `*.loadAll` / `*.loadForWorkspace` / `*.loadForLayout`.

### Current-pointer persistence

Two `app-meta` keys carry the "where am I" pointer across reloads:

| Key                    | Type   | Owner               |
| ---------------------- | ------ | ------------------- |
| `current-workspace-id` | `Ulid` | `useWorkspaceStore` |
| `current-layout-id`    | `Ulid` | `useLayoutStore`    |

These are written every time `setCurrentWorkspace` / `setCurrentLayout` runs. In Supabase, the same keys live in `app_meta(user_id, key, value)` — RLS scopes them per user automatically.

### DockviewApi is intentionally outside Pinia state

`useSessionStore` holds the `DockviewApi` reference in a **module-scope `shallowRef`**, not in the Pinia state surface. CLAUDE.md's architectural rule 4 forbids non-serializable values in stores; the module-scope ref keeps the live API reachable from store actions without leaking into devtools / persistence / Supabase Realtime. No migration impact — the API only exists in-browser.

### Dirty-flag semantics

`session.dirty` flips `true` on every `onDidLayoutChange` from Dockview and clears on `updateCurrentLayout` / `loadLayout` / `discardChanges`. Dockview state and dirty tracking live entirely client-side — they don't migrate. Supabase Realtime conflict resolution (Last-Write-Wins vs CRDT) remains an open question (#3 in the original Open Questions section); the dirty flag gives us a clean place to gate optimistic-vs-pessimistic merge later.

### `saveCurrentAsNewLayout` deep-clone pattern

The session store implements layout fork-on-save: capture the current `dockviewState.toJSON()`, allocate fresh ULIDs for every panel-state, rewrite the panel-id references inside the serialized JSON via string replace (same approach as `layoutRepo.duplicate`), then insert the new layout with its cloned panel-states. In Postgres, this becomes a single transactional `INSERT ... RETURNING` chain — the client still allocates the ULIDs.

---

## Phase D note — Menu bar, dialogs, panel-creation flows

Phase D is **UI-only and does not migrate** — every action delegates to the Phase C stores, which in turn delegate to the Phase A repositories. The migration path is unchanged.

Notable Phase D pieces worth pinning down:

- **`UnassignedPanel.vue` swap pattern.** Dockview-vue has no `setComponent` API, so changing a panel's component type means `containerApi.addPanel({ id, component: newType, position: { referenceGroup: currentGroup, direction: 'within' } })` followed by `currentPanel.api.close()`. The panel id is preserved, which keeps cross-references intact (`layout.panelIds`, `panel.appliedPresetIds`). Same pattern will apply in a Supabase-backed deployment.
- **`View → Add Empty Panel` and `View → Add Component`** allocate a new ULID client-side, write a `panel-states` row, then ask Dockview to mount the panel as `floating: true`. Order matters: the panel-state must exist before Dockview mounts the component (Phase G readers).
- **`view.toggleComponents` (`Cmd/Ctrl+B`)** looks up the components-browser panel via `panelStateStore.listForLayout()` rather than via `DockviewApi.panels[].component` — the public `IDockviewPanel` doesn't expose the component-type field.
- **Manage Workspaces dialog auto-creates a "Default" layout** for each new workspace so invariant 6 (≥1 layout per workspace) is satisfied before the user switches into it. In Supabase this becomes a server-side trigger or a `WITH ... INSERT` chain.
- **Permission gating:** `canEdit` is the Phase E hook for auth. Phase D's menu items and dialogs are all enabled today; once Phase E lands the `canEdit` computed in `useChromeStore`, the menu items / WorkspaceSwitcher should consult it (left as a Phase E task — Phase D does not gate).

---

## Phase E note — Chrome system

Phase E introduces `chrome-profiles` (already in the Phase A schema) as a fully managed entity. Two migration-relevant points:

- **Slot assignments persist as JSONB.** `chrome_profiles.slot_assignments` is `jsonb` mapping `ChromeSlot → text[]`. The shape matches `ChromeProfile.slotAssignments` 1:1; no transformation needed on read.
- **`canEdit` is the auth seam.** `useChromeStore.canEdit` returns `true` in Phase E (stubbed). In a Supabase-backed deployment, this computed should read from a session store populated by Supabase Auth — e.g. `canEdit = computed(() => sessionStore.user?.role === 'admin' || sessionStore.user?.role === 'editor')`. The chrome store's actions (`enterEditMode`, `addItemToSlot`, etc.) already gate on `canEdit`, so flipping the source is the entire integration surface.

### Drag-and-drop deferred

Phase E ships an **Add Item dropdown + Remove badge** affordance for edit-mode mutations, **not** full pointer-driven drag-and-drop. The store API (`moveItem(itemId, fromSlot, toSlot, position)`) is in place and exercised by the dropdown flow; a later phase can wire `@atlaskit/pragmatic-drag-and-drop` onto the same store action without changing the data model. No migration impact either way.

---

## Phase F note — Presets system

Phase F lifts `presets` from "schema-only" to a fully managed entity with a typed registry, per-workspace scoping, and runtime application.

### Schema stays as Phase A specified

`presets` table shape is unchanged from the Phase A DDL sketch. The decision deferred in **Open question 1** (org-level vs user-level globals) is unblocked now:

- `workspaceId: null` continues to mean "global to this user." For the upcoming Supabase migration, **add nullable `org_id` and `is_system` columns**:
  - `org_id IS NOT NULL` → org-global (visible to every member of the org).
  - `is_system = true` → system-global (shipped by the template / platform admin).
  - All-null (`org_id IS NULL AND is_system = false AND workspace_id IS NULL`) → user-global, today's behavior.
- The repo API stays `presetRepo.listGlobal()` / `listForWorkspace(id)` — under the hood, `listGlobal` becomes `WHERE workspace_id IS NULL AND (user_id = auth.uid() OR org_id = current_setting('app.org_id') OR is_system)`.

### Panel-instance registry

`src/modules/panels/instances.ts` is a non-Pinia, **module-scope** map of `panelId → imperative handle`. It exists to bridge `PresetTypeDefinition.applyToPanel(panelId, config)` to the live panel instance (MapLibre map, Cesium viewer, ECharts chart). Same reasoning as the DockviewApi in the session store — non-serializable, intentionally out of Pinia state, doesn't migrate.

### Runtime application is per-panel

Each panel that supports presets watches its `appliedPresetIds` and iterates `presetTypeRegistry.get(typeId).applyToPanel`. This phase wires **MapLibrePanel** as the proof-of-concept: `useMapLibre()` returns the map, MapLibrePanel registers it via `registerPanelInstance(api.id, map)` on mount, and a `watch` re-applies presets on any change. `MAP_STYLE_PRESET.applyToPanel` reads the map by id and calls `map.setStyle`.

`map-overlay` and `chart-theme` ship as registered types with stub `applyToPanel` implementations that warn to the console. Downstream apps replace these with tailored implementations (or override the entire definition by re-registering after `registerBuiltinPresetTypes()`).

### `updatePreset` propagates via the repo

When a preset's config is edited, `usePresetStore.updatePreset` scans `panel-states` for every record that references the preset id and re-runs `applyToPanel` against the live instance for each. In Supabase, this can be replaced with Realtime — subscribe to `presets` UPDATE events filtered to the active workspace, and re-apply locally on receipt.

---

## Phase G note — Portable JSON + per-panel state + missing-panel fallback

Phase G wraps the system with three additions that all live entirely on the existing schema:

### Portable JSON (`schemaVersion: 2`)

`src/modules/workspaces/portable.ts` exports / imports a single workspace as a self-contained JSON blob: workspace + layouts + panel-states + workspace-scoped presets + (optionally) the active chrome profile. Every ULID is regenerated on import, panel-id refs inside `dockviewState` are rewritten via the same string-replace pattern used by `layoutRepo.duplicate`, and preset refs in `panel-states.appliedPresetIds` are remapped to the new ids. Unknown preset refs are silently dropped (invariant 9). Imports refuse mismatched `schemaVersion` or non-CommandVue payloads.

**Migration impact:** none. The blob is client-format only — the server side will use Postgres `COPY ... TO STDOUT (FORMAT json)` for export and a parameterized `INSERT ... SELECT ... RETURNING` chain for import. The contract (one workspace per blob, fresh ids on import, ref rewriting) stays identical.

### Per-panel state persistence

`src/composables/usePanelState.ts` is the shared helper. Panels opt in by passing `{ serialize, restore }`; the composable debounces writes (400 ms default), flushes on unmount, and marks `session.dirty`. Phase G wires:

- **MapLibrePanel** — `{ center, zoom, bearing, pitch }`, save triggered on `moveend` / `zoomend` / `rotateend` / `pitchend`.
- **MarkdownPanel** — `{ content }`, save triggered on textarea input + "Done" button.

Cesium / Entity-list / Chart / Telemetry panels are unchanged — their state is rich enough that wiring is per-app and would constrain downstream customization. The composable + repo are ready for any panel to opt in later.

### MissingPanelPlaceholder + `__missing__` synthetic type

`src/components/panels/MissingPanelPlaceholder.vue` + `src/modules/panels/missing.ts` reserve the `__missing__` synthetic id. DockLayout's `rebuildFromPanelStates` falls back to this when a panel-state references an unregistered `panelType` (common after import from a different build). The user can Reassign (keeps the panel id intact, preserves preset refs) or Remove.

**Migration impact:** none. The fallback runs entirely client-side against the panel registry. After migration, the server returns the panel-state row as-is; the client decides whether the type resolves.

### custom-themes store (Prompt 4 Phase A)

New IndexedDB object store added at database version 2 (`src/modules/storage/db.ts`). ULID primary keys, indexed by `name` and `source`. Holds only `source` ∈ { `user`, `imported`, `generated` } themes — built-ins ship as JSON and are registered, never stored. Written through `themeRepo`, which enforces 8 invariants at write time (ULID id, name uniqueness per source, source enum, known-token names, CSS-injection safety, mode, density, generation-block shape).

**Supabase mapping (future):**

- Table: `themes`
- Row schema: `id` (ulid PK), `user_id` (fk users), `name`, `description`, `author`, `source`, `mode`, `density`, `tokens` (jsonb), `generation` (jsonb nullable), `created_at` (bigint unix-ms), `updated_at` (bigint unix-ms)
- RLS: a user sees only their own themes, plus org-shared themes once org sharing lands.
- Migration: read every `custom-themes` row from IndexedDB, upsert into `themes` by `id`.

**Known-token validation:** currently enforced at write time in `themeRepo` against `src/modules/themes/knownTokens.ts`. When server-authoritative, the same allow-list should run on the Supabase side via a database trigger or edge function — the token allow-list is the safety boundary that keeps arbitrary CSS (and injection vectors) out of the rendered document.

**Workspace-binding cleanup:** `themeRepo.delete` scans `app-meta` keys with prefix `commandvue:workspace-theme-` and clears any binding pointing at the deleted theme. Server-side this becomes an `ON DELETE` cascade / trigger from `themes` to the workspace-binding column.
