<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import Tag from 'primevue/tag'

const store = useGrowStore()
const route = useRoute()
const router = useRouter()

const controllerId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => Boolean(controllerId.value))

const form = ref({ ipAddress: '', macAddress: '', name: '' })

const deviceTypeOptions = Object.values(DeviceType).map((t) => ({
  label: t.replaceAll(/_/g, ' '),
  value: t,
}))

const devices = computed(() => {
  if (!controllerId.value) {
    return []
  }
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
  isActive: true,
  mqttTopic: '',
  name: '',
  pinNumber: '',
  type: '',
})
const isEditingDevice = ref(false)

onMounted(async () => {
  await store.fetchAll()
  if (isEditMode.value && controllerId.value) {
    const existing = store.controllers.find((c) => c.id === controllerId.value)
    if (existing) {
      form.value = {
        ipAddress: existing.ipAddress,
        macAddress: existing.macAddress,
        name: existing.name,
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
  if (!controllerId.value) {
    return
  }

  const payload = {
    controllerId: controllerId.value,
    isActive: deviceForm.value.isActive,
    mqttTopic: deviceForm.value.mqttTopic,
    name: deviceForm.value.name,
    pinNumber: Number(deviceForm.value.pinNumber),
    type: deviceForm.value.type as DeviceType,
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
    isActive: device.isActive,
    mqttTopic: device.mqttTopic,
    name: device.name,
    pinNumber: String(device.pinNumber),
    type: device.type,
  }
}

const removeDevice = async (deviceId: string) => {
  if (!controllerId.value) {
    return
  }
  if (confirm('Are you sure you want to remove this device?')) {
    await store.deleteDevice(deviceId)
  }
}

const resetDeviceForm = () => {
  isEditingDevice.value = false
  deviceForm.value = {
    id: '',
    isActive: true,
    mqttTopic: '',
    name: '',
    pinNumber: '',
    type: '',
  }
}
</script>

<template>
  <div class="form-page">
    <div :class="['form-grid', { single: !isEditMode }]">
      <div class="form-column">
        <Card>
          <template #title>
            {{ isEditMode ? 'Controller' : 'New Controller' }}
          </template>
          <template #content>
            <div class="form-stack">
              <div class="field">
                <label for="ctrl-name" class="field-label">Name</label>
                <InputText
                  id="ctrl-name"
                  v-model="form.name"
                  placeholder="Tent 1 Raspberry Pi"
                  fluid
                />
              </div>
              <div class="field">
                <label for="ctrl-mac" class="field-label">MAC Address</label>
                <InputText
                  id="ctrl-mac"
                  v-model="form.macAddress"
                  placeholder="00:1A:2B:3C:4D:5E"
                  :disabled="isEditMode"
                  fluid
                />
              </div>
              <div class="field">
                <label for="ctrl-ip" class="field-label">IP Address</label>
                <InputText
                  id="ctrl-ip"
                  v-model="form.ipAddress"
                  placeholder="192.168.0.105"
                  fluid
                />
              </div>

              <div class="form-actions">
                <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
                <Button :label="isEditMode ? 'Save Changes' : 'Create'" @click="handleSave" />
              </div>
            </div>
          </template>
        </Card>

        <Card v-if="isEditMode">
          <template #title>
            {{ isEditingDevice ? 'Edit Device' : 'Add Device' }}
          </template>
          <template #content>
            <div class="form-stack">
              <div class="field">
                <label for="dev-name" class="field-label">Device Name</label>
                <InputText
                  id="dev-name"
                  v-model="deviceForm.name"
                  placeholder="DHT22 Temperature Sensor"
                  fluid
                />
              </div>

              <div class="field-row">
                <div class="field">
                  <label for="dev-type" class="field-label">Type</label>
                  <Dropdown
                    id="dev-type"
                    v-model="deviceForm.type"
                    :options="deviceTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Select type"
                    fluid
                  />
                </div>
                <div class="field">
                  <label for="dev-pin" class="field-label">GPIO Pin</label>
                  <InputText id="dev-pin" v-model="deviceForm.pinNumber" placeholder="4" fluid />
                </div>
              </div>

              <div class="field">
                <label for="dev-topic" class="field-label">MQTT Topic</label>
                <InputText
                  id="dev-topic"
                  v-model="deviceForm.mqttTopic"
                  placeholder="tent1/device/light/cmd"
                  fluid
                />
              </div>

              <div class="switch-row">
                <InputSwitch v-model="deviceForm.isActive" inputId="dev-active" />
                <label for="dev-active" class="field-label-inline">Active</label>
              </div>

              <div class="form-actions">
                <Button
                  v-if="isEditingDevice"
                  label="Cancel"
                  severity="secondary"
                  size="small"
                  @click="resetDeviceForm"
                />
                <Button
                  :label="isEditingDevice ? 'Update' : 'Add Device'"
                  size="small"
                  :disabled="!deviceForm.name"
                  @click="handleSaveDevice"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <div v-if="isEditMode" class="devices-column">
        <Card class="devices-card">
          <template #title>
            <div class="section-header">
              <span>Linked Devices</span>
              <span class="muted">{{ devices.length }} bound</span>
            </div>
          </template>
          <template #content>
            <DataTable
              v-if="devices.length > 0"
              :value="devices"
              size="small"
              paginator
              :rows="10"
              :rowsPerPageOptions="[10, 20, 50]"
            >
              <Column field="name" header="Name" sortable style="font-weight: 600"></Column>
              <Column field="type" header="Type" sortable>
                <template #body="slotProps">
                  <span class="type-pill">
                    {{ slotProps.data.type.replace(/_/g, ' ') }}
                  </span>
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
              <Column field="isActive" header="Active" sortable>
                <template #body="slotProps">
                  <Tag
                    :value="slotProps.data.isActive ? 'Active' : 'Inactive'"
                    :severity="slotProps.data.isActive ? 'success' : 'secondary'"
                    rounded
                  />
                </template>
              </Column>
              <Column header="Actions" style="width: 100px">
                <template #body="slotProps">
                  <div class="row-actions">
                    <Button
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      size="small"
                      aria-label="Edit"
                      v-tooltip.top="'Edit'"
                      @click="editDevice(slotProps.data)"
                    />
                    <Button
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      size="small"
                      aria-label="Delete"
                      v-tooltip.top="'Remove'"
                      @click="removeDevice(slotProps.data.id)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>

            <div v-else class="empty-state">
              <span class="pi pi-box empty-icon"></span>
              <p>No devices are linked to this controller yet.</p>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-page {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: var(--space-6);
}

.form-grid.single {
  display: block;
  max-width: 600px;
  margin: 0 auto;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.devices-card {
  height: 100%;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field-row {
  display: flex;
  gap: var(--space-4);
}

.field-row .field {
  flex: 1;
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

.field-label-inline {
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  font-weight: 500;
  cursor: pointer;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.form-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.muted {
  font-size: var(--text-base);
  color: var(--color-text-muted);
  font-weight: 500;
  font-family: var(--font-mono);
}

.row-actions {
  display: flex;
  gap: var(--space-1);
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

.meta-code {
  background: var(--color-code-bg);
  padding: 0.1875rem 0.4375rem;
  border-radius: var(--radius-sm);
  color: var(--color-code-text);
  font-size: var(--text-sm);
  border: 1px solid var(--color-border);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  text-align: center;
  background: var(--color-bg-elevated);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-md);
}
</style>
