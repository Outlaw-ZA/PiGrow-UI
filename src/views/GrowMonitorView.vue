<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '../stores/apiStore'
import type { DeviceConfig, GrowPhase } from '../types/grow'
import { TriggerType } from '../types/grow'
import {
  addDays,
  daysBetween,
  deriveActivePhaseIndex,
  deriveElapsedDays,
  deriveGrowActive,
  todayStr,
} from '../utils/growDates'
import {
  TRIGGER_TYPE_LABEL,
  TRIGGER_TYPE_SEVERITY,
  formatConfigSummary,
  normalizeThresholdConfig,
} from '../utils/deviceConfigs'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'

const route = useRoute()
const router = useRouter()
const store = useApiStore()

const cycleId = computed(() => route.params.id as string)

const currentCycle = computed(() => store.growCycles.find((g) => g.id === cycleId.value) as any)

const linkedController = computed(() => {
  const cycle = currentCycle.value
  if (!cycle) {
    return null
  }
  return store.controllers.find((c) => c.id === cycle.controllerId) || cycle.controller || null
})

const sortedPhases = computed(() => {
  const phases = currentCycle.value?.phases
  if (!phases) {
    return []
  }
  return [...phases].toSorted((a: GrowPhase, b: GrowPhase) => a.order - b.order)
})

const totalDurationDays = computed(() =>
  sortedPhases.value.reduce((sum: number, p: GrowPhase) => sum + p.durationDays, 0),
)

const activePhaseIndex = computed(() => {
  const dateIdx = deriveActivePhaseIndex(sortedPhases.value)
  if (dateIdx !== -1) {
    return dateIdx
  }
  return sortedPhases.value.findIndex((p: GrowPhase) => p.isActive)
})

const cycleProgressPercent = computed(() => {
  if (totalDurationDays.value === 0) {
    return 0
  }
  const elapsed = deriveElapsedDays(sortedPhases.value, activePhaseIndex.value)
  return Math.min(Math.round((elapsed / totalDurationDays.value) * 100), 100)
})

const elapsedDays = computed(() => {
  if (totalDurationDays.value === 0) {
    return 0
  }
  return Math.min(
    deriveElapsedDays(sortedPhases.value, activePhaseIndex.value),
    totalDurationDays.value,
  )
})

const deviceToggles = reactive<Record<string, boolean>>({})

const openPhasePanels = ref<string[]>([])

function phaseDeviceCount(phase: GrowPhase): number {
  return phase.deviceConfigs?.length ?? 0
}

const activePhaseName = computed(() => {
  const idx = activePhaseIndex.value
  if (idx < 0) {
    return 'Not started'
  }
  return sortedPhases.value[idx]?.name ?? 'Not started'
})

const activePhaseSub = computed(() => {
  const idx = activePhaseIndex.value
  if (idx < 0) {
    return 'No active phase'
  }
  const phase = sortedPhases.value[idx]
  if (!phase) {
    return 'No active phase'
  }
  const day = Math.min(activePhaseElapsedDays.value + 1, phase.durationDays)
  return `Phase ${idx + 1} of ${sortedPhases.value.length} · Day ${day} of ${phase.durationDays}`
})

const controllerStatusClass = computed(() => {
  const status = linkedController.value?.status
  if (status === 'ONLINE') {
    return 'online'
  }
  if (status === 'ERROR') {
    return 'error'
  }
  return 'offline'
})

const daysRemaining = computed(() => Math.max(0, totalDurationDays.value - elapsedDays.value))

const estimatedHarvestDate = computed(() => {
  const startAt = currentCycle.value?.startAt
  if (!startAt || totalDurationDays.value === 0) {
    return null
  }
  return addDays(startAt, totalDurationDays.value)
})

const activePhaseElapsedDays = computed(() => {
  const idx = activePhaseIndex.value
  if (idx < 0) {
    return 0
  }
  const phase = sortedPhases.value[idx]
  if (!phase?.startAt) {
    return 0
  }
  return Math.min(daysBetween(phase.startAt, todayStr()), phase.durationDays)
})

// TODO: replace with live telemetry from the backend once the API is ready
const temperatureC = ref(24.5)
const humidityPercent = ref(58)
const co2Ppm = ref(1000)
const ecMs = ref(800)
const phValue = ref(6)

