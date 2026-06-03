<script setup lang="ts">
import { Check, RotateCcw } from "@lucide/vue";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import DatePicker from "@/volt/DatePicker.vue";
import Fieldset from "@/volt/Fieldset.vue";
import FloatLabel from "@/volt/FloatLabel.vue";
import IftaLabel from "@/volt/IftaLabel.vue";
import InputText from "@/volt/InputText.vue";
import Message from "@/volt/Message.vue";
import SecondaryButton from "@/volt/SecondaryButton.vue";
import Step from "@/volt/Step.vue";
import StepList from "@/volt/StepList.vue";
import StepPanel from "@/volt/StepPanel.vue";
import StepPanels from "@/volt/StepPanels.vue";
import Stepper from "@/volt/Stepper.vue";
import Textarea from "@/volt/Textarea.vue";

/**
 * FormsTab — composed demo. Assembles the project's existing input primitives
 * into the real artifact admins build: a two-column labelled form with modern
 * FloatLabel / IftaLabel patterns and required-field validation, plus a linear
 * multi-step wizard. No new primitives are introduced here.
 */

// --- Section 1: two-column form -------------------------------------------
const name = ref<string>("");
const role = ref<null | string>(null);
const startDate = ref<Date | null>(null);
const notes = ref<string>("");
const submitted = ref<boolean>(false);

const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Operator", value: "operator" },
  { label: "Analyst", value: "analyst" },
  { label: "Commander", value: "commander" },
  { label: "Observer", value: "observer" },
];

// Required: name + role. Invalid only shown for the required name field.
const nameInvalid = computed<boolean>(() => name.value.trim().length === 0);
const formValid = computed<boolean>(() => name.value.trim().length > 0 && role.value !== null);

function resetForm(): void {
  name.value = "";
  role.value = null;
  startDate.value = null;
  notes.value = "";
  submitted.value = false;
}

function submitForm(): void {
  if (!formValid.value) return;
  submitted.value = true;
}

// --- Section 2: multi-step wizard -----------------------------------------
const step = ref<number>(1);
const account = ref<string>("");
const displayName = ref<string>("");
const team = ref<null | string>(null);
const wizardDone = ref<boolean>(false);

const TEAM_OPTIONS: { label: string; value: string }[] = [
  { label: "Alpha", value: "alpha" },
  { label: "Bravo", value: "bravo" },
  { label: "Charlie", value: "charlie" },
];

function finishWizard(): void {
  wizardDone.value = true;
}

