import {
  computed,
  inject,
  provide,
  reactive,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useRoute } from 'vue-router'
import type { Device, GrowPhase, PhaseEnvironment } from '../../types/grow'
import { DayNightPeriod, SensorType } from '../../types/grow'
import { useApiStore } from '../../stores/apiStore'
import { useLiveTelemetry } from '../../composables/useLiveTelemetry'
import {
  actionLabel,
  proximityLabel,
  useAutomationMonitor,
  type AutomationMonitor,
} from '../../composables/useAutomationMonitor'
import {
  addDays,
  daysBetween,
  deriveActivePhaseIndex,
  deriveElapsedDays,
  deriveGrowActive,
  todayStr,
} from '../../utils/growDates'

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
const DEFAULT_DAY_START_MINUTES = 6 * MINUTES_PER_HOUR
const DEFAULT_DAY_DURATION_MINUTES = 18 * MINUTES_PER_HOUR

export interface RuleDisplay {
  ruleId: string
  ruleName: string
  deviceName: string
  conditionShort: string
  actionLabel: string
  currentValue: number | null
  thresholdValue: number | null
  unit: string
  proximity: 'safe' | 'approaching' | 'firing' | 'unknown' | 'unset' | 'not-applicable'
  enabled: boolean
  lastTriggeredAt: string | null
  periodLabel: string
}

export interface ActiveEnvState {
  day: PhaseEnvironment | null
  night: PhaseEnvironment | null
  loading: boolean
}

export type ApiStore = ReturnType<typeof useApiStore>
export type GrowCycleRecord = ApiStore['growCycles'][number]
export type ControllerRecord = ApiStore['controllers'][number]

export interface GrowMonitorState {
  // cycle + controller
  cycleId: ComputedRef<string>
  currentCycle: ComputedRef<
    | (GrowCycleRecord & {
        phases?: GrowPhase[]
        controller?: ControllerRecord
      })
    | undefined
  >
  linkedController: ComputedRef<ControllerRecord | null>
  controllerStatusClass: ComputedRef<'online' | 'offline' | 'error'>
  growDevices: ComputedRef<Device[]>

  // phase / progress
  sortedPhases: ComputedRef<GrowPhase[]>
  activePhaseIndex: ComputedRef<number>
  cycleProgressPercent: ComputedRef<number>
  elapsedDays: ComputedRef<number>
  totalDurationDays: ComputedRef<number>
  daysRemaining: ComputedRef<number>
  estimatedHarvestDate: ComputedRef<string | null>
  activePhaseName: ComputedRef<string>
  activePhaseSub: ComputedRef<string>
  isGrowComplete: ComputedRef<boolean>

  // light schedule / period
  activePeriod: ComputedRef<'DAY' | 'NIGHT'>
  lightScheduleText: ComputedRef<string>
  lightCountdownText: ComputedRef<string>

  // telemetry
  liveTelemetry: ReturnType<typeof useLiveTelemetry>
  temperatureC: ComputedRef<number>
  humidityPercent: ComputedRef<number>
  co2Ppm: ComputedRef<number>
  ecMs: ComputedRef<number>
  phValue: ComputedRef<number>

  // env targets
  activeEnv: Ref<ActiveEnvState>
  activeEnvConfigured: ComputedRef<boolean>

  // automations
  automations: AutomationMonitor
  automationsSummary: ComputedRef<{
    groups: Array<{
      key: string
      label: string
      currentReading: string
      rules: RuleDisplay[]
    }>
    pinnedRules: RuleDisplay[]
    hasRules: boolean
    loading: boolean
  }>

  // device toggles
  deviceToggles: Record<string, boolean>
  lastDeviceStateUpdate: Record<string, number>

  // internal wall-clock ticks (driven by shell interval)
  nowTick: Ref<number>
  secondsTick: Ref<number>

  // phase management
  canSkipPhase: ComputedRef<boolean>
  isOnLastPhase: ComputedRef<boolean>
  skipping: Ref<boolean>
  ending: Ref<boolean>

