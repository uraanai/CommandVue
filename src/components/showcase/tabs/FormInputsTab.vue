<script setup lang="ts">
import { Search } from "@lucide/vue";
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import ColorPicker from "@/components/ui/ColorPicker.vue";
import ColorSwatchPicker from "@/components/ui/ColorSwatchPicker.vue";
import EditableLabel from "@/components/ui/EditableLabel.vue";
import FileUpload from "@/components/ui/FileUpload.vue";
import Input from "@/components/ui/Input.vue";
import Checkbox from "@/volt/Checkbox.vue";
import DatePicker from "@/volt/DatePicker.vue";
import Fieldset from "@/volt/Fieldset.vue";
import FloatLabel from "@/volt/FloatLabel.vue";
import IconField from "@/volt/IconField.vue";
import IftaLabel from "@/volt/IftaLabel.vue";
import InputGroup from "@/volt/InputGroup.vue";
import InputGroupAddon from "@/volt/InputGroupAddon.vue";
import InputIcon from "@/volt/InputIcon.vue";
import InputMask from "@/volt/InputMask.vue";
import InputNumber from "@/volt/InputNumber.vue";
import InputOtp from "@/volt/InputOtp.vue";
import InputText from "@/volt/InputText.vue";
import Knob from "@/volt/Knob.vue";
import Password from "@/volt/Password.vue";
import Slider from "@/volt/Slider.vue";
import Textarea from "@/volt/Textarea.vue";

/**
 * FormInputsTab — Form Inputs section of the Component Showcase.
 * Demo-only file under src/components/showcase/; uses semantic utility classes
 * and CSS-var status colors, never raw palette. Every control is wired to a
 * typed local ref so its state is observable without any real side effect.
 */

// --- Text inputs -----------------------------------------------------------
const inputVal = ref<string>("");
const voltInputVal = ref<string>("");
const textareaVal = ref<string>("");

// --- EditableLabel ---------------------------------------------------------
const editableLabelVal = ref<string>("Sector 7");
const editableHover = ref<boolean>(false);
const editableBg = ref<boolean>(false);

// --- Password --------------------------------------------------------------
const passwordVal = ref<string>("");

// --- InputNumber -----------------------------------------------------------
const stepperVal = ref<number>(8);
const currencyVal = ref<number>(1250);

// --- InputMask -------------------------------------------------------------
const phoneVal = ref<string>("");

// --- InputOtp --------------------------------------------------------------
const otpVal = ref<string>("");

// --- DatePicker ------------------------------------------------------------
const dateVal = ref<Date | null>(null);
const dateRange = ref<(Date | null)[] | null>(null);
const timeVal = ref<Date | null>(null);

// --- Slider ----------------------------------------------------------------
const sliderVal = ref<number>(60);

// --- Labels ----------------------------------------------------------------
const floatVal = ref<string>("");
const iftaVal = ref<string>("");

// --- IconField + InputGroup ------------------------------------------------
const searchVal = ref<string>("");
const handleVal = ref<string>("");

// --- Knob ------------------------------------------------------------------
const knobVal = ref<number>(40);
const knobVal2 = ref<number>(72);
const knobVal3 = ref<number>(55);
const knobVal4 = ref<number>(30);

// --- Color + File ----------------------------------------------------------
const colorVal = ref<string>("#10c4a2");
const swatchVal = ref<string>("oklch(0.55 0.18 250)");
const SWATCH_OPTIONS = [
  { label: "Teal", value: "oklch(0.55 0.13 195)" },
  { label: "Blue", value: "oklch(0.55 0.18 250)" },
  { label: "Violet", value: "oklch(0.55 0.2 305)" },
  { label: "Amber", value: "oklch(0.65 0.16 75)" },
];

const fileUpload = ref<InstanceType<typeof FileUpload> | null>(null);
const fileLabel = ref<string>("no file chosen");
</script>

