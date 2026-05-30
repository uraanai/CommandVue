import { ref, type Ref } from "vue";

/**
 * App-wide confirmation prompt.
 *
 * One `ConfirmDialog` host is mounted once at the app root (`App.vue`) and
 * reads the module-level singleton below; any component, anywhere, triggers a
 * prompt by calling `useConfirm().confirm({ … })` and awaiting a boolean.
 * There is no per-call-site dialog state to leak — a closed prompt always
 * resolves and clears, so re-opening a list / dialog can never show a stale
 * "armed" affordance.
 *
 * Two entry points:
 *   - `confirm(options)` — always shows the modal; resolves `true` (confirm)
 *     or `false` (cancel / dismiss).
 *   - `confirmIf(needed, options)` — the prop-driven gate. When `needed` is
 *     `false` it resolves `true` immediately with **no modal** (the action
 *     proceeds directly); when `true` it behaves like `confirm`. This is the
 *     "confirm or not" switch destructive actions opt into:
 *
 *         if (!(await confirmIf(requireConfirm, { title: "Delete?", … }))) return;
 *         await doDestructiveThing();
 *
 * Design: a custom Volt-Dialog-based prompt rather than PrimeVue's
 * `ConfirmationService`. The CLAUDE.md mapping points 2-action confirms at
 * PrimeVue `ConfirmDialog`, but that requires registering a global service +
 * an unstyled-mode Volt wrapper the catalog doesn't ship; this composable +
 * `ConfirmDialog.vue` is the same ergonomics (await a boolean) with the
 * project's existing Volt Dialog styling and zero extra plugin wiring.
 */

export interface ConfirmOptions {
  /** Dialog headline. */
  title: string;
  /** Optional body sentence explaining the consequence. */
  message?: string;
  /**
   * Optional detail lines describing the target — e.g. its name, source, and
   * state — rendered as a compact info block so the user can confirm they're
   * acting on the right thing.
   */
  details?: string[];
  /** Confirm-button label. Default `"Confirm"`. */
  confirmLabel?: string;
  /** Cancel-button label. Default `"Cancel"`. */
  cancelLabel?: string;
  /** Render the confirm button as destructive (red). Default `false`. */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

// Singleton — shared by the host dialog and every caller.
const current = ref<ConfirmRequest | null>(null);

function confirm(options: ConfirmOptions): Promise<boolean> {
  // If a prompt is somehow already open, auto-cancel it so its promise never
  // strands (e.g. two rapid triggers). The newest request wins.
  if (current.value) {
    current.value.resolve(false);
    current.value = null;
  }
  return new Promise<boolean>((resolve) => {
    current.value = { ...options, resolve };
  });
}

function confirmIf(needed: boolean, options: ConfirmOptions): Promise<boolean> {
  return needed ? confirm(options) : Promise.resolve(true);
}

/**
 * Resolve the active prompt and close it. Called by the `ConfirmDialog` host
 * only — feature code uses `confirm` / `confirmIf`.
 */
function resolveCurrent(confirmed: boolean): void {
  current.value?.resolve(confirmed);
  current.value = null;
}

export function useConfirm(): {
  /** Reactive active request (null when no prompt is open). Host-only. */
  current: Readonly<Ref<ConfirmRequest | null>>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmIf: (needed: boolean, options: ConfirmOptions) => Promise<boolean>;
  resolveCurrent: (confirmed: boolean) => void;
} {
  // `current` is returned as a read-only-typed Ref (the interface marks it
  // Readonly); callers must mutate only via confirm / resolveCurrent. We don't
  // wrap with `readonly()` because its deep-readonly transform widens the inner
  // ConfirmRequest type and no longer matches the declared return type.
  return { current, confirm, confirmIf, resolveCurrent };
}

/** Test-only — clear any open prompt without resolving. */
export function __resetConfirmForTests(): void {
  current.value = null;
}
