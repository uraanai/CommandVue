# CommandVue & ENGAGE — Internal Roadmap

> **Internal document. Do not reference from public docs, READMEs, or changelogs.**
> Stored under `.internal/` so it stays in version history but outside the public-facing `docs/` tree.
> Last updated: May 2026

---

## What's been built (Prompts 0–4)

The CommandVue foundation is complete once all four prompts are merged into `develop` and released to `main`:

- **Prompt 0** — GitFlow workflow, branch protection, PR templates, label system
- **Prompt 1** — TanStack DataTable wrapper with virtualization, density modes, governance rules
- **Prompt 2** — Volt evaluation, PrimeVue-first compliance audit and migration across entire UI layer
- **Prompt 3** — Three-layer design token system, Light/Dark/Auto toggle with anti-FOUC persistence, six built-in theme variants
- **Prompt 4** — Runtime theme authoring: Linear-style 3-input generation engine, custom theme storage (IndexedDB), constrained editor UI, per-workspace binding, JSON import/export, LLM-friendly schema docs

---

## Roadmap

### Theming

**Raw JSON editor with live preview**
Power-user authoring surface. Embed Monaco or CodeMirror inside the theme authoring dialog. Debounced validation as user types. Live preview with rollback on error. Diff view against current theme. Foundation fully in place after Prompt 4 (schema, Zod validator, application engine, registry). Needs UX thinking on guardrails before building. Medium effort.

**Theme variants beyond light/dark**
High-contrast mode and color-blind safe mode. The generation algorithm already supports both — the UI just doesn't expose the knobs yet. Low effort once Phase E is shipped.

**Theme marketplace / community sharing**
Browse and install community themes from inside the app. Needs server infrastructure. Later.

---

### Storage and sync

**Undo/Redo across stores**
Unified command pattern across Dockview state, panel state, preset state, and chrome state. Currently stubbed as disabled menu items. Multi-week effort. Needs a clean command bus design before starting.

**Multi-user real-time collaboration**
Workspace and layout sync across multiple operators simultaneously. WebSocket protocol is in the stack; the actual sync layer isn't implemented. Directly depends on Supabase realtime.

**Per-user permissions for edit mode**
The `canEdit` flag is hardcoded `true` everywhere in the codebase. Real implementation needs Supabase auth + role check wired to the chrome system's existing `canEdit` extension point.

---

### Supabase integration

This is the cross-cutting dependency that unlocks most of the above:

- **Auth layer** → unlocks `canEdit`, per-user themes, org-level sharing
- **Database backend** → replaces IndexedDB as the authority store for workspaces, layouts, presets, custom themes
- **Realtime** → enables multi-user collaboration
- **Migration path** → `docs/supabase-migration.md` has been tracking every relevant decision since Prompt 0

Start here before tackling anything in the storage/sync section.

---

### Maps and visualization

**OrbPro / space domain visualization**
DigitalArsenal's CesiumJS-based space visualization library (OrbPro2). npm package available. Commercial license — contact `info@digitalarsenal.io`. Related open repos: SDA-TAP-LAB, spacedatastandards.org, OrbPro-Small-Language-Model. Deferred pending licensing decision.

**Operational symbology layer on MapLibre/Cesium**
`milsymbol` and `@orbat-mapper/convert-symbology` are in the stack. The actual symbol rendering layer on MapLibre and Cesium 3D globe is demo-only. Full implementation needs proper symbol lifecycle management, clustering, and performance testing at scale.

---

### Platform and data connections

**Real-time telemetry data feeds**
WebSocket via VueUse `useWebSocket` is in the stack. The telemetry panel consuming live sensor/feed data is currently demo-only. ENGAGE will need real protocol adapters (STANAG, Cursor-on-Target, etc.).

**ROS2 integration for UAV**
Bridge between ROS2 topics and the CommandVue WebSocket layer. Referenced in the original BVIS/ENGAGE backend stack.

**OSINT data feeds**
World Monitor (OSINT/news aggregation) and GlobalCity WorldView are sister products under the Uraan AI brand. Eventually these feed data into CommandVue panels via the real-time layer.

---

### Developer experience and ecosystem

**Workspace templates**
Save a workspace layout as a named template, spawn new workspaces from it. Different from layouts (which live inside a workspace). More like "starter configs" for different operator roles: ISR analyst, fleet manager, comms officer.

