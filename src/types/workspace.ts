/**
 * Core types for the workspace / layout / panel-state subsystem.
 *
 * A {@link Workspace} owns a collection of {@link Layout}s. Each layout owns
 * a Dockview-serialized arrangement plus a list of {@link PanelState} records
 * describing the panels inside. {@link AppMeta} is a small key/value bag for
 * runtime pointers (current workspace, current layout, etc.) that doesn't
 * justify its own table.
 */

export type Ulid = string;

export type PanelType = string;

export type PanelAssignmentState = "empty" | "assigned" | "configured";

export interface Workspace {
  id: Ulid;
  name: string;
  description?: string;
  defaultLayoutId: Ulid | null;
  isGlobalDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Layout {
  id: Ulid;
  workspaceId: Ulid;
  name: string;
  description?: string;
  dockviewState: unknown;
  panelIds: Ulid[];
  createdAt: number;
  updatedAt: number;
}

export interface PanelState {
  id: Ulid;
  layoutId: Ulid;
  panelType: PanelType | null;
  assignmentState: PanelAssignmentState;
  state: Record<string, unknown>;
  appliedPresetIds: Ulid[];
  createdAt: number;
  updatedAt: number;
}

export interface AppMeta {
  key: string;
  value: unknown;
}
