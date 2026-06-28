<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '../../stores/apiStore'
import type { Device, GrowCycle, Sensor, SensorSeed } from '../../types/grow'
import { SensorProtocol, SensorType } from '../../types/grow'
import {
  SENSOR_PIN_OPTIONS,
  SENSOR_PROTOCOL_OPTIONS,
  SENSOR_TYPE_OPTIONS,
  defaultSensorForm,
  formatSensorProtocol,
  formatSensorType,
} from '../../utils/sensors'
import type { CreateControllerPayload } from '../../stores/controllerStore'
import { extractApiError } from '../../utils/errors'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import WiringDiagram from '../../components/WiringDiagram.vue'
import GpioPinoutDiagram from '../../components/GpioPinoutDiagram.vue'

const store = useApiStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const controllerId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => Boolean(controllerId.value))

const form = ref({ ipAddress: '', macAddress: '', name: '' })
const activeTab = ref<'details' | 'sensors' | 'devices'>('details')

const activeGrows = computed<GrowCycle[]>(() => {
  if (!controllerId.value) {
    return []
  }
  const controller = store.controllers.find((c) => c.id === controllerId.value) as
    | ((typeof store.controllers)[number] & { growCycles?: GrowCycle[] })
    | undefined
  return controller?.growCycles ?? []
})

const totalDevices = computed(() =>
  activeGrows.value.reduce((sum, g) => sum + (g.devices?.filter((d) => d.isActive).length ?? 0), 0),
)

const selectedGrowId = ref<string | null>(null)
const selectedGrow = computed<GrowCycle | null>(
  () => activeGrows.value.find((g) => g.id === selectedGrowId.value) ?? null,
)
const selectedDevices = computed<Device[]>(() => selectedGrow.value?.devices ?? [])
const showWiring = ref(false)

// ---------- Sensors (create + edit) ----------

type StagedSensor = SensorSeed & { localKey: string }

const stagedSensors = ref<StagedSensor[]>([])

const liveSensors = computed<Sensor[]>(
  () =>
    (
      store.controllers.find((c) => c.id === controllerId.value) as
        | ((typeof store.controllers)[number] & { sensors?: Sensor[] })
        | undefined
    )?.sensors ?? [],
)

const sensors = computed<(Sensor | StagedSensor)[]>(() => {
  if (isEditMode.value) {
    return liveSensors.value
  }
  return stagedSensors.value
})

const showSensorModal = ref(false)
const editingSensorKey = ref<string | null>(null)
const editingIsLive = ref(false)
const sensorForm = ref(defaultSensorForm())
const openPinoutPanels = ref<string[]>([])

const editingSensor = computed(() => {
  if (!editingSensorKey.value) {
    return null
  }
  return (
    sensors.value.find(
      (s) =>
        (s as Sensor).id === editingSensorKey.value ||
        (s as StagedSensor).localKey === editingSensorKey.value,
    ) ?? null
  )
})

const isEditSensor = computed(
  () => Boolean(editingSensorKey.value) && editingIsLive.value && isEditMode.value,
)

const canSaveSensor = computed(
  () => sensorForm.value.name.trim().length > 0 && sensorForm.value.pinNumbers.length > 0,
)

let sensorLocalKeySeq = 0
function genSensorLocalKey(): string {
  return `sensor-${++sensorLocalKeySeq}`
}

function openAddSensor() {
  sensorForm.value = defaultSensorForm()
  editingSensorKey.value = null
  editingIsLive.value = false
  openPinoutPanels.value = []
  showSensorModal.value = true
}

function openEditSensor(sensor: Sensor | StagedSensor) {
  sensorForm.value = {
    mqttTopic: sensor.mqttTopic,
    name: sensor.name,
    pinNumbers: [...sensor.pinNumbers],
    protocol: sensor.protocol,
    type: sensor.type,
  }
  if ('id' in sensor && sensor.id) {
    editingSensorKey.value = sensor.id
    editingIsLive.value = true
  } else {
    editingSensorKey.value = (sensor as StagedSensor).localKey
    editingIsLive.value = false
  }
  openPinoutPanels.value = []
  showSensorModal.value = true
}

function closeSensorModal() {
  showSensorModal.value = false
  editingSensorKey.value = null
  editingIsLive.value = false
}

