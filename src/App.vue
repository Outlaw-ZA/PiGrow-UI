<!-- src/App.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGrowStore } from './stores/growStore'
import { DeviceType } from './types/grow'

// UI PrimeVue Component Imports
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const store = useGrowStore()

// Sync state on load
onMounted(() => {
  store.fetchAll()
})

// --- FORM STATES (Drawn directly from your Prisma Schema fields) ---
const newController = ref({ name: '', macAddress: '', ipAddress: '' })

const newDevice = ref({
  controllerId: '',
  name: '',
  type: DeviceType.LIGHT,
  pinNumber: 1,
  mqttTopic: '',
  isActive: true,
})

const newGrowCycle = ref({
  controllerId: '',
  name: '',
  isActive: false,
})

// --- FORM SUBMIT HANDLERS ---
const handleCreateController = async () => {
  await store.createController({ ...newController.value })
  newController.value = { name: '', macAddress: '', ipAddress: '' }
}

const handleCreateDevice = async () => {
  await store.createDevice({ ...newDevice.value })
  newDevice.value = {
    controllerId: '',
    name: '',
    type: DeviceType.LIGHT,
    pinNumber: 1,
    mqttTopic: '',
    isActive: true,
  }
}

const handleCreateGrowCycle = async () => {
  await store.createGrowCycle({ ...newGrowCycle.value })
  newGrowCycle.value = { controllerId: '', name: '', isActive: false }
}
</script>

<template>
  <div
    class="p-6 max-w-7xl mx-auto space-y-8"
    style="font-family: system-ui, sans-serif; padding: 2rem"
  >
    <h1 class="text-3xl font-bold mb-6">🌱 Grow Automation Control Plane</h1>

    <div
      style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem"
    >
      <!-- 1. CONTROLLER PROVISIONING CARD -->
      <Card>
        <template #title>📟 Commission New Controller (Pi)</template>
        <template #content>
          <div style="display: flex; flex-direction: column; gap: 1rem">
            <label>Controller Name</label>
            <InputText v-model="newController.name" placeholder="e.g. Tent 1 Main Hub" />

            <label>MAC Address</label>
            <InputText v-model="newController.macAddress" placeholder="00:1A:2B:3C:4D:5E" />

            <label>IP Address</label>
            <InputText v-model="newController.ipAddress" placeholder="192.168.1.105" />

            <Button
              label="Register Controller"
              icon="pi pi-check"
              @click="handleCreateController"
            />
          </div>
        </template>
      </Card>

      <!-- 2. DEVICE ATTACHMENT CARD -->
      <Card>
        <template #title>🔌 Map Physical Device to GPIO</template>
        <template #content>
          <div style="display: flex; flex-direction: column; gap: 1rem">
            <label>Assign to Controller</label>
            <Select
              v-model="newDevice.controllerId"
              :options="store.controllers"
              optionLabel="name"
              optionValue="id"
              placeholder="Select Pi Host"
            />

            <label>Device Name</label>
            <InputText v-model="newDevice.name" placeholder="e.g. AC Infinity Exhaust" />

            <label>Device Hardware Type</label>
            <Select
              v-model="newDevice.type"
              :options="Object.values(DeviceType)"
              placeholder="Select Class"
            />

            <label>GPIO / Relay Pin Number</label>
            <InputNumber v-model="newDevice.pinNumber" :min="0" :max="40" showButtons />

            <label>MQTT Control Topic</label>
            <InputText v-model="newDevice.mqttTopic" placeholder="tent1/device/fan/cmd" />

            <Button
              label="Attach Device"
              severity="success"
              icon="pi pi-plus"
              @click="handleCreateDevice"
            />
          </div>
        </template>
      </Card>

      <!-- 3. GROW CYCLE CREATION CARD -->
      <Card>
        <template #title>📅 Schedule Grow Cycle</template>
        <template #content>
          <div style="display: flex; flex-direction: column; gap: 1rem">
            <label>Target Controller Infrastructure</label>
            <Select
              v-model="newGrowCycle.controllerId"
              :options="store.controllers"
              optionLabel="name"
              optionValue="id"
              placeholder="Target Enclosure"
            />

            <label>Run Cycle Name</label>
            <InputText v-model="newGrowCycle.name" placeholder="e.g. Run #4 - Super Lemon Haze" />

            <div style="display: flex; align-items: center; gap: 1rem">
              <label>Activate Immediately?</label>
              <ToggleSwitch v-model="newGrowCycle.isActive" />
            </div>

            <Button
              label="Initialize Run"
              severity="warn"
              icon="pi pi-calendar"
              @click="handleCreateGrowCycle"
            />
          </div>
        </template>
      </Card>
    </div>

    <!-- DATA MONITORING VIEW LAYER -->
    <div style="margin-top: 3rem">
      <h2>Active Network Layout</h2>
      <DataTable
        :value="store.controllers"
        tableStyle="min-width: 50rem"
        class="p-datatable-striped"
      >
        <Column field="name" header="Controller Name"></Column>
        <Column field="ipAddress" header="IP Address"></Column>
        <Column field="status" header="Network Status">
          <template #body="slotProps">
            <span :style="{ color: slotProps.data.status === 'ONLINE' ? 'green' : 'red' }">
              ● {{ slotProps.data.status || 'OFFLINE' }}
            </span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
