<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '../../stores/apiStore'
import type {
  AutomationRule,
  CreateAutomationRulePayload,
  Device,
  GrowPhase,
  PhaseEnvironment,
  PhaseEnvironmentPayload,
  UpdateAutomationRulePayload,
} from '../../types/grow'
import {
  AutomationMode,
  DayNightPeriod,
  DeviceAction,
  DeviceType,
  RuleCondition,
  SensorType,
} from '../../types/grow'
import {
  deriveActivePhaseIndex,
  deriveGrowActive,
  formatDate,
  parseDateOnly,
  recalculatePhaseDates,
} from '../../utils/growDates'
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
import MultiSelect from 'primevue/multiselect'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'

const store = useApiStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

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

let localKeySeq = 0
function genLocalKey(prefix: string): string {
  return `${prefix}-${++localKeySeq}`
}

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
      dayStartMinutes: 360,
      dayDurationMinutes: 1080,
    },
    {
      durationDays: 14,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Seedling',
      order: 2,
      startAt: null,
      dayStartMinutes: 360,
      dayDurationMinutes: 1080,
    },
    {
      durationDays: 28,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Vegetative',
      order: 3,
      startAt: null,
      dayStartMinutes: 360,
      dayDurationMinutes: 1080,
    },
    {
      durationDays: 56,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Flowering',
      order: 4,
      startAt: null,
      dayStartMinutes: 360,
      dayDurationMinutes: 1080,
    },
    {
      durationDays: 14,
      endAt: null,
      isActive: false,
      localKey: genLocalKey('phase'),
      name: 'Flush',
      order: 5,
      startAt: null,
      dayStartMinutes: 360,
      dayDurationMinutes: 1080,
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
  await store.fetchDevices(cycle.controllerId)
}

function isPhaseActive(phase: GrowPhase): boolean {
  const activeIdx = deriveActivePhaseIndex(sortedPhases.value)
  if (activeIdx < 0) {
    return false
  }
  return sortedPhases.value[activeIdx] === phase
}

const activeTab = ref<'details' | 'phases'>('details')

const showPhaseModal = ref(false)
const editingPhaseIndex = ref<number | null>(null)
const phaseDraft = ref<GrowPhase>({
  durationDays: 7,
  endAt: null,
  isActive: false,
  name: '',
  order: 0,
  startAt: null,
  dayStartMinutes: 360,
  dayDurationMinutes: 1080,
})

function dayStartTime(dayStartMinutes: number): { hours: number; minutes: number } {
  return {
    hours: Math.floor(dayStartMinutes / 60),
    minutes: dayStartMinutes % 60,
  }
}

function minutesFromTime(hours: number, minutes: number): number {
  return hours * 60 + minutes
}

const phaseDraftStartTime = computed(() => {
  const mins = phaseDraft.value.dayStartMinutes ?? 360
  return dayStartTime(mins)
})

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
const DEFAULT_DAY_DURATION_MINUTES = 18 * MINUTES_PER_HOUR

const phaseDraftDurationHours = computed({
  get: () =>
    Math.round(
      (phaseDraft.value.dayDurationMinutes ?? DEFAULT_DAY_DURATION_MINUTES) / MINUTES_PER_HOUR,
    ),
  set: (hours: number) => {
    phaseDraft.value.dayDurationMinutes = hours * MINUTES_PER_HOUR
  },
})

function phaseDayNight(phase: GrowPhase): {
  startLabel: string
  dayHours: number
  nightHours: number
} {
  const dayMinutes = phase.dayDurationMinutes ?? DEFAULT_DAY_DURATION_MINUTES
  const nightMinutes = MINUTES_PER_DAY - dayMinutes
  const dayHours = dayMinutes / MINUTES_PER_HOUR
  const nightHours = nightMinutes / MINUTES_PER_HOUR
  if (phase.dayStartMinutes === undefined) {
    return { dayHours, nightHours, startLabel: '—' }
  }
  return { dayHours, nightHours, startLabel: fmtTime(phase.dayStartMinutes) }
}

