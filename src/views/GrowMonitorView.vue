<!-- src/views/GrowMonitorView.vue -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../stores/growStore'
import Card from 'primevue/card'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const route = useRoute()
const router = useRouter()
const store = useGrowStore()

// Capture current id parameter from location path context
const cycleId = computed(() => route.params.id as string)

// Lookup match inside centralized Pinia stores
const currentCycle = computed(() => {
  return store.growCycles.find((g) => g.id === cycleId.value)
})

// Lookup corresponding host execution node machine
const linkedController = computed(() => {
  if (!currentCycle.value) return null
  return store.controllers.find((c) => c.id === currentCycle.value.controllerId)
})

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div v-if="currentCycle" style="display: flex; flex-direction: column; gap: 2rem">
    <!-- BACK NAVIGATION HEADER ROW LAYER -->
    <div style="display: flex; align-items: center; gap: 1.5rem">
      <Button icon="pi pi-arrow-left" severity="secondary" rounded @click="router.push('/')" />
      <div>
        <h1 style="font-size: 1.875rem; font-weight: 700; color: #0f172a; margin: 0">
          {{ currentCycle.name }}
        </h1>
        <p style="color: #64748b; margin: 0.25rem 0 0 0">System Run Monitoring Dashboard</p>
      </div>
    </div>

    <!-- INFRASTRUCTURE META SPLIT GRID -->
    <div
      style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.5rem;
      "
    >
      <!-- HOST HARDWARE PROFILE CARD -->
      <Card>
        <template #title><span style="color: #0f172a">🖥️ Controller Hub Metadata</span></template>
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

      <!-- RUNTIME SUMMARY STATS CARD -->
      <Card>
        <template #title><span style="color: #0f172a">📊 Execution Plan Status</span></template>
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

    <!-- PERIPHERAL ATTACHED HARDWARE DEVICES MATRIX LAYER -->
    <Card>
      <template #title>
        <span style="color: #0f172a"
          >🔌 Physical Hardware Relays Mapping Matrix (`Devices` Layer)</span
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
