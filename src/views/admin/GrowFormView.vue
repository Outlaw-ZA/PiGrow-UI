<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../../stores/growStore'
import type { GrowPhase } from '../../types/grow'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Card from 'primevue/card'

const store = useGrowStore()
const route = useRoute()
const router = useRouter()

const growId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => Boolean(growId.value))

const form = ref({ controllerId: '', isActive: false, name: '' })
const phases = ref<GrowPhase[]>([])
const ready = ref(false)
const saving = ref(false)

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

function recalculateDates() {
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (const phase of phases.value) {
    phase.startAt = formatDate(cursor)
    cursor.setDate(cursor.getDate() + phase.durationDays)
    phase.endAt = formatDate(cursor)
  }
}

const controllerOptions = computed(() => store.controllers.filter((c) => c.id != null))

const totalCycleDays = computed(() => phases.value.reduce((sum, p) => sum + p.durationDays, 0))

function getDefaultPhases(): GrowPhase[] {
  return [
    { durationDays: 7, endAt: null, isActive: false, name: 'Germination', order: 1, startAt: null },
    { durationDays: 14, endAt: null, isActive: false, name: 'Seedling', order: 2, startAt: null },
    { durationDays: 28, endAt: null, isActive: false, name: 'Vegetative', order: 3, startAt: null },
    { durationDays: 56, endAt: null, isActive: false, name: 'Flowering', order: 4, startAt: null },
    { durationDays: 14, endAt: null, isActive: false, name: 'Flush', order: 5, startAt: null },
  ]
}

watch(
  () => phases.value.map((p) => p.durationDays),
  () => recalculateDates(),
  { deep: true },
)

onMounted(async () => {
  try {
    await store.fetchAll()
    if (isEditMode.value && growId.value) {
      await loadExistingCycle(growId.value)
    } else {
      phases.value = getDefaultPhases()
      recalculateDates()
    }
  } catch (error) {
    console.error('Failed to load form data', error)
  } finally {
    ready.value = true
  }
})

async function loadExistingCycle(id: string) {
  const cycle = await store.fetchGrowCycle(id)
  form.value.controllerId = cycle.controllerId ?? ''
  form.value.name = cycle.name
  form.value.isActive = cycle.isActive
  phases.value = cycle.phases ? [...cycle.phases] : []
  recalculateDates()
}

function addPhase() {
  const nextOrder = phases.value.length > 0 ? Math.max(...phases.value.map((p) => p.order)) + 1 : 1
  phases.value.push({
    durationDays: 7,
    endAt: null,
    isActive: false,
    name: '',
    order: nextOrder,
    startAt: null,
  })
  recalculateDates()
}

async function removePhase(index: number) {
  const phase = phases.value[index]
  if (!phase) {
    return
  }
  if (phase.id) {
    await store.deleteGrowPhase(phase.id)
  }
  phases.value.splice(index, 1)
  phases.value.forEach((p, i) => (p.order = i + 1))
  recalculateDates()
}

async function savePhase(phase: GrowPhase): Promise<GrowPhase | null> {
  if (phase.id) {
    return await store.updateGrowPhase(phase.id, {
      durationDays: phase.durationDays,
      isActive: phase.isActive,
      name: phase.name,
      order: phase.order,
    })
  }
  return null
}