**Plugin/extension API**
Downstream apps (ENGAGE, World Monitor, custom forks) currently extend CommandVue by forking. A proper plugin API for registering new panel types, preset types, chrome items, and theme presets without touching core CommandVue code would make it a real platform rather than just a template.

**Component library publishing**
The UI primitives from Prompt 2 (Button, Input, Dialog, etc.) are internal to CommandVue right now. Publishing them as a standalone npm package lets other Uraan AI products consume them without duplication.

---

### Quality and compliance

**Full accessibility audit**
Each phase adds ARIA basics but a real WCAG AA audit with a screen-reader user hasn't happened. Required before any government or enterprise procurement review of ENGAGE.

**Internationalization (i18n)**
All UI strings currently English. i18n infrastructure is non-trivial; not in scope until a specific customer requirement drives it. Arabic is the obvious first target given Pakistan/GCC context.

**Mobile/tablet responsive layout**
CommandVue is explicitly desktop-first by design. A mobile-capable layout system is its own substantial design effort. Not blocking ENGAGE v1.

---

### Portfolio and credibility (Uraan AI public presence)

These are not CommandVue features but directly feed ENGAGE's launch readiness. The strategy: establish public portfolio credibility before ENGAGE's full launch so enterprise clients find something when they search.

| Project                      | Purpose                                                                | Effort     |
| ---------------------------- | ---------------------------------------------------------------------- | ---------- |
| World Monitor Dashboard      | Public OSINT feed aggregator. Fastest credibility build.               | Low–Medium |
| NATO Symbol Playground       | Interactive milsymbol browser. Demonstrates domain knowledge publicly. | Low        |
| Conflict Zone Heatmap        | Public data visualization. SEO + portfolio value.                      | Low        |
| UAV Fleet Simulator Demo     | WebSocket + Cesium demo, ENGAGE-adjacent.                              | Medium     |
| AI Geopolitical Briefing Bot | LLM + OSINT, demonstrates AI integration angle.                        | Medium     |
| Defense Tech Digest          | Newsletter. Builds audience before ENGAGE launch.                      | Ongoing    |
| OSINT Threat Classifier      | ML demo, shows technical depth.                                        | Medium     |

**Recommended launch order:** World Monitor Dashboard first (fastest, most broadly understood), then NATO Symbol Playground (domain-specific credibility), then the rest in parallel with ENGAGE development.

---

### Strategic (ENGAGE-specific)

**GIDS Pakistan partnership**
Global Industrial and Defence Solutions — Pakistan's largest state-owned defense manufacturer. Identified as highest-priority potential client/partner for ENGAGE. Direct outreach contact: CEO Asad Kamal.

Positioning: technology integration opportunity (ENGAGE as a capability GIDS adds to their product portfolio), not employment. This framing is faster and more strategically valuable.

**Next step:** Initiate outreach once at least one public portfolio project (World Monitor Dashboard or NATO Symbol Playground) is live — having a working URL changes the conversation from "trust us" to "here's what we build."

**ENGAGE v1 launch readiness**
CommandVue is the platform. ENGAGE is the product. The four-prompt sequence gave you the platform; product-specific work starts now:

- Real operational data adapters
- Training institution feature set
- Classified/operational network deployment considerations
- ENGAGE-specific branding on top of CommandVue's theme system

---

## Priority order

```
1. Supabase auth
   └── unlocks: edit mode gating, per-user themes, multi-user collab

2. Portfolio credibility (runs in parallel with ENGAGE development)
   ├── World Monitor Dashboard
   └── NATO Symbol Playground

3. GIDS outreach
   └── after at least one portfolio project is live

4. ENGAGE v1 feature development
   ├── Real data adapters (STANAG, CoT, WebSocket feeds)
   ├── Training institution UX
   └── ENGAGE-specific theme and branding layer

5. Everything else from the roadmap above
   ├── Undo/Redo (after Supabase, needs stable data model)
   ├── Multi-user collab (after Supabase realtime)
   ├── OrbPro integration (after licensing resolved)
   └── Plugin API (when third-party extensibility becomes a real need)
```

---

## Local model workflow note

For ENGAGE development specifically — where code contains denser domain-specific vocabulary that can trip Claude Code's content filter — the planned hybrid approach:

- Claude.ai (this interface) for architecture and planning
- Claude Code for scaffolding and standard files
- Local models via Ollama + Aider for sensitive file generation (Qwen2.5-Coder or DeepSeek-Coder)

Ollama is already running locally with `qwen3:14b`. Aider integration is planned.

---

_This file is for internal tracking only. Review and update as priorities shift._
