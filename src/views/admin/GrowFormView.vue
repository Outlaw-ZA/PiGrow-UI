<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '../../stores/apiStore'
import type { Device, DeviceConfig, GrowPhase } from '../../types/grow'
import { TriggerType } from '../../types/grow'
import {
  deriveActivePhaseIndex,
  deriveGrowActive,
  formatDate,
  parseDateOnly,
  recalculatePhaseDates,
} from '../../utils/growDates'
import {
  TRIGGER_TYPE_OPTIONS,
  buildConfigPayload,
  defaultConfigForm,
  normalizeScheduleConfig,
  normalizeThresholdConfig,
} from '../../utils/deviceConfigs'
import type { ConfigFormState } from '../../utils/deviceConfigs'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Card from 'primevue/card'

const store = useApiStore()
const route = useRoute()
const router = useRouter()

const growId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => Boolean(growId.value))

const form = ref({ controllerId: '', name: '' })
const growStartDate = ref<Date>(new Date())
const phases = ref<GrowPhase[]>([])
const ready = ref(false)
const saving = ref(false)
const previousActivePhaseId = ref<string | null>(null)

function recalculateDates() {
  recalculatePhaseDates(phases.value, growStartDate.value)
}

const controllerOptions = computed(() => store.controllers.filter((c) => c.id != null))

const totalCycleDays = computed(() => phases.value.reduce((sum, p) => sum + p.durationDays, 0))

const sortedPhases = computed(() => [...phases.value].toSorted((a, b) => a.order - b.order))

const selectedPhaseId = ref<string | null>(null)
const deviceConfigForms = ref<Record<string, ConfigFormState>>({})
const onTimeDate = ref<Record<string, Date | null>>({})

const linkedController = computed(() =>
  store.controllers.find((c) => c.id === form.value.controllerId),
)
const controllerDevices = computed<Device[]>(() => linkedController.value?.devices ?? [])
const selectedPhase = computed<GrowPhase | undefined>(() =>
  phases.value.find((p) => p.id && p.id === selectedPhaseId.value),
)
const selectablePhases = computed(() =>
  sortedPhases.value.filter((p) => p.id != null).map((p) => ({ id: p.id as string, name: p.name })),
)

const configRows = computed(() =>
  controllerDevices.value
    .filter((d): d is Device & { id: string } => d.id != null)
    .map((device) => {
      const formState = deviceConfigForms.value[device.id]
      return { device, formState }
    })
    .filter(
      (row): row is { device: Device & { id: string }; formState: ConfigFormState } =>
        row.formState != null,
    ),
)

function getForm(deviceId: string): ConfigFormState {
  const formState = deviceConfigForms.value[deviceId]
  if (!formState) {
    deviceConfigForms.value[deviceId] = defaultConfigForm()
    return deviceConfigForms.value[deviceId]!
  }
  return formState
}

function initDeviceConfigFormsForPhase(phase: GrowPhase | undefined) {
  const next: Record<string, ConfigFormState> = {}
  const nextTimes: Record<string, Date | null> = {}
  const existing = phase?.deviceConfigs ?? []
  for (const device of controllerDevices.value) {
    if (!device.id) {
      continue
    }
    const current = existing.find((c) => c.deviceId === device.id)
    if (current) {
      const { triggerType } = current
      const form: ConfigFormState = {
        ...defaultConfigForm(),
        dirty: false,
        id: current.id,
        triggerType,
      }
      if (triggerType === TriggerType.SCHEDULE) {
        const sched = normalizeScheduleConfig(current.configData)
        form.onTime = sched.onTime
        form.durationHours = sched.durationHours
        nextTimes[device.id] = parseTimeOfDay(sched.onTime)
      } else if (triggerType === TriggerType.THRESHOLD) {
        const thresh = normalizeThresholdConfig(current.configData)
        form.metric = thresh.metric
        form.high = thresh.high
      }
      next[device.id] = form
    } else {
      const blank = defaultConfigForm()
      next[device.id] = blank
      nextTimes[device.id] = parseTimeOfDay(blank.onTime)
    }
  }
  deviceConfigForms.value = next
  onTimeDate.value = nextTimes
}