async function saveSensor() {
  if (!canSaveSensor.value) {
    return
  }
  const payload: SensorSeed = {
    mqttTopic: sensorForm.value.mqttTopic,
    name: sensorForm.value.name.trim(),
    pinNumbers: [...sensorForm.value.pinNumbers].toSorted((a, b) => a - b),
    protocol: sensorForm.value.protocol,
    type: sensorForm.value.type,
  }

  if (isEditMode.value && controllerId.value) {
    const controllerIdValue = controllerId.value
    try {
      if (editingIsLive.value && editingSensorKey.value) {
        await store.updateSensor(editingSensorKey.value, controllerIdValue, payload)
        toast.add({
          detail: `Sensor "${payload.name}" updated.`,
          life: 3000,
          severity: 'success',
          summary: 'Sensor saved',
        })
      } else {
        await store.createSensor({ controllerId: controllerIdValue, ...payload })
        toast.add({
          detail: `Sensor "${payload.name}" added.`,
          life: 3000,
          severity: 'success',
          summary: 'Sensor added',
        })
      }
      closeSensorModal()
    } catch (error) {
      const { message } = extractApiError(error, 'Failed to save sensor')
      toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Save failed' })
    }
    return
  }

  // Create mode — stage locally
  if (editingSensorKey.value) {
    const idx = stagedSensors.value.findIndex((s) => s.localKey === editingSensorKey.value)
    if (idx !== -1) {
      stagedSensors.value[idx] = { ...payload, localKey: editingSensorKey.value }
    }
  } else {
    stagedSensors.value.push({ ...payload, localKey: genSensorLocalKey() })
  }
  closeSensorModal()
}

function confirmDeleteSensor(sensor: Sensor | StagedSensor) {
  const {name} = sensor
  if ('id' in sensor && sensor.id && isEditMode.value && controllerId.value) {
    const {id} = sensor
    const controllerIdValue = controllerId.value
    confirm.require({
      accept: async () => {
        try {
          await store.deleteSensor(id, controllerIdValue)
          toast.add({
            detail: `Sensor "${name}" removed.`,
            life: 3000,
            severity: 'success',
            summary: 'Sensor deleted',
          })
        } catch (error) {
          const { message } = extractApiError(error, 'Failed to delete sensor')
          toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Delete failed' })
        }
      },
      acceptLabel: 'Delete',
      acceptProps: { severity: 'danger' },
      header: 'Delete sensor',
      icon: 'pi pi-exclamation-triangle',
      message: `This will permanently remove "${name}" and cascade to its telemetry history. This cannot be undone.`,
      rejectLabel: 'Cancel',
    })
  } else {
    const {localKey} = (sensor as StagedSensor)
    confirm.require({
      accept: () => {
        stagedSensors.value = stagedSensors.value.filter((s) => s.localKey !== localKey)
      },
      acceptLabel: 'Remove',
      acceptProps: { severity: 'danger' },
      header: 'Remove staged sensor',
      icon: 'pi pi-exclamation-triangle',
      message: `Remove "${name}" from the staged sensors for this controller?`,
      rejectLabel: 'Cancel',
    })
  }
}

// ---------- Lifecycle ----------

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
    await store.fetchController(controllerId.value)
    if (activeGrows.value.length > 0) {
      selectedGrowId.value = activeGrows.value[0]?.id ?? null
    }
  }
})

async function handleSave() {
  if (isEditMode.value && controllerId.value) {
    await store.updateController(controllerId.value, form.value)
    router.push('/admin')
    return
  }

  const payload: CreateControllerPayload = {
    ipAddress: form.value.ipAddress,
    macAddress: form.value.macAddress,
    name: form.value.name,
  }
  if (stagedSensors.value.length > 0) {
    payload.sensors = stagedSensors.value.map((s) => ({
      mqttTopic: s.mqttTopic,
      name: s.name,
      pinNumbers: s.pinNumbers,
      protocol: s.protocol,
      type: s.type,
    }))
  }

  try {
    const created = await store.createController(payload)
    if (stagedSensors.value.length > 0 && !created.sensors?.length) {
      toast.add({
        detail:
          'A controller with this MAC address already exists, so the staged sensors were not applied. Open the controller in edit mode to manage its sensors.',
        life: 8000,
        severity: 'warn',
        summary: 'Sensors not seeded',
      })
    } else {
      router.push('/admin')
      return
    }
  } catch (error) {
    const { message } = extractApiError(error, 'Failed to create controller')
    toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Create failed' })
    return
  }
  router.push('/admin')
}
</script>

