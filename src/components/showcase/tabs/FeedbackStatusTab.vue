<script setup lang="ts">
import { Inbox } from "@lucide/vue";
import { ref } from "vue";

import Button from "@/components/ui/Button.vue";
import BlockUI from "@/volt/BlockUI.vue";
import Fieldset from "@/volt/Fieldset.vue";
import Message from "@/volt/Message.vue";
import ProgressBar from "@/volt/ProgressBar.vue";
import ProgressSpinner from "@/volt/ProgressSpinner.vue";
import Skeleton from "@/volt/Skeleton.vue";

/**
 * FeedbackStatusTab — "Feedback & Status" tab of the Component Showcase.
 * Renders the project's actual Volt wrappers for the loading / progress /
 * inline-feedback family plus a couple of composed patterns (fake loading
 * card, no-data empty state) so a token change recolors them in one scroll.
 *
 * Stateless demo — local refs only, no props.
 */

// ProgressBar — determinate value bumped by a button.
const progress = ref<number>(35);
function bumpProgress(): void {
  progress.value = progress.value >= 100 ? 0 : Math.min(100, progress.value + 15);
}

// BlockUI — toggle the lock-while-saving mask.
const blocked = ref<boolean>(false);
function toggleBlocked(): void {
  blocked.value = !blocked.value;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ================= MESSAGE ================= -->
    <Fieldset legend="Message — inline severities">
      <div class="flex flex-col gap-2">
        <Message severity="info">Telemetry link established — receiving at 12 Hz.</Message>
        <Message severity="success">Mission plan saved to the operations log.</Message>
        <Message severity="warn">Signal strength is degraded over the eastern sector.</Message>
        <Message severity="error" closable>
          Lost contact with unit Charlie — last seen 4 minutes ago.
        </Message>
      </div>
    </Fieldset>

    <!-- ================= PROGRESSBAR ================= -->
    <Fieldset legend="ProgressBar — determinate &amp; indeterminate">
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <ProgressBar :value="progress" class="min-w-0 flex-1" />
          <span class="text-muted w-10 text-right text-sm tabular-nums">{{ progress }}%</span>
          <Button size="sm" variant="secondary" @click="bumpProgress">Bump</Button>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-faint text-xs">Indeterminate (unknown duration)</span>
          <ProgressBar mode="indeterminate" class="h-2" />
        </div>
      </div>
    </Fieldset>

    <!-- ================= PROGRESSSPINNER ================= -->
    <Fieldset legend="ProgressSpinner">
      <div class="flex items-center gap-4">
        <ProgressSpinner class="!mx-0 !h-12 !w-12" />
        <span class="text-muted text-sm">Working — fetching the latest snapshot…</span>
      </div>
    </Fieldset>

    <!-- ================= SKELETON ================= -->
    <Fieldset legend="Skeleton — loading placeholders">
      <div class="flex flex-col gap-6">
        <!-- text lines -->
        <div class="flex flex-col gap-2">
          <span class="text-faint text-xs">Text lines</span>
          <Skeleton width="60%" height="0.85rem" />
          <Skeleton width="90%" height="0.85rem" />
          <Skeleton width="75%" height="0.85rem" />
        </div>

        <!-- circle + composed loading card -->
        <div class="flex flex-col gap-2">
          <span class="text-faint text-xs">Loading card</span>
          <div class="border-border bg-surface-sunken flex max-w-sm gap-3 rounded-md border p-3">
            <Skeleton shape="circle" width="3rem" height="3rem" />
            <div class="flex flex-1 flex-col gap-2">
              <Skeleton width="50%" height="0.9rem" />
              <Skeleton width="100%" height="0.75rem" />
              <Skeleton width="80%" height="0.75rem" />
              <Skeleton width="100%" height="4rem" class="mt-1" />
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

    <!-- ================= BLOCKUI ================= -->
    <Fieldset legend="BlockUI — lock while saving">
      <div class="flex flex-col gap-3">
        <Button size="sm" variant="secondary" @click="toggleBlocked">
          {{ blocked ? "Unblock content" : "Block content (simulate save)" }}
        </Button>
        <BlockUI :blocked="blocked">
          <div class="border-border bg-surface-sunken flex flex-col gap-2 rounded-md border p-4">
            <span class="text-foreground text-sm font-medium">Editable region</span>
            <p class="text-muted text-sm">
              While a save is in flight this region is masked and pointer events are blocked, so the
              operator can't double-submit. Toggle the button above to see the overlay.
            </p>
          </div>
        </BlockUI>
      </div>
    </Fieldset>

    <!-- ================= EMPTY STATE ================= -->
    <Fieldset legend="Empty state (composed)">
      <div class="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <Inbox :size="40" class="text-faint" aria-hidden="true" />
        <span class="text-foreground text-sm font-medium">No items yet</span>
        <p class="text-muted max-w-xs text-sm">
          Nothing has been added to this list. Create your first item to get started.
        </p>
        <Button variant="primary" size="sm" class="mt-1">Add item</Button>
      </div>
    </Fieldset>
  </div>
</template>
