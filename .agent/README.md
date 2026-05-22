# .agent — AI Agent Configuration

This directory holds configuration and reference material for AI coding agents working on CommandVue.

## Skills

Skills under `.agent/skills/` are loaded when an agent's task matches a skill's trigger conditions. Each skill scopes itself to a specific subsystem and bundles the data model, invariants, common mistakes, and copy-paste templates the agent needs to work in that area.

| Skill                           | Subsystem                                                         | Trigger files                                                                  |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `commandvue-workspace-system`   | Workspaces, layouts, panel-states, sessions, storage repositories | `src/stores/{workspace,layout,panelState,session}.ts`, `src/modules/storage/*` |
| `commandvue-panel-development`  | Panel Registry, panel components, lifecycle, state persistence    | `src/components/panels/*`, `src/modules/panels/*`                              |
| `commandvue-preset-development` | Preset types, preset application, cascading order                 | `src/modules/presets/*`, `src/stores/preset.ts`                                |
| `commandvue-chrome-system`      | Chrome registry, slots, edit mode, `canEdit` auth hook            | `src/modules/chrome/*`, `src/components/chrome/*`, `src/stores/chrome.ts`      |

Each skill directory contains:

- `SKILL.md` — the skill body with YAML frontmatter declaring trigger conditions.
- `reference/*.md` — deeper material the skill links to (data model details, common mistakes, copy-paste templates).

## Workflows

| File                              | Purpose                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `workflows/documentation-sync.md` | "When I change X, what else do I update?" Read before any non-trivial change. |

## Adding skills

When extending CommandVue with a new subsystem, add a corresponding skill under `.agent/skills/`. Skills are the project's long-term agent memory — keep them up to date as the system evolves.

Recommended skill layout:

```
.agent/skills/<name>/
├── SKILL.md                  ← YAML frontmatter + skill body
└── reference/
    ├── data-model.md         ← optional
    ├── common-mistakes.md    ← optional
    └── *-template.ts          ← optional copy-paste templates
```

## Canonical guidance

For high-level rules that apply to all agents in all sessions, see [`CLAUDE.md`](../CLAUDE.md) at the repo root. That file is the universal entry point; skills are scoped supplements.
