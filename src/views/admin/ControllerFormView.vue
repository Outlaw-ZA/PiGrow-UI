<!-- src/views/admin/ControllerFormView.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../../stores/growStore'
import { DeviceType } from '../../types/grow'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dropdown from 'primevue/dropdown'
import InputSwitch from 'primevue/inputswitch'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const store = useGrowStore()
const route = useRoute()
const router = useRouter()

const controllerId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => !!controllerId.value)

const form = ref({ name: '', macAddress: '', ipAddress: '' })

const deviceTypeOptions = Object.values(DeviceType).map((t) => ({
  label: t.replace(/_/g, ' '),
  value: t,
}))

const devices = computed(() => {
  if (!controllerId.value) return []
  const controller = store.controllers.find((c) => c.id === controllerId.value)
  return controller?.devices || []
})

interface DeviceFormData {
  id: string
  name: string
  type: string
  pinNumber: string
  mqttTopic: string
  isActive: boolean
}

const deviceForm = ref<DeviceFormData>({
  id: '',
  name: '',
  type: '',
  pinNumber: '',
  mqttTopic: '',
  isActive: true,
})
const isEditingDevice = ref(false)

onMounted(async () => {
  await store.fetchAll()
  if (isEditMode.value && controllerId.value) {
    const existing = store.controllers.find((c) => c.id === controllerId.value)
    if (existing) {
      form.value = {
        name: existing.name,
        macAddress: existing.macAddress,
        ipAddress: existing.ipAddress,
      }
    }
    await store.fetchDevices(controllerId.value)
  }
})

const handleSave = async () => {
  if (isEditMode.value && controllerId.value) {
    await store.updateController(controllerId.value, form.value)
  } else {
    await store.createController(form.value)
  }
  router.push('/admin')
}

const handleSaveDevice = async () => {
  if (!controllerId.value) return

  const payload = {
    controllerId: controllerId.value,
    name: deviceForm.value.name,
    type: deviceForm.value.type as DeviceType,
    pinNumber: Number(deviceForm.value.pinNumber),
    mqttTopic: deviceForm.value.mqttTopic,
    isActive: deviceForm.value.isActive,
  }

  if (isEditingDevice.value) {
    const { controllerId: _cid, ...updatePayload } = payload
    await store.updateDevice(deviceForm.value.id, updatePayload)
  } else {
    await store.createDevice(payload)
  }
  await store.fetchDevices(controllerId.value)
  resetDeviceForm()
}

const editDevice = (device: any) => {
  isEditingDevice.value = true
  deviceForm.value = {
    id: device.id,
    name: device.name,
    type: device.type,
    pinNumber: String(device.pinNumber),
    mqttTopic: device.mqttTopic,
    isActive: device.isActive,
  }
}

const removeDevice = async (deviceId: string) => {
  if (!controllerId.value) return
  if (confirm('Are you sure you want to remove this device?')) {
    await store.deleteDevice(deviceId)
  }
}

const resetDeviceForm = () => {
  isEditingDevice.value = false
  deviceForm.value = {
    id: '',
    name: '',
    type: '',
    pinNumber: '',
    mqttTopic: '',
    isActive: true,
  }
}
</script>