function metricToValue(metric: string): number | null {
  const m = metric.toUpperCase()
  if (m === 'TEMP' || m === 'TEMPERATURE') {
    return temperatureC.value
  }
  if (m === 'HUMIDITY') {
    return humidityPercent.value
  }
  if (m === 'CO2') {
    return co2Ppm.value
  }
  if (m === 'EC') {
    return ecMs.value
  }
  if (m === 'PH') {
    return phValue.value
  }
  return null
}

const METRIC_DISPLAY: Record<string, { label: string; unit: string }> = {
  CO2: { label: 'CO₂', unit: 'ppm' },
  EC: { label: 'Water EC', unit: 'ppm' },
  HUMIDITY: { label: 'Humidity', unit: '%' },
  PH: { label: 'Water pH', unit: '' },
  TEMP: { label: 'Temperature', unit: '°C' },
  TEMPERATURE: { label: 'Temperature', unit: '°C' },
}

function formatAlert(metric: string, current: number, threshold: number): string {
  const info = METRIC_DISPLAY[metric.toUpperCase()] ?? { label: metric, unit: '' }
  return `${info.label} ${current}${info.unit} exceeds ${threshold}${info.unit} threshold`
}

const alerts = computed(() => {
  const idx = activePhaseIndex.value
  if (idx < 0) {
    return []
  }
  const phase = sortedPhases.value[idx]
  if (!phase?.deviceConfigs) {
    return []
  }
  const result: { key: string; message: string }[] = []
  for (const cfg of phase.deviceConfigs) {
    if (cfg.triggerType !== TriggerType.THRESHOLD) {
      continue
    }
    if (!cfg.id) {
      continue
    }
    const { metric, high } = normalizeThresholdConfig(cfg.configData as Record<string, unknown>)
    if (!metric) {
      continue
    }
    const current = metricToValue(metric)
    if (current === null) {
      continue
    }
    if (current > high) {
      result.push({ key: cfg.id, message: formatAlert(metric, current, high) })
    }
  }
  return result
})

function summarizeConfig(config: DeviceConfig): string {
  return formatConfigSummary(
    config.triggerType as TriggerType,
    config.configData as Record<string, unknown>,
  )
}

watch(
  () => linkedController.value?.devices,
  (devices) => {
    if (devices) {
      for (const device of devices) {
        if (device.id && !(device.id in deviceToggles)) {
          deviceToggles[device.id] = device.isActive
        }
      }
    }
  },
  { deep: true, immediate: true },
)

async function onToggle(deviceId: string, checked: boolean) {
  deviceToggles[deviceId] = checked
  await store.sendDeviceCommand(deviceId, checked ? 'ON' : 'OFF')
}

async function reconcileGrowState(cycle: {
  id: string
  startAt: string | null
  isActive: boolean
  phases?: GrowPhase[]
}) {
  const phases = [...(cycle.phases ?? [])].toSorted((a, b) => a.order - b.order)

  function syncPhaseIntoCycle(updated: GrowPhase) {
    if (!updated.id) {
      return
    }
    const live: GrowPhase[] | undefined = currentCycle.value?.phases
    if (!live) {
      return
    }
    const liveIdx = live.findIndex((p: GrowPhase) => p.id === updated.id)
    if (liveIdx !== -1) {
      live[liveIdx] = { ...live[liveIdx], ...updated }
    }
  }
  const growActive = deriveGrowActive(cycle.startAt, phases)
  const activeIdx = deriveActivePhaseIndex(phases)
  const storedActive = phases.find((p) => p.isActive)

  if (activeIdx >= 0) {
    const target = phases[activeIdx]
    if (target && target.id && (!storedActive || storedActive.id !== target.id)) {
      const updated = await store.activateGrowPhase(target.id)
      const localIdx = phases.findIndex((p) => p.id === updated.id)
      if (localIdx !== -1) {
        phases[localIdx] = { ...phases[localIdx], ...updated }
        syncPhaseIntoCycle(updated)
      }
    }
  } else if (storedActive && storedActive.id) {
    const updated = await store.updateGrowPhase(storedActive.id, { isActive: false })
    const localIdx = phases.findIndex((p) => p.id === updated.id)
    if (localIdx !== -1) {
      phases[localIdx] = { ...phases[localIdx], ...updated }
      syncPhaseIntoCycle(updated)
    }
  }

  if (cycle.isActive !== growActive) {
    await store.updateGrowCycle(cycle.id, { isActive: growActive })
    const idx = store.growCycles.findIndex((g) => g.id === cycle.id)
    if (idx !== -1) {
      store.growCycles[idx] = {
        ...store.growCycles[idx],
        isActive: growActive,
      } as (typeof store.growCycles)[number]
    }
  }
}

