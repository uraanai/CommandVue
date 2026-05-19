import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { DEMO_SYMBOLS } from "@/modules/symbology/codes";
import { nanoid } from "@/utils/id";

export interface Entity {
  id: string;
  name: string;
  /** SIDC code (MIL-STD-2525 / APP-6) for symbology rendering. */
  sidc: string;
  affiliation: "friend" | "hostile" | "neutral" | "unknown";
  position: { lon: number; lat: number };
  altitudeMeters?: number;
  speedKnots?: number;
  headingDegrees?: number;
  lastSeen: number;
}

const NAMES = [
  "Aurora",
  "Beacon",
  "Cascade",
  "Dynamo",
  "Echo",
  "Falcon",
  "Granite",
  "Halcyon",
  "Iris",
  "Jade",
  "Kestrel",
  "Lyra",
  "Mosaic",
  "Nova",
  "Onyx",
  "Pelican",
  "Quartz",
  "Reef",
  "Sentinel",
  "Talon",
  "Umbra",
  "Vertex",
  "Whisper",
  "Xenon",
  "Yarrow",
  "Zephyr",
];

function randomEntity(index: number): Entity {
  const symbol = DEMO_SYMBOLS[index % DEMO_SYMBOLS.length]!;
  const name = NAMES[index % NAMES.length]!;
  return {
    id: nanoid(),
    name: `${name}-${String(index + 1).padStart(3, "0")}`,
    sidc: symbol.sidc,
    affiliation: symbol.affiliation,
    position: {
      lon: 68 + Math.random() * 5,
      lat: 28 + Math.random() * 5,
    },
    altitudeMeters:
      symbol.dimension === "air" ? Math.round(2000 + Math.random() * 10000) : undefined,
    speedKnots: Math.round(Math.random() * 200) / 10,
    headingDegrees: Math.round(Math.random() * 360),
    lastSeen: Date.now() - Math.floor(Math.random() * 60_000),
  };
}

function generateMockEntities(count: number): Entity[] {
  return Array.from({ length: count }, (_, i) => randomEntity(i));
}

/**
 * Entity store — mock data today; wires up to live WebSocket events in
 * Phase 6+ when the realtime client is consumed by panels.
 */
export const useEntitiesStore = defineStore("entities", () => {
  const entities = ref<Entity[]>(generateMockEntities(50));

  const totalsByAffiliation = computed(() => {
    const totals = { friend: 0, hostile: 0, neutral: 0, unknown: 0 };
    for (const entity of entities.value) {
      totals[entity.affiliation]++;
    }
    return totals;
  });

  function add(entity: Entity): void {
    entities.value.push(entity);
  }

  function remove(id: string): void {
    entities.value = entities.value.filter((e) => e.id !== id);
  }

  function update(id: string, patch: Partial<Entity>): void {
    const index = entities.value.findIndex((e) => e.id === id);
    if (index === -1) return;
    entities.value[index] = { ...entities.value[index]!, ...patch };
  }

  function clear(): void {
    entities.value = [];
  }

  return {
    entities,
    totalsByAffiliation,
    add,
    remove,
    update,
    clear,
  };
});
