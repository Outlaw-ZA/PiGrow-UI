<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '../../stores/apiStore'
import type { Device, DeviceConfig, DeviceSeed, GrowPhase } from '../../types/grow'
import { DeviceType, TriggerType } from '../../types/grow'
import {
  deriveActivePhaseIndex,
  deriveGrowActive,
  formatDate,
  parseDateOnly,
  recalculatePhaseDates,
} from '../../utils/growDates'
import {
  TRIGGER_TYPE_LABEL,
  TRIGGER_TYPE_OPTIONS,
  TRIGGER_TYPE_SEVERITY,
  buildConfigPayload,
  defaultConfigForm,
  formatConfigSummary,
  normalizeScheduleConfig,
  normalizeThresholdConfig,
} from '../../utils/deviceConfigs'
import type { ConfigFormState } from '../../utils/deviceConfigs'
import { extractApiError } from '../../utils/errors'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import InputSwitch from 'primevue/inputswitch'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import GpioPinoutDiagram from '../../components/GpioPinoutDiagram.vue'

const store = useApiStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const growId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => Boolean(growId.value))

const form = ref({ controllerId: '', name: '' })
const growStartDate = ref<Date>(new Date())
const phases = ref<GrowPhase[]>([])
const ready = ref(false)
const saving = ref(false)
const previousActivePhaseId = ref<string | null>(null)

const stagedDevices = ref<Device[]>([])

function recalculateDates() {
  recalculatePhaseDates(phases.value, growStartDate.value)
}

const controllerOptions = computed(() => store.controllers.filter((c) => c.id != null))

const totalCycleDays = computed(() => phases.value.reduce((sum, p) => sum + p.durationDays, 0))

const sortedPhases = computed(() => [...phases.value].toSorted((a, b) => a.order - b.order))

const selectedPhaseKey = ref<string | null>(null)
const deviceConfigForms = ref<Record<string, ConfigFormState>>({})
const onTimeDate = ref<Record<string, Date | null>>({})

const growDevices = computed<Device[]>(() => {
  if (isEditMode.value && growId.value) {
    const cycle = store.growCycles.find((g) => g.id === growId.value) as
      | ((typeof store.growCycles)[number] & { devices?: Device[] })
      | undefined
    return cycle?.devices ?? []
  }
  return stagedDevices.value
})

const selectedPhase = computed<GrowPhase | undefined>(() =>
  phases.value.find((p) => p.localKey != null && p.localKey === selectedPhaseKey.value),
)
const selectablePhases = computed(() =>
  sortedPhases.value
    .filter((p) => p.localKey != null)
    .map((p) => ({ key: p.localKey as string, name: p.name })),
)

const configRows = computed(() => {
  const configs = selectedPhase.value?.deviceConfigs ?? []
  return growDevices.value
    .map((device) => {
      const key = deviceKey(device)
      const formState = deviceConfigForms.value[key]
      const config = configs.find((c) => c.deviceId === deviceKey(device))
      return { config, device, formState, key }
    })
    .filter(
      (
        row,
      ): row is {
        device: Device
        formState: ConfigFormState
        config: DeviceConfig | undefined
        key: string
      } => row.formState != null && row.key != null,
    )
})

function deviceKey(device: Device): string {
  return device.id || device.localKey || ''
}

function getForm(key: string): ConfigFormState {
  const formState = deviceConfigForms.value[key]
  if (!formState) {
    deviceConfigForms.value[key] = defaultConfigForm()
    return deviceConfigForms.value[key]!
  }
  return formState
}

