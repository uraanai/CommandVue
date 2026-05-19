/**
 * Declarative keyboard-shortcut catalog.
 *
 * One source of truth for both the runtime binding (`useKeyboardShortcuts`)
 * and the help dialog (TBD). New shortcuts go here; the consumer maps the
 * `action` string to a store call.
 *
 * `mod` is the platform-conditional Cmd-on-mac / Ctrl-elsewhere modifier.
 */

export type ShortcutScope = "global" | "map" | "palette";

export type ShortcutAction = "palette.open" | "tool.deactivate" | `tool.${string}`;

export interface ShortcutDef {
  /** Key combos. Multiple combos can map to the same action. */
  keys: readonly string[];
  /** Where the shortcut is meaningful. Documentation hint for now. */
  scope: ShortcutScope;
  /** Human-readable label for the help dialog and command palette. */
  label: string;
  /** Action id the consumer dispatches on. */
  action: ShortcutAction;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  {
    keys: ["mod+k"],
    scope: "global",
    label: "Open command palette",
    action: "palette.open",
  },
  {
    keys: ["escape"],
    scope: "map",
    label: "Deactivate current tool",
    action: "tool.deactivate",
  },
  {
    keys: ["m"],
    scope: "map",
    label: "Measure distance",
    action: "tool.measure-distance",
  },
  {
    keys: ["p"],
    scope: "map",
    label: "Draw polygon",
    action: "tool.draw-polygon",
  },
];

export function findShortcutForAction(action: ShortcutAction): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.action === action);
}

/** Render a key combo for display, e.g. `mod+k` → `⌘K` on Mac, `Ctrl+K` else. */
export function formatCombo(combo: string, isMac = detectMac()): string {
  return combo
    .split("+")
    .map((token) => {
      const t = token.toLowerCase();
      if (t === "mod") return isMac ? "⌘" : "Ctrl";
      if (t === "meta") return isMac ? "⌘" : "Win";
      if (t === "ctrl") return "Ctrl";
      if (t === "shift") return "⇧";
      if (t === "alt") return isMac ? "⌥" : "Alt";
      if (t === "escape") return "Esc";
      if (t === "enter") return "↵";
      return token.length === 1 ? token.toUpperCase() : token;
    })
    .join(isMac ? "" : "+");
}

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform);
}
