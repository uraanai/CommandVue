# Themes

CommandVue ships six built-in theme variants and a runtime picker so operators can match the dashboard to their environment without writing CSS. Themes are layered on top of the token foundation from Phase 3.1 and the Light / Dark / Auto toggle from Phase 3.2.

This page is the user-facing guide. For the architecture and how to author a custom theme programmatically, see [`docs/design-tokens.md`](./design-tokens.md).

## The six built-in variants

| Theme                    | Mode  | Density     | Vibe                                                                           |
| ------------------------ | ----- | ----------- | ------------------------------------------------------------------------------ |
| **Compact Light**        | light | compact     | High-density operational. Slate neutrals, blue accent. The default.            |
| **Compact Dark**         | dark  | compact     | Same dense layout, deep slate surfaces, bright blue accent for late-night ops. |
| **Command Center Light** | light | compact     | Operations-console aesthetic. Sharp corners, teal accent, mono data layer.     |
| **Command Center Dark**  | dark  | compact     | Deep navy + teal. Reference theme for 24/7 ops rooms.                          |
| **Admin Panel Light**    | light | comfortable | Friendly admin. Generous spacing, violet accent, rounded corners.              |
| **Admin Panel Dark**     | dark  | comfortable | Softer dark admin. The kind of dashboard you can stare at for hours.           |

Each theme overrides ~30–40 semantic + component tokens. Primitive scales (the OKLCH color palettes, the spacing scale, the radius scale) are untouched — themes pick different stops on the same primitives.

## Switching themes

**View → Themes…** opens the picker dialog. Click **Apply** on any card to switch the whole app to that theme. The choice persists to IndexedDB and survives reloads.

If you tick **Set as default for this workspace** before applying, the theme is bound to the active workspace — switching to a different workspace reverts to that workspace's bound theme (or the global default if the new workspace has no binding). This lets one workspace own a command-center aesthetic while another stays on the friendly admin look.

## Pairing convention — Light/Dark/Auto toggle

Themes come in light + dark pairs sharing a base id with a `-light` / `-dark` suffix (`compact-light` ↔ `compact-dark`, etc.).

The Sun / Moon / Monitor toggle in the chrome top-right cycles between **Light**, **Dark**, and **Auto** mode:

- **Light** → applies the light variant of the current pair if one exists; otherwise just sets `data-theme="light"` on `<html>`.
- **Dark** → mirror, for the dark variant.
- **Auto** → follows `prefers-color-scheme`. When the OS flips between light and dark, the variant flips with it.

This means switching modes never drops you back to a generic theme — your chosen aesthetic carries across.

If a theme has no paired variant (e.g. a custom one-off), the toggle still works but just sets the `data-theme` attribute and lets the default dark cascade in `tokens.css` take over.

## Per-workspace binding

Each workspace can have its own bound theme. The lookup chain on app load (and on workspace switch) is:

1. `commandvue:workspace-theme-{workspaceId}` in IndexedDB — workspace-bound theme (highest precedence).
2. `commandvue:theme-id` in IndexedDB — global default.
3. `compact-light` — fallback.

Bound theme indicators show as small colored dots in the workspace switcher dropdown. Hover the dot to see "Theme: \<name\>".

## Customizing the built-ins

The six JSON files live at `src/assets/themes/*.json`. Each is a `PortableTheme` shape:

```jsonc
{
  "id": "your-theme-id",
  "name": "Your Theme",
  "description": "One-paragraph elevator pitch.",
  "author": "Your Name",
  "mode": "light", // intrinsic mode for the variant pairing
  "density": "comfortable", // applies to data-density attribute
  "tokens": {
    // Keys WITHOUT the leading `--`. Values can be hex, oklch(), or
    // var() references into the primitive scale.
    "color-surface-base": "var(--color-slate-50)",
    "color-interactive": "var(--color-blue-600)",
    "color-status-success": "var(--color-green-600)",
    // ... 30-50 tokens total
  },
}
```

To bundle a new theme as a built-in:

