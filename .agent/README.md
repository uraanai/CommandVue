# Agent configuration

This directory holds configuration and instructions for AI coding agents (Claude Code, Cursor, Aider, and similar) working in this repository. Use it for agent-specific subconfigs, prompts, or helper scripts that complement the project tooling but are scoped to AI workflows.

The canonical agent guidance for CommandVue lives in [`../CLAUDE.md`](../CLAUDE.md) at the repo root — agents should read that first. Files in this directory are supplementary; they must not duplicate or contradict the rules in `CLAUDE.md`.

## Contents

- [`workflows/documentation-sync.md`](./workflows/documentation-sync.md) — the canonical "when I change X, what else do I update?" reference. Every agent must consult this before making non-trivial changes and apply the required updates in the same PR.
