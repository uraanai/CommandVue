# Documentation sync workflow

This file is the **canonical reference for cross-file consistency** in CommandVue. Whenever an AI agent (or human contributor) makes a change to the codebase, this table tells you what else needs to be updated **in the same PR** so the docs, AI instructions, and runtime configuration never drift out of step.

> Read this **before** you start a non-trivial change, not after. It's much cheaper to update three files in one PR than to chase doc drift across four reviewers.

---

## How to use

1. Identify what your change is (left column of the table below).
2. Apply every update listed in the right column **in the same commit / PR**.
3. If your change matches multiple rows, apply them all.
4. If your change doesn't appear here and you think it's load-bearing, **add a new row in this PR** before merging. Future agents read this file, not your commit message.

The "Quality gates" in [`CONTRIBUTING.md`](../../CONTRIBUTING.md#quality-gates) catch broken sidebar links and missing dictionary terms automatically — but they do **not** catch doc-staleness. That's what this file is for.

---

## Triggers and required updates

### Code & dependency changes

| Trigger                                                   | Update these                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Add / rename / remove a **`pnpm` script**                 | `README.md` Scripts table; `CONTRIBUTING.md` Quality gates (if it's CI-relevant)                                                     |
| Add a **runtime dependency** (anything in `dependencies`) | `README.md` Stack table; `CLAUDE.md` Locked technology stack table                                                                   |
| Remove a **runtime dependency**                           | `README.md` Stack table; `CLAUDE.md` Locked technology stack table; grep for stale references in `docs/*.md`                         |
| Add a **devDependency**                                   | Update tooling docs only if user-facing (e.g., a new linter, formatter, test framework). Internal-only bumps don't need doc updates. |
| Add a **new environment variable**                        | `README.md` Configuration table; `.env.example`; `docs/deployment.md` Environment variables table                                    |
| Add a **new keyboard shortcut**                           | `src/modules/shortcuts/catalog.ts`; the catalog drives the help dialog automatically — no separate doc page to update                |
| Add a **new pnpm script**                                 | `README.md` Scripts table; `CLAUDE.md` if the script affects an agent workflow                                                       |
| Bump **Node** or **pnpm** minimum                         | `package.json` `engines`; `.nvmrc`; `README.md` Requirements; `CONTRIBUTING.md` "Required:" line; CI workflow matrix                 |

### Feature additions

| Trigger                                         | Update these                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **New panel**                                   | Create under `src/components/panels/`; register in `src/components/layout/DockLayout.vue` `components` map; add to default layout if it should appear by default; document in `docs/panels.md` (anatomy + registration); add a query-string entry in `DemoView.vue` if you want isolated-panel testing |
| **New tool** (measure / draw / select / custom) | Implement under `src/modules/tools/`; export in `src/modules/tools/index.ts` (`TOOLS` array); register a shortcut in `src/modules/shortcuts/catalog.ts`; document in `docs/tools.md` (worked example); add a TitleBar toggle button if you want chrome UI for it                                       |
| **New composable**                              | Add under `src/composables/`; follow the lifecycle contract (init in `mount`, teardown in `onBeforeUnmount`); document in the relevant `docs/*.md` if user-facing                                                                                                                                      |
| **New Pinia store**                             | Add under `src/stores/`; one concern per store; re-export from `src/stores/index.ts`; document in `docs/state.md` if non-trivial                                                                                                                                                                       |
| **New realtime message type**                   | Document in `docs/realtime.md`; ensure the envelope shape matches `WsMessage<T>`                                                                                                                                                                                                                       |
| **New icon**                                    | Use the right pack per `CLAUDE.md` Icon usage rules; named imports only — never `import *`                                                                                                                                                                                                             |

### Documentation site

| Trigger                                                       | Update these                                                                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a **new `docs/*.md` page**                                | Register in `docs/.vitepress/config.ts` sidebar (under the right section); cross-link from any related existing page; run `pnpm docs:build` to verify |
| **Rename** a `docs/*.md` page                                 | Update the sidebar entry; search the repo for the old filename to fix incoming links (`README.md`, other `docs/*.md`, `CLAUDE.md`)                    |
| **Remove** a `docs/*.md` page                                 | Remove from sidebar; remove all incoming links                                                                                                        |
| Change the **landing page** (`docs/index.md`) hero / features | Keep the README "Why CommandVue" section consistent with the landing-page hero — they should read as written by the same person                       |

### Tooling / configuration

| Trigger                          | Update these                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| New **CSpell-flagged word**      | Add to `dictionaries/operations.txt` / `project.txt` / `tech.txt` (pick the category that matches); **never** to `cspell.json` |
| New **ESLint rule override**     | Document the rationale inline in `eslint.config.ts` (one-line comment); no separate doc page                                   |
| New **Tailwind plugin or token** | Update `docs/styling.md` if user-facing; update `docs/theming.md` if it affects theming                                        |
| New **CI workflow** step         | Update `CONTRIBUTING.md` Quality gates if contributors need to run it locally                                                  |
| New **Husky hook**               | Document in `CONTRIBUTING.md`; explain how to bypass safely if there's a legitimate need                                       |

### Lifecycle events

> **CHANGELOG policy:** `CHANGELOG.md` is **release-only**. Do not modify it on bug-fix, feature, breaking-change, or deprecation PRs. The entry is written **once, at release time**, as a curated summary of everything since the last tag. The `[Unreleased]` section is a placeholder — leave it empty between releases. See "Cut a release" below for the only row that touches the file.

| Trigger                                                                                        | Update these                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bug fix** that's user-visible                                                                | Update affected `docs/*.md` if behavior changed. **No `CHANGELOG.md` edit.** The PR description carries the rationale for the eventual release summary.                                                                                                                         |
| **Bug fix** that's internal-only (e.g., test harness, dev-tooling)                             | No doc updates required.                                                                                                                                                                                                                                                        |
| **Breaking change** (anything in `src/composables/`, `src/modules/`, `src/stores/` public API) | Update affected `docs/*.md`. Lead the PR title with `feat!:` / `fix!:` (or include a `BREAKING CHANGE:` footer) so the next release walk catches it. **No `CHANGELOG.md` edit.**                                                                                                |
| **Deprecate** a public API                                                                     | Add a `@deprecated` JSDoc tag in the code; update affected `docs/*.md`; keep working until next major. **No `CHANGELOG.md` edit.**                                                                                                                                              |
| **Cut a release**                                                                              | Walk `git log <last-tag>..HEAD`, group by Keep-a-Changelog section (Added / Changed / Deprecated / Removed / Fixed / Security), write a single `[X.Y.Z] — YYYY-MM-DD` summary block in `CHANGELOG.md`; bump `package.json` `version`; tag the commit; publish a GitHub Release. |
| **Security fix**                                                                               | `SECURITY.md` if the disclosure process changed; coordinated disclosure first. The CHANGELOG entry is folded into the next release summary; do **not** write to `[Unreleased]` mid-cycle.                                                                                       |

### Repository identity

| Trigger                        | Update these                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change **license**             | `LICENSE`; `package.json` `license`; `README.md` License section; `CONTRIBUTING.md` License of contributions section                                           |
| Change **maintainer / author** | `package.json` `author`; `README.md` Credits; `CODE_OF_CONDUCT.md` reporting address; `SECURITY.md`                                                            |
| Change **repo URL**            | `package.json` `homepage` / `repository` / `bugs`; `README.md` badges + Quick start; `CONTRIBUTING.md`; `docs/.vitepress/config.ts` `socialLinks` + `editLink` |

---

## Anti-patterns

Things this workflow exists to **prevent**:

- **Stealth additions.** "Just dropping a new script in `package.json`" — the README scripts table will silently rot until someone notices. Sync it in the same commit.
- **Doc-only refactors that diverge from code.** Renaming a function in `src/` without grepping `docs/` for references leaves the docs lying. Always grep.
- **Per-PR CHANGELOG drafts.** The CHANGELOG is **release-only and summary-style** — never write to `[Unreleased]` from a feature / fix / breaking-change PR. The release walk reads `git log` and the PR descriptions; that's the source material. Leaving the file alone between releases keeps it clean and prevents stale half-entries.
- **Adding a new dependency without updating the stack table.** The stack table is a hard contract — `CLAUDE.md` instructs future agents to "not substitute libraries from this list without explicit instruction." If you add one without updating the table, the next agent doesn't know it's locked in.
- **Inventing a new doc trigger without recording it here.** If you find yourself updating three files for the same change repeatedly, that's a missing row in this table.

---

## When this file itself changes

If you add a row to the table above, that's the same commit as the change that triggered the need for it. Don't open a separate PR.

If you remove a row (e.g., we deleted the `docker:*` scripts), remove the row in the same PR as the deletion.

This file is a living contract. It only works if it stays accurate.

---

## See also

- [`CLAUDE.md`](../../CLAUDE.md) — top-level agent guidance. Has a short pointer to this file under "Keeping documentation in sync."
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — human-contributor quickstart and quality gates.
- [`.agent/README.md`](../README.md) — agent-folder index.
