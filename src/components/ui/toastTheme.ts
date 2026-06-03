/**
 * Severity → message-class mapping for the {@link Toast} outlet (Track A A1b).
 *
 * Pure token references only — every color comes from the `--color-toast-*` /
 * `--color-status-*` theme tokens (defined in `tokens.css`, re-emitted by the
 * generator on a status override), so a theme recolors every toast with no code
 * edit. That is also why this lives in its own module: keeping the class strings
 * here makes them unit-testable AND keeps the single-source guard
 * (`scripts/check-single-source.mjs`) satisfied — there are no raw color
 * literals, only `var(--…)` token lookups.
 *
 * PrimeVue toast severities are `success | info | warn | error | secondary |
 * contrast` (note `warn`/`error`, which map onto our `warning`/`danger` token
 * families). Anything unrecognized — `secondary`, `contrast`, or an absent
 * severity — falls back to the neutral toast surface.
 */

/** Shared shape: rounded card, subtle full border, thicker left accent stripe. */
const BASE = "rounded-md border border-l-4 shadow-lg px-3 py-2 text-sm";

/** Neutral (default / secondary / contrast) — surface-raised card, no accent. */
const NEUTRAL =
  "border-[var(--color-toast-border)] border-l-[color:var(--color-toast-border)] bg-[var(--color-toast-bg)] text-[var(--color-toast-fg)]";

/** Per-severity: subtle family fill, solid family text, family-colored stripe. */
const BY_SEVERITY: Record<string, string> = {
  success:
    "border-[var(--color-toast-border)] border-l-[color:var(--color-status-success-border)] bg-[var(--color-toast-success-bg)] text-[var(--color-toast-success-fg)]",
  info: "border-[var(--color-toast-border)] border-l-[color:var(--color-status-info-border)] bg-[var(--color-toast-info-bg)] text-[var(--color-toast-info-fg)]",
  warn: "border-[var(--color-toast-border)] border-l-[color:var(--color-status-warning-border)] bg-[var(--color-toast-warning-bg)] text-[var(--color-toast-warning-fg)]",
  error:
    "border-[var(--color-toast-border)] border-l-[color:var(--color-status-danger-border)] bg-[var(--color-toast-danger-bg)] text-[var(--color-toast-danger-fg)]",
};

/**
 * Resolve the class string for one toast message from its PrimeVue severity.
 * Unknown / absent severities resolve to the neutral surface.
 */
export function toastMessageClass(severity?: string): string {
  return `${BASE} ${BY_SEVERITY[severity ?? ""] ?? NEUTRAL}`;
}