function parseTimeOfDay(hhmm: string): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!match) {
    return null
  }
  const date = new Date()
  date.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return date
}

function formatTimeOfDay(date: Date | null | undefined): string {
  if (!date) {
    return '00:00'
  }
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function markDirty(deviceId: string) {
  const formState = deviceConfigForms.value[deviceId]
  if (formState) {
    formState.dirty = true
  }
}

function onTriggerTypeChange(deviceId: string, val: TriggerType) {
  const formState = deviceConfigForms.value[deviceId]
  if (formState) {
    formState.triggerType = val
    formState.dirty = true
  }
}

function onOnTimeChange(deviceId: string, val: Date | null) {
  onTimeDate.value[deviceId] = val
  const formState = deviceConfigForms.value[deviceId]
  if (formState) {
    formState.onTime = formatTimeOfDay(val)
    formState.dirty = true
  }
}

watch(selectedPhaseId, (id) => {
  const phase = phases.value.find((p) => p.id === id)
  initDeviceConfigFormsForPhase(phase)
})

watch(
  () => controllerDevices.value.map((d) => d.id).join('|'),
  () => {
    if (selectedPhaseId.value) {
      initDeviceConfigFormsForPhase(selectedPhase.value)
    }
  },
)

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

watch(growStartDate, () => recalculateDates())

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
  if (cycle.startAt) {
    growStartDate.value = parseDateOnly(cycle.startAt)
  }
  phases.value = cycle.phases ? [...cycle.phases] : []
  recalculateDates()
  const previouslyActive = phases.value.find((p) => p.isActive && p.id)
  previousActivePhaseId.value = previouslyActive?.id ?? null
  if (cycle.controllerId) {
    await store.fetchDevices(cycle.controllerId)
  }
  const firstPhaseWithId = phases.value.find((p) => p.id)
  selectedPhaseId.value = firstPhaseWithId?.id ?? null
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
    if (previousActivePhaseId.value === phase.id) {
      previousActivePhaseId.value = null
    }
  }
  phases.value.splice(index, 1)
  phases.value.forEach((p, i) => (p.order = i + 1))
  recalculateDates()
}

async function savePhase(phase: GrowPhase, cycleId?: string): Promise<GrowPhase | null> {
  if (phase.id) {
    return await store.updateGrowPhase(phase.id, {
      durationDays: phase.durationDays,
      endAt: phase.endAt,
      isActive: phase.isActive,
      name: phase.name,
      order: phase.order,
      startAt: phase.startAt,
    })
  }
  const targetCycleId = cycleId ?? growId.value
  if (targetCycleId) {
    const created = await store.createGrowPhase({
      durationDays: phase.durationDays,
      endAt: phase.endAt,
      growCycleId: targetCycleId,
      isActive: false,
      name: phase.name,
      order: phase.order,
      startAt: phase.startAt,
    })
    phase.id = created.id
    return created
  }
  return null
}

async function reconcileActivePhase() {
  const activeIdx = deriveActivePhaseIndex(sortedPhases.value)
  if (activeIdx >= 0) {
    const target = sortedPhases.value[activeIdx]
    if (target && target.id && target.id !== previousActivePhaseId.value) {
      await store.activateGrowPhase(target.id)
    }
    return
  }
  if (previousActivePhaseId.value) {
    await store.updateGrowPhase(previousActivePhaseId.value, { isActive: false })
  }
}