<template>
  <div style="padding: 2rem; width: 100%; max-width: 1600px; margin: 0 auto">
    <!-- Top Level Dashboard Grid Layout -->
    <div
      :style="
        isEditMode
          ? 'display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem;'
          : 'max-width: 600px; margin: 0 auto;'
      "
    >
      <!-- LEFT COLUMN: Controller Configuration -->
      <div style="display: flex; flex-direction: column; gap: 2rem">
        <Card>
          <template #title>
            <div style="display: flex; align-items: center; gap: 0.5rem">
              <span>{{
                isEditMode ? '⚙️ Modify Controller Matrix' : '📟 Provision New Host Hub'
              }}</span>
            </div>
          </template>
          <template #content>
            <div style="display: flex; flex-direction: column; gap: 1.5rem">
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500"
                  >Display Label Name</label
                >
                <InputText
                  v-model="form.name"
                  placeholder="Tent 1 Raspberry Pi"
                  style="width: 100%"
                />
              </div>
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500"
                  >Hardware MAC Address</label
                >
                <InputText
                  v-model="form.macAddress"
                  placeholder="00:1A:2B:3C:4D:5E"
                  :disabled="isEditMode"
                  style="width: 100%"
                />
              </div>
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500"
                  >Static Network IP Target</label
                >
                <InputText
                  v-model="form.ipAddress"
                  placeholder="192.168.0.105"
                  style="width: 100%"
                />
              </div>

              <div style="display: flex; gap: 1rem; margin-top: 1rem; justify-content: flex-end">
                <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
                <Button
                  :label="isEditMode ? 'Save Changes' : 'Register Node'"
                  @click="handleSave"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Inline Add / Edit Form Block (Left Column under Master Config) -->
        <Card v-if="isEditMode">
          <template #title>
            <div style="font-size: 1.25rem">
              {{ isEditingDevice ? '✏️ Edit Device Link' : '🔌 Link New Peripheral Device' }}
            </div>
          </template>
          <template #content>
            <div style="display: flex; flex-direction: column; gap: 1.25rem">
              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem"
                  >Device Label Name</label
                >
                <InputText
                  v-model="deviceForm.name"
                  placeholder="DHT22 Temp Sensor"
                  style="width: 100%"
                />
              </div>

              <div style="display: flex; gap: 1rem">
                <div style="flex: 1">
                  <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem"
                    >Device Type</label
                  >
                  <Dropdown
                    v-model="deviceForm.type"
                    :options="deviceTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Select Type"
                    style="width: 100%"
                  />
                </div>
                <div style="flex: 1">
                  <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem"
                    >GPIO Pin Number</label
                  >
                  <InputText
                    v-model="deviceForm.pinNumber"
                    placeholder="4"
                    style="width: 100%"
                  />
                </div>
              </div>

              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem"
                  >MQTT Topic</label
                >
                <InputText
                  v-model="deviceForm.mqttTopic"
                  placeholder="tent1/device/light/cmd"
                  style="width: 100%"
                />
              </div>

              <div style="display: flex; align-items: center; gap: 0.5rem">
                <InputSwitch v-model="deviceForm.isActive" />
                <label style="font-size: 0.875rem">Active</label>
              </div>

              <div
                style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem"
              >
                <Button
                  v-if="isEditingDevice"
                  label="Cancel"
                  severity="secondary"
                  size="small"
                  @click="resetDeviceForm"
                />
                <Button
                  :label="isEditingDevice ? 'Update Link' : 'Attach Device'"
                  size="small"
                  :disabled="!deviceForm.name"
                  @click="handleSaveDevice"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- RIGHT COLUMN: Currently Linked Devices Matrix (Full Page Width Data Grid) -->
      <div v-if="isEditMode">
        <Card style="height: 100%">
          <template #title>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>📦 Active Connected Devices Matrix</span>
              <span style="font-size: 0.875rem; font-weight: normal; opacity: 0.7"
                >Total Bound: {{ devices.length }}</span
              >
            </div>
          </template>
          <template #content>
            <DataTable
              :value="devices"
              class="p-datatable-sm"
              responsiveLayout="scroll"
              :rows="10"
              paginator
              v-if="devices.length > 0"
            >
              <Column field="name" header="Device Name" sortable style="font-weight: 600"></Column>
              <Column field="type" header="Hardware Type" sortable>
                <template #body="slotProps">
                  <span
                    style="
                      text-transform: capitalize;
                      padding: 0.25rem 0.5rem;
                      background-color: rgba(255, 255, 255, 0.05);
                      border-radius: 4px;
                      border: 1px solid rgba(255, 255, 255, 0.1);
                    "
                  >
                    {{ slotProps.data.type.replace(/_/g, ' ') }}
                  </span>
                </template>
              </Column>
              <Column field="pinNumber" header="GPIO Pin" sortable></Column>
              <Column field="mqttTopic" header="MQTT Topic" sortable></Column>
              <Column field="isActive" header="Active" sortable>
                <template #body="slotProps">
                  {{ slotProps.data.isActive ? 'Yes' : 'No' }}
                </template>
              </Column>
              <Column header="Actions" style="width: 100px; text-align: center">
                <template #body="slotProps">
                  <div style="display: flex; gap: 0.25rem; justify-content: center">
                    <Button
                      icon="pi pi-pencil"
                      severity="warning"
                      text
                      rounded
                      size="small"
                      v-tooltip.top="'Edit Configuration'"
                      @click="editDevice(slotProps.data)"
                    />
                    <Button
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      size="small"
                      v-tooltip.top="'Sever Connection Link'"
                      @click="removeDevice(slotProps.data.id)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>

            <div
              v-else
              style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 4rem 2rem;
                border: 2px dashed rgba(255, 255, 255, 0.1);
                border-radius: 6px;
              "
            >
              <span
                class="pi pi-box"
                style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.4"
              ></span>
              <p style="margin: 0; font-style: italic; opacity: 0.6">
                No devices are pinned to this host node hub network matrix context yet.
              </p>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>
