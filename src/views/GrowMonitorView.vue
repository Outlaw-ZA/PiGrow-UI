<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../stores/growStore'
import type { GrowPhase } from '../types/grow'
import Card from 'primevue/card'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'

const route = useRoute()
const router = useRouter()
const store = useGrowStore()

const cycleId = computed(() => route.params.id as string)

const currentCycle = computed(() => {
  return store.growCycles.find((g) => g.id === cycleId.value) as any
})

const linkedController = computed(() => {
  return currentCycle.value?.controller || null
})

const sortedPhases = computed(() => {
  const phases = currentCycle.value?.phases
  if (!phases) return []
  return [...phases].sort((a: GrowPhase, b: GrowPhase) => a.order - b.order)
})

const totalDurationDays = computed(() => {
  return sortedPhases.value.reduce((sum: number, p: GrowPhase) => sum + p.durationDays, 0)
})

const activePhaseIndex = computed(() => {
  return sortedPhases.value.findIndex((p: GrowPhase) => p.isActive)
})

const cycleProgressPercent = computed(() => {
  if (sortedPhases.value.length === 0) return 0
  const idx = activePhaseIndex.value
  if (idx === -1) return 0
  const completedDays = sortedPhases.value
    .slice(0, idx)
    .reduce((sum: number, p: GrowPhase) => sum + p.durationDays, 0)
  return Math.min(
    Math.round((completedDays / totalDurationDays.value) * 100),
    100,
  )
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
  { immediate: true, deep: true },
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
        store.controllers[idx] = cycle.controller
      } else {
        store.controllers.push(cycle.controller)
      }
    }
  }
})
</script>

