/**
 * Severity vocabulary bridge + accent mapping for the {@link Toast} outlet.
 *
 * The project-facing severity names (`success | info | warning | danger`) and
 * the PrimeVue Toast names (`success | info | warn | error`) differ on two
 * entries; this module is the SINGLE source of that bridge so the producer
 * (`useNotify`) and the outlet styling agree.
 *
 * Toast visuals (Track A A-Toast): a neutral surface card (`--color-toast-*`)
 * with a small severity-colored icon — the modern admin pattern (Sonner /
 * Linear / shadcn) rather than a colored bar. Severity is conveyed by the icon
 * shape + its `--color-status-*` tint, both themeable. The icon colors live here
 * (a single source) so the slot template stays declarative.
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

/**
 * Tailwind class for a toast's severity icon color, keyed by the PrimeVue
 * severity carried on the message (`warn`/`error`, not `warning`/`danger`).
 * Resolves to a `--color-status-*` token so it follows the active theme;
 * `secondary` / `contrast` / unknown fall back to the neutral toast foreground.
 */
export function severityAccentClass(severity: string | undefined): string {
  switch (severity) {
    case "success":
      return "text-[var(--color-status-success)]";
    case "warn":
      return "text-[var(--color-status-warning)]";
    case "error":
      return "text-[var(--color-status-danger)]";
    case "info":
      return "text-[var(--color-status-info)]";
    default:
      return "text-[var(--color-toast-fg)]";
  }
}
