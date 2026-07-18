<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Message from 'primevue/message'
import type { GrowPhase } from '../../types/grow'
import { addDays } from '../../utils/growDates'
import { useApiStore } from '../../stores/apiStore'
import { extractApiError } from '../../utils/errors'

const props = defineProps<{
  visible: boolean
  cycleId: string
  activePhase: GrowPhase | null
  startAt: string | null
  totalDurationDays: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const store = useApiStore()
const toast = useToast()

const days = ref<number>(1)
const saving = ref(false)
const inlineError = ref<string | null>(null)

watch(
  () => props.visible,
  (next) => {
    if (next) {
      days.value = 1
      inlineError.value = null
    }
  },
)

const currentEndAt = computed(() => props.activePhase?.endAt ?? null)
const newEndAt = computed(() => {
  if (!currentEndAt.value) {
    return null
  }
  return addDays(currentEndAt.value, days.value)
})
const newHarvest = computed(() => {
  if (!props.startAt || props.totalDurationDays <= 0) {
    return null
  }
  return addDays(props.startAt, props.totalDurationDays + days.value)
})
const canSubmit = computed(
  () => !saving.value && days.value >= 1 && days.value <= 90 && currentEndAt.value !== null,
)

async function submit() {
  inlineError.value = null
  if (!canSubmit.value) {
    inlineError.value = 'Enter a number of days between 1 and 90.'
    return
  }
  saving.value = true
  try {
    await store.extendActivePhase(props.cycleId, days.value)
    const added = days.value
    const afterHarvest = newHarvest.value
    toast.add({
      detail: afterHarvest
        ? `Phase extended by ${added} day${added === 1 ? '' : 's'} · harvest now ${afterHarvest}`
        : `Phase extended by ${added} day${added === 1 ? '' : 's'}`,
      life: 5000,
      severity: 'success',
      summary: 'Phase extended',
    })
    emit('update:visible', false)
  } catch (error) {
    const { message, status } = extractApiError(error, 'Failed to extend phase')
    if (status === 409 && message.includes('PHASE_LOST_RACE')) {
      toast.add({
        detail: 'This phase just advanced — refresh and try again.',
        life: 6000,
        severity: 'warn',
        summary: 'Phase just changed',
      })
      try {
        await store.fetchGrowCycle(props.cycleId)
      } catch {
        // Surfaced by the toast above; fall through to keep the dialog open.
      }
      emit('update:visible', false)
      return
    }
    if (status === 400) {
      inlineError.value = message
      return
    }
    if (status === 409) {
      toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Extend failed' })
      return
    }
    toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Extend failed' })
  } finally {
    saving.value = false
  }
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="`Extend phase — ${activePhase?.name ?? ''}`"
    :style="{ width: '90vw', maxWidth: '480px' }"
    modal
    dismissable-mask
    class="extend-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="extend-stack">
      <p class="extend-summary">
        Push the end of <strong>{{ activePhase?.name ?? 'this phase' }}</strong> out by a number of
        days. The new harvest estimate is recomputed from the grow start.
      </p>

      <div class="field">
        <label for="extend-days" class="field-label">Days to add</label>
        <InputNumber
          inputId="extend-days"
          v-model="days"
          :min="1"
          :max="90"
          showButtons
          buttonLayout="horizontal"
          :step="1"
          data-testid="extend-days"
        />
        <span v-if="currentEndAt && newEndAt" class="field-hint">
          Current end: <strong>{{ currentEndAt }}</strong> &rarr; new end:
          <strong>{{ newEndAt }}</strong>
        </span>
      </div>

      <div v-if="newHarvest" class="harvest-preview">
        <span class="harvest-preview-label">New estimated harvest</span>
        <span class="harvest-preview-value">{{ newHarvest }}</span>
      </div>

      <Message v-if="inlineError" severity="error" :closable="false">
        {{ inlineError }}
      </Message>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" size="small" :disabled="saving" @click="cancel" />
      <Button
        label="Extend"
        icon="pi pi-calendar-plus"
        severity="success"
        size="small"
        :loading="saving"
        :disabled="!canSubmit"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.extend-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.extend-summary {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.field-hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.harvest-preview {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.harvest-preview-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.harvest-preview-value {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-mono);
}
</style>
