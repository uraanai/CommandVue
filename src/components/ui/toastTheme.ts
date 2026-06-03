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

/**
 * The project-facing severity vocabulary (`success | info | warning | danger`)
 * and the PrimeVue Toast vocabulary (`success | info | warn | error`). They
 * differ on two names; this module is the SINGLE source of the bridge so both
 * the styling (`toastMessageClass`) and the producer (`useNotify`) agree.
 */
export type NotifySeverity = "danger" | "info" | "success" | "warning";
export type ToastSeverity = "error" | "info" | "success" | "warn";

/** The seven canonical PrimeVue Toast positions (no arbitrary placement). */
export type ToastPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "top-center"
  | "top-left"
  | "top-right";

/** Map a project severity onto the PrimeVue severity `Toast.add` expects. */
export function toPrimeSeverity(severity: NotifySeverity): ToastSeverity {
  if (severity === "warning") return "warn";
  if (severity === "danger") return "error";
  return severity;
}

/** Shared shape: rounded card, subtle full border, thicker left accent stripe.
 *  `pointer-events-auto` re-enables clicks on the message itself — the outlet
 *  root is `pointer-events-none` so its empty region never blocks the page. */
const BASE = "pointer-events-auto rounded-md border border-l-4 shadow-lg px-3 py-2 text-sm";

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
