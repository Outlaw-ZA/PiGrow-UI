<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../stores/growStore'
import type { GrowPhase } from '../types/grow'
import Card from 'primevue/card'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'

const route = useRoute()
const router = useRouter()
const store = useGrowStore()

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

const activePhaseIndex = computed(() => sortedPhases.value.findIndex((p: GrowPhase) => p.isActive))

const cycleProgressPercent = computed(() => {
  if (sortedPhases.value.length === 0) {
    return 0
  }
  const idx = activePhaseIndex.value
  if (idx === -1) {
    return 0
  }
  const completedDays = sortedPhases.value
    .slice(0, idx)
    .reduce((sum: number, p: GrowPhase) => sum + p.durationDays, 0)
  return Math.min(Math.round((completedDays / totalDurationDays.value) * 100), 100)
})

const deviceToggles = reactive<Record<string, boolean>>({})

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

    <div class="meta-grid">
      <Card>
        <template #title>Controller</template>
        <template #content>
          <div v-if="linkedController" class="meta-list">
            <div class="meta-row">
              <span class="meta-label">Name</span>
              <span class="meta-value">{{ linkedController.name }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">IP Address</span>
              <code class="meta-code">{{ linkedController.ipAddress }}</code>
            </div>
            <div class="meta-row">
              <span class="meta-label">MAC Address</span>
              <code class="meta-code">{{ linkedController.macAddress }}</code>
            </div>
            <div class="meta-row">
              <span class="meta-label">Status</span>
              <Tag
                :value="linkedController.status || 'OFFLINE'"
                :severity="statusSeverity(linkedController.status)"
                rounded
              />
            </div>
          </div>
          <div v-else class="empty-state error">Controller linkage not configured.</div>
        </template>
      </Card>

      <Card>
        <template #title>Cycle</template>
        <template #content>
          <div class="meta-list">
            <div class="meta-row">
              <span class="meta-label">ID</span>
              <span class="meta-value mono">{{ currentCycle.id }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">State</span>
              <Tag
                :value="currentCycle.isActive ? 'Running' : 'Idle'"
                :severity="currentCycle.isActive ? 'success' : 'secondary'"
                rounded
              />
            </div>
            <div class="meta-row">
              <span class="meta-label">Devices</span>
              <span class="meta-value">{{ linkedController?.devices?.length || 0 }} attached</span>
            </div>
          </div>
        </template>
      </Card>
    </div>

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
              <span>0 days</span>
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
      <template #title>Device Map</template>
      <template #content>
        <DataTable
          :value="linkedController?.devices || []"
          size="small"
          paginator
          :rows="10"
          :rowsPerPageOptions="[10, 20, 50]"
        >
          <template #empty>
            <div class="empty-state">
              No devices configured. Visit administration to assign devices.
            </div>
          </template>
          <Column field="name" header="Name" sortable style="font-weight: 600"></Column>
          <Column field="type" header="Type" sortable>
            <template #body="slotProps">
              <span class="type-pill">{{ slotProps.data.type.replace(/_/g, ' ') }}</span>
            </template>
          </Column>
          <Column field="pinNumber" header="GPIO Pin" sortable>
            <template #body="slotProps">
              <code class="meta-code">{{ slotProps.data.pinNumber }}</code>
            </template>
          </Column>
          <Column field="mqttTopic" header="MQTT Topic" sortable>
            <template #body="slotProps">
              <code class="meta-code">{{ slotProps.data.mqttTopic }}</code>
            </template>
          </Column>
          <Column header="State" sortable>
            <template #body="slotProps">
              <Tag
                :value="slotProps.data.isActive ? 'Armed' : 'Disarmed'"
                :severity="slotProps.data.isActive ? 'success' : 'secondary'"
                rounded
              />
            </template>
          </Column>
        </DataTable>
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

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--text-md);
}

.meta-label {
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  font-weight: 500;
}

.meta-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.meta-value.mono {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.meta-code {
  background: var(--color-code-bg);
  padding: 0.1875rem 0.4375rem;
  border-radius: var(--radius-sm);
  color: var(--color-code-text);
  font-size: var(--text-base);
  border: 1px solid var(--color-border);
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
</style>
