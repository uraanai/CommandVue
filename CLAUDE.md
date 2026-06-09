# CommandVue — Claude Code / Agent Instructions

This file is read by Claude Code and other AI coding agents at the start of every session. It defines the project's stack, conventions, and rules so agents produce consistent, high-quality code.

The full ruleset is split into focused modules under [`.agent/rules/`](./.agent/rules) and imported below. Claude Code expands every `@import` inline at session start, so the complete ruleset still loads as one — this split is for maintainability, not a reduction in what's loaded. **Edit the relevant module, and keep the import list below in sync when you add or remove one.**

---

## Agent skills

Project-specific agent guidance lives in [`.agent/skills/`](./.agent/skills). Four skills cover the four workspace-system subsystems: `commandvue-workspace-system`, `commandvue-panel-development`, `commandvue-preset-development`, `commandvue-chrome-system`. Each skill bundles its subsystem's data model, invariants, common mistakes, and copy-paste templates. When working in one of those areas, the relevant skill is the canonical source — read it before making changes.

---

## Rule modules

**Project & stack** — what CommandVue is, the locked technology stack, the "don't add" list, brand colors:
@./.agent/rules/project-and-stack.md

**UI & components** — library-first / PrimeVue-first rules, the component mapping table, DataTable (TanStack), icons, styling:
@./.agent/rules/ui-and-components.md

**Architecture & conventions** — architectural rules, the Panel / Chrome / Preset registries, state, file & testing conventions:
@./.agent/rules/architecture.md

**Git & workflow** — commit conventions, the GitFlow branch/PR rules, branch protection, `.internal/`:
@./.agent/rules/git-workflow.md

**Verification** — runtime verification after major version bumps, the `vue-tsc` cache gotcha, the two-stage verification protocol:
@./.agent/rules/verification.md

**Libraries, gotchas & knowledge** — Context7-first rule, Cesium / milsymbol gotchas, the documentation-sync table, the memory surfaces:
@./.agent/rules/libraries-and-knowledge.md
