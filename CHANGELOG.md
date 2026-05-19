# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project scaffold: Vue 3 + Vite + TypeScript (strict) + Vue Router 4 + Pinia, packaged via pnpm 10 workspaces.
- Project-references TypeScript layout (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json`) with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `verbatimModuleSyntax` enabled.
- Repository identity and governance: Apache 2.0 LICENSE, Contributor Covenant 3.0 code of conduct, security disclosure policy, contributor guidelines, and AI-agent guidance in `CLAUDE.md`.
- Folder skeleton for `src/` (components, composables, modules, stores, router, views, types, utils), `docs/`, `dictionaries/`, `.github/`, `.vscode/`, and `public/`.
- Home / Demo / About views wired through Vue Router with lazy route components; baseline Pinia plugin registration.

### Changed

### Deprecated

### Removed

### Fixed

### Security

[Unreleased]: https://github.com/uraanai/CommandVue/compare/main...HEAD