async function saveDeviceConfig(deviceId: string) {
  const phase = selectedPhase.value
  if (!phase || !phase.id) {
    return
  }
  const formState = deviceConfigForms.value[deviceId]
  if (!formState) {
    return
  }
  const payload = buildConfigPayload(formState)
  try {
    let result: DeviceConfig
    if (formState.id) {
      result = await store.updateDeviceConfig(formState.id, payload)
    } else {
      result = await store.createDeviceConfig({
        configData: payload.configData,
        deviceId,
        growPhaseId: phase.id,
        triggerType: payload.triggerType,
      })
    }
    formState.id = result.id
    formState.dirty = false
    if (!phase.deviceConfigs) {
      phase.deviceConfigs = []
    }
    const idx = phase.deviceConfigs.findIndex((c) => c.id === result.id)
    if (idx !== -1) {
      phase.deviceConfigs[idx] = result
    } else {
      phase.deviceConfigs.push(result)
    }
  } catch (error) {
    console.error('Failed to save device config', error)
  }
}

async function removeDeviceConfig(deviceId: string) {
  const phase = selectedPhase.value
  if (!phase || !phase.deviceConfigs) {
    return
  }
  const formState = deviceConfigForms.value[deviceId]
  const config = phase.deviceConfigs.find((c) => c.deviceId === deviceId)
  if (!config || !config.id) {
    return
  }
  try {
    await store.deleteDeviceConfig(config.id)
    phase.deviceConfigs = phase.deviceConfigs.filter((c) => c.id !== config.id)
    if (formState) {
      deviceConfigForms.value[deviceId] = defaultConfigForm()
    }
  } catch (error) {
    console.error('Failed to delete device config', error)
  }
}