1. Drop the JSON under `src/assets/themes/`.
2. Add the import + entry in `src/modules/themes/builtin.ts`'s `BUILTIN_PORTABLE` array.
3. (Optional) Add a dot color in `WorkspaceSwitcher.vue`'s `THEME_DOT_COLORS` map.
4. If the theme becomes the documentation default, re-capture the screenshots listed in `docs/public/concepts/MANIFEST.md`.

To register a theme from a downstream app (without forking CommandVue), call `themeRegistry.register(theme)` after `registerBuiltinThemes()` in `main.ts`. The picker dialog picks it up automatically via the registry subscription.

## What themes should NOT override

- **Primitive tokens** (`--color-slate-500`, `--space-4`, `--text-sm`, …). Themes pick stops; the scale itself stays constant. Overriding primitives breaks the token contract and produces unpredictable results across components that reference different layers.
- **Density values directly.** Themes set `density: "compact"` etc., which switches the `data-density` attribute; the attribute drives the `--density-*` tokens from `tokens.css`. Themes that hardcode `--density-row-height` bypass the density mode system.
- **The `data-theme` attribute.** That's owned by `useTheme()`. Themes set their _intrinsic_ mode via the `mode` field; the apply engine writes the attribute as part of applying the theme.

## Theme application engine internals

When `applyTheme(theme)` runs:

1. Reads `data-theme-applied` on `<html>` (JSON array of keys from the previous theme), removes each stale `--key` from the inline style.
2. Writes every `theme.tokens` entry as `root.style.setProperty('--key', value)`.
3. Stores the new key list back into `data-theme-applied`.
4. Sets three identity attributes: `data-theme-id`, `data-theme`, `data-density`.

The Tailwind `@theme` defaults in `tokens.css` apply when no `:root` inline override exists, so a theme that overrides only 10 tokens cleanly inherits the other ~80.

## Roadmap — not yet supported (Prompt 4)

Phase 3.3 ships the **runtime foundation** for themes. The Prompt-3 brief explicitly defers the in-app **authoring** surface to Prompt 4 — _"Do not start runtime theme authoring in this prompt"_. So today there's no UI path to:

- **Upload a custom theme JSON file** from the picker. A user who wants to add their own theme has to either edit source (`src/assets/themes/` + register in `builtin.ts`) or call `themeRegistry.register(theme)` from a downstream extension hook.
- **Validate a `PortableTheme` payload at runtime.** The `PortableTheme` TypeScript type exists for the bundled JSON loader, but there's no runtime validator — malformed input would either crash at `JSON.parse` or pass through with bad token keys that the apply engine silently writes (then ignores).
- **Edit a theme inside the app.** No in-app editor for token tweaking. Source-level JSON edits + page reload is the only path.
- **Export / duplicate / save-as.** The picker only applies; it doesn't read out the current theme as JSON or clone an existing built-in into a new custom theme.
- **Bind workspace cleanup.** Workspace deletion doesn't cascade-clear the workspace-bound theme key (`commandvue:workspace-theme-{wsId}`); the orphan persists until manually cleared.

Prompt 4 builds all of this on top of the registry + apply engine the runtime already exposes. The foundation is deliberate: `PortableTheme`, `themeRegistry.register()`, and the `applyTheme()` engine were designed so the authoring layer is mechanical to add — no architectural pivots needed.

If you need a workaround today:

- **Downstream apps** can register custom themes by importing `themeRegistry` in their own `main.ts` (after `registerBuiltinThemes()`) and calling `themeRegistry.register({...})` with a hand-constructed `Theme` object.
- **Template forks** can drop new JSON files alongside the six built-ins and add them to `BUILTIN_PORTABLE` in `src/modules/themes/builtin.ts`.

## References

- [`docs/design-tokens.md`](./design-tokens.md) — token foundation + Light/Dark/Auto toggle docs
- `src/types/theme.ts` — `Theme`, `PortableTheme`, `ThemeMode`, `ThemeDensity` types
- `src/modules/themes/registry.ts` — singleton registry
- `src/modules/themes/builtin.ts` — built-in registration
- `src/modules/themes/apply.ts` — application engine
- `src/stores/theme.ts` — Pinia store, persistence, workspace binding
- `src/assets/themes/*.json` — the six built-in variants
- `tests/unit/themes/` — unit tests
- Phase 3.3 of Prompt 3 — design rationale