const handleSave = async () => {
  if (!form.value.controllerId) {
    console.error('controllerId is required')
    return
  }
  saving.value = true
  try {
    if (isEditMode.value && growId.value) {
      await store.updateGrowCycle(growId.value, {
        controllerId: form.value.controllerId,
        isActive: form.value.isActive,
        name: form.value.name,
      })
      for (const phase of phases.value) {
        await savePhase(phase)
      }
      router.push('/admin')
    } else {
      await store.createGrowCycle({
        controllerId: form.value.controllerId,
        isActive: form.value.isActive,
        name: form.value.name,
      })
      router.push('/admin')
    }
  } catch (error) {
    console.error('Failed to save', error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="ready" class="form-page">
    <Card>
      <template #title>
        {{ isEditMode ? 'Adjust Grow Lifecycle Plan' : 'Schedule New Botanical Run' }}
      </template>
      <template #content>
        <div class="form-stack">
          <div class="field">
            <label for="grow-controller" class="field-label">
              Assigned Controller Infrastructure Host
            </label>
            <Select
              id="grow-controller"
              v-model="form.controllerId"
              :options="controllerOptions"
              optionLabel="name"
              optionValue="id"
              placeholder="Select Pi Host Room"
              class="full-width"
              show-clear
            />
          </div>
          <div class="field">
            <label for="grow-name" class="field-label">Grow Batch Track Name</label>
            <InputText
              id="grow-name"
              v-model="form.name"
              placeholder="Run #5 - White Widow Pheno"
              class="full-width"
            />
          </div>
          <div class="switch-row">
            <ToggleSwitch v-model="form.isActive" inputId="grow-active" />
            <label for="grow-active" class="field-label-inline">
              Set Target Execution State Active
            </label>
          </div>

          <div v-if="isEditMode" class="phases-section">
            <div class="phases-header">
              <h3 class="phases-title">Grow Phases</h3>
              <Button
                label="Add Phase"
                icon="pi pi-plus"
                size="small"
                severity="success"
                @click="addPhase"
              />
            </div>

            <div class="phases-list">
              <div v-for="(phase, idx) in phases" :key="phase.id || idx" class="phase-card">
                <div class="phase-card-header">
                  <span class="phase-order-badge">{{ phase.order }}</span>
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    size="small"
                    aria-label="Remove phase"
                    @click="removePhase(idx)"
                  />
                </div>

                <div class="phase-fields">
                  <div class="field">
                    <label :for="`phase-name-${idx}`" class="field-label-sm">Phase Name</label>
                    <InputText
                      :id="`phase-name-${idx}`"
                      v-model="phase.name"
                      placeholder="e.g. Vegetative"
                      class="full-width"
                    />
                  </div>
                  <div class="field field-duration">
                    <label :for="`phase-duration-${idx}`" class="field-label-sm">
                      Duration (days)
                    </label>
                    <InputNumber
                      :inputId="`phase-duration-${idx}`"
                      v-model="phase.durationDays"
                      :min="1"
                    />
                  </div>
                </div>

                <div v-if="phase.startAt && phase.endAt" class="date-range">
                  <span>
                    <strong>Start:</strong>
                    {{ phase.startAt }}
                  </span>
                  <span class="date-separator">→</span>
                  <span>
                    <strong>End:</strong>
                    {{ phase.endAt }}
                  </span>
                </div>
              </div>
            </div>

            <div v-if="phases.length > 0" class="total-summary">
              <span class="total-label">Total Cycle Duration</span>
              <span class="total-value">{{ totalCycleDays }} days</span>
            </div>
          </div>

          <div class="form-actions">
            <Button
              :label="isEditMode ? 'Commit Changes' : 'Initialize Batch'"
              severity="success"
              :loading="saving"
              @click="handleSave"
            />
            <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.form-page {
  max-width: 720px;
  margin: 0 auto;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  display: block;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.field-label-sm {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  font-weight: 500;
}

.field-label-inline {
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  font-weight: 500;
  cursor: pointer;
}

.full-width {
  width: 100%;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.phases-section {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.phases-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.phases-title {
  margin: 0;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: var(--text-xl);
}

.phases-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.phase-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: border-color var(--duration-normal) var(--ease-default);
}

.phase-card:hover {
  border-color: var(--color-bg-muted);
}

.phase-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phase-order-badge {
  background: var(--color-info);
  color: #ffffff;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 700;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
}

.phase-fields {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: var(--space-3);
}

.field-duration {
  min-width: 0;
}

.date-range {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  background: var(--color-bg-base);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono);
}

.date-range strong {
  color: var(--color-text-secondary);
  font-weight: 600;
  margin-right: 0.25rem;
}

.date-separator {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.total-summary {
  margin-top: var(--space-2);
  padding: 0.75rem var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: space-between;
  font-size: var(--text-md);
}

.total-label {
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-size: var(--text-sm);
  font-weight: 500;
}

.total-value {
  color: var(--color-accent);
  font-weight: 700;
  font-family: var(--font-mono);
}

.form-actions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-2);
}
</style>