function formatPhaseDayNight(phase: GrowPhase): string {
  const { startLabel, dayHours, nightHours } = phaseDayNight(phase)
  return `${startLabel} · ${dayHours}h day / ${nightHours}h night`
}

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
    dayStartMinutes: 360,
    dayDurationMinutes: 1080,
  }
  showPhaseModal.value = true
}

function openEditPhase(idx: number) {
  const phase = phases.value[idx]
  if (!phase) {
    return
  }
  editingPhaseIndex.value = idx
  phaseDraft.value = {
    ...phase,
    dayStartMinutes: phase.dayStartMinutes ?? 360,
    dayDurationMinutes: phase.dayDurationMinutes ?? 1080,
  }
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

const phaseDraftStartHours = ref(6)
const phaseDraftStartMinutes = ref(0)

watch(
  () => showPhaseModal.value,
  (visible) => {
    if (visible) {
      const t = dayStartTime(phaseDraft.value.dayStartMinutes ?? 360)
      phaseDraftStartHours.value = t.hours
      phaseDraftStartMinutes.value = t.minutes
    }
  },
)

function applyTimeToPhaseDraft() {
  phaseDraft.value.dayStartMinutes = minutesFromTime(
    phaseDraftStartHours.value,
    phaseDraftStartMinutes.value,
  )
}

async function savePhase(phase: GrowPhase, cycleId?: string): Promise<GrowPhase | null> {
  const payload = {
    durationDays: phase.durationDays,
    endAt: phase.endAt,
    isActive: phase.isActive,
    name: phase.name,
    order: phase.order,
    startAt: phase.startAt,
    dayStartMinutes: phase.dayStartMinutes,
    dayDurationMinutes: phase.dayDurationMinutes,
  }
  if (phase.id) {
    return await store.updateGrowPhase(phase.id, payload)
  }
  const targetCycleId = cycleId ?? growId.value
  if (targetCycleId) {
    const created = await store.createGrowPhase({
      ...payload,
      growCycleId: targetCycleId,
      isActive: false,
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

// ---------- Expandable phase panels: environment + automation ----------

const expandedPhaseKey = ref<string | null>(null)

function toggleExpand(localKey: string) {
  expandedPhaseKey.value = expandedPhaseKey.value === localKey ? null : localKey
}

// Auto-expand active phase on mount in edit mode
onMounted(async () => {
  if (isEditMode.value) {
    const activeIdx = deriveActivePhaseIndex(sortedPhases.value)
    if (activeIdx >= 0) {
      const active = sortedPhases.value[activeIdx]
      if (active?.localKey) {
        expandedPhaseKey.value = active.localKey
      }
    }
  }
})

// ---------- Environment ----------

interface PhaseEnvCache {
  day: PhaseEnvironment | null
  night: PhaseEnvironment | null
  loading: boolean
  savingDay: boolean
  savingNight: boolean
}

const envCache = ref<Record<string, PhaseEnvCache>>({})

function getEnvCache(phase: GrowPhase): PhaseEnvCache {
  const key = phase.localKey!
  if (!envCache.value[key]) {
    envCache.value[key] = {
      day: null,
      night: null,
      loading: false,
      savingDay: false,
      savingNight: false,
    }
  }
  return envCache.value[key]
}

async function loadPhaseEnv(phase: GrowPhase) {
  if (!phase.id) return
  const cache = getEnvCache(phase)
  cache.loading = true
  try {
    const data = await store.fetchPhaseEnvironment(phase.id)
    cache.day = data.day
    cache.night = data.night
  } catch {
    // non-fatal
  } finally {
    cache.loading = false
  }
}

async function savePhaseEnv(
  phase: GrowPhase,
  period: 'DAY' | 'NIGHT',
  payload: PhaseEnvironmentPayload,
  options: { silent?: boolean } = {},
) {
  if (!phase.id) return
  const cache = getEnvCache(phase)
  if (period === 'DAY') cache.savingDay = true
  else cache.savingNight = true
  try {
    const saved = await store.upsertPhaseEnvironment(phase.id, period, payload)
    if (period === 'DAY') cache.day = saved
    else cache.night = saved
    return saved
  } catch (error) {
    if (!options.silent) {
      const { message } = extractApiError(error, 'Failed to save environment')
      toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Save failed' })
    }
    throw error
  } finally {
    if (period === 'DAY') cache.savingDay = false
    else cache.savingNight = false
  }
}

async function clearPhaseEnv(phase: GrowPhase, period: 'DAY' | 'NIGHT') {
  const phaseId = phase.id
  if (!phaseId) return
  confirm.require({
    accept: async () => {
      const cache = getEnvCache(phase)
      if (period === 'DAY') cache.savingDay = true
      else cache.savingNight = true
      try {
        await store.deletePhaseEnvironment(phaseId, period)
        if (period === 'DAY') cache.day = null
        else cache.night = null
      } catch (error) {
        const { message } = extractApiError(error, 'Failed to clear environment')
        toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Delete failed' })
      } finally {
        if (period === 'DAY') cache.savingDay = false
        else cache.savingNight = false
      }
    },
    acceptLabel: 'Clear',
    acceptProps: { severity: 'danger' },
    header: `Clear ${period} environment`,
    icon: 'pi pi-exclamation-triangle',
    message: `Remove the ${period} environment thresholds for "${phase.name}"?`,
    rejectLabel: 'Cancel',
  })
}

function emptyEnvPayload(): PhaseEnvironmentPayload {
  return {
    co2Max: null,
    co2Min: null,
    co2Target: null,
    humidityMax: null,
    humidityMin: null,
    humidityTarget: null,
    tempMax: null,
    tempMin: null,
    tempTarget: null,
  }
}

const envDraftDay = ref<PhaseEnvironmentPayload>(emptyEnvPayload())
const envDraftNight = ref<PhaseEnvironmentPayload>(emptyEnvPayload())
const envEditingPhase = ref<GrowPhase | null>(null)
const showEnvForm = ref(false)
const envDialogLoading = ref(false)

function envPayloadFromCache(env: PhaseEnvironment | null): PhaseEnvironmentPayload {
  return {
    co2Max: env?.co2Max ?? null,
    co2Min: env?.co2Min ?? null,
    co2Target: env?.co2Target ?? null,
    humidityMax: env?.humidityMax ?? null,
    humidityMin: env?.humidityMin ?? null,
    humidityTarget: env?.humidityTarget ?? null,
    tempMax: env?.tempMax ?? null,
    tempMin: env?.tempMin ?? null,
    tempTarget: env?.tempTarget ?? null,
  }
}

async function openEnvDialog(phase: GrowPhase) {
  envEditingPhase.value = phase
  showEnvForm.value = true
  envDialogLoading.value = true
  try {
    await loadPhaseEnv(phase)
    const cache = getEnvCache(phase)
    envDraftDay.value = envPayloadFromCache(cache.day)
    envDraftNight.value = envPayloadFromCache(cache.night)
  } finally {
    envDialogLoading.value = false
  }
}

function closeEnvDialog() {
  envEditingPhase.value = null
  showEnvForm.value = false
}

async function saveEnvDialog() {
  const phase = envEditingPhase.value
  if (!phase) return
  const [dayRes, nightRes] = await Promise.allSettled([
    savePhaseEnv(phase, 'DAY', envDraftDay.value, { silent: true }),
    savePhaseEnv(phase, 'NIGHT', envDraftNight.value, { silent: true }),
  ])
  if (dayRes.status === 'fulfilled' && nightRes.status === 'fulfilled') {
    toast.add({
      detail: 'Environment saved',
      life: 3000,
      severity: 'success',
      summary: 'Saved',
    })
    closeEnvDialog()
    return
  }
  const failed: string[] = []
  if (dayRes.status === 'rejected') failed.push('Day')
  if (nightRes.status === 'rejected') failed.push('Night')
  toast.add({
    detail: `${failed.join(' and ')} save failed`,
    life: 6000,
    severity: 'error',
    summary: 'Save failed',
  })
}

function envDraftFor(period: 'DAY' | 'NIGHT'): PhaseEnvironmentPayload {
  return period === 'DAY' ? envDraftDay.value : envDraftNight.value
}

const envIsSaving = computed(() => {
  const phase = envEditingPhase.value
  if (!phase) return false
  const cache = getEnvCache(phase)
  return cache.savingDay || cache.savingNight
})

// ---------- Automation ----------

interface RulesCache {
  rules: AutomationRule[]
  loading: boolean
}

const rulesCache = ref<Record<string, RulesCache>>({})

function getRulesCache(phase: GrowPhase): RulesCache {
  const key = phase.localKey!
  if (!rulesCache.value[key]) {
    rulesCache.value[key] = { rules: [], loading: false }
  }
  return rulesCache.value[key]
}

async function loadPhaseRules(phase: GrowPhase) {
  if (!phase.id) return
  const cache = getRulesCache(phase)
  cache.loading = true
  try {
    cache.rules = await store.fetchRulesByPhase(phase.id)
  } catch {
    // non-fatal
  } finally {
    cache.loading = false
  }
}

async function toggleRule(phase: GrowPhase, rule: AutomationRule) {
  try {
    const updated = await store.toggleRule(rule.id)
    const cache = getRulesCache(phase)
    const idx = cache.rules.findIndex((r) => r.id === rule.id)
    if (idx !== -1) cache.rules[idx] = updated
  } catch (error) {
    const { message } = extractApiError(error, 'Failed to toggle rule')
    toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Toggle failed' })
  }
}

async function deleteRule(phase: GrowPhase, rule: AutomationRule) {
  confirm.require({
    accept: async () => {
      try {
        await store.deleteRule(rule.id)
        const cache = getRulesCache(phase)
        cache.rules = cache.rules.filter((r) => r.id !== rule.id)
      } catch (error) {
        const { message } = extractApiError(error, 'Failed to delete rule')
        toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Delete failed' })
      }
    },
    acceptLabel: 'Delete',
    acceptProps: { severity: 'danger' },
    header: 'Delete rule',
    icon: 'pi pi-exclamation-triangle',
    message: `Remove this automation rule for "${phase.name}"?`,
    rejectLabel: 'Cancel',
  })
}

// ---------- Quick-add ----------

const controllerDevices = computed<Device[]>(
  () =>
    (
      store.controllers.find((c) => c.id === form.value.controllerId) as
        | ((typeof store.controllers)[number] & { devices?: Device[] })
        | undefined
    )?.devices ?? [],
)

const quickAddDeviceId = ref<string[]>([])

const QUICK_ADD_TEMPLATES: Array<{
  label: string
  deviceTypes: DeviceType[]
  watchedSensorType: SensorType
  condition: RuleCondition
  action: DeviceAction
  period: DayNightPeriod | null
}> = [
  {
    label: 'Light — Day start',
    action: DeviceAction.ON,
    condition: RuleCondition.SCHEDULE_ON,
    deviceTypes: [DeviceType.LIGHT],
    period: DayNightPeriod.DAY,
    watchedSensorType: SensorType.TEMPERATURE,
  },
  {
    label: 'Light — Night start',
    action: DeviceAction.OFF,
    condition: RuleCondition.SCHEDULE_OFF,
    deviceTypes: [DeviceType.LIGHT],
    period: DayNightPeriod.NIGHT,
    watchedSensorType: SensorType.TEMPERATURE,
  },
  {
    label: 'Exhaust/Intake Fan — Above max temp',
    action: DeviceAction.ON,
    condition: RuleCondition.ABOVE_MAX,
    deviceTypes: [
      DeviceType.EXHAUST_FAN,
      DeviceType.INTAKE_FAN,
      DeviceType.AIR_CONDITIONER,
      DeviceType.CIRCULATION_FAN,
    ],
    period: null,
    watchedSensorType: SensorType.TEMPERATURE,
  },
  {
    label: 'Heater — Below min temp',
    action: DeviceAction.ON,
    condition: RuleCondition.BELOW_MIN,
    deviceTypes: [DeviceType.HEATER],
    period: null,
    watchedSensorType: SensorType.TEMPERATURE,
  },
  {
    label: 'Humidifier — Below min humidity',
    action: DeviceAction.ON,
    condition: RuleCondition.BELOW_MIN,
    deviceTypes: [DeviceType.HUMIDIFIER],
    period: null,
    watchedSensorType: SensorType.HUMIDITY,
  },
  {
    label: 'Dehumidifier — Above max humidity',
    action: DeviceAction.ON,
    condition: RuleCondition.ABOVE_MAX,
    deviceTypes: [DeviceType.DEHUMIDIFIER],
    period: null,
    watchedSensorType: SensorType.HUMIDITY,
  },
  {
    label: 'CO₂ — Below min CO₂ (day)',
    action: DeviceAction.ON,
    condition: RuleCondition.BELOW_MIN,
    deviceTypes: [DeviceType.CO2_INJECTOR],
    period: DayNightPeriod.DAY,
    watchedSensorType: SensorType.CO2,
  },
]

async function quickAddRule(phase: GrowPhase, template: (typeof QUICK_ADD_TEMPLATES)[number]) {
  const deviceIds = quickAddDeviceId.value
  if (!phase.id || deviceIds.length === 0) {
    toast.add({
      detail: 'Select a device first.',
      life: 4000,
      severity: 'warn',
      summary: 'No device selected',
    })
    return
  }
  const cache = getRulesCache(phase)
  try {
    for (const dId of deviceIds) {
      const payload: CreateAutomationRulePayload = {
        action: template.action,
        condition: template.condition,
        cooldownSeconds: 180,
        deviceId: dId,
        enabled: true,
        growPhaseId: phase.id,
        period: template.period,
        watchedSensorType: template.watchedSensorType,
      }
      const created = await store.createRule(payload)
      cache.rules.push(created)
    }
    quickAddDeviceId.value = []
    toast.add({
      detail: `Rule${deviceIds.length > 1 ? 's' : ''} added.`,
      life: 3000,
      severity: 'success',
      summary: 'Rule created',
    })
  } catch (error) {
    const { message } = extractApiError(error, 'Failed to create rule')
    toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Create failed' })
  }
}

// Watch expanded phase → load env + rules
watch(
  () => expandedPhaseKey.value,
  async (key) => {
    if (!key || !isEditMode.value) return
    const phase = phases.value.find((p) => p.localKey === key)
    if (!phase) return
    await Promise.all([loadPhaseEnv(phase), loadPhaseRules(phase)])
  },
)

// ---------- Save ---------

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
      await reconcileActivePhase()
      router.push('/admin')
    } else {
      let created
      try {
        created = await store.createGrowCycle({
          controllerId: form.value.controllerId,
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

      for (const phase of sortedPhases.value) {
        await savePhase(phase, created.id)
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
      await reconcileActivePhase()
      router.push(`/admin/grows/edit/${created.id}`)
    }
  } catch (error) {
    console.error('Failed to save', error)
  } finally {
    saving.value = false
  }
}

function fmtTime(dayStartMinutes: number): string {
  const h = Math.floor(dayStartMinutes / 60)
  const m = dayStartMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
</script>

<template>
  <ConfirmDialog />
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

                <DataTable
                  v-if="phases.length > 0"
                  :value="sortedPhases"
                  size="small"
                  class="phases-table"
                >
                  <Column header="#" style="width: 60px">
                    <template #body="slotProps">
                      <span class="phase-order-badge">{{ slotProps.data.order }}</span>
                    </template>
                  </Column>
                  <Column field="name" header="Name" sortable style="font-weight: 600" />
                  <Column header="Duration" sortable>
                    <template #body="slotProps"> {{ slotProps.data.durationDays }} days </template>
                  </Column>
                  <Column header="Day/Night" sortable>
                    <template #body="slotProps">
                      <code v-if="slotProps.data.dayStartMinutes != null" class="meta-code">
                        {{ formatPhaseDayNight(slotProps.data) }}
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
                  <Column header="Actions" style="width: 120px">
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
                          icon="pi pi-sun"
                          severity="info"
                          text
                          rounded
                          size="small"
                          aria-label="Edit environment"
                          :disabled="!slotProps.data.id"
                          v-tooltip.top="slotProps.data.id ? 'Environment' : 'Save the grow first'"
                          @click.stop="openEnvDialog(slotProps.data)"
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
                  <Column header="" style="width: 48px">
                    <template #body="slotProps">
                      <Button
                        :icon="
                          expandedPhaseKey === slotProps.data.localKey
                            ? 'pi pi-chevron-up'
                            : 'pi pi-chevron-down'
                        "
                        text
                        rounded
                        size="small"
                        severity="secondary"
                        :aria-label="
                          expandedPhaseKey === slotProps.data.localKey ? 'Collapse' : 'Expand'
                        "
                        @click="toggleExpand(slotProps.data.localKey!)"
                      />
                    </template>
                  </Column>

                  <template #expansion="slotProps">
                    <div
                      v-if="expandedPhaseKey === slotProps.data.localKey"
                      class="phase-expansion"
                    >
                      <!-- Automation -->
                      <div class="expansion-section">
                        <div class="expansion-section-header">
                          <h4 class="expansion-section-title">Automation Rules</h4>
                          <p class="expansion-section-hint">
                            {{
                              isEditMode
                                ? 'Rules drive device actuation for this phase.'
                                : 'Save the grow first to configure automation rules.'
                            }}
                          </p>
                        </div>

                        <div v-if="!isEditMode" class="env-locked-hint">
                          <i class="pi pi-lock" />
                          Save the grow to enable automation rules.
                        </div>

                        <template v-else>
                          <div v-if="getRulesCache(slotProps.data).loading" class="env-loading">
                            <i class="pi pi-spin pi-spinner" /> Loading…
                          </div>

                          <template v-else>
                            <DataTable
                              v-if="getRulesCache(slotProps.data).rules.length > 0"
                              :value="getRulesCache(slotProps.data).rules"
                              size="small"
                              class="rules-table"
                            >
                              <Column field="deviceId" header="Device">
                                <template #body="ruleSlot">
                                  {{
                                    controllerDevices.find((d) => d.id === ruleSlot.data.deviceId)
                                      ?.name ?? ruleSlot.data.deviceId
                                  }}
                                </template>
                              </Column>
                              <Column field="watchedSensorType" header="Sensor" />
                              <Column field="condition" header="Condition" />
                              <Column field="action" header="Action">
                                <template #body="ruleSlot">
                                  <Tag
                                    :value="ruleSlot.data.action"
                                    :severity="
                                      ruleSlot.data.action === 'ON' ? 'success' : 'secondary'
                                    "
                                    rounded
                                  />
                                </template>
                              </Column>
                              <Column field="period" header="Period">
                                <template #body="ruleSlot">
                                  <span class="type-pill">
                                    {{ ruleSlot.data.period ?? 'Both' }}
                                  </span>
                                </template>
                              </Column>
                              <Column field="cooldownSeconds" header="Cooldown" />
                              <Column header="Enabled" style="width: 80px">
                                <template #body="ruleSlot">
                                  <InputSwitch
                                    :modelValue="ruleSlot.data.enabled"
                                    @update:modelValue="toggleRule(slotProps.data, ruleSlot.data)"
                                  />
                                </template>
                              </Column>
                              <Column header="Last Triggered">
                                <template #body="ruleSlot">
                                  <span v-if="ruleSlot.data.lastTriggeredAt" class="meta-code">
                                    {{ ruleSlot.data.lastTriggeredAt }}
                                  </span>
                                  <span v-else class="muted">Never</span>
                                </template>
                              </Column>
                              <Column header="" style="width: 60px">
                                <template #body="ruleSlot">
                                  <Button
                                    icon="pi pi-trash"
                                    text
                                    rounded
                                    size="small"
                                    severity="danger"
                                    v-tooltip.top="'Delete rule'"
                                    @click="deleteRule(slotProps.data, ruleSlot.data)"
                                  />
                                </template>
                              </Column>
                            </DataTable>

                            <div v-else class="rules-empty">
                              No rules configured for this phase.
                            </div>

                            <!-- Quick-add -->
                            <div class="quick-add">
                              <h5 class="quick-add-title">Quick-add rules</h5>
                              <div class="quick-add-controls">
                                <MultiSelect
                                  v-model="quickAddDeviceId"
                                  :options="controllerDevices"
                                  optionLabel="name"
                                  optionValue="id"
                                  placeholder="Select device(s)"
                                  class="quick-add-device-select"
                                  display="chip"
                                />
                                <Button
                                  v-for="tmpl in QUICK_ADD_TEMPLATES"
                                  :key="tmpl.label"
                                  :label="tmpl.label"
                                  size="small"
                                  severity="secondary"
                                  :disabled="!slotProps.data.id || quickAddDeviceId.length === 0"
                                  @click="quickAddRule(slotProps.data, tmpl)"
                                />
                              </div>
                            </div>
                          </template>
                        </template>
                      </div>
                    </div>
                  </template>
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
      :style="{ width: '90vw', maxWidth: '520px' }"
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
        <div class="field-row-2">
          <div class="field">
            <label for="phase-day-start" class="field-label">Day Start (HH:MM)</label>
            <div class="time-picker-row">
              <InputNumber
                inputId="phase-day-start-hours"
                v-model="phaseDraftStartHours"
                :min="0"
                :max="23"
                showButtons
                buttonLayout="horizontal"
                :step="1"
                class="time-input"
                @blur="applyTimeToPhaseDraft"
              />
              <span class="time-sep">:</span>
              <InputNumber
                inputId="phase-day-start-minutes"
                v-model="phaseDraftStartMinutes"
                :min="0"
                :max="59"
                showButtons
                buttonLayout="horizontal"
                :step="5"
                class="time-input"
                @blur="applyTimeToPhaseDraft"
              />
            </div>
          </div>
          <div class="field">
            <label for="phase-day-duration" class="field-label">Day Duration (hours)</label>
            <InputNumber
              inputId="phase-day-duration"
              v-model="phaseDraftDurationHours"
              :min="0"
              :max="24"
              showButtons
              buttonLayout="horizontal"
              :step="1"
            />
            <span class="field-hint">Night = {{ 24 - phaseDraftDurationHours }} h</span>
          </div>
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

    <!-- Environment edit dialog (combined Day + Night) -->
    <Dialog
      v-model:visible="showEnvForm"
      :header="`Environment — ${envEditingPhase?.name ?? ''}`"
      :style="{ width: '90vw', maxWidth: '800px' }"
      modal
      dismissable-mask
      class="env-modal"
    >
      <div v-if="envDialogLoading" class="env-loading">
        <i class="pi pi-spin pi-spinner" /> Loading environment…
      </div>
      <div v-else class="form-stack">
        <div class="env-form-grid env-form-grid--dual">
          <div v-for="period in ['DAY', 'NIGHT'] as const" :key="period" class="env-form-group">
            <div class="env-form-group-header">
              <h5 class="env-form-group-title">{{ period }}</h5>
              <Button
                v-if="envEditingPhase?.id"
                icon="pi pi-trash"
                label="Clear"
                text
                size="small"
                severity="danger"
                v-tooltip.top="`Clear ${period} environment`"
                :loading="
                  period === 'DAY'
                    ? getEnvCache(envEditingPhase).savingDay
                    : getEnvCache(envEditingPhase).savingNight
                "
                @click="clearPhaseEnv(envEditingPhase!, period)"
              />
            </div>
            <div class="env-form-fields">
              <h6 class="env-form-subtitle">Temperature (°C)</h6>
              <div class="field-row-3">
                <div class="field">
                  <label class="field-label">Min</label>
                  <InputNumber v-model="envDraftFor(period).tempMin" placeholder="e.g. 18" />
                </div>
                <div class="field">
                  <label class="field-label">Target</label>
                  <InputNumber v-model="envDraftFor(period).tempTarget" placeholder="e.g. 22" />
                </div>
                <div class="field">
                  <label class="field-label">Max</label>
                  <InputNumber v-model="envDraftFor(period).tempMax" placeholder="e.g. 28" />
                </div>
              </div>
            </div>
            <div class="env-form-fields">
              <h6 class="env-form-subtitle">Humidity (%)</h6>
              <div class="field-row-3">
                <div class="field">
                  <label class="field-label">Min</label>
                  <InputNumber v-model="envDraftFor(period).humidityMin" placeholder="e.g. 50" />
                </div>
                <div class="field">
                  <label class="field-label">Target</label>
                  <InputNumber v-model="envDraftFor(period).humidityTarget" placeholder="e.g. 65" />
                </div>
                <div class="field">
                  <label class="field-label">Max</label>
                  <InputNumber v-model="envDraftFor(period).humidityMax" placeholder="e.g. 80" />
                </div>
              </div>
            </div>
            <div class="env-form-fields">
              <h6 class="env-form-subtitle">CO₂ (ppm)</h6>
              <div class="field-row-3">
                <div class="field">
                  <label class="field-label">Min</label>
                  <InputNumber v-model="envDraftFor(period).co2Min" placeholder="e.g. 800" />
                </div>
                <div class="field">
                  <label class="field-label">Target</label>
                  <InputNumber v-model="envDraftFor(period).co2Target" placeholder="e.g. 1200" />
                </div>
                <div class="field">
                  <label class="field-label">Max</label>
                  <InputNumber v-model="envDraftFor(period).co2Max" placeholder="e.g. 1500" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="field-hint">Leave blank to leave a threshold unconstrained.</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" size="small" @click="closeEnvDialog" />
        <Button
          label="Save"
          severity="success"
          size="small"
          :loading="envIsSaving"
          :disabled="envDialogLoading"
          @click="saveEnvDialog"
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

.field-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.time-picker-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.time-input {
  width: 80px;
}

.time-sep {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text-secondary);
}

.field-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

/* Expandable row */
.phase-expansion {
  padding: var(--space-4) var(--space-4) var(--space-4) calc(1rem + 60px);
  background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.expansion-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.expansion-section-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.expansion-section-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text-primary);
}

.expansion-section-hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.env-locked-hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-style: italic;
  padding: var(--space-3) 0;
}

.env-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  padding: var(--space-2) 0;
}

.env-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.env-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.env-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.env-card-title {
  font-size: var(--text-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.env-card-actions {
  display: flex;
  gap: var(--space-1);
}

.env-empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.env-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.env-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-weight: 500;
}

.rules-table {
  margin-bottom: var(--space-3);
}

.rules-empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-style: italic;
  padding: var(--space-2) 0;
}

.quick-add {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.quick-add-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.quick-add-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.quick-add-device-select {
  min-width: 200px;
}

/* Env form */
.env-form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.env-form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.env-form-group-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-2);
}

.field-row-3 .field {
  gap: var(--space-1);
}

.env-form-grid--dual {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 640px) {
  .env-form-grid--dual {
    grid-template-columns: 1fr;
  }
}

.env-form-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.env-form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.env-form-subtitle {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
