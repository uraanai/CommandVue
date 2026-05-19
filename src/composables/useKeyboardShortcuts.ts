import { useEventListener } from "@vueuse/core";

import { SHORTCUTS, type ShortcutAction } from "@/modules/shortcuts/catalog";

export interface UseKeyboardShortcutsOptions {
  /** Called whenever a registered key combo fires. */
  onAction: (action: ShortcutAction) => void;
}

/**
 * Keyboard-shortcut binder.
 *
 * Reads the static catalog at `@/modules/shortcuts/catalog`, attaches a
 * single `keydown` listener to `window`, matches combos against the
 * `KeyboardEvent`, and dispatches the matching action via `onAction`.
 *
 * Inputs and textareas are skipped except for Escape and mod+k so the
 * user can always close a palette or escape an in-progress edit.
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  useEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (shouldSkip(event)) return;

      for (const shortcut of SHORTCUTS) {
        for (const combo of shortcut.keys) {
          if (matches(event, combo)) {
            event.preventDefault();
            options.onAction(shortcut.action);
            return;
          }
        }
      }
    },
    { capture: true },
  );
}

function shouldSkip(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const editable =
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
  if (!editable) return false;

  // Allow Escape and the global palette shortcut even while typing.
  const key = event.key.toLowerCase();
  const hasMod = event.ctrlKey || event.metaKey;
  if (key === "escape") return false;
  if (key === "k" && hasMod) return false;
  return true;
}

function matches(event: KeyboardEvent, combo: string): boolean {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const tokens = combo.toLowerCase().split("+");
  const key = tokens[tokens.length - 1]!;

  const wantsMod = tokens.includes("mod");
  const wantsCtrl = tokens.includes("ctrl") || (wantsMod && !isMac);
  const wantsMeta = tokens.includes("meta") || (wantsMod && isMac);
  const wantsShift = tokens.includes("shift");
  const wantsAlt = tokens.includes("alt");

  if (event.ctrlKey !== wantsCtrl) return false;
  if (event.metaKey !== wantsMeta) return false;
  if (event.shiftKey !== wantsShift) return false;
  if (event.altKey !== wantsAlt) return false;

  const eventKey = event.key.toLowerCase();
  if (key === "escape") return eventKey === "escape" || eventKey === "esc";
  if (key === "enter") return eventKey === "enter";
  return eventKey === key;
}