onMounted(async () => {
  if (cycleId.value) {
    const cycle = await store.fetchGrowCycle(cycleId.value)
    if (cycle?.controller) {
      const idx = store.controllers.findIndex((c) => c.id === cycle.controllerId)
      if (idx !== -1) {
        store.controllers[idx] = { ...store.controllers[idx], ...cycle.controller }
      } else {
        store.controllers.push(cycle.controller)
      }
    }
    await reconcileGrowState(cycle)
    const initialPhases = sortedPhases.value
    const initialActive = initialPhases[activePhaseIndex.value] ?? initialPhases[0]
    if (initialActive?.id) {
      openPhasePanels.value = [initialActive.id]
    }
    if (cycle?.controllerId) {
      const devices = await store.fetchDevices(cycle.controllerId)
      const ctrl = store.controllers.find((c) => c.id === cycle.controllerId)
      if (ctrl) {
        ctrl.devices = devices
      }
      if (currentCycle.value?.controller) {
        currentCycle.value.controller.devices = devices
      }
    }
  }
})

function statusSeverity(status?: string) {
  return status === 'ONLINE' ? 'success' : 'danger'
}
</script>

<template>
  <div v-if="currentCycle" class="monitor-page">
    <div class="back-row">
      <Button
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        rounded
        size="small"
        aria-label="Back"
        @click="router.push('/')"
      />
      <div>
        <h1 class="page-title">{{ currentCycle.name }}</h1>
        <p class="page-subtitle">System run monitoring dashboard</p>
      </div>
    </div>

    <Card class="status-hero">
      <template #content>
        <div v-if="linkedController" class="hero-strip">
          <div class="hero-group hero-controller">
            <span class="status-dot" :class="controllerStatusClass"></span>
            <div class="hero-controller-info">
              <span
                class="hero-controller-name"
                v-tooltip.top="`MAC: ${linkedController.macAddress}`"
              >
                {{ linkedController.name }}
              </span>
              <span class="hero-controller-ip">{{ linkedController.ipAddress }}</span>
            </div>
          </div>

          <div class="hero-divider"></div>

          <div class="hero-group hero-cycle">
            <Tag
              :value="currentCycle.isActive ? 'Running' : 'Idle'"
              :severity="currentCycle.isActive ? 'success' : 'secondary'"
              rounded
            />
            <div class="hero-cycle-info">
              <span class="hero-phase-name">{{ activePhaseName }}</span>
              <span class="hero-phase-sub">{{ activePhaseSub }}</span>
            </div>
          </div>

          <div class="hero-divider"></div>

          <div class="hero-group hero-progress">
            <div class="hero-progress-text">
              <span class="hero-progress-percent">{{ cycleProgressPercent }}%</span>
              <span class="hero-progress-days">
                {{ daysRemaining }} {{ daysRemaining === 1 ? 'day' : 'days' }} to harvest
                <template v-if="daysRemaining === 0"> — Complete</template>
              </span>
            </div>
            <div class="hero-progress-bar">
              <div class="hero-progress-fill" :style="{ width: cycleProgressPercent + '%' }"></div>
            </div>
            <div v-if="estimatedHarvestDate" class="hero-progress-footer">
              <span>{{ elapsedDays }} / {{ totalDurationDays }} days</span>
              <span>est. {{ estimatedHarvestDate }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state error">Controller linkage not configured.</div>
      </template>
    </Card>

    <Card v-if="alerts.length" class="alerts-card">
      <template #content>
        <div class="alerts-list">
          <div v-for="alert in alerts" :key="alert.key" class="alert-item">
            <i class="pi pi-exclamation-triangle alert-icon"></i>
            <span class="alert-message">{{ alert.message }}</span>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Climate</template>
      <template #content>
        <div class="climate-grid">
          <div class="hero-metric" v-tooltip.top="'Live telemetry — hardcoded for now'">
            <i class="pi pi-sun hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ temperatureC }}<span class="hero-metric-unit">°C</span>
              </span>
              <span class="hero-metric-label">Temperature</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'Live telemetry — hardcoded for now'">
            <i class="pi pi-cloud hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ humidityPercent }}<span class="hero-metric-unit">%</span>
              </span>
              <span class="hero-metric-label">Humidity</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'Live telemetry — hardcoded for now'">
            <i class="pi pi-globe hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ co2Ppm }}<span class="hero-metric-unit">ppm</span>
              </span>
              <span class="hero-metric-label">CO₂</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'Live telemetry — hardcoded for now'">
            <i class="pi pi-bolt hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ ecMs }}<span class="hero-metric-unit">ppm</span>
              </span>
              <span class="hero-metric-label">Water EC</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'Live telemetry — hardcoded for now'">
            <i class="pi pi-chart-line hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ phValue }}<span class="hero-metric-unit">pH</span>
              </span>
              <span class="hero-metric-label">Water pH</span>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Phases</template>
      <template #content>
        <div v-if="sortedPhases.length" class="phases-wrapper">
          <div class="phase-track">
            <div class="phase-line">
              <div class="phase-line-fill" :style="{ width: cycleProgressPercent + '%' }"></div>
            </div>
            <div v-for="(phase, idx) in sortedPhases" :key="phase.id || idx" class="phase-step">
              <div
                class="phase-dot"
                :class="{
                  done: idx < activePhaseIndex,
                  active: idx === activePhaseIndex,
                  pending: idx > activePhaseIndex,
                }"
              >
                {{ idx + 1 }}
              </div>
              <div class="phase-name" :class="{ active: idx === activePhaseIndex }">
                {{ phase.name }}
              </div>
              <div class="phase-duration">
                {{ phase.durationDays }} day{{ phase.durationDays !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>

          <div class="progress-block">
            <div class="progress-header">
              <span class="progress-label">Overall Progress</span>
              <span class="progress-value">{{ cycleProgressPercent }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: cycleProgressPercent + '%' }"></div>
            </div>
            <div class="progress-footer">
              <span>{{ elapsedDays }} days</span>
              <span>{{ totalDurationDays }} days</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">No phases configured for this grow cycle.</div>
      </template>
    </Card>

    <Card>
      <template #title>Devices</template>
      <template #content>
        <div v-if="linkedController?.devices?.length" class="device-grid">
          <div
            v-for="device in linkedController.devices"
            :key="device.id"
            class="device-tile"
            :class="{ active: deviceToggles[device.id!] }"
          >
            <span class="device-name">{{ device.name }}</span>
            <ToggleSwitch
              :modelValue="deviceToggles[device.id!]"
              @update:modelValue="(val: boolean) => onToggle(device.id!, val)"
            />
          </div>
        </div>
        <div v-else class="empty-state">No devices configured for this controller.</div>
      </template>
    </Card>

    <Card>
      <template #title>Phase Configuration</template>
      <template #content>
        <div v-if="sortedPhases.length" class="phase-config-accordion">
          <Accordion v-model:value="openPhasePanels" multiple>
            <AccordionPanel v-for="phase in sortedPhases" :key="phase.id" :value="phase.id">
              <AccordionHeader>
                <div class="phase-config-header">
                  <div class="phase-config-header-left">
                    <span class="phase-config-order">{{ phase.order }}</span>
                    <div class="phase-config-meta">
                      <span class="phase-config-name" :class="{ active: phase.isActive }">
                        {{ phase.name }}
                      </span>
                      <span class="phase-config-sub">
                        {{ phase.durationDays }} day{{ phase.durationDays !== 1 ? 's' : '' }} ·
                        {{ phaseDeviceCount(phase) }}
                        config{{ phaseDeviceCount(phase) !== 1 ? 's' : '' }}
                      </span>
                    </div>
                  </div>
                  <div class="phase-config-header-right">
                    <Tag v-if="phase.isActive" value="Active" severity="success" rounded />
                    <span v-if="phase.startAt && phase.endAt" class="phase-config-dates">
                      {{ phase.startAt }} → {{ phase.endAt }}
                    </span>
                  </div>
                </div>
              </AccordionHeader>
              <AccordionContent>
                <div v-if="phase.deviceConfigs && phase.deviceConfigs.length" class="config-list">
                  <div v-for="cfg in phase.deviceConfigs" :key="cfg.id" class="config-item">
                    <div class="config-item-left">
                      <div class="config-item-device">
                        <span class="config-device-name">
                          {{ cfg.device?.name ?? 'Unknown device' }}
                        </span>
                        <span v-if="cfg.device?.type" class="type-pill">
                          {{ cfg.device.type.replace(/_/g, ' ') }}
                        </span>
                      </div>
                      <div v-if="cfg.device" class="config-item-meta">
                        <code class="meta-code">GPIO {{ cfg.device.pinNumber }}</code>
                        <code class="meta-code">{{ cfg.device.mqttTopic }}</code>
                      </div>
                    </div>
                    <div class="config-item-right">
                      <Tag
                        :value="cfg.device?.isActive ? 'Armed' : 'Disarmed'"
                        :severity="cfg.device?.isActive ? 'success' : 'secondary'"
                        rounded
                      />
                      <Tag
                        :value="TRIGGER_TYPE_LABEL[cfg.triggerType as TriggerType]"
                        :severity="TRIGGER_TYPE_SEVERITY[cfg.triggerType as TriggerType]"
                        rounded
                      />
                      <code class="config-summary">
                        {{ summarizeConfig(cfg) }}
                      </code>
                    </div>
                  </div>
                </div>
                <div v-else class="config-empty">No device configurations for this phase.</div>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </div>
        <div v-else class="empty-state">No phases configured for this grow cycle.</div>
      </template>
    </Card>
  </div>

  <div v-else class="not-found">
    <p class="error">Grow cycle not found.</p>
    <Button label="Return to dashboard" text @click="router.push('/')" />
  </div>
</template>

<style scoped>
.monitor-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.back-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: var(--tracking-tight);
}

.page-subtitle {
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  margin: 0.125rem 0 0 0;
}

.meta-code {
  background: var(--color-code-bg);
  padding: 0.1875rem 0.4375rem;
  border-radius: var(--radius-sm);
  color: var(--color-code-text);
  font-size: var(--text-base);
  border: 1px solid var(--color-border);
}

.status-hero :deep(.p-card-body) {
  padding: var(--space-4) var(--space-5);
}

.status-hero {
  border-top: 2px solid var(--color-accent);
}

.hero-strip {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.hero-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.hero-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border);
  flex-shrink: 0;
}