  // actions (called by the shell)
  handleDeviceStateUpdate: (data: { deviceId: string; isActive: boolean }) => void
  handleSocketReconnect: () => void
  onDeviceToggle: (
    deviceId: string,
    checked: boolean,
    pin: number,
  ) => Promise<{ ok: boolean; reason?: string }>
  onRuleToggle: (ruleId: string) => Promise<void>
  envFor: (period: 'DAY' | 'NIGHT') => PhaseEnvironment | null
  fmtRange: (min: number | null, max: number | null) => string
  fmtTarget: (t: number | null) => string
  formatLastTriggered: (iso: string) => string
  loadActivePhaseEnv: () => Promise<void>

  // re-exported labels
  actionLabel: typeof actionLabel
  proximityLabel: typeof proximityLabel
}

function formatHm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmtRange(min: number | null, max: number | null): string {
  if (min == null && max == null) {
    return '—'
  }
  return `${min ?? '—'}\u2013${max ?? '—'}`
}

function fmtTarget(t: number | null): string {
  return t == null ? '—' : String(t)
}

function formatLastTriggered(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  if (days < 7) {
    return `${days}d ago`
  }
  return new Date(iso).toLocaleDateString()
}

interface RuleSourceInfo {
  rule: { id: string; enabled: boolean; lastTriggeredAt: string | null }
  device?: { name: string }
  conditionShort: string
  currentValue: number | null
  thresholdValue: number | null
  unit: string
  proximity: RuleDisplay['proximity']
  periodLabel: string
}

function mapRuleToDisplay(info: RuleSourceInfo): RuleDisplay {
  return {
    actionLabel: '',
    conditionShort: info.conditionShort,
    currentValue: info.currentValue,
    deviceName: info.device?.name ?? 'Unknown device',
    enabled: info.rule.enabled,
    lastTriggeredAt: info.rule.lastTriggeredAt,
    periodLabel: info.periodLabel,
    proximity: info.proximity,
    ruleId: info.rule.id,
    ruleName: info.rule.id,
    thresholdValue: info.thresholdValue,
    unit: info.unit,
  }
}

