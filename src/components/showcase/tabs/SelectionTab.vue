<script setup lang="ts">
import { ref } from "vue";

import Select from "@/components/ui/Select.vue";
import AutoComplete from "@/volt/AutoComplete.vue";
import Checkbox from "@/volt/Checkbox.vue";
import Fieldset from "@/volt/Fieldset.vue";
import Listbox from "@/volt/Listbox.vue";
import MultiSelect from "@/volt/MultiSelect.vue";
import RadioButton from "@/volt/RadioButton.vue";
import Rating from "@/volt/Rating.vue";
import SelectButton from "@/volt/SelectButton.vue";
import ToggleButton from "@/volt/ToggleButton.vue";
import ToggleSwitch from "@/volt/ToggleSwitch.vue";

/**
 * SelectionTab — selection / choice primitives for the Component Showcase.
 * Stateless playground: just local demo refs. Mirrors the Fieldset + semantic
 * class house style of ShowcasePanel.vue.
 */

// Shared option data ---------------------------------------------------------
interface Unit {
  name: string;
  code: string;
}
const UNITS: Unit[] = [
  { name: "Alpha", code: "AL" },
  { name: "Bravo", code: "BR" },
  { name: "Charlie", code: "CH" },
  { name: "Delta", code: "DE" },
  { name: "Echo", code: "EC" },
];
const UNIT_NAMES: string[] = UNITS.map((u) => u.name);

// Select ---------------------------------------------------------------------
const selectVal = ref<null | string>("AL");
const SELECT_OPTIONS = UNITS.map((u) => ({ label: u.name, value: u.code }));

// Checkbox + RadioButton -----------------------------------------------------
const checkVal = ref<boolean>(true);
const radioVal = ref<null | string>("BR");

// MultiSelect ----------------------------------------------------------------
const multiVal = ref<string[]>(["AL", "CH"]);

// AutoComplete ---------------------------------------------------------------
const acSingle = ref<null | string>(null);
const acSingleItems = ref<string[]>([]);
const acMultiple = ref<string[]>([]);
const acMultipleItems = ref<string[]>([]);

function searchSingle(event: { query: string }): void {
  const q = event.query.toLowerCase();
  acSingleItems.value = UNIT_NAMES.filter((n) => n.toLowerCase().includes(q));
}
function searchMultiple(event: { query: string }): void {
  const q = event.query.toLowerCase();
  acMultipleItems.value = UNIT_NAMES.filter((n) => n.toLowerCase().includes(q));
}

// Segmented + toggles --------------------------------------------------------
const segmentVal = ref<null | string>("Bravo");
const SEGMENT_OPTIONS = UNITS.slice(0, 3).map((u) => ({ label: u.name }));
const toggleBtnVal = ref<boolean>(false);
const switchVal = ref<boolean>(true);

// Listbox --------------------------------------------------------------------
const listVal = ref<null | string>("CH");

// Rating ---------------------------------------------------------------------
const ratingVal = ref<number>(3);
</script>

<template>
  <div class="flex flex-col gap-4">
    <Fieldset legend="Select">
      <div class="flex flex-wrap items-center gap-3">
        <Select
          v-model="selectVal"
          :options="SELECT_OPTIONS"
          placeholder="Choose a unit…"
          show-clear
          class="sm:w-64"
        />
        <span class="text-muted font-mono text-xs tabular-nums">{{ selectVal ?? "—" }}</span>
        <Select
          model-value="AL"
          :options="SELECT_OPTIONS"
          disabled
          placeholder="Disabled"
          class="sm:w-48"
        />
      </div>
    </Fieldset>

    <Fieldset legend="Checkbox + RadioButton">
      <div class="flex flex-col gap-3">
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="checkVal" :binary="true" />
          <span>Acknowledge ({{ checkVal ? "on" : "off" }})</span>
        </label>
        <div class="flex flex-wrap items-center gap-4">
          <label
            v-for="u in UNITS.slice(0, 3)"
            :key="u.code"
            class="flex items-center gap-2 text-sm"
          >
            <RadioButton v-model="radioVal" name="unit-select" :value="u.code" />
            <span>{{ u.name }}</span>
          </label>
          <span class="text-muted font-mono text-xs tabular-nums">{{ radioVal ?? "—" }}</span>
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="MultiSelect">
      <div class="flex flex-wrap items-center gap-3">
        <MultiSelect
          v-model="multiVal"
          :options="UNITS"
          option-label="name"
          option-value="code"
          display="chip"
          placeholder="Select units…"
          class="w-full sm:w-80"
        />
      </div>
    </Fieldset>

    <Fieldset legend="AutoComplete">
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <span class="text-muted text-xs">Single</span>
          <AutoComplete
            v-model="acSingle"
            :suggestions="acSingleItems"
            placeholder="Type to filter units…"
            class="w-full sm:w-72"
            @complete="searchSingle"
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-muted text-xs">Multiple (chips)</span>
          <AutoComplete
            v-model="acMultiple"
            multiple
            :suggestions="acMultipleItems"
            placeholder="Add units…"
            class="w-full sm:w-72"
            @complete="searchMultiple"
          />
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="Segmented + toggles">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex items-center gap-2">
          <SelectButton v-model="segmentVal" :options="SEGMENT_OPTIONS" option-label="label" />
          <span class="text-muted font-mono text-xs tabular-nums">{{ segmentVal ?? "—" }}</span>
        </div>
        <div class="flex items-center gap-2">
          <ToggleButton v-model="toggleBtnVal" on-label="Armed" off-label="Safe" />
          <span class="text-muted font-mono text-xs tabular-nums">{{ toggleBtnVal }}</span>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <ToggleSwitch v-model="switchVal" />
          <span>Live updates ({{ switchVal ? "on" : "off" }})</span>
        </label>
      </div>
    </Fieldset>

    <Fieldset legend="Listbox">
      <div class="flex flex-wrap items-start gap-3">
        <Listbox
          v-model="listVal"
          :options="UNITS"
          option-label="name"
          option-value="code"
          class="w-56"
        />
        <span class="text-muted font-mono text-xs tabular-nums">{{ listVal ?? "—" }}</span>
      </div>
    </Fieldset>

    <Fieldset legend="Rating">
      <div class="flex items-center gap-3">
        <Rating v-model="ratingVal" />
        <span class="text-muted font-mono text-xs tabular-nums">{{ ratingVal }} / 5</span>
      </div>
    </Fieldset>
  </div>
</template>