function restartWizard(): void {
  account.value = "";
  displayName.value = "";
  team.value = null;
  wizardDone.value = false;
  step.value = 1;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ================= FORM LAYOUT ================= -->
    <Fieldset legend="Form layout">
      <div class="flex flex-col gap-4">
        <Message v-if="submitted" severity="success" :closable="false">
          Member saved — form submitted successfully.
        </Message>

        <div class="flex flex-col gap-4">
          <!-- name (required, FloatLabel) -->
          <div class="grid grid-cols-[8rem_1fr] items-start gap-3">
            <label class="text-muted pt-2 text-sm" for="form-name">
              Name <span class="text-[var(--color-status-danger)]">*</span>
            </label>
            <div class="flex flex-col gap-1">
              <FloatLabel variant="on">
                <InputText
                  id="form-name"
                  v-model="name"
                  class="w-full"
                  :invalid="nameInvalid"
                  :fluid="true"
                />
                <label for="form-name">Full name</label>
              </FloatLabel>
              <Message v-if="nameInvalid" severity="error" variant="simple" size="small">
                Name is required.
              </Message>
            </div>
          </div>

          <!-- role (required, Select) -->
          <div class="grid grid-cols-[8rem_1fr] items-center gap-3">
            <label class="text-muted text-sm" for="form-role">
              Role <span class="text-[var(--color-status-danger)]">*</span>
            </label>
            <Select
              v-model="role"
              :options="ROLE_OPTIONS"
              placeholder="Select a role…"
              show-clear
              class="w-full"
            />
          </div>

          <!-- start date (DatePicker) -->
          <div class="grid grid-cols-[8rem_1fr] items-center gap-3">
            <label class="text-muted text-sm">Start date</label>
            <DatePicker
              v-model="startDate"
              date-format="yy-mm-dd"
              placeholder="Pick a date…"
              show-icon
              icon-display="input"
              :fluid="true"
            />
          </div>

          <!-- notes (Textarea, IftaLabel) -->
          <div class="grid grid-cols-[8rem_1fr] items-start gap-3">
            <label class="text-muted pt-2 text-sm">Notes</label>
            <IftaLabel>
              <Textarea id="form-notes" v-model="notes" rows="3" class="w-full" :fluid="true" />
              <label for="form-notes">Assignment notes</label>
            </IftaLabel>
          </div>
        </div>

        <!-- footer -->
        <div class="border-border flex items-center justify-end gap-2 border-t pt-3">
          <SecondaryButton label="Reset" @click="resetForm">
            <template #icon>
              <RotateCcw :size="15" />
            </template>
          </SecondaryButton>
          <Button variant="primary" :disabled="!formValid" @click="submitForm">
            <Check :size="15" />
            Submit
          </Button>
        </div>
      </div>
    </Fieldset>

    <!-- ================= MULTI-STEP WIZARD ================= -->
    <Fieldset legend="Multi-step wizard">
      <Stepper v-model:value="step" linear>
        <StepList>
          <Step :value="1">Account</Step>
          <Step :value="2">Profile</Step>
          <Step :value="3">Confirm</Step>
        </StepList>
        <StepPanels>
          <!-- step 1 -->
          <StepPanel v-slot="{ activateCallback }" :value="1">
            <div class="flex flex-col gap-3 py-2">
              <FloatLabel variant="on">
                <InputText id="wiz-account" v-model="account" class="w-full" :fluid="true" />
                <label for="wiz-account">Username</label>
              </FloatLabel>
              <div class="flex justify-end">
                <Button
                  variant="primary"
                  :disabled="account.trim().length === 0"
                  @click="activateCallback(2)"
                >
                  Next
                </Button>
              </div>
            </div>
          </StepPanel>

          <!-- step 2 -->
          <StepPanel v-slot="{ activateCallback }" :value="2">
            <div class="flex flex-col gap-3 py-2">
              <label class="text-muted flex flex-col gap-1 text-sm">
                Display name
                <Input v-model="displayName" placeholder="How others see you…" class="w-full" />
              </label>
              <Select
                v-model="team"
                :options="TEAM_OPTIONS"
                placeholder="Select a team…"
                class="w-full"
              />
              <div class="flex justify-between">
                <SecondaryButton label="Back" @click="activateCallback(1)" />
                <Button
                  variant="primary"
                  :disabled="displayName.trim().length === 0"
                  @click="activateCallback(3)"
                >
                  Next
                </Button>
              </div>
            </div>
          </StepPanel>

          <!-- step 3 -->
          <StepPanel v-slot="{ activateCallback }" :value="3">
            <div class="flex flex-col gap-3 py-2">
              <Message v-if="wizardDone" severity="success" :closable="false">
                Setup complete for {{ displayName || account }}.
              </Message>
              <div
                v-else
                class="bg-surface-sunken border-border flex flex-col gap-1 rounded-md border p-3 text-sm"
              >
                <div class="text-muted">
                  Username: <span class="text-foreground font-mono">{{ account || "—" }}</span>
                </div>
                <div class="text-muted">
                  Display name:
                  <span class="text-foreground">{{ displayName || "—" }}</span>
                </div>
                <div class="text-muted">
                  Team: <span class="text-foreground">{{ team ?? "—" }}</span>
                </div>
              </div>
              <div class="flex justify-between">
                <SecondaryButton label="Back" @click="activateCallback(2)" />
                <Button v-if="!wizardDone" variant="primary" @click="finishWizard">
                  <Check :size="15" />
                  Submit
                </Button>
                <SecondaryButton v-else label="Start over" @click="restartWizard" />
              </div>
            </div>
          </StepPanel>
        </StepPanels>
      </Stepper>
    </Fieldset>
  </div>
</template>