export function useGrowMonitorState(): GrowMonitorState {
  const route = useRoute()
  const store = useApiStore()

  const cycleId = computed(() => route.params.id as string)

  const currentCycle = computed(
    () =>
      store.growCycles.find((g) => g.id === cycleId.value) as
        | ((typeof store.growCycles)[number] & {
            phases?: GrowPhase[]
            controller?: (typeof store.controllers)[number]
          })
        | undefined,
  )

  const linkedController = computed(() => {
    const cycle = currentCycle.value
    if (!cycle) {
      return null
    }
    return store.controllers.find((c) => c.id === cycle.controllerId) ?? cycle.controller ?? null
  })

  const controllerStatusClass = computed<'online' | 'offline' | 'error'>(() => {
    const status = linkedController.value?.status
    if (status === 'ONLINE') {
      return 'online'
    }
    if (status === 'ERROR') {
      return 'error'
    }
    return 'offline'
  })

  const growDevices = computed<Device[]>(() => {
    const ctrl = linkedController.value
    if (!ctrl) {
      return []
    }
    const found = store.controllers.find((c) => c.id === ctrl.id) as
      | ((typeof store.controllers)[number] & { devices?: Device[] })
      | undefined
    return found?.devices ?? []
  })

  const sortedPhases = computed(() => {
    const phases = currentCycle.value?.phases
    if (!phases) {
      return []
    }
    return [...phases].toSorted((a: GrowPhase, b: GrowPhase) => a.order - b.order)
  })

  const activePhaseIndex = computed(() => {
    const dateIdx = deriveActivePhaseIndex(sortedPhases.value)
    if (dateIdx !== -1) {
      return dateIdx
    }
    return sortedPhases.value.findIndex((p: GrowPhase) => p.isActive)
  })

  const totalDurationDays = computed(() =>
    sortedPhases.value.reduce((sum: number, p: GrowPhase) => sum + p.durationDays, 0),
  )

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

  const activePhaseName = computed(() => {
    if (isGrowComplete.value) {
      return 'Complete'
    }
    const idx = activePhaseIndex.value
    if (idx < 0) {
      return 'Not started'
    }
    return sortedPhases.value[idx]?.name ?? 'Not started'
  })

  const activePhaseSub = computed(() => {
    if (isGrowComplete.value) {
      return 'Grow ended'
    }
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

  const isGrowComplete = computed(() => {
    const cycle = currentCycle.value
    if (!cycle?.startAt) {
      return false
    }
    if (activePhaseIndex.value >= 0) {
      return false
    }
    const lastPhase = sortedPhases.value.at(-1)
    if (!lastPhase?.endAt) {
      return false
    }
    return todayStr() >= lastPhase.endAt
  })

  // Wall-clock period detection — tick once a minute so the "Active now" badge
  // flips at the schedule boundary without a page reload. Second tick for the
  // countdown timer.
  const nowTick = ref(Date.now())
  const secondsTick = ref(Date.now())

  const currentMinutesIntoDay = computed(() => {
    void nowTick.value
    const now = new Date()
    return now.getHours() * MINUTES_PER_HOUR + now.getMinutes()
  })

  const activePeriod = computed<'DAY' | 'NIGHT'>(() => {
    const idx = activePhaseIndex.value
    const phase = idx >= 0 ? sortedPhases.value[idx] : null
    const start = phase?.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES
    const duration = phase?.dayDurationMinutes ?? DEFAULT_DAY_DURATION_MINUTES
    const cur = currentMinutesIntoDay.value
    const end = start + duration
    if (end <= MINUTES_PER_DAY) {
      return cur >= start && cur < end ? 'DAY' : 'NIGHT'
    }
    return cur >= start || cur < end - MINUTES_PER_DAY ? 'DAY' : 'NIGHT'
  })

  const currentSecondsIntoDay = computed(() => {
    void secondsTick.value
    const now = new Date()
    return now.getHours() * MINUTES_PER_HOUR * 60 + now.getMinutes() * 60 + now.getSeconds()
  })

  const lightTransitionCountdown = computed<{ label: string; totalSecs: number } | null>(() => {
    const idx = activePhaseIndex.value
    const phase = idx >= 0 ? sortedPhases.value[idx] : null
    if (!phase) {
      return null
    }
    const start = phase.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES
    const duration = phase.dayDurationMinutes ?? DEFAULT_DAY_DURATION_MINUTES
    const endMin = start + duration
    const curSec = currentSecondsIntoDay.value
    const startSec = start * MINUTES_PER_HOUR
    let endSec = (endMin % MINUTES_PER_DAY) * MINUTES_PER_HOUR
    if (endSec === 0 && endMin > 0) {
      endSec = MINUTES_PER_DAY * MINUTES_PER_HOUR
    }

    if (activePeriod.value === 'DAY') {
      const diffSecs = endSec - curSec
      if (diffSecs <= 0) {
        return null
      }
      return { label: 'lights off in', totalSecs: diffSecs }
    }
    let diffSecs: number
    if (curSec < startSec) {
      diffSecs = startSec - curSec
    } else {
      diffSecs = startSec + MINUTES_PER_DAY * MINUTES_PER_HOUR - curSec
    }
    return { label: 'lights on in', totalSecs: diffSecs }
  })

  const lightCountdownText = computed(() => {
    const c = lightTransitionCountdown.value
    if (!c) {
      return ''
    }
    const h = Math.floor(c.totalSecs / 3600)
    const m = Math.floor((c.totalSecs % 3600) / 60)
    const s = c.totalSecs % 60
    return `${c.label} ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
  })

  const lightScheduleText = computed(() => {
    const idx = activePhaseIndex.value
    const phase = idx >= 0 ? sortedPhases.value[idx] : null
    const start = phase?.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES
    const duration = phase?.dayDurationMinutes ?? DEFAULT_DAY_DURATION_MINUTES
    const dayH = Math.round(duration / MINUTES_PER_HOUR)
    const nightH = 24 - dayH
    const onH = Math.floor(start / MINUTES_PER_HOUR)
    const onM = start % MINUTES_PER_HOUR
    const off = start + duration
    const offH = Math.floor((off % MINUTES_PER_DAY) / MINUTES_PER_HOUR)
    const offM = (off % MINUTES_PER_DAY) % MINUTES_PER_HOUR
    return `${formatHm(onH, onM)} → ${formatHm(offH, offM)} (${dayH}h day / ${nightH}h night)`
  })

  // ---------- Live telemetry via Socket.IO ----------
  const liveTelemetry = useLiveTelemetry(() => cycleId.value)

  const temperatureC = computed(() => liveTelemetry.getLatest(SensorType.TEMPERATURE)?.value ?? 0)
  const humidityPercent = computed(() => liveTelemetry.getLatest(SensorType.HUMIDITY)?.value ?? 0)
  const co2Ppm = computed(() => liveTelemetry.getLatest(SensorType.CO2)?.value ?? 0)
  const ecMs = computed(() => liveTelemetry.getLatest(SensorType.EC)?.value ?? 0)
  const phValue = computed(() => liveTelemetry.getLatest(SensorType.PH)?.value ?? 0)

  // ---------- Active phase environment ----------
  const activeEnv = ref<ActiveEnvState>({ day: null, loading: false, night: null })

  async function loadActivePhaseEnv() {
    const idx = activePhaseIndex.value
    const phase = idx >= 0 ? sortedPhases.value[idx] : null
    if (!phase?.id) {
      activeEnv.value = { day: null, loading: false, night: null }
      return
    }
    activeEnv.value = { ...activeEnv.value, loading: true }
    try {
      const data = await store.fetchPhaseEnvironment(phase.id)
      activeEnv.value = { day: data.day, loading: false, night: data.night }
    } catch {
      activeEnv.value = { ...activeEnv.value, loading: false }
    }
  }

  const activeEnvConfigured = computed(
    () => activeEnv.value.day !== null || activeEnv.value.night !== null,
  )

  function envFor(period: 'DAY' | 'NIGHT'): PhaseEnvironment | null {
    return period === 'DAY' ? activeEnv.value.day : activeEnv.value.night
  }

  // ---------- Automations ----------
  const automations = useAutomationMonitor({
    fetchRulesApi: (phaseId) => store.fetchRulesByPhase(phaseId),
    getActiveEnv: () => ({ day: activeEnv.value.day, night: activeEnv.value.night }),
    getActivePeriod: () => activePeriod.value as DayNightPeriod,
    getActivePhaseId: () => {
      const idx = activePhaseIndex.value
      if (idx < 0) {
        return
      }
      return sortedPhases.value[idx]?.id ?? undefined
    },
    getDevices: () => growDevices.value,
    getReadings: () => ({
      co2: liveTelemetry.getLatest(SensorType.CO2)?.value ?? 0,
      humidity: liveTelemetry.getLatest(SensorType.HUMIDITY)?.value ?? 0,
      temperature: liveTelemetry.getLatest(SensorType.TEMPERATURE)?.value ?? 0,
    }),
    toggleRuleApi: (id) => store.toggleRule(id),
  })

  const automationsSummary = computed(() => {
    const toRule = mapRuleToDisplay
    return {
      groups: automations.groups.map((g) => ({
        currentReading: g.currentReading,
        key: g.key,
        label: g.label,
        rules: g.rules.map(toRule),
      })),
      hasRules: automations.hasRules,
      loading: automations.loading,
      pinnedRules: automations.pinnedRules.map(toRule),
    }
  })

  // ---------- Device toggles ----------
  const deviceToggles = reactive<Record<string, boolean>>({})
  const lastDeviceStateUpdate = reactive<Record<string, number>>({})

  function handleDeviceStateUpdate(data: { deviceId: string; isActive: boolean }) {
    deviceToggles[data.deviceId] = data.isActive
    lastDeviceStateUpdate[data.deviceId] = Date.now()
    const ctrlId = linkedController.value?.id
    if (ctrlId) {
      store.updateDeviceInCache(ctrlId, { id: data.deviceId, isActive: data.isActive })
    }
  }

  function handleSocketReconnect() {
    const ctrlId = linkedController.value?.id
    if (ctrlId) {
      store.fetchDevices(ctrlId)
    }
  }

  async function onDeviceToggle(
    deviceId: string,
    checked: boolean,
    pin: number,
  ): Promise<{ ok: boolean; reason?: string }> {
    deviceToggles[deviceId] = checked
    const action = checked ? 'ON' : 'OFF'

    const sock = liveTelemetry.socket.value
    if (sock?.connected) {
      return new Promise((resolve) => {
        sock.emit('ui_command', { action, deviceId, pin }, (ack: { ok: boolean } | null) => {
          if (!ack?.ok) {
            deviceToggles[deviceId] = !checked
            resolve({ ok: false, reason: 'Device command was not acknowledged' })
            return
          }
          resolve({ ok: true })
        })
      })
    }
    const controllerId = linkedController.value?.id
    if (!controllerId) {
      deviceToggles[deviceId] = !checked
      return { ok: false, reason: 'No controller linked' }
    }
    try {
      await store.sendDeviceCommand(deviceId, controllerId, action)
      return { ok: true }
    } catch {
      deviceToggles[deviceId] = !checked
      return { ok: false, reason: 'Device command failed' }
    }
  }

  async function onRuleToggle(ruleId: string): Promise<void> {
    // Re-throw on failure so the caller (tab component) can surface a toast.
    await automations.toggleRule(ruleId)
  }

  // ---------- Phase skip / end ----------
  const skipping = ref(false)
  const ending = ref(false)

  const canSkipPhase = computed(
    () =>
      Boolean(currentCycle.value?.startAt) &&
      activePhaseIndex.value >= 0 &&
      activePhaseIndex.value < sortedPhases.value.length - 1,
  )

  const isOnLastPhase = computed(
    () => activePhaseIndex.value >= 0 && activePhaseIndex.value === sortedPhases.value.length - 1,
  )

  // ---------- Watchers ----------
  watch(
    () => growDevices.value,
    (devices) => {
      if (devices) {
        for (const device of devices) {
          if (device.id) {
            deviceToggles[device.id] = device.isActive
          }
        }
      }
    },
    { deep: true, immediate: true },
  )

  watch(activePhaseIndex, () => {
    void loadActivePhaseEnv()
  })

  return {
    actionLabel,
    activeEnv,
    activeEnvConfigured,
    activePeriod,
    activePhaseIndex,
    activePhaseName,
    activePhaseSub,
    automations,
    automationsSummary,
    canSkipPhase,
    controllerStatusClass,
    co2Ppm,
    currentCycle,
    cycleId,
    cycleProgressPercent,
    daysRemaining,
    deviceToggles,
    ecMs,
    elapsedDays,
    ending,
    envFor,
    estimatedHarvestDate,
    fmtRange,
    fmtTarget,
    formatLastTriggered,
    growDevices,
    handleDeviceStateUpdate,
    handleSocketReconnect,
    humidityPercent,
    isGrowComplete,
    isOnLastPhase,
    lastDeviceStateUpdate,
    lightCountdownText,
    lightScheduleText,
    linkedController,
    liveTelemetry,
    loadActivePhaseEnv,
    nowTick,
    onDeviceToggle,
    onRuleToggle,
    phValue,
    proximityLabel,
    secondsTick,
    skipping,
    sortedPhases,
    temperatureC,
    totalDurationDays,
  }
}

export const GROW_MONITOR_STATE_KEY: InjectionKey<GrowMonitorState> = Symbol('growMonitorState')

export function provideGrowMonitorState(state: GrowMonitorState) {
  provide(GROW_MONITOR_STATE_KEY, state)
}

export function useProvidedGrowMonitorState(): GrowMonitorState {
  const state = inject(GROW_MONITOR_STATE_KEY)
  if (!state) {
    throw new Error('useProvidedGrowMonitorState() called outside a GrowMonitorView descendant.')
  }
  return state
}

// Re-export to satisfy callers that previously imported deriveGrowActive from growDates
// (kept here to make the public surface of the composable bundle obvious).
export { deriveGrowActive }
