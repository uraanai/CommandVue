/**
 * Chrome — the persistent application UI surrounding the dock (menu bar,
 * status bar, slot-based items). Chrome is split into named {@link ChromeSlot}s
 * that hold an ordered list of {@link ChromeItemId}s.
 *
 * A {@link ChromeProfile} captures the user's complete chrome arrangement
 * (slot assignments, hidden items, bar visibility). Exactly one profile has
 * `isDefault: true` at any time.
 */

import type { Ulid } from "./workspace";

export type ChromeSlot =
  | "top-left"
  | "top-center"
  | "top-right"
  | "status-left"
  | "status-center"
  | "status-right";

export type ChromeItemId = string;

export interface ChromeProfile {
  id: Ulid;
  name: string;
  isDefault: boolean;
  slotAssignments: Record<ChromeSlot, ChromeItemId[]>;
  hiddenItems: ChromeItemId[];
  menuBarVisible: boolean;
  statusBarVisible: boolean;
  createdAt: number;
  updatedAt: number;
}

export const CHROME_SLOTS: readonly ChromeSlot[] = [
  "top-left",
  "top-center",
  "top-right",
  "status-left",
  "status-center",
  "status-right",
] as const;