const handleSave = async () => {
  if (!form.value.controllerId) {
    console.error('controllerId is required')
    return
  }
  saving.value = true
  try {
    const startAtDate = formatDate(growStartDate.value)
    if (isEditMode.value && growId.value) {
      const growActive = deriveGrowActive(startAtDate, sortedPhases.value)
      await store.updateGrowCycle(growId.value, {
        controllerId: form.value.controllerId,
        isActive: growActive,
        name: form.value.name,
        startAt: startAtDate,
      })
      for (const phase of phases.value) {
        await savePhase(phase)
      }
      await reconcileActivePhase()
      router.push('/admin')
    } else {
      const created = await store.createGrowCycle({
        controllerId: form.value.controllerId,
        name: form.value.name,
        startAt: startAtDate,
      })
      const backendPhases = created.phases ?? []
      const userPhases = sortedPhases.value

      for (let i = 0; i < userPhases.length; i++) {
        const userPhase = userPhases[i]
        const backendPhase = backendPhases[i]
        if (userPhase && backendPhase) {
          userPhase.id = backendPhase.id
          await savePhase(userPhase)
        } else if (userPhase) {
          await savePhase(userPhase, created.id)
        }
      }
      for (let i = userPhases.length; i < backendPhases.length; i++) {
        const backendPhase = backendPhases[i]
        if (backendPhase?.id) {
          await store.deleteGrowPhase(backendPhase.id)
        }
      }

      const growActive = deriveGrowActive(startAtDate, sortedPhases.value)
      await store.updateGrowCycle(created.id, { isActive: growActive })
      await reconcileActivePhase()
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
          <div class="field">
            <label for="grow-start-date" class="field-label">Grow Start Date</label>
            <DatePicker
              id="grow-start-date"
              v-model="growStartDate"
              dateFormat="yy-mm-dd"
              showIcon
              class="full-width"
            />
          </div>

          <div class="phases-section">
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

          <div v-if="isEditMode && controllerDevices.length > 0" class="device-configs-section">
            <div class="device-configs-header">
              <h3 class="device-configs-title">Device Configuration</h3>
              <span class="device-configs-hint">Edits save immediately per device.</span>
            </div>

            <div class="field">
              <label for="config-phase" class="field-label-sm">Select Phase</label>
              <Select
                id="config-phase"
                v-model="selectedPhaseId"
                :options="selectablePhases"
                optionLabel="name"
                optionValue="id"
                placeholder="Select a phase to configure"
                class="full-width"
              />
            </div>

            <div v-if="selectedPhase" class="config-rows">
              <div v-for="row in configRows" :key="row.device.id" class="config-row">
                <div class="config-row-header">
                  <div class="config-device-info">
                    <span class="config-device-name">{{ row.device.name }}</span>
                    <span class="type-pill">{{ row.device.type.replace(/_/g, ' ') }}</span>
                  </div>
                </div>

                <div class="config-fields">
                  <div class="field">
                    <label :for="`trigger-${row.device.id}`" class="field-label-sm"
                      >Trigger Type</label
                    >
                    <Select
                      :inputId="`trigger-${row.device.id}`"
                      v-model="row.formState.triggerType"
                      :options="TRIGGER_TYPE_OPTIONS"
                      optionLabel="label"
                      optionValue="value"
                      class="full-width"
                      @update:modelValue="
                        (val: TriggerType) => onTriggerTypeChange(row.device.id, val)
                      "
                    />
                  </div>

                  <template v-if="row.formState.triggerType === TriggerType.SCHEDULE">
                    <div class="field">
                      <label :for="`onTime-${row.device.id}`" class="field-label-sm">On Time</label>
                      <DatePicker
                        :inputId="`onTime-${row.device.id}`"
                        v-model="onTimeDate[row.device.id]"
                        timeOnly
                        hourFormat="24"
                        class="full-width"
                        @update:modelValue="
                          (val) => onOnTimeChange(row.device.id, val as Date | null)
                        "
                      />
                    </div>
                    <div class="field">
                      <label :for="`dur-${row.device.id}`" class="field-label-sm"
                        >Duration (hours)</label
                      >
                      <InputNumber
                        :inputId="`dur-${row.device.id}`"
                        v-model="row.formState.durationHours"
                        :min="0.1"
                        :max="24"
                        :minFractionDigits="1"
                        :maxFractionDigits="1"
                        @update:modelValue="markDirty(row.device.id)"
                      />
                    </div>
                  </template>

                  <template v-else-if="row.formState.triggerType === TriggerType.THRESHOLD">
                    <div class="field">
                      <label :for="`metric-${row.device.id}`" class="field-label-sm">Metric</label>
                      <InputText
                        :inputId="`metric-${row.device.id}`"
                        v-model="row.formState.metric"
                        placeholder="TEMP, HUMIDITY, CO2..."
                        class="full-width"
                        @update:modelValue="markDirty(row.device.id)"
                      />
                    </div>
                    <div class="field">
                      <label :for="`high-${row.device.id}`" class="field-label-sm"
                        >High Threshold</label
                      >
                      <InputNumber
                        :inputId="`high-${row.device.id}`"
                        v-model="row.formState.high"
                        :minFractionDigits="1"
                        :maxFractionDigits="2"
                        @update:modelValue="markDirty(row.device.id)"
                      />
                    </div>
                  </template>

                  <div v-else class="config-note">
                    No additional parameters for this trigger type.
                  </div>
                </div>

                <div class="config-row-actions">
                  <Button
                    label="Save Config"
                    icon="pi pi-save"
                    size="small"
                    severity="success"
                    :disabled="!row.formState.dirty"
                    @click="saveDeviceConfig(row.device.id)"
                  />
                  <Button
                    v-if="row.formState.id"
                    label="Delete"
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    text
                    @click="removeDeviceConfig(row.device.id)"
                  />
                </div>
              </div>
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

.full-width {
  width: 100%;
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

.device-configs-section {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.device-configs-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.device-configs-title {
  margin: 0;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: var(--text-xl);
}

.device-configs-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: 500;
}

.config-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.config-row {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: border-color var(--duration-normal) var(--ease-default);
}

.config-row:hover {
  border-color: var(--color-bg-muted);
}

.config-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-device-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.config-device-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.config-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}

.config-note {
  display: flex;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-style: italic;
  padding: var(--space-2) 0;
}

.config-row-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-subtle);
}
</style>