<template>
  <div v-if="currentCycle" style="display: flex; flex-direction: column; gap: 2rem">
    <div style="display: flex; align-items: center; gap: 1.5rem">
      <Button icon="pi pi-arrow-left" severity="secondary" rounded @click="router.push('/')" />
      <div>
        <h1 style="font-size: 1.875rem; font-weight: 700; color: #0f172a; margin: 0">
          {{ currentCycle.name }}
        </h1>
        <p style="color: #64748b; margin: 0.25rem 0 0 0">System Run Monitoring Dashboard</p>
      </div>
    </div>

    <div
      style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.5rem;
      "
    >
      <Card>
        <template #title><span style="color: #ffffff; font-weight: 700">Controller Hub Metadata</span></template>
        <template #content>
          <div v-if="linkedController" style="display: flex; flex-direction: column; gap: 0.75rem">
            <div><strong>Host Identifier Name:</strong> {{ linkedController.name }}</div>
            <div>
              <strong>Target LAN Address:</strong> <code>{{ linkedController.ipAddress }}</code>
            </div>
            <div>
              <strong>MAC Signature:</strong> <code>{{ linkedController.macAddress }}</code>
            </div>
            <div>
              <strong>Current Connection:</strong>
              <span
                :style="{
                  color: linkedController.status === 'ONLINE' ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold',
                }"
              >
                ● {{ linkedController.status || 'OFFLINE' }}
              </span>
            </div>
          </div>
          <div v-else style="color: #ef4444">Warning: Infrastructure linkage mapping error.</div>
        </template>
      </Card>

      <Card>
        <template #title><span style="color: #ffffff; font-weight: 700">Execution Plan Status</span></template>
        <template #content>
          <div style="display: flex; flex-direction: column; gap: 0.75rem">
            <div>
              <strong>Logical Record UUID:</strong>
              <span style="font-size: 0.85rem; color: #64748b">{{ currentCycle.id }}</span>
            </div>
            <div>
              <strong>Active Operational Toggle:</strong>
              <span
                :style="{
                  background: currentCycle.isActive ? '#ecfdf5' : '#f1f5f9',
                  color: currentCycle.isActive ? '#065f46' : '#475569',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontWeight: '600',
                }"
              >
                {{ currentCycle.isActive ? 'RUNNING CYCLE' : 'STANDBY IDLE' }}
              </span>
            </div>
            <div>
              <strong>Mapped Active Hardware Devices:</strong>
              {{ linkedController?.devices?.length || 0 }} Attached Peripherals
            </div>
          </div>
        </template>
      </Card>
    </div>

    <Card>
      <template #title><span style="color: #ffffff; font-weight: 700">Grow Phases</span></template>
      <template #content>
        <div v-if="sortedPhases.length">
          <div
            style="
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              position: relative;
              padding: 1rem 0;
            "
          >
            <div
              style="
                position: absolute;
                top: calc(1rem + 16px);
                left: 18px;
                right: 18px;
                height: 4px;
                background: #e2e8f0;
                border-radius: 2px;
                z-index: 0;
              "
            >
              <div
                style="
                  height: 100%;
                  background: linear-gradient(90deg, #22c55e, #3b82f6);
                  border-radius: 2px;
                  transition: width 0.5s ease;
                "
                :style="{ width: cycleProgressPercent + '%' }"
              ></div>
            </div>

            <div
              v-for="(phase, idx) in sortedPhases"
              :key="phase.id || idx"
              style="
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
                position: relative;
                z-index: 1;
              "
            >
              <div
                style="
                  width: 36px;
                  height: 36px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 0.8rem;
                  font-weight: 700;
                  transition: all 0.3s ease;
                "
                :style="{
                  background: idx < activePhaseIndex ? '#22c55e' : idx === activePhaseIndex ? '#3b82f6' : '#e2e8f0',
                  color: idx <= activePhaseIndex ? '#ffffff' : '#94a3b8',
                  boxShadow: idx === activePhaseIndex ? '0 0 0 4px rgba(59, 130, 246, 0.25)' : 'none',
                }"
              >
                {{ idx + 1 }}
              </div>
              <div
                style="
                  margin-top: 0.5rem;
                  text-align: center;
                  font-size: 0.8rem;
                  font-weight: 600;
                  max-width: 100px;
                "
                :style="{ color: idx === activePhaseIndex ? '#3b82f6' : '#64748b' }"
              >
                {{ phase.name }}
              </div>
              <div style="margin-top: 0.25rem; font-size: 0.7rem; color: #94a3b8">
                {{ phase.durationDays }} day{{ phase.durationDays !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>

          <div style="margin-top: 1rem">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
              <span style="font-size: 0.75rem; color: #94a3b8">Overall Progress</span>
              <span style="font-size: 0.75rem; font-weight: 600; color: #64748b">
                {{ cycleProgressPercent }}%
              </span>
            </div>
            <div
              style="
                width: 100%;
                height: 6px;
                background: #e2e8f0;
                border-radius: 3px;
                overflow: hidden;
              "
            >
              <div
                style="
                  height: 100%;
                  background: linear-gradient(90deg, #22c55e, #3b82f6);
                  border-radius: 3px;
                  transition: width 0.5s ease;
                "
                :style="{ width: cycleProgressPercent + '%' }"
              ></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 0.25rem">
              <span style="font-size: 0.7rem; color: #94a3b8">0 days</span>
              <span style="font-size: 0.7rem; color: #94a3b8">{{ totalDurationDays }} days</span>
            </div>
          </div>
        </div>
        <div v-else style="text-align: center; color: #64748b; padding: 1rem 0">
          No phases configured for this grow cycle.
        </div>
      </template>
    </Card>

    <Card>
      <template #title><span style="color: #ffffff; font-weight: 700">Devices</span></template>
      <template #content>
        <div
          v-if="linkedController?.devices?.length"
          style="
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
          "
        >
          <div
            v-for="device in linkedController.devices"
            :key="device.id"
            style="
              display: flex;
              align-items: center;
              gap: 0.75rem;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 0.75rem 1.25rem;
              min-width: 200px;
              flex: 1;
              max-width: 280px;
              transition: all 0.2s ease;
            "
            :style="{
              borderColor: deviceToggles[device.id!] ? '#86efac' : '#e2e8f0',
              background: deviceToggles[device.id!] ? '#f0fdf4' : '#f8fafc',
            }"
          >
            <span
              style="
                font-size: 0.8rem;
                font-weight: 600;
                color: #334155;
                flex: 1;
                line-height: 1.2;
              "
            >
              {{ device.name }}
            </span>
            <ToggleSwitch
              :modelValue="deviceToggles[device.id!]"
              @update:modelValue="(val: boolean) => onToggle(device.id!, val)"
            />
          </div>
        </div>
        <div v-else style="text-align: center; color: #64748b; padding: 1rem 0">
          No devices configured for this controller.
        </div>
      </template>
    </Card>

    <Card>
      <template #title>
        <span style="color: #ffffff; font-weight: 700"
          >Physical Hardware Relays Mapping Matrix (`Devices` Layer)</span
        >
      </template>
      <template #content>
        <DataTable
          :value="linkedController?.devices || []"
          responsiveLayout="scroll"
          placeholder="No physical channels configured for this controller host environment yet."
        >
          <template #empty>
            <div style="padding: 1.5rem; text-align: center; color: #64748b">
              No hardware devices map configurations discovered for this control node. Visit the
              administration panel to assign devices.
            </div>
          </template>
          <Column field="name" header="Device Peripheral Label" style="font-weight: 600"></Column>
          <Column field="type" header="Device Framework Class"></Column>
          <Column field="pinNumber" header="Physical GPIO / Relay Pin">
            <template #body="slotProps">
              <span
                style="
                  background: #f1f5f9;
                  padding: 0.2rem 0.5rem;
                  border-radius: 4px;
                  font-family: monospace;
                "
              >
                Pin {{ slotProps.data.pinNumber }}
              </span>
            </template>
          </Column>
          <Column field="mqttTopic" header="Control Bus Target Topic">
            <template #body="slotProps">
              <code style="color: #0284c7">{{ slotProps.data.mqttTopic }}</code>
            </template>
          </Column>
          <Column header="Power Signal Switch">
            <template #body="slotProps">
              <span
                :style="{
                  color: slotProps.data.isActive ? '#22c55e' : '#64748b',
                  fontWeight: 'bold',
                }"
              >
                {{ slotProps.data.isActive ? '⚡ LINK ARMED' : '⚪ SYSTEM DISARMED' }}
              </span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
  <div v-else style="text-align: center; padding: 3rem">
    <p style="color: #ef4444; font-weight: bold">
      Error 404: Grow Plan Profile Context Unresolved.
    </p>
    <Button label="Return to Facility Dashboard" class="p-button-text" @click="router.push('/')" />
  </div>
</template>
