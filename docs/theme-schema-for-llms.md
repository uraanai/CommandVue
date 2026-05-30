# Theme schema for LLM generation

This page is a **prompt template**. Paste everything in the "Prompt template"
section below into a chat with any capable LLM (Claude, GPT-4, Gemini), add
your color preferences, and the model will produce a valid CommandVue theme
JSON that you can import via **View → Import theme…** (or the **Import…**
button in the Themes picker).

CommandVue validates every imported theme — unknown token names, unsafe CSS
values, and wrong schema versions are rejected with a clear message — so a
slightly-off LLM result fails safe rather than corrupting your setup.

> Prefer not to hand-author? The in-app customizer (**View → Create new
> theme…**) generates a complete, accessibility-checked theme from 3–4 inputs.
> This LLM path is for when you want a specific palette described in words
> ("a high-contrast amber CRT terminal theme") without picking values yourself.

---

## Prompt template

Copy everything between the lines into your LLM chat:

---

You are generating a **CommandVue theme JSON file**. Output ONLY valid JSON
matching the schema below — no commentary, no markdown fences.

**My preferences:** _[describe what you want — e.g. "a calm dark theme with a
teal accent for a maritime operations dashboard", or "match the Anthropic
brand: warm off-white background, clay/rust accent"]_

### Envelope shape

```json
{
  "schemaVersion": 1,
  "exportedAt": 0,
  "exportedBy": "commandvue",
  "exportedByVersion": "llm",
  "theme": {
    "id": "my-theme-id",
    "name": "My Theme",
    "description": "One short sentence.",
    "author": "",
    "source": "imported",
    "mode": "light",
    "density": "comfortable",
    "tokens": {
      "--color-surface-base": "oklch(0.98 0.005 250)"
    },
    "createdAt": 0,
    "updatedAt": 0
  }
}
```

- `mode` is `"light"` or `"dark"`.
- `density` is `"compact"`, `"comfortable"`, or `"spacious"`.
- `id` can be any string — CommandVue reassigns it a real ULID on import.
- `createdAt` / `updatedAt` / `exportedAt` can be `0` — they're restamped on import.

### Token keys you may set

Set any subset. Anything you omit inherits a sensible default. **Every key you
include must be from this list** — unknown keys are rejected.

**Surfaces** (backgrounds, ordered by elevation):
`--color-surface-base`, `--color-surface-raised`, `--color-surface-overlay`,
`--color-surface-sunken`

**Text:**
`--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`,
`--color-text-disabled`, `--color-text-inverse`

**Borders:**
`--color-border-subtle`, `--color-border-default`, `--color-border-strong`

**Interactive (the accent — buttons, links, selection):**
`--color-interactive`, `--color-interactive-hover`, `--color-interactive-active`,
`--color-interactive-subtle`, `--color-on-interactive`, `--color-focus-ring`

**Accent scale (drives every accented control — set all 10 to fully re-skin
the UI accent, or omit and rely on `--color-interactive`):**
`--color-accent-50`, `--color-accent-100`, `--color-accent-200`,
`--color-accent-300`, `--color-accent-400`, `--color-accent-500`,
`--color-accent-600`, `--color-accent-700`, `--color-accent-800`,
`--color-accent-900`

**Status (keep the semantic meaning — green/amber/red/blue):**
`--color-status-success` + `--color-status-success-subtle`,
`--color-status-warning` + `--color-status-warning-subtle`,
`--color-status-danger` + `--color-status-danger-subtle`,
`--color-status-info` + `--color-status-info-subtle`

**Typography (optional):** `--font-family-sans`, `--font-family-mono`

There are additional component-level keys (datatable, menubar, dialog, etc.)
and a `--color-p-surface-*` scale; most themes don't need them because they
inherit from the semantic tokens above. The authoritative allowlist lives in
`src/modules/themes/knownTokens.ts`.

### Value format

- **Colors:** OKLCH is strongly preferred — `oklch(L C H)` where `L` is 0–1,
  `C` is ~0–0.4, `H` is 0–360. Example: `oklch(0.55 0.18 250)`. Hex, `rgb()`,
  and `hsl()` are also accepted.
- **Fonts:** a CSS font-family stack string, e.g.
  `"'Inter', system-ui, sans-serif"`.
- No JavaScript, no `<script>`, no `expression(`, no `javascript:` — these are
  rejected as unsafe.

### Rules

1. Every token key must be from the allowlist above.
2. **Surfaces follow elevation:** in light mode `surface-base` is the darkest
   of base/raised/overlay (raised + overlay are lighter); in dark mode the
   reverse, and `surface-base` is a deep grey, never pure black.
3. **Text must contrast its surface:** `--color-text-primary` should clear
   ~4.5:1 against `--color-surface-base` (WCAG AA). `--color-on-interactive`
   must clear ~4.5:1 against `--color-interactive`.
4. **Status hues stay semantic:** success ≈ 145°, warning ≈ 75°, danger ≈ 27°,
   info ≈ 250°. Don't recolor these to match the accent.
5. Output ONLY the JSON object — no prose, no code fences.

### Before you output, verify

- Are surface elevations ordered correctly for the mode?
- Does primary text clear ~4.5:1 against `surface-base`?
- Are the status hues in their semantic families?
- Is every key in the allowlist?

If any check fails, fix it before responding.

---

End of prompt template.

## Tips

- **Be specific.** "A muted slate dark theme with a single cyan accent, for
  long night shifts" beats "make it look nice".
- **Reference palettes you like:** "in the spirit of Solarized Dark" or
  "Tailwind's `zinc` scale as the surfaces".
- **Ask for a pair:** "give me both a light and a dark version" — the model
  produces two JSON files; import both, then the Light/Dark toggle bridges
  them once you re-pair them in the customizer.
- **After import you can keep editing:** imported themes show up in the Themes
  picker; open the customizer to fine-tune (note: only themes that carry a
  `generation` block are editable there — a purely hand-written import is
  applied as-is).

## What happens on import

1. CommandVue parses the JSON and checks `schemaVersion`.
2. It validates the structure + every token name + CSS-value safety with Zod.
3. It resolves any id/name clash with your chosen policy (import a copy /
   replace / skip).
4. A fresh ULID is assigned and the theme is stored, re-stamped as
   `source: "imported"`, and added to the picker.

See [`docs/theme-generation-algorithm.md`](./theme-generation-algorithm.md)
for how the in-app generator derives these same tokens from high-level inputs,
and [`docs/themes.md`](./themes.md) for the theme system overview.
