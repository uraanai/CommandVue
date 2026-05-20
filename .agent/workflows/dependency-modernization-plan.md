# Dependency modernization — multi-phase plan

> **Status:** Active — Phases 1–2 complete; Phase 3 (vue-router) starting next.
>
> **2026-05-20 plan amendment:** During the original Phase 2 prep, `npm view vue-router@5.0.7` showed `peerDependencies: { pinia: '^3.0.4', '@pinia/colada': '>=0.21.2', ... }`. vue-router 5 has been redesigned around Pinia-backed state; it can no longer ship before pinia. Phases 2 and 3 have been **swapped**: pinia 3 first, then vue-router 5. The "phases are independent" claim above no longer holds — phase 3 (now `vue-router`) is **gated on** phase 2 (now `pinia`).
> **Started:** 2026-05-20
> **Goal:** Get the remaining 6 outdated packages to their latest majors, in phases, with each phase shipping as its own PR and the app verified clean between phases.
> **Lifetime:** This file lives in the repo only while the migration is in progress. It is **deleted in the final PR** once every phase completes.

---

## Why this exists

After a session of merging ~17 Dependabot PRs (see git log of 2026-05-19 → 2026-05-20), six packages still need real migration work — not just lockfile bumps. Each touches a load-bearing part of the app: state, routing, rendering, or the type system. Doing them all in one PR would be unreviewable and unverifiable.

This plan locks in the **order**, the **isolation boundary** for each phase, and the **verification gate** that must pass before moving on.

---

## Remaining outdated packages

| Package        | Current → Latest | Touches                                           |
| -------------- | ---------------- | ------------------------------------------------- |
| `echarts`      | 5.6.0 → 6.1.0    | `ChartPanel.vue` (rendering layer)                |
| `vue-echarts`  | 7.0.3 → 8.0.1    | `ChartPanel.vue` (peer of `echarts`)              |
| `vue-router`   | 4.6.4 → 5.0.7    | `src/router/`, scattered `useRouter` / `useRoute` |
| `pinia`        | 2.3.1 → 3.0.4    | `src/stores/*` (every store)                      |
| `dockview-vue` | 4.13.1 → 6.3.0   | `DockLayout.vue`, `useLayoutStore`, persistence   |
| `typescript`   | 5.9.3 → 6.0.3    | Toolchain (eslint TS parser, vue-tsc, vitest, …)  |

---

## Phase order + rationale

Lowest blast radius first; toolchain (TypeScript) last so the surrounding plugin ecosystem has more time to catch up.

| Phase | Scope                              | Why this order                                                              | Risk      |
| ----- | ---------------------------------- | --------------------------------------------------------------------------- | --------- |
| **1** | `echarts` + `vue-echarts` (paired) | Most isolated — affects one panel                                           | 🟡 Medium |
| **2** | `vue-router`                       | Scattered but well-defined surface; doesn't touch state or rendering        | 🟡 Medium |
| **3** | `pinia`                            | Affects all stores but the migration is mechanical (defineStore API stable) | 🟡 Medium |
| **4** | `dockview-vue`                     | Central to UX; needs manual click-through of every panel                    | 🔴 High   |
| **5** | `typescript`                       | Final — let plugins catch up; pull as a separate cleanup pass               | 🔴 High   |

Phases 1–4 are independent of each other (no shared files outside `package.json` / `pnpm-lock.yaml`). They can technically run in any order; the table above is the recommended path.

Phase 5 runs **after** all others land because TypeScript 6 may surface latent type issues that should be fixed against the new (post-migration) code surface, not the old one.

---

## Per-phase template

Every phase PR must:

1. **Branch name:** `chore/migrate-<package>` (e.g. `chore/migrate-echarts`).
2. **Read** the upstream migration guide before writing any code. Quote breaking changes in the PR description.
3. **Update** code to the new API. Don't add backward-compat shims — this is a template repo, downstream forks can re-introduce them.
4. **Gauntlet locally:** `pnpm lint && pnpm type-check && pnpm test && pnpm spell && pnpm build && pnpm docs:build`. All green before pushing.
5. **Manually verify** the panel(s) the change touches in `pnpm dev`. Don't trust CI for runtime behavior — the cleanup-race bug that bit us with the tool registry passed lint+types+tests but broke at runtime.
6. **Update this file** (mark the phase row as `✅ Done — <date> — PR #N`).
7. **Update `CHANGELOG.md`?** No — per the release-only policy in [`documentation-sync.md`](./documentation-sync.md), all of these will be summarized at the next release cut.

---

## Phase tracker

| Phase | Package(s)                               | Status               | PR        | Notes                                                                                  |
| ----- | ---------------------------------------- | -------------------- | --------- | -------------------------------------------------------------------------------------- |
| 1     | `echarts` 6 + `vue-echarts` 8            | ✅ Done — 2026-05-20 | #42       | Zero code changes — echarts 6 kept the subpath export contract stable.                 |
| 2     | `pinia` 3 _(swapped — was Phase 3)_      | ✅ Done — 2026-05-20 | (this PR) | Zero code changes — setup-fn `defineStore` syntax stable across 2 → 3. Tests 66/66.    |
| 3     | `vue-router` 5 _(swapped — was Phase 2)_ | ⏳ Gated on Phase 2  | —         | Peer-dep gated. Originally Phase 2; reordered on 2026-05-20 after the discovery above. |
| 4     | `dockview-vue` 6                         | ⏳ Not started       | —         |                                                                                        |
| 5     | `typescript` 6                           | ⏳ Not started       | —         |                                                                                        |

