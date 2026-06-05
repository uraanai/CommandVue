import type { Tab } from "@/components/ui/Tabs.vue";

/**
 * LOCKED by Phase C6 (spec §4) — do not reorder or rename without maintainer
 * sign-off. C1/C2/C4/C5 fill the corresponding tab bodies; they MUST NOT edit
 * this list. Guarded by tests/unit/components/panels/studioTabs.spec.ts.
 */
export const STUDIO_L1_TABS = [
  { id: "generate", label: "Generate" },
  { id: "tokens", label: "Tokens" },
  { id: "typography", label: "Typography" },
  { id: "panels", label: "Panels & Chrome" },
  { id: "effects", label: "Effects" },
] as const satisfies readonly Tab[];

export type StudioL1TabId = (typeof STUDIO_L1_TABS)[number]["id"];
