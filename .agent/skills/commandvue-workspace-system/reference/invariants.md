# Invariants

| #   | Rule                                                  | Repo enforcement                                            | Postgres enforcement                                       |
| --- | ----------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Exactly one workspace has `isGlobalDefault: true`     | `workspaceRepo.setGlobalDefault` atomic transaction         | Unique partial index `WHERE is_global_default`             |
| 2   | Every workspace has a valid `defaultLayoutId`         | Stores update on layout delete                              | FK `workspaces.default_layout_id → layouts.id` (nullable)  |
| 3   | Layout belongs to exactly one workspace               | `layouts.workspaceId` non-null in `create`                  | FK NOT NULL                                                |
| 4   | Panel-state belongs to exactly one layout             | `panelStates.layoutId` non-null in `create`                 | FK NOT NULL                                                |
| 5   | At least one workspace always exists                  | `workspaceRepo.delete` count check                          | App-level (no clean DB constraint); same repo check        |
| 6   | At least one layout per workspace                     | `layoutRepo.delete` count check via `by-workspace` index    | Trigger `BEFORE DELETE ON layouts` raise if peer count = 0 |
| 7   | Exactly one chrome profile is `isDefault: true`       | `chromeProfileRepo.setDefault` atomic transaction           | Unique partial index `WHERE is_default`                    |
| 8   | Workspace-scoped presets cascade with workspace       | `workspaceRepo.delete` cascades to `presets` `by-workspace` | `ON DELETE CASCADE`                                        |
| 9   | Dangling preset refs in panel-states silently dropped | At apply time: `presetTypeRegistry.get(typeId) → undefined` | App-level (text[] FK is awkward in Postgres)               |

## Where each enforcement lives

- **#1, #7** — atomic flip in the repo (`setGlobalDefault`, `setDefault`). Reads every record, writes the ones that need updating, all in one transaction.
- **#2** — `layoutRepo.delete` checks `workspaces.defaultLayoutId === deletedId` and re-points to the oldest survivor.
- **#3, #4** — type-level (non-null fields on the create input).
- **#5, #6** — `delete` opens a count via the appropriate index and throws `InvariantError` if the result is ≤ 1.
- **#8** — `workspaceRepo.delete` iterates `presets.index('by-workspace').getAll(id)` and deletes each.
- **#9** — at the `presetStore.applyToPanel` call site; the panel-state record keeps the stale id until next save (which lazily strips it via portable export round-trips).

## Don't add new invariants to the repo layer

If your downstream app has an additional rule ("Ops layouts must be prefixed with 'OPS-'"), wrap the repo call in your own helper. Don't push the rule into `layoutRepo.create` — the repo layer is for invariants that hold for every CommandVue deployment.

## Test seam

`tests/unit/storage/helpers.ts → resetStorage()` wipes the IDB database between tests so each spec starts clean. See `tests/unit/storage/workspaceRepo.spec.ts` for the canonical "every invariant fires" test pattern.
