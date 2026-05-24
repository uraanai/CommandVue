## Summary

<!-- One paragraph: what changes, why now. -->

## Target branch

<!-- Confirm the PR base branch. -->

- [ ] This PR targets `develop` (default for feature work)
- [ ] This PR targets `main` (release PR only — squash-merge from develop)

## Type of change

<!-- Check one. -->

- [ ] `feat` — new feature or capability
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — code change that neither fixes a bug nor adds a feature
- [ ] `chore` — tooling, config, dependency updates
- [ ] `perf` — performance improvement
- [ ] `test` — adding or fixing tests
- [ ] `ci` — CI configuration change
- [ ] `release` — version bump and changelog update

## Linked prompt and phase

<!-- For work done via a Claude Code prompt sequence, note which prompt and phase. -->

- Prompt: <!-- e.g., "Prompt 1 — TanStack DataTable & governance" -->
- Phase: <!-- e.g., "Phase 2 — Build the DataTable wrapper" -->

## Verification

<!-- Confirm the verification block from the prompt passed. -->

- [ ] `pnpm install` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes
- [ ] `pnpm spell` passes
- [ ] `pnpm build` succeeds
- [ ] Manual smoke test (if applicable) completed — describe below

### Manual smoke test notes

<!-- What did you click through? What worked, what didn't? -->

## Governance flags

<!-- Tick any that apply to this PR. -->

- [ ] This PR introduces a usage of `primevue/datatable` (default is `@tanstack/vue-table`; justify below)
- [ ] This PR adds a new external dependency (justify below)
- [ ] This PR modifies content under `dictionaries/` (terminology change)
- [ ] This PR modifies `CLAUDE.md`, `.agent/skills/`, or `docs/supabase-migration.md` (knowledge artifacts)
- [ ] This PR introduces a breaking change

### Justification for any flagged item

<!-- Required if any governance flag was ticked. -->

## Screenshots or recordings

<!-- For UI changes, attach before/after. -->

## Documentation impact

- [ ] No documentation changes needed
- [ ] Updated `CLAUDE.md` to reflect new conventions
- [ ] Updated `docs/...` for end users or downstream consumers
- [ ] Updated `.agent/skills/...` to keep agent knowledge in sync
- [ ] Updated `CHANGELOG.md` under `[Unreleased]`

## Reviewer notes

<!-- Anything specific to look at, areas of risk, follow-ups deferred. -->