<template>
  <div class="flex flex-col gap-4">
    <Fieldset legend="Text inputs">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-2 sm:flex-row">
          <Input v-model="inputVal" placeholder="Callsign…" class="sm:w-56" />
          <Input model-value="Disabled" disabled class="sm:w-56" />
        </div>
        <InputText v-model="voltInputVal" placeholder="Volt InputText…" class="w-full" />
        <Textarea v-model="textareaVal" rows="3" placeholder="Notes…" class="w-full" />
      </div>
    </Fieldset>

    <Fieldset legend="EditableLabel (click-to-edit)">
      <div class="flex flex-col gap-3">
        <p class="text-sm">
          Operation
          <EditableLabel
            v-model="editableLabelVal"
            :hoverable="editableHover"
            :background="editableBg"
            placeholder="codename"
          />
          is currently active.
        </p>
        <span class="text-faint text-xs"
          >an inline word — sizes to its text, no side padding · click to rename · Enter / blur
          commits · Esc reverts</span
        >
        <div class="flex flex-wrap gap-4">
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="editableHover" :binary="true" />
            <span>Hover affordance</span>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="editableBg" :binary="true" />
            <span>Background</span>
          </label>
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="Password">
      <div class="flex flex-wrap items-center gap-3">
        <Password v-model="passwordVal" toggle-mask :feedback="true" placeholder="Password…" />
        <span class="text-faint text-xs">toggle-mask + strength meter</span>
      </div>
    </Fieldset>

    <Fieldset legend="InputNumber">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <InputNumber v-model="stepperVal" :show-buttons="true" :min="0" :max="99" />
          <span class="text-faint text-xs">stepper</span>
        </div>
        <div class="flex items-center gap-2">
          <InputNumber v-model="currencyVal" mode="currency" currency="USD" locale="en-US" />
          <span class="text-faint text-xs">currency (USD)</span>
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="InputMask">
      <div class="flex flex-wrap items-center gap-3">
        <InputMask v-model="phoneVal" mask="(999) 999-9999" placeholder="(999) 999-9999" />
        <span class="text-muted font-mono text-xs tabular-nums">{{ phoneVal || "—" }}</span>
      </div>
    </Fieldset>

    <Fieldset legend="InputOtp">
      <div class="flex flex-wrap items-center gap-3">
        <InputOtp v-model="otpVal" :length="6" integer-only />
        <span class="text-muted font-mono text-xs tabular-nums">{{ otpVal || "—" }}</span>
      </div>
    </Fieldset>

    <Fieldset legend="DatePicker">
      <!--
        Headline: a date picker and a time picker sit side-by-side here, but
        DatePicker keeps date and time in separate panels — there is a visible
        gap between picking a day and picking an hour. Surfaced per maintainer
        note; not papered over with a custom combined control.
      -->
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-faint text-xs">Date</span>
          <DatePicker v-model="dateVal" show-icon placeholder="Pick a date" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-faint text-xs">Range</span>
          <DatePicker
            v-model="dateRange"
            selection-mode="range"
            :manual-input="false"
            show-icon
            placeholder="Start – End"
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-faint text-xs">Time</span>
          <DatePicker v-model="timeVal" time-only placeholder="--:--" />
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="Slider">
      <div class="flex items-center gap-3">
        <Slider v-model="sliderVal" :min="0" :max="100" :step="1" class="w-56" />
        <span class="text-muted w-10 text-sm tabular-nums">{{ sliderVal }}</span>
      </div>
    </Fieldset>

    <Fieldset legend="Labels — FloatLabel + IftaLabel">
      <div class="flex flex-wrap items-center gap-6">
        <FloatLabel>
          <InputText id="float-callsign" v-model="floatVal" class="w-56" />
          <label for="float-callsign">Callsign</label>
        </FloatLabel>
        <IftaLabel>
          <InputText id="ifta-channel" v-model="iftaVal" class="w-56" />
          <label for="ifta-channel">Channel</label>
        </IftaLabel>
      </div>
    </Fieldset>

    <Fieldset legend="IconField + InputGroup">
      <div class="flex flex-wrap items-center gap-6">
        <IconField class="sm:w-64">
          <InputIcon>
            <Search :size="16" />
          </InputIcon>
          <InputText v-model="searchVal" placeholder="Search units…" class="w-full" />
        </IconField>
        <InputGroup class="sm:w-64">
          <InputGroupAddon>@</InputGroupAddon>
          <InputText v-model="handleVal" placeholder="handle" />
        </InputGroup>
      </div>
    </Fieldset>

    <Fieldset legend="Knob — styles">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex flex-col items-center gap-1">
          <Knob v-model="knobVal" :min="0" :max="100" :size="90" />
          <span class="text-faint text-xs">default</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Knob
            v-model="knobVal2"
            :size="90"
            :stroke-width="14"
            value-color="var(--color-status-success)"
          />
          <span class="text-faint text-xs">thick · success</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Knob
            v-model="knobVal3"
            :size="90"
            :stroke-width="4"
            value-color="var(--color-status-warning)"
          />
          <span class="text-faint text-xs">thin · warning</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Knob
            v-model="knobVal4"
            :size="90"
            :show-value="false"
            value-color="var(--color-status-danger)"
          />
          <span class="text-faint text-xs">no value · danger</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Knob :model-value="68" :size="64" readonly />
          <span class="text-faint text-xs">small · readonly</span>
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="Color + File">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex items-center gap-2">
          <ColorPicker v-model="colorVal" />
          <span class="text-muted font-mono text-xs">{{ colorVal }}</span>
        </div>
        <ColorSwatchPicker v-model="swatchVal" :options="SWATCH_OPTIONS" aria-label="Accent" />
        <div class="flex items-center gap-2">
          <Button variant="secondary" @click="fileUpload?.choose()">Choose file…</Button>
          <span class="text-faint text-xs">{{ fileLabel }}</span>
          <FileUpload
            ref="fileUpload"
            accept="image/*"
            @select="(e) => (fileLabel = e.files?.[0]?.name ?? `${e.files?.length ?? 0} file(s)`)"
          />
        </div>
      </div>
    </Fieldset>
  </div>
</template>