<template>
  <ConfirmDialog />
  <div class="form-page">
    <Card>
      <template #title>
        {{ isEditMode ? 'Controller' : 'New Controller' }}
      </template>
      <template #content>
        <Tabs v-model:value="activeTab" class="controller-tabs">
          <TabList>
            <Tab value="details">
              <i class="pi pi-info-circle" />
              <span>Details</span>
            </Tab>
            <Tab value="sensors">
              <i class="pi pi-bolt" />
              <span>Sensors</span>
            </Tab>
            <Tab v-if="isEditMode" value="devices">
              <i class="pi pi-cog" />
              <span>Linked Devices</span>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="details">
              <div class="form-stack">
                <div class="field">
                  <label for="ctrl-name" class="field-label">Name</label>
                  <InputText
                    id="ctrl-name"
                    v-model="form.name"
                    placeholder="Tent 1 Raspberry Pi"
                    class="full-width"
                  />
                </div>
                <div class="field">
                  <label for="ctrl-mac" class="field-label">MAC Address</label>
                  <InputText
                    id="ctrl-mac"
                    v-model="form.macAddress"
                    placeholder="00:1A:2B:3C:4D:5E"
                    :disabled="isEditMode"
                    class="full-width"
                  />
                </div>
                <div class="field">
                  <label for="ctrl-ip" class="field-label">IP Address</label>
                  <InputText
                    id="ctrl-ip"
                    v-model="form.ipAddress"
                    placeholder="192.168.0.105"
                    class="full-width"
                  />
                </div>
                <p v-if="!isEditMode" class="form-hint">
                  Staged sensors on the <strong>Sensors</strong> tab will be created atomically with
                  this controller. Re-registering an existing MAC will ignore the staged sensors.
                </p>
                <div class="form-actions">
                  <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
                  <Button :label="isEditMode ? 'Save Changes' : 'Create'" @click="handleSave" />
                </div>
              </div>
            </TabPanel>

            <TabPanel value="sensors">
              <div class="sensors-tab">
                <div class="section-header">
                  <div>
                    <h3 class="section-title">Sensors</h3>
                    <p class="section-subtitle">
                      <template v-if="isEditMode">
                        {{ sensors.length }} wired to this controller.
                      </template>
                      <template v-else>
                        {{ sensors.length }} staged for creation. New sensors are added live after
                        the controller is registered.
                      </template>
                    </p>
                  </div>
                  <Button
                    label="Add Sensor"
                    icon="pi pi-plus"
                    size="small"
                    severity="success"
                    @click="openAddSensor"
                  />
                </div>

                <DataTable v-if="sensors.length > 0" :value="sensors" size="small">
                  <Column field="name" header="Name" sortable style="font-weight: 600" />
                  <Column header="Type" sortable>
                    <template #body="slotProps">
                      <span class="type-pill">
                        {{ formatSensorType(slotProps.data.type) }}
                      </span>
                    </template>
                  </Column>
                  <Column header="Protocol" sortable>
                    <template #body="slotProps">
                      <span class="type-pill">
                        {{ formatSensorProtocol(slotProps.data.protocol) }}
                      </span>
                    </template>
                  </Column>
                  <Column header="GPIO Pins">
                    <template #body="slotProps">
                      <div class="pin-chips">
                        <code v-for="pin in slotProps.data.pinNumbers" :key="pin" class="meta-code">
                          {{ pin }}
                        </code>
                      </div>
                    </template>
                  </Column>
                  <Column header="MQTT Topic">
                    <template #body="slotProps">
                      <code v-if="slotProps.data.mqttTopic" class="meta-code">
                        {{ slotProps.data.mqttTopic }}
                      </code>
                      <span v-else class="muted">—</span>
                    </template>
                  </Column>
                  <Column v-if="isEditMode" header="Last Active">
                    <template #body="slotProps">
                      <span v-if="slotProps.data.lastActive" class="meta-code">
                        {{ slotProps.data.lastActive }}
                      </span>
                      <span v-else class="muted">—</span>
                    </template>
                  </Column>
                  <Column header="Actions" style="width: 120px">
                    <template #body="slotProps">
                      <div class="row-actions">
                        <Button
                          icon="pi pi-pencil"
                          severity="secondary"
                          text
                          rounded
                          size="small"
                          aria-label="Edit"
                          @click="openEditSensor(slotProps.data)"
                        />
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          aria-label="Delete"
                          @click="confirmDeleteSensor(slotProps.data)"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>

                <div v-else class="empty-state">
                  <span class="pi pi-bolt empty-icon" />
                  <p>
                    No sensors configured. Click <strong>Add Sensor</strong> to wire a new probe to
                    this controller.
                  </p>
                </div>
              </div>
            </TabPanel>

            <TabPanel v-if="isEditMode" value="devices">
              <div class="devices-tab">
                <div class="section-header">
                  <span class="muted">
                    {{ totalDevices }} active across {{ activeGrows.length }} grow{{
                      activeGrows.length === 1 ? '' : 's'
                    }}
                  </span>
                  <Button
                    v-if="selectedDevices.length > 0"
                    icon="pi pi-sitemap"
                    label="Wiring"
                    severity="secondary"
                    size="small"
                    text
                    rounded
                    v-tooltip.top="'View generated wiring diagram'"
                    @click="showWiring = true"
                  />
                </div>

                <div v-if="activeGrows.length > 1" class="field">
                  <label for="grow-selector" class="field-label">Grow cycle</label>
                  <select id="grow-selector" v-model="selectedGrowId" class="grow-select">
                    <option v-for="grow in activeGrows" :key="grow.id" :value="grow.id">
                      {{ grow.name }}
                    </option>
                  </select>
                </div>

                <DataTable v-if="selectedDevices.length > 0" :value="selectedDevices" size="small">
                  <Column field="name" header="Name" sortable style="font-weight: 600" />
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
                </DataTable>

                <div v-else-if="activeGrows.length > 0" class="empty-state">
                  <span class="pi pi-box empty-icon" />
                  <p>This grow cycle has no devices configured yet.</p>
                </div>
                <div v-else class="empty-state">
                  <span class="pi pi-box empty-icon" />
                  <p>
                    No active grow cycle is running on this controller. Devices are scoped to a grow
                    cycle, so start a grow to provision devices.
                  </p>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <Dialog
      v-model:visible="showSensorModal"
      :header="
        isEditSensor ? 'Edit Sensor' : editingSensorKey ? 'Edit Staged Sensor' : 'Add Sensor'
      "
      :style="{ width: '90vw', maxWidth: '640px' }"
      modal
      dismissable-mask
      class="sensor-modal"
    >
      <div class="form-stack">
        <div class="field">
          <label for="sensor-name" class="field-label">Name</label>
          <InputText
            id="sensor-name"
            v-model="sensorForm.name"
            placeholder="Tent 1 Climate Sensor"
            class="full-width"
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label for="sensor-type" class="field-label">Type</label>
            <Select
              id="sensor-type"
              v-model="sensorForm.type"
              :options="SENSOR_TYPE_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Select type"
              class="full-width"
            />
          </div>
          <div class="field">
            <label for="sensor-protocol" class="field-label">Protocol</label>
            <Select
              id="sensor-protocol"
              v-model="sensorForm.protocol"
              :options="SENSOR_PROTOCOL_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Select protocol"
              class="full-width"
            />
          </div>
        </div>

        <div class="field">
          <label for="sensor-mqtt" class="field-label">MQTT Topic</label>
          <InputText
            id="sensor-mqtt"
            v-model="sensorForm.mqttTopic"
            placeholder="tent1/sensors/climate/state"
            class="full-width"
          />
        </div>

        <div class="field">
          <label for="sensor-pins" class="field-label">GPIO Pins</label>
          <MultiSelect
            id="sensor-pins"
            v-model="sensorForm.pinNumbers"
            :options="SENSOR_PIN_OPTIONS"
            optionLabel="label"
            optionValue="value"
            placeholder="Select physical pins (1–40)"
            class="full-width"
            display="chip"
            :max-selected-labels="6"
          />
        </div>

        <Accordion v-model:value="openPinoutPanels" class="pinout-accordion">
          <AccordionPanel value="pinout">
            <AccordionHeader>
              <span class="pinout-accordion__title">
                <i class="pi pi-map pinout-accordion__icon" />
                GPIO Pinout Reference
              </span>
            </AccordionHeader>
            <AccordionContent>
              <p class="pinout-hint">
                Reference for choosing physical pins (1–40) on the Raspberry Pi header. Match the
                bus family to your sensor protocol (I²C, SPI, UART).
              </p>
              <GpioPinoutDiagram />
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="closeSensorModal" />
        <Button
          :label="isEditSensor ? 'Save Changes' : editingSensorKey ? 'Update Staged' : 'Add Sensor'"
          :disabled="!canSaveSensor"
          @click="saveSensor"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showWiring"
      :header="selectedGrow ? `Wiring — ${selectedGrow.name}` : 'Controller Wiring Diagram'"
      :style="{ width: '90vw', maxWidth: '1100px' }"
      modal
      dismissable-mask
    >
      <WiringDiagram :devices="selectedDevices" />
    </Dialog>
  </div>
</template>

<style scoped>
.form-page {
  width: 100%;
}

.controller-tabs :deep(.p-tablist) {
  margin-bottom: var(--space-5);
}

.controller-tabs :deep(.p-tab) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.field-label {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.full-width {
  width: 100%;
}

.form-hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin: 0;
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
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.section-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.section-subtitle {
  margin: 0.125rem 0 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.muted {
  font-size: var(--text-base);
  color: var(--color-text-muted);
  font-weight: 500;
  font-family: var(--font-mono);
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

.pin-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.row-actions {
  display: flex;
  gap: var(--space-1);
}

.grow-select {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-md);
  font-family: inherit;
  width: 100%;
}

.grow-select:focus {
  outline: none;
  border-color: var(--color-accent);
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

.pinout-accordion :deep(.p-accordionheader) {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.pinout-accordion__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.pinout-accordion__icon {
  color: var(--color-accent);
}

.pinout-hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-3) 0;
}
</style>