---

## Phase 1 — `echarts` 5→6 + `vue-echarts` 7→8

**Constraint:** `vue-echarts` 8 declares `echarts ^6` as a peer dependency. They must move together.

**Files expected to change:**

- `package.json` + `pnpm-lock.yaml` (both deps bumped)
- `src/components/panels/ChartPanel.vue` (vue-echarts import / `use([...])` registrations may have shifted)
- Possibly `dictionaries/tech.txt` if new terms surface in CSpell

**Breaking changes to read upstream:**

- echarts 6 release notes: https://github.com/apache/echarts/releases (look for 6.0.0 entry)
- vue-echarts 8 release notes: https://github.com/ecomfe/vue-echarts/releases (look for 8.0.0 entry — already known: drops echarts 5 peer, requires Vue 3.3+, manual-update + reactive option are mutually exclusive)

**Verification gate:**

- Full gauntlet green.
- `pnpm dev` → ChartPanel renders the 1 Hz synthetic signal without console errors.
- Switch theme dark/light → chart re-themes correctly (`tokens.css` overrides).

---

## Phase 2 — `vue-router` 4→5

**Breaking changes to read upstream:**

- Vue Router 5 migration guide: https://router.vuejs.org/guide/migration/ (when 5 docs are linked from changelog)
- Likely areas: `createRouter` signature, history modes, named routes vs path-only, `RouterView` slots.

**Files expected to change:**

- `src/router/routes.ts`
- `src/main.ts` (router registration)
- Any component using `useRouter` / `useRoute` — grep before editing.

**Verification gate:**

- Full gauntlet green.
- `pnpm dev` → Home / Demo / About all reachable.
- `?panel=<id>` query on `/demo` still mounts the isolated panel.
- Command palette navigation entries still work.

---

## Phase 3 — `pinia` 2→3

**Breaking changes to read upstream:**

- Pinia 3 changelog: https://github.com/vuejs/pinia/releases (look for 3.0 entry)
- Likely areas: `defineStore` setup-fn signature, `storeToRefs` typings, devtools integration, plugin API.

**Files expected to change:**

- Every file under `src/stores/` (verify each store still compiles).
- Possibly tests under `tests/unit/*-store.spec.ts`.

**Verification gate:**

- Full gauntlet green.
- `pnpm dev` → layout state survives a hard reload (idb persistence still functions).
- Telemetry buffer fills + caps at 50 messages.
- Drawing tool finalization adds to `useDrawingsStore`.

---

## Phase 4 — `dockview-vue` 4→6

**Critical context:** This skips a major (v5 is unreleased to us). Read **both** the 4→5 and 5→6 migration notes.

**Breaking changes to read upstream:**

- dockview-vue release notes: https://github.com/dockview/dockview/releases (v5.0.0 and v6.0.0 entries)
- Likely areas: panel registration shape, layout JSON format (this affects idb-persisted layouts!), event names, theme variable contract.

**Files expected to change:**

- `src/components/layout/DockLayout.vue`
- `src/stores/layout.ts` (if JSON shape changed)
- `src/assets/styles/dockview.css` (if CSS-variable names changed)
- `src/utils/storage.ts` (if layout payload needs versioned migration)

**Migration concern — persisted layouts:** If the layout JSON schema changed, existing users' idb-stored layouts may be invalid against v6. Add a version check + fall-back-to-defaults path. Document the breakage clearly.

**Verification gate:**

- Full gauntlet green.
- `pnpm dev` → every panel mounts correctly via the dock.
- Drag, resize, tab-stack still work.
- Reset layout button restores defaults.
- Hard reload restores the persisted layout (or falls back to defaults cleanly if the shape is incompatible).

---

## Phase 5 — `typescript` 5.9→6.0

**Wait condition:** Only start this phase when:

- Phases 1–4 are all merged.
- Surrounding tooling (`vue-tsc`, `@vue/tsconfig`, `@typescript-eslint/*`, `vitest`'s TS parser) has caught up. As of 2026-05-20, TS 6.0 is brand-new and many plugins lag.

**Breaking changes to read upstream:**

- TypeScript 6.0 release notes: https://devblogs.microsoft.com/typescript/ (announcement post)
- Likely areas: stricter inference, new lib defaults, deprecation removals.

**Files expected to change:**

- `package.json` (`devDependencies.typescript`)
- Possibly `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.vitest.json` (if compiler-option defaults changed)
- Any code where TS 6 surfaces a new strictness error.

**Verification gate:**

- Full gauntlet green.
- No new ts-expect-error / @ts-ignore added to work around stricter checks (fix the underlying types instead).

---

## Rollback

Each phase ships as one PR. If a phase lands and surfaces runtime issues that weren't caught by the verification gate, revert via:

```
gh pr create --title "Revert PR #N: <phase>" --base main
```

The deferred deps (`pinia`, `dockview-vue`, `typescript`) are tracked as closed Dependabot PRs (#35, #37, #39) for reference but are **not** the source of truth for the migration code — each phase's branch is.

---

## When this file gets deleted

The final PR of the migration (cleanup) deletes this file and removes its entry from `.agent/README.md`. At that point the [`documentation-sync.md`](./documentation-sync.md) workflow stays as the long-lived contract; this file was just scaffolding for one project.