function initDeviceConfigFormsForPhase(phase: GrowPhase | undefined) {
  const next: Record<string, ConfigFormState> = {}
  const nextTimes: Record<string, Date | null> = {}
  const existing = phase?.deviceConfigs ?? []
  for (const device of growDevices.value) {
    const key = deviceKey(device)
    if (!key) {
      continue
    }
    const current = existing.find((c) => c.deviceId === deviceKey(device))
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
        nextTimes[key] = parseTimeOfDay(sched.onTime)
      } else if (triggerType === TriggerType.THRESHOLD) {
        const thresh = normalizeThresholdConfig(current.configData)
        form.metric = thresh.metric
        form.high = thresh.high
      }
      next[key] = form
    } else {
      const blank = defaultConfigForm()
      next[key] = blank
      nextTimes[key] = parseTimeOfDay(blank.onTime)
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

let localKeySeq = 0
function genLocalKey(prefix: string): string {
  return `${prefix}-${++localKeySeq}`
}

watch(selectedPhaseKey, () => {
  initDeviceConfigFormsForPhase(selectedPhase.value)
})

watch(
  () => growDevices.value.map((d) => deviceKey(d)).join('|'),
  () => {
    if (selectedPhaseKey.value) {
      initDeviceConfigFormsForPhase(selectedPhase.value)
    }
  },
)

function getDefaultPhases(): GrowPhase[] {
  return [
    {
      durationDays: 7,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Germination',
      order: 1,
      startAt: null,
    },
    {
      durationDays: 14,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Seedling',
      order: 2,
      startAt: null,
    },
    {
      durationDays: 28,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Vegetative',
      order: 3,
      startAt: null,
    },
    {
      durationDays: 56,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Flowering',
      order: 4,
      startAt: null,
    },
    {
      durationDays: 14,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Flush',
      order: 5,
      startAt: null,
    },
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
  phases.value = (cycle.phases ?? []).map((p) => ({
    ...p,
    localKey: p.localKey ?? genLocalKey('phase'),
  }))
  recalculateDates()
  const previouslyActive = phases.value.find((p) => p.isActive && p.id)
  previousActivePhaseId.value = previouslyActive?.id ?? null
  const firstPhase = phases.value[0]
  selectedPhaseKey.value = firstPhase?.localKey ?? null
}

function isPhaseActive(phase: GrowPhase): boolean {
  const activeIdx = deriveActivePhaseIndex(sortedPhases.value)
  if (activeIdx < 0) {
    return false
  }
  return sortedPhases.value[activeIdx] === phase
}

const activeTab = ref<'details' | 'phases' | 'devices'>('details')

const deviceConfigHint = computed(() =>
  isEditMode.value
    ? 'Edits save immediately per device.'
    : 'Device configs are saved when you commit the grow.',
)

const showPhaseModal = ref(false)
const editingPhaseIndex = ref<number | null>(null)
const phaseDraft = ref<GrowPhase>({
  durationDays: 7,
  endAt: null,
  isActive: false,
  name: '',
  order: 0,
  startAt: null,
})

const phaseDraftDateRange = computed<{ start: string; end: string }>(() => {
  if (!phaseDraft.value.durationDays) {
    return { end: '—', start: '—' }
  }
  const idx = editingPhaseIndex.value ?? phases.value.length
  const cursor = new Date(growStartDate.value)
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < idx; i++) {
    const p = phases.value[i]
    if (p) {
      cursor.setDate(cursor.getDate() + p.durationDays)
    }
  }
  const start = new Date(cursor)
  const end = new Date(cursor)
  end.setDate(end.getDate() + phaseDraft.value.durationDays)
  return { end: formatDate(end), start: formatDate(start) }
})

function openAddPhase() {
  editingPhaseIndex.value = null
  phaseDraft.value = {
    durationDays: 7,
    endAt: null,
    isActive: false,
    localKey: genLocalKey('phase'),
    name: '',
    order: sortedPhases.value.length + 1,
    startAt: null,
  }
  showPhaseModal.value = true
}

function openEditPhase(idx: number) {
  const phase = phases.value[idx]
  if (!phase) {
    return
  }
  editingPhaseIndex.value = idx
  phaseDraft.value = { ...phase }
  showPhaseModal.value = true
}

function closePhaseModal() {
  showPhaseModal.value = false
  editingPhaseIndex.value = null
}

function savePhaseDraft() {
  if (editingPhaseIndex.value === null) {
    phases.value.push({ ...phaseDraft.value })
  } else {
    const target = phases.value[editingPhaseIndex.value]
    if (target) {
      Object.assign(target, phaseDraft.value)
    }
  }
  phases.value.forEach((p, i) => (p.order = i + 1))
  recalculateDates()
  closePhaseModal()
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

function goToDevicesForPhaseFromRow(phase: GrowPhase) {
  if (phase.localKey) {
    selectedPhaseKey.value = phase.localKey
    activeTab.value = 'devices'
  }
}

const showConfigModal = ref(false)
const editingDeviceKey = ref<string | null>(null)
const modalForm = ref<ConfigFormState>(defaultConfigForm())
const modalOnTime = ref<Date | null>(null)

const configModalDevice = computed<Device | null>(() => {
  if (!editingDeviceKey.value) {
    return null
  }
  return growDevices.value.find((d) => deviceKey(d) === editingDeviceKey.value) ?? null
})

const configModalTitle = computed(() => {
  const dev = configModalDevice.value
  return dev ? `Configure ${dev.name}` : 'Configure device'
})

const configModalSubtitle = computed(() => {
  const dev = configModalDevice.value
  if (!dev || !selectedPhase.value) {
    return ''
  }
  return `${selectedPhase.value.name} · ${dev.type.replaceAll('_', ' ')}`
})

const editingDeviceHasConfig = computed(() => {
  const key = editingDeviceKey.value
  if (!key) {
    return false
  }
  const dev = growDevices.value.find((d) => deviceKey(d) === key)
  if (!dev) {
    return false
  }
  const ref = deviceKey(dev)
  return Boolean(selectedPhase.value?.deviceConfigs?.some((c) => c.deviceId === ref))
})

function getTriggerLabel(config: DeviceConfig): string {
  return TRIGGER_TYPE_LABEL[config.triggerType]
}

function getTriggerSeverity(config: DeviceConfig): 'info' | 'warn' | 'success' | 'secondary' {
  return TRIGGER_TYPE_SEVERITY[config.triggerType]
}

function openConfigModal(key: string) {
  const existing = getForm(key)
  modalForm.value = { ...existing }
  modalOnTime.value = onTimeDate.value[key] ?? parseTimeOfDay(existing.onTime)
  editingDeviceKey.value = key
  showConfigModal.value = true
}

function closeConfigModal() {
  showConfigModal.value = false
  editingDeviceKey.value = null
}

async function saveConfigFromModal() {
  const key = editingDeviceKey.value
  if (!key) {
    return
  }
  if (modalOnTime.value) {
    modalForm.value.onTime = formatTimeOfDay(modalOnTime.value)
  }
  const real = deviceConfigForms.value[key]
  if (real) {
    Object.assign(real, modalForm.value)
  }
  onTimeDate.value[key] = modalOnTime.value
  await saveDeviceConfig(key)
  closeConfigModal()
}

async function deleteConfigFromModal() {
  const key = editingDeviceKey.value
  if (!key) {
    return
  }
  await removeDeviceConfig(key)
  closeConfigModal()
}

const showDeviceModal = ref(false)
const deviceForm = ref({ isActive: true, mqttTopic: '', name: '', pinNumber: '', type: '' })
const openPinoutPanels = ref<string[]>([])

const deviceTypeOptions = Object.values(DeviceType).map((t) => ({
  label: t.replaceAll('_', ' '),
  value: t,
}))

function openAddDevice() {
  deviceForm.value = { isActive: true, mqttTopic: '', name: '', pinNumber: '', type: '' }
  openPinoutPanels.value = []
  showDeviceModal.value = true
}

function closeDeviceModal() {
  showDeviceModal.value = false
}

async function saveDevice() {
  const { controllerId } = form.value
  if (!controllerId) {
    return
  }
  const seed: DeviceSeed = {
    isActive: deviceForm.value.isActive,
    mqttTopic: deviceForm.value.mqttTopic,
    name: deviceForm.value.name,
    pinNumber: Number(deviceForm.value.pinNumber),
    type: deviceForm.value.type as DeviceType,
  }
  try {
    if (isEditMode.value && growId.value) {
      await store.createDevice({ growCycleId: growId.value, ...seed })
      await store.fetchDevices(growId.value)
    } else {
      stagedDevices.value.push({
        ...seed,
        controllerId: '',
        createdAt: '',
        growCycleId: '',
        id: '',
        isActive: seed.isActive ?? true,
        localKey: genLocalKey('device'),
        mqttTopic: seed.mqttTopic,
        name: seed.name,
        pinNumber: seed.pinNumber,
        type: seed.type,
        updatedAt: '',
      } as Device)
    }
    closeDeviceModal()
  } catch (error) {
    console.error('Failed to create device', error)
  }
}

function removeStagedDevice(localKey: string) {
  stagedDevices.value = stagedDevices.value.filter((d) => d.localKey !== localKey)
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

async function saveDeviceConfig(key: string) {
  const phase = selectedPhase.value
  if (!phase) {
    return
  }
  const formState = deviceConfigForms.value[key]
  if (!formState) {
    return
  }
  const device = growDevices.value.find((d) => deviceKey(d) === key)
  if (!device) {
    return
  }
  const payload = buildConfigPayload(formState)
  if (phase.id && device.id) {
    try {
      let result: DeviceConfig
      if (formState.id) {
        result = await store.updateDeviceConfig(formState.id, payload)
      } else {
        result = await store.createDeviceConfig({
          configData: payload.configData,
          deviceId: device.id,
          growPhaseId: phase.id,
          triggerType: payload.triggerType,
        })
      }
      formState.id = result.id
      formState.dirty = false
      upsertConfigInPhase(phase, device.id, result)
    } catch (error) {
      console.error('Failed to save device config', error)
    }
  } else {
    const ref = deviceKey(device) || key
    const staged: DeviceConfig = {
      configData: payload.configData,
      deviceId: ref,
      triggerType: payload.triggerType,
    }
    formState.dirty = false
    upsertConfigInPhase(phase, ref, staged)
  }
}

function upsertConfigInPhase(phase: GrowPhase, deviceRef: string, config: DeviceConfig) {
  if (!phase.deviceConfigs) {
    phase.deviceConfigs = []
  }
  const idx = phase.deviceConfigs.findIndex((c) => c.deviceId === deviceRef)
  if (idx !== -1) {
    phase.deviceConfigs[idx] = config
  } else {
    phase.deviceConfigs.push(config)
  }
}

async function removeDeviceConfig(key: string) {
  const phase = selectedPhase.value
  if (!phase) {
    return
  }
  const formState = deviceConfigForms.value[key]
  const device = growDevices.value.find((d) => deviceKey(d) === key)
  if (!device) {
    return
  }
  const ref = deviceKey(device) || key
  const configs = phase.deviceConfigs ?? []
  const config = configs.find((c) => c.deviceId === ref)
  if (!config) {
    return
  }
  if (config.id) {
    try {
      await store.deleteDeviceConfig(config.id)
    } catch (error) {
      console.error('Failed to delete device config', error)
      return
    }
  }
  phase.deviceConfigs = configs.filter((c) => c.deviceId !== ref)
  if (formState) {
    deviceConfigForms.value[key] = defaultConfigForm()
  }
}

async function persistStagedDeviceConfigs(
  cycleId: string,
  deviceIdByLocalKey: Map<string, string>,
) {
  for (const phase of phases.value) {
    if (!phase.id || !phase.deviceConfigs) {
      continue
    }
    for (const cfg of phase.deviceConfigs) {
      if (cfg.id) {
        continue
      }
      const realId = deviceIdByLocalKey.get(cfg.deviceId) ?? cfg.deviceId
      try {
        await store.createDeviceConfig({
          configData: cfg.configData,
          deviceId: realId,
          growPhaseId: phase.id,
          triggerType: cfg.triggerType,
        })
      } catch (error) {
        console.error('Failed to persist staged device config', error)
      }
    }
  }
}

function remapStagedDeviceRefs(deviceIdByLocalKey: Map<string, string>) {
  for (const phase of phases.value) {
    if (!phase.deviceConfigs) {
      continue
    }
    for (const cfg of phase.deviceConfigs) {
      const real = deviceIdByLocalKey.get(cfg.deviceId)
      if (real) {
        cfg.deviceId = real
      }
    }
  }
  for (const device of stagedDevices.value) {
    if (device.localKey) {
      const real = deviceIdByLocalKey.get(device.localKey)
      if (real) {
        device.id = real
      }
    }
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
      try {
        await store.updateGrowCycle(growId.value, {
          isActive: growActive,
          name: form.value.name,
          startAt: startAtDate,
        })
      } catch (error) {
        const { message, status } = extractApiError(error, 'Failed to update grow cycle')
        if (status === 409) {
          toast.add({
            detail:
              'End the currently running grow on this controller before activating another one.',
            life: 8000,
            severity: 'error',
            summary: 'Controller busy',
          })
        } else {
          toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Update failed' })
        }
        return
      }
      for (const phase of phases.value) {
        await savePhase(phase)
      }
      await persistStagedDeviceConfigs(growId.value, new Map())
      await reconcileActivePhase()
      router.push('/admin')
    } else {
      const devicesSeed: DeviceSeed[] = stagedDevices.value.map((d) => ({
        isActive: d.isActive,
        mqttTopic: d.mqttTopic,
        name: d.name,
        pinNumber: d.pinNumber,
        type: d.type,
      }))

      let created
      try {
        created = await store.createGrowCycle({
          controllerId: form.value.controllerId,
          devices: devicesSeed,
          name: form.value.name,
          startAt: startAtDate,
        })
      } catch (error) {
        const { message, status } = extractApiError(error, 'Failed to create grow cycle')
        if (status === 409) {
          toast.add({
            detail: 'End the currently running grow on this controller before starting a new one.',
            life: 8000,
            severity: 'error',
            summary: 'Controller busy',
          })
        } else {
          toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Create failed' })
        }
        return
      }

      const deviceIdByLocalKey = new Map<string, string>()
      const createdDevices = created.devices ?? []
      for (let i = 0; i < stagedDevices.value.length; i++) {
        const staged = stagedDevices.value[i]
        const createdDevice = createdDevices[i]
        if (staged?.localKey && createdDevice?.id) {
          deviceIdByLocalKey.set(staged.localKey, createdDevice.id)
        }
      }
      remapStagedDeviceRefs(deviceIdByLocalKey)

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
      try {
        await store.updateGrowCycle(created.id, { isActive: growActive })
      } catch (error) {
        const { message, status } = extractApiError(error, 'Failed to activate grow cycle')
        if (status === 409) {
          toast.add({
            detail:
              'End the currently running grow on this controller before activating another one.',
            life: 8000,
            severity: 'error',
            summary: 'Controller busy',
          })
        } else {
          toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Update failed' })
        }
        return
      }
      await persistStagedDeviceConfigs(created.id, deviceIdByLocalKey)
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
        <Tabs v-model:value="activeTab" class="grow-tabs">
          <TabList>
            <Tab value="details">
              <i class="pi pi-info-circle" />
              <span>Details</span>
            </Tab>
            <Tab value="phases">
              <i class="pi pi-list" />
              <span>Phases</span>
            </Tab>
            <Tab value="devices">
              <i class="pi pi-cog" />
              <span>Devices</span>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="details">
              <div class="details-grid">
                <div class="field">
                  <label for="grow-controller" class="field-label">Assigned Controller</label>
                  <Select
                    id="grow-controller"
                    v-model="form.controllerId"
                    :options="controllerOptions"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Select controller"
                    class="full-width"
                    show-clear
                    :disabled="isEditMode"
                  />
                </div>
                <div class="field">
                  <label for="grow-name" class="field-label">Grow Name</label>
                  <InputText
                    id="grow-name"
                    v-model="form.name"
                    placeholder="Run #5 - White Widow"
                    class="full-width"
                  />
                </div>
                <div class="field">
                  <label for="grow-start-date" class="field-label">Start Date</label>
                  <DatePicker
                    id="grow-start-date"
                    v-model="growStartDate"
                    dateFormat="yy-mm-dd"
                    showIcon
                    class="full-width"
                  />
                </div>
              </div>
              <p v-if="isEditMode" class="form-hint">
                Controller assignment is locked for the lifetime of a grow. To move this run to a
                different Pi, end it and create a new one.
              </p>
            </TabPanel>

            <TabPanel value="phases">
              <div class="tab-section">
                <div class="section-toolbar">
                  <h3 class="section-title">Grow Phases</h3>
                  <Button
                    label="Add Phase"
                    icon="pi pi-plus"
                    size="small"
                    severity="success"
                    @click="openAddPhase"
                  />
                </div>

                <DataTable v-if="phases.length > 0" :value="sortedPhases" size="small">
                  <Column header="#" style="width: 60px">
                    <template #body="slotProps">
                      <span class="phase-order-badge">{{ slotProps.data.order }}</span>
                    </template>
                  </Column>
                  <Column field="name" header="Name" sortable style="font-weight: 600" />
                  <Column header="Duration" sortable>
                    <template #body="slotProps"> {{ slotProps.data.durationDays }} days </template>
                  </Column>
                  <Column header="Schedule" sortable>
                    <template #body="slotProps">
                      <code v-if="slotProps.data.startAt && slotProps.data.endAt" class="meta-code">
                        {{ slotProps.data.startAt }} → {{ slotProps.data.endAt }}
                      </code>
                      <span v-else class="muted">—</span>
                    </template>
                  </Column>
                  <Column header="Status" sortable>
                    <template #body="slotProps">
                      <Tag
                        :value="isPhaseActive(slotProps.data) ? 'Active' : 'Scheduled'"
                        :severity="isPhaseActive(slotProps.data) ? 'success' : 'secondary'"
                        rounded
                      />
                    </template>
                  </Column>
                  <Column header="Actions" style="width: 180px">
                    <template #body="slotProps">
                      <div class="row-actions">
                        <Button
                          icon="pi pi-pencil"
                          severity="secondary"
                          text
                          rounded
                          size="small"
                          aria-label="Edit phase"
                          v-tooltip.top="'Edit phase'"
                          @click.stop="openEditPhase(phases.indexOf(slotProps.data))"
                        />
                        <Button
                          v-if="slotProps.data.localKey"
                          icon="pi pi-cog"
                          severity="info"
                          text
                          rounded
                          size="small"
                          aria-label="Configure devices"
                          v-tooltip.top="'Configure devices for this phase'"
                          @click.stop="goToDevicesForPhaseFromRow(slotProps.data)"
                        />
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          aria-label="Delete phase"
                          v-tooltip.top="'Delete phase'"
                          @click.stop="removePhase(phases.indexOf(slotProps.data))"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>

                <div v-else class="empty-state">
                  <span class="pi pi-list empty-icon" />
                  <p>No phases defined yet. Add a phase to begin planning the grow cycle.</p>
                </div>

                <div v-if="phases.length > 0" class="total-summary">
                  <span class="total-label">Total Cycle Duration</span>
                  <span class="total-value">{{ totalCycleDays }} days</span>
                </div>
              </div>
            </TabPanel>

            <TabPanel value="devices">
              <div class="tab-section">
                <div class="section-toolbar">
                  <h3 class="section-title">Device Configuration</h3>
                  <div class="toolbar-actions">
                    <span class="section-hint">{{ deviceConfigHint }}</span>
                    <Button
                      v-if="form.controllerId"
                      label="Add Device"
                      icon="pi pi-plus"
                      size="small"
                      severity="success"
                      @click="openAddDevice"
                    />
                  </div>
                </div>

                <div v-if="!isEditMode" class="staged-list">
                  <h4 class="staged-title">Staged devices ({{ stagedDevices.length }})</h4>
                  <DataTable v-if="stagedDevices.length > 0" :value="stagedDevices" size="small">
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
                    <Column header="Actions" style="width: 80px">
                      <template #body="slotProps">
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          aria-label="Remove staged device"
                          v-tooltip.top="'Remove'"
                          @click="removeStagedDevice(slotProps.data.localKey!)"
                        />
                      </template>
                    </Column>
                  </DataTable>
                </div>

                <div class="field">
                  <label for="config-phase" class="field-label">
                    Configure devices for phase
                  </label>
                  <Select
                    id="config-phase"
                    v-model="selectedPhaseKey"
                    :options="selectablePhases"
                    optionLabel="name"
                    optionValue="key"
                    placeholder="Select a phase"
                    class="full-width"
                  />
                </div>

                <DataTable
                  v-if="selectedPhase && growDevices.length > 0"
                  :value="configRows"
                  size="small"
                >
                  <Column header="Device" sortable>
                    <template #body="slotProps">
                      <div class="config-device-info">
                        <span class="config-device-name">{{ slotProps.data.device.name }}</span>
                        <span class="type-pill">
                          {{ slotProps.data.device.type.replace(/_/g, ' ') }}
                        </span>
                      </div>
                    </template>
                  </Column>
                  <Column header="Trigger" sortable>
                    <template #body="slotProps">
                      <Tag
                        v-if="slotProps.data.config"
                        :value="getTriggerLabel(slotProps.data.config)"
                        :severity="getTriggerSeverity(slotProps.data.config)"
                        rounded
                      />
                      <span v-else class="muted">Unconfigured</span>
                    </template>
                  </Column>
                  <Column header="Configuration" sortable>
                    <template #body="slotProps">
                      <code v-if="slotProps.data.config" class="config-summary">
                        {{
                          formatConfigSummary(
                            slotProps.data.config.triggerType,
                            slotProps.data.config.configData,
                          )
                        }}
                      </code>
                      <span v-else class="muted">—</span>
                    </template>
                  </Column>
                  <Column header="Actions" style="width: 130px">
                    <template #body="slotProps">
                      <div class="row-actions">
                        <Button
                          icon="pi pi-pencil"
                          severity="secondary"
                          text
                          rounded
                          size="small"
                          aria-label="Configure device"
                          v-tooltip.top="'Configure'"
                          @click.stop="openConfigModal(slotProps.data.key)"
                        />
                        <Button
                          v-if="slotProps.data.config"
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          aria-label="Delete configuration"
                          v-tooltip.top="'Delete configuration'"
                          @click.stop="removeDeviceConfig(slotProps.data.key)"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>

                <div v-else-if="!form.controllerId" class="empty-state">
                  <span class="pi pi-arrow-up empty-icon" />
                  <p>Select a controller in the Details tab first.</p>
                </div>
                <div v-else-if="!selectedPhase" class="empty-state">
                  <span class="pi pi-arrow-up empty-icon" />
                  <p>Select a phase above to configure its devices.</p>
                </div>
                <div v-else class="empty-state">
                  <span class="pi pi-box empty-icon" />
                  <p>
                    {{
                      isEditMode
                        ? 'This grow cycle has no devices yet. Add one to configure triggers.'
                        : 'No devices staged yet. Use Add Device to provision hardware for this grow.'
                    }}
                  </p>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>

        <div class="form-actions">
          <Button
            :label="isEditMode ? 'Commit Changes' : 'Initialize Batch'"
            severity="success"
            :loading="saving"
            @click="handleSave"
          />
          <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="showPhaseModal"
      :header="editingPhaseIndex === null ? 'Add Phase' : 'Edit Phase'"
      :style="{ width: '90vw', maxWidth: '480px' }"
      modal
      dismissable-mask
      class="phase-modal"
    >
      <div class="form-stack">
        <div class="field">
          <label for="phase-name-modal" class="field-label">Phase Name</label>
          <InputText
            id="phase-name-modal"
            v-model="phaseDraft.name"
            placeholder="e.g. Vegetative"
            class="full-width"
            autofocus
          />
        </div>
        <div class="field">
          <label for="phase-duration-modal" class="field-label">Duration (days)</label>
          <InputNumber inputId="phase-duration-modal" v-model="phaseDraft.durationDays" :min="1" />
        </div>
        <div v-if="phaseDraft.durationDays" class="date-range date-range--modal">
          <span>
            <strong>Runs:</strong>
            {{ phaseDraftDateRange.start }} → {{ phaseDraftDateRange.end }}
          </span>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" size="small" @click="closePhaseModal" />
        <Button
          :label="editingPhaseIndex === null ? 'Add Phase' : 'Save'"
          severity="success"
          size="small"
          :disabled="!phaseDraft.name || !phaseDraft.durationDays"
          @click="savePhaseDraft"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showConfigModal"
      :style="{ width: '90vw', maxWidth: '560px' }"
      modal
      dismissable-mask
      class="config-modal"
    >
      <template #header>
        <div class="config-modal-header">
          <span class="config-modal-title">{{ configModalTitle }}</span>
          <span v-if="configModalSubtitle" class="config-modal-subtitle">
            {{ configModalSubtitle }}
          </span>
        </div>
      </template>
      <div v-if="modalForm" class="form-stack">
        <div class="field">
          <label for="trigger-modal" class="field-label">Trigger Type</label>
          <Select
            inputId="trigger-modal"
            v-model="modalForm.triggerType"
            :options="TRIGGER_TYPE_OPTIONS"
            optionLabel="label"
            optionValue="value"
            class="full-width"
          />
        </div>

        <template v-if="modalForm.triggerType === TriggerType.SCHEDULE">
          <div class="field">
            <label for="onTime-modal" class="field-label">On Time</label>
            <DatePicker
              inputId="onTime-modal"
              v-model="modalOnTime"
              timeOnly
              hourFormat="24"
              class="full-width"
            />
          </div>
          <div class="field">
            <label for="dur-modal" class="field-label">Duration (hours)</label>
            <InputNumber
              inputId="dur-modal"
              v-model="modalForm.durationHours"
              :min="0.1"
              :max="24"
              :minFractionDigits="1"
              :maxFractionDigits="1"
            />
          </div>
        </template>

        <template v-else-if="modalForm.triggerType === TriggerType.THRESHOLD">
          <div class="field">
            <label for="metric-modal" class="field-label">Metric</label>
            <InputText
              inputId="metric-modal"
              v-model="modalForm.metric"
              placeholder="TEMP, HUMIDITY, CO2..."
              class="full-width"
            />
          </div>
          <div class="field">
            <label for="high-modal" class="field-label">High Threshold</label>
            <InputNumber
              inputId="high-modal"
              v-model="modalForm.high"
              :minFractionDigits="1"
              :maxFractionDigits="2"
            />
          </div>
        </template>

        <div v-else class="config-note">No additional parameters for this trigger type.</div>
      </div>
      <template #footer>
        <Button
          v-if="editingDeviceHasConfig"
          label="Delete"
          icon="pi pi-trash"
          severity="danger"
          text
          size="small"
          @click="deleteConfigFromModal"
        />
        <Button label="Cancel" severity="secondary" size="small" @click="closeConfigModal" />
        <Button
          label="Save"
          icon="pi pi-save"
          severity="success"
          size="small"
          @click="saveConfigFromModal"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showDeviceModal"
      header="Add Device"
      :style="{ width: '90vw', maxWidth: '520px' }"
      modal
      dismissable-mask
      class="device-modal"
    >
      <div class="form-stack">
        <div class="field">
          <label for="dev-name" class="field-label">Device Name</label>
          <InputText
            id="dev-name"
            v-model="deviceForm.name"
            placeholder="DHT22 Temperature Sensor"
            class="full-width"
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label for="dev-type" class="field-label">Type</label>
            <Select
              id="dev-type"
              v-model="deviceForm.type"
              :options="deviceTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select type"
              class="full-width"
            />
          </div>
          <div class="field">
            <label for="dev-pin" class="field-label">GPIO Pin</label>
            <InputText
              id="dev-pin"
              v-model="deviceForm.pinNumber"
              placeholder="4"
              class="full-width"
            />
          </div>
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
                Use the BCM GPIO number above (not the physical pin position). For example, enter
                <code>4</code> for the standard GCLK pin on physical pin 7.
              </p>
              <GpioPinoutDiagram />
              <ul class="pinout-legend">
                <li class="legend-group">
                  <span class="legend-group__title">Pin types</span>
                  <span class="legend-group__items">
                    <span class="legend-item"><span class="swatch swatch--gpio" /> BCM GPIO</span>
                    <span class="legend-item"><span class="swatch swatch--3v3" /> 3.3 V</span>
                    <span class="legend-item"><span class="swatch swatch--5v" /> 5 V</span>
                    <span class="legend-item"><span class="swatch swatch--gnd" /> Ground</span>
                    <span class="legend-item"
                      ><span class="swatch swatch--id" /> Reserved (ID EEPROM)</span
                    >
                  </span>
                </li>
                <li class="legend-group">
                  <span class="legend-group__title">Bus functions</span>
                  <span class="legend-group__items">
                    <span class="legend-item"
                      ><span class="swatch swatch--i2c" /> I²C · SDA/SCL</span
                    >
                    <span class="legend-item"
                      ><span class="swatch swatch--spi" /> SPI · CE/MOSI/MISO/SCLK</span
                    >
                    <span class="legend-item"
                      ><span class="swatch swatch--uart" /> UART · TXD/RXD</span
                    >
                    <span class="legend-item"
                      ><span class="swatch swatch--pwm" /> PWM · PWM0/PWM1</span
                    >
                  </span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>

        <div class="field">
          <label for="dev-topic" class="field-label">MQTT Topic</label>
          <InputText
            id="dev-topic"
            v-model="deviceForm.mqttTopic"
            placeholder="tent1/device/light/cmd"
            class="full-width"
          />
        </div>

        <div class="switch-row">
          <InputSwitch v-model="deviceForm.isActive" inputId="dev-active" />
          <label for="dev-active" class="field-label-inline">Active</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" size="small" @click="closeDeviceModal" />
        <Button
          label="Add Device"
          icon="pi pi-plus"
          severity="success"
          size="small"
          :disabled="!deviceForm.name"
          @click="saveDevice"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.form-page {
  max-width: 880px;
  margin: 0 auto;
}

.grow-tabs {
  margin-bottom: var(--space-2);
}

.grow-tabs :deep(.p-tabpanel) {
  padding: var(--space-4) 0 0 0;
}

.grow-tabs :deep(.p-tab) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.section-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.section-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

.section-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: 500;
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
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

.form-hint {
  margin: var(--space-3) 0 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-style: italic;
}

.full-width {
  width: 100%;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.phase-order-badge {
  background: var(--color-info);
  color: #ffffff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 700;
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
  font-family: var(--font-mono);
}

.config-summary {
  background: var(--color-code-bg);
  padding: 0.1875rem 0.5rem;
  border-radius: var(--radius-sm);
  color: var(--color-code-text);
  font-size: var(--text-sm);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono);
  display: inline-block;
}

.config-device-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.config-device-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
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

.date-range {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  background: var(--color-bg-base);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono);
}

.date-range--modal {
  margin-top: var(--space-2);
}

.date-range strong {
  color: var(--color-text-secondary);
  font-weight: 600;
  margin-right: 0.25rem;
}

.config-note {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-style: italic;
  padding: var(--space-2) 0;
}

.config-modal-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.config-modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.config-modal-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-transform: capitalize;
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
  gap: var(--space-2);
}

.empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-md);
}

.form-actions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.staged-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.staged-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.field-row {
  display: flex;
  gap: var(--space-4);
}

.field-row .field {
  flex: 1;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.field-label-inline {
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  font-weight: 500;
  cursor: pointer;
}

.pinout-accordion {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-elevated);
}

.pinout-accordion__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.pinout-accordion__icon {
  color: var(--color-accent);
  font-size: var(--text-md);
}

.pinout-hint {
  margin: 0 0 var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

.pinout-hint code {
  font-family: var(--font-mono);
  background: var(--color-code-bg);
  color: var(--color-code-text);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: var(--text-sm);
}

.pinout-legend {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.legend-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.legend-group__title {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.legend-group__items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}

.swatch--gpio {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
}

.swatch--3v3 {
  border-color: var(--color-info);
  background: var(--color-info-bg);
}

.swatch--5v {
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
}

.swatch--gnd {
  border-color: var(--color-text-muted);
}

.swatch--id {
  border-color: var(--color-warning);
  background: rgba(245, 158, 11, 0.06);
  border-style: dashed;
}

.swatch--i2c {
  border-color: var(--color-bus-i2c-border);
  background: var(--color-bus-i2c-bg);
}

.swatch--spi {
  border-color: var(--color-bus-spi-border);
  background: var(--color-bus-spi-bg);
}

.swatch--uart {
  border-color: var(--color-bus-uart-border);
  background: var(--color-bus-uart-bg);
}

.swatch--pwm {
  border-color: var(--color-bus-pwm-border);
  background: var(--color-bus-pwm-bg);
}
</style>