.hero-controller-info,
.hero-cycle-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.hero-controller-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
  cursor: help;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.hero-controller-ip {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.hero-phase-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-phase-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: 500;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
  animation: pulse-dot 2s var(--ease-default) infinite;
}

.status-dot.offline {
  background: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-bg);
}

.status-dot.error {
  background: var(--color-warning);
  box-shadow: 0 0 0 3px var(--color-warning-bg);
}

.hero-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 200px;
}

.hero-progress-text {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.hero-progress-percent {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-accent);
  font-family: var(--font-mono);
  line-height: 1;
}

.hero-progress-days {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.hero-progress-bar {
  width: 100%;
  max-width: 220px;
  height: 4px;
  background: var(--color-track-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.hero-progress-fill {
  height: 100%;
  background: var(--color-track-fill);
  border-radius: var(--radius-sm);
  transition: width var(--duration-slow) var(--ease-default);
  box-shadow: 0 0 8px var(--color-accent-glow);
}

.hero-progress-footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.climate-grid {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  width: 100%;
}

.hero-metric {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: help;
  flex: 1;
  min-width: 140px;
}

.hero-metric-icon {
  font-size: var(--text-xl);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.hero-metric-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.hero-metric-value {
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  line-height: 1;
}

.hero-metric-unit {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 500;
  margin-left: 0.125rem;
}

.hero-metric-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: 500;
}

.alerts-card {
  border-top: 2px solid var(--color-warning);
}

.alerts-card :deep(.p-card-body) {
  padding: var(--space-3) var(--space-5);
  background: var(--color-warning-bg);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.alert-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.alert-icon {
  color: var(--color-warning);
  font-size: var(--text-md);
  flex-shrink: 0;
}

.alert-message {
  font-size: var(--text-md);
  color: var(--color-text-primary);
}

@media (max-width: 767px) {
  .hero-strip {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  .hero-divider {
    display: none;
  }
  .hero-progress,
  .hero-progress-bar,
  .climate-grid {
    width: 100%;
  }
}

.type-pill {
  text-transform: capitalize;
  padding: 0.1875rem 0.5rem;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
  border: 1px solid var(--color-border);
}

.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--space-6) 0;
  font-size: var(--text-md);
}

.empty-state.error {
  color: var(--color-danger);
}

.phases-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.phase-track {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-4) 0;
}

.phase-line {
  position: absolute;
  top: calc(1rem + 16px);
  left: 18px;
  right: 18px;
  height: 2px;
  background: var(--color-track-bg);
  z-index: 0;
  border-radius: 2px;
  overflow: hidden;
}

.phase-line-fill {
  height: 100%;
  background: var(--color-track-fill);
  transition: width var(--duration-slow) var(--ease-default);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--color-accent-glow);
}

.phase-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
  z-index: 1;
}

