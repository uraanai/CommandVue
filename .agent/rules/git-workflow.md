# Git & workflow

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Commit conventions

Conventional Commits, enforced by commitlint:

- `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `perf:`, `style:`

---

## Branch and workflow conventions

CommandVue uses a GitFlow-style workflow. **Agents working in this repo must follow it:**

- **Never commit directly to `main` or `develop`.** Both are protected.
- **All feature work begins from `develop`.** Pull latest before branching.
- **One branch per logical unit of work.** Conventional naming: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`.
- **PRs target `develop` by default.** Use `gh pr create --base develop`.
- **PRs to `main` are release PRs only**, opened from a short-lived `release/vX.Y.Z` branch cut from `develop` (see [Release PRs](#release-prs) below), titled `release: <version>`.
- **Dependency updates target `develop`, not `main`.** `.github/dependabot.yml` sets `target-branch: develop`, so Dependabot PRs flow through `develop` like all other work and reach `main` via the release branch — `main` never diverges on manifests. (Dependabot reads its config only from the default branch `main`, so edits to that file take effect once they land on `main`.)
- **After each phase, stop and wait for PR merge** before starting the next phase. Do not chain phases without merge confirmation.
- **PR titles follow Conventional Commits.** Match the type to the work: `feat:` for new capabilities, `fix:` for bug fixes, `docs:` for docs-only, etc.

### The required sequence (feature work)

```bash
git checkout develop && git pull origin develop    # start from clean develop
git checkout -b <type>/<short-slug>                # feature branch first, BEFORE any edits
# … edit, commit (lint-staged + commitlint hooks run automatically) …
git push -u origin <type>/<short-slug>             # push branch
gh pr create --base develop --title "<conventional-commit-style>" --body "<summary + test plan>"
# Stop and wait for the user to merge. Do not auto-merge.
```

**Branch naming:** mirror the Conventional Commit prefix — `feat/...`, `fix/...`, `chore/...`, `docs/...`, `refactor/...`.

### Release PRs

Release PRs are the only PRs that target `main`. They are **not** opened straight from `develop` — cut a short-lived `release/vX.Y.Z` branch so the version bump, changelog, and `.internal/` strip never touch `develop`:

1. `git checkout -b release/vX.Y.Z` off the latest `develop`.
2. Bump `version` in `package.json`; add the `[X.Y.Z]` section to `CHANGELOG.md` (+ footer compare links).
3. `git rm -r --cached .internal` — strip the private planning docs so the `no-internal-on-main` guard passes. They stay tracked on `develop`; the back-merge keeps them there.
4. PR `release/vX.Y.Z → main`, titled `release: <summary> vX.Y.Z`. **Squash-merge** once CI is green (`main` requires linear history).
5. Tag the squashed commit on `main` (`git tag -a vX.Y.Z <sha> && git push origin vX.Y.Z`) and create the GitHub Release from the changelog section.
6. **Back-merge `main → develop` with a _merge commit_** (`chore: back-merge vX.Y.Z release into develop`), then delete the release branch. The merge commit is mandatory — see [Merge method — by PR type](#merge-method--by-pr-type). It carries only the version bump + changelog (dependencies already live on `develop`); keep `develop`'s `.internal/`.

### Branch protection

| Branch    | `enforce_admins` | Linear history | Merge methods                            |
| --------- | ---------------- | -------------- | ---------------------------------------- |
| `main`    | `true`           | required       | squash only (enforced by linear history) |
| `develop` | `false`          | not required   | squash or merge commit                   |

Both branches require the same status checks before merge:

- `Lint · Type-check · Test · Build` — `.github/workflows/ci.yml`, job `quality`
- `CSpell` — `.github/workflows/cspell.yml`, job `spell`

Both workflows fire on PRs to either `main` or `develop`.

**Approval policy:** the maintainer (`awaisali88`) self-merges; required approvals is `0`. Do not raise this to 1+ until a second collaborator exists. **Do NOT auto-merge PRs without checking with the user first** — the user approves every merge.

### Merge method — by PR type

**Squash to integrate work; merge-commit to sync branches.** The method is per-PR-type, not one-size-fits-all — picking one for everything breaks one of the two:

| PR type                                  | Method                          | Why                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature / fix / docs / chore → `develop` | **Squash**                      | Collapses a branch's WIP commits into one clean conventional-commit per unit of work — readable history, trivial revert, clean changelog generation. ~95% of PRs.                                                                |
| Release `release/vX.Y.Z → main`          | **Squash** (or rebase)          | `main` requires linear history; one commit per release keeps the public history clean.                                                                                                                                           |
| Back-merge `main → develop`              | **Merge commit** (never squash) | A back-merge's job is to record that `develop` _contains_ `main`'s release commit. Squashing copies the content but **severs the ancestry link** → Git's merge-base breaks → the next release PR hits a spurious conflict storm. |

### Critical "don'ts"

- **Never run `git push origin main`** or `git push origin develop` — both will be rejected.
- **Never edit `main` or `develop` directly.** Confirm `git branch --show-current` is a feature branch before any edit.
- **Never amend a published commit** or force-push — both blocked by protection.
- **Never skip the PR** for "trivial" changes — required CI checks only run on PRs.
- **Never use `--merge` for PRs to `main`** — main requires linear history; squash or rebase the merge method.

### If you've already made changes on a protected branch by mistake

1. Don't push, don't panic.
2. `git checkout -b <type>/<slug>` — your modifications follow you to the new branch.
3. Stage, commit, push, open PR as normal. The recovery is invisible to reviewers.

### How to inspect / modify branch protection

- `gh api repos/uraanai/CommandVue/branches/main/protection`
- `gh api repos/uraanai/CommandVue/branches/develop/protection`

Settings live there; don't loosen without the user's explicit go-ahead.

---

## Internal planning documents

Private planning and strategic documents live under `.internal/`. They are
tracked in git (intentionally, for version history) but are not part of the
public `docs/` tree.

Rules for agents:

- Never reference `.internal/` files from public-facing documentation, READMEs,
  changelogs, or agent-skill files
- Never suggest moving `.internal/` content into `docs/`
- When asked to update the roadmap or internal planning docs, edit files under
  `.internal/` directly
- `.internal/` contents are not browsable by the public; treat them as private
  even though they are in the repo