.phase-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 600;
  background: var(--color-bg-base);
  border: 2px solid var(--color-phase-pending-border);
  color: var(--color-phase-pending-text);
  transition: all var(--duration-slow) var(--ease-default);
}

.phase-dot.done {
  background: var(--color-phase-done);
  border-color: var(--color-phase-done);
  color: var(--color-phase-done-text);
}

.phase-dot.active {
  background: var(--color-phase-active);
  border-color: var(--color-phase-active);
  color: var(--color-phase-done-text);
  box-shadow:
    0 0 0 4px var(--color-accent-glow),
    0 0 16px var(--color-accent-glow);
  animation: pulse 2.4s var(--ease-default) infinite;
}

.phase-name {
  margin-top: var(--space-2);
  text-align: center;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  max-width: 100px;
  transition: color var(--duration-normal) var(--ease-default);
}

.phase-name.active {
  color: var(--color-text-primary);
  font-weight: 600;
}

.phase-duration {
  margin-top: 0.1875rem;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.progress-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: 500;
}

.progress-value {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-mono);
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--color-track-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-track-fill);
  border-radius: var(--radius-sm);
  transition: width var(--duration-slow) var(--ease-default);
  box-shadow: 0 0 8px var(--color-accent-glow);
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.device-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.device-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.625rem var(--space-4);
  min-width: 200px;
  flex: 1;
  max-width: 280px;
  transition: all var(--duration-normal) var(--ease-default);
}

.device-tile:hover {
  border-color: var(--color-bg-muted);
  background: var(--color-bg-hover);
}

.device-tile.active {
  border-color: var(--color-device-active-border);
  background: var(--color-device-active-bg);
  box-shadow: var(--shadow-glow);
}

.device-name {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: color var(--duration-normal) var(--ease-default);
}

.device-tile.active .device-name {
  color: var(--color-text-primary);
}

.not-found {
  text-align: center;
  padding: var(--space-12) var(--space-4);
}

.not-found .error {
  color: var(--color-danger);
  font-weight: 500;
  margin: 0 0 var(--space-4) 0;
}

.phase-config-accordion :deep(.p-accordionpanel) {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.phase-config-accordion :deep(.p-accordionpanel:last-child) {
  margin-bottom: 0;
}

.phase-config-accordion :deep(.p-accordionheader) {
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
}

.phase-config-accordion :deep(.p-accordionheader:hover) {
  background: var(--color-bg-hover);
}

.phase-config-accordion :deep(.p-accordioncontent-content) {
  padding: 0 var(--space-4) var(--space-4) var(--space-4);
  background: transparent;
  border: none;
}

.phase-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
}

.phase-config-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.phase-config-order {
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
  flex-shrink: 0;
}

.phase-config-meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.phase-config-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.phase-config-name.active {
  color: var(--color-text-primary);
}

.phase-config-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.phase-config-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.phase-config-dates {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-subtle);
}

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.config-item-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  flex-wrap: wrap;
}

.config-item-device {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.config-item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}

.config-device-name {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.config-item-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.config-summary {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  background: var(--color-code-bg);
  padding: 0.1875rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  white-space: nowrap;
}

.config-empty {
  padding: var(--space-4) 0 var(--space-2) 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
  font-style: italic;
}
</style>
