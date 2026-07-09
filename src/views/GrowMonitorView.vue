<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '../stores/apiStore'
import type { Device, GrowPhase, PhaseEnvironment } from '../types/grow'
import { DayNightPeriod, SensorType } from '../types/grow'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { useLiveTelemetry } from '../composables/useLiveTelemetry'
import TelemetryChart from '../components/TelemetryChart.vue'
import { API_BASE } from '../stores/apiBase'
import {
  addDays,
  daysBetween,
  deriveActivePhaseIndex,
  deriveElapsedDays,
  deriveGrowActive,
  todayStr,
} from '../utils/growDates'
import { extractApiError } from '../utils/errors'
import { useToast } from 'primevue/usetoast'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputSwitch from 'primevue/inputswitch'
import ToggleSwitch from 'primevue/toggleswitch'
import Menu from 'primevue/menu'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import {
  actionLabel,
  proximityLabel,
  useAutomationMonitor,
} from '../composables/useAutomationMonitor'

const route = useRoute()
const router = useRouter()
const store = useApiStore()
const toast = useToast()

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
  return store.controllers.find((c) => c.id === cycle.controllerId) || (cycle.controller ?? null)
})

const linkedControllerDevices = computed<Device[]>(
  () =>
    (
      store.controllers.find((c) => c.id === linkedController.value?.id) as
        | ((typeof store.controllers)[number] & { devices?: Device[] })
        | undefined
    )?.devices ?? [],
)

const growDevices = computed<Device[]>(() => linkedControllerDevices.value)

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

const activePhaseIndex = computed(() => {
  const dateIdx = deriveActivePhaseIndex(sortedPhases.value)
  if (dateIdx !== -1) {
    return dateIdx
  }
  return sortedPhases.value.findIndex((p: GrowPhase) => p.isActive)
})

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

const deviceToggles = reactive<Record<string, boolean>>({})

// Socket.IO connection for device commands
let deviceCommandSocket: Socket | null = null

function connectDeviceSocket() {
  if (deviceCommandSocket) {
    if (!deviceCommandSocket.connected) {
      // Socket exists but disconnected — let reconnection handle it
    }
    return
  }
  const { origin } = new URL(API_BASE)
  deviceCommandSocket = io(origin, {
    ackTimeout: 10_000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling'],
  })
  deviceCommandSocket.on('connect_error', () => {
    console.warn('Device command socket connection failed, falling back to REST')
  })
}

function disconnectDeviceSocket() {
  if (deviceCommandSocket) {
    deviceCommandSocket.removeAllListeners()
    deviceCommandSocket.disconnect()
    deviceCommandSocket = null
  }
}

const confirm = useConfirm()
const phaseMenu = useTemplateRef<InstanceType<typeof Menu>>('phaseMenu')
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

const phaseMenuItems = computed(() => {
  if (isOnLastPhase.value) {
    return [
      {
        command: () => confirmEndGrow(),
        disabled: ending.value,
        icon: 'pi pi-trophy',
        label: 'End grow',
      },
    ]
  }
  return [
    {
      command: () => confirmSkipPhase(),
      disabled: !canSkipPhase.value || skipping.value,
      icon: 'pi pi-forward',
      label: 'Skip to next phase',
    },
  ]
})

function togglePhaseMenu(event: Event) {
  phaseMenu.value?.toggle(event)
}

function confirmSkipPhase() {
  if (!canSkipPhase.value) {
    return
  }
  const active = sortedPhases.value[activePhaseIndex.value]
  if (!active || !active.endAt) {
    return
  }
  const leftoverDays = daysBetween(todayStr(), active.endAt)
  const nextName = sortedPhases.value[activePhaseIndex.value + 1]?.name ?? 'next phase'
  confirm.require({
    accept: executeSkipPhase,
    acceptLabel: 'Skip phase',
    acceptProps: { severity: 'warn' },
    header: 'Skip to next phase',
    icon: 'pi pi-exclamation-triangle',
    message: `This will end "${active.name}" today and advance to "${nextName}". Approximately ${leftoverDays} day${leftoverDays === 1 ? '' : 's'} will be removed from the overall grow cycle. This cannot be undone.`,
    rejectLabel: 'Cancel',
  })
}

async function executeSkipPhase() {
  if (!cycleId.value) {
    return
  }
  skipping.value = true
  try {
    await store.skipGrowPhase(cycleId.value, todayStr())
  } catch (error) {
    console.error('Failed to skip grow phase', error)
    await store.fetchGrowCycle(cycleId.value)
  } finally {
    skipping.value = false
  }
}

function confirmEndGrow() {
  if (!isOnLastPhase.value) {
    return
  }
  const active = sortedPhases.value[activePhaseIndex.value]
  if (!active || !active.endAt) {
    return
  }
  const leftoverDays = daysBetween(todayStr(), active.endAt)
  confirm.require({
    accept: executeEndGrow,
    acceptLabel: 'End grow',
    acceptProps: { severity: 'danger' },
    header: 'End grow',
    icon: 'pi pi-exclamation-triangle',
    message: `This will end the grow cycle today. "${active.name}" will be trimmed to its elapsed days and the grow will be marked complete. Approximately ${leftoverDays} day${leftoverDays === 1 ? '' : 's'} will be removed from the overall cycle. This cannot be undone.`,
    rejectLabel: 'Cancel',
  })
}

async function executeEndGrow() {
  if (!cycleId.value) {
    return
  }
  ending.value = true
  try {
    await store.endGrow(cycleId.value, todayStr())
  } catch (error) {
    console.error('Failed to end grow', error)
    await store.fetchGrowCycle(cycleId.value)
  } finally {
    ending.value = false
  }
}

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

const controllerStatusClass = computed(() => {
  const status = linkedController.value?.status
  if (status === 'ONLINE') {
    return 'online'
  }
  if (status === 'ERROR') {
    return 'error'
  }
  return 'offline'
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

// ---------- Live telemetry via Socket.IO ----------

const liveTelemetry = useLiveTelemetry(() => cycleId.value)

const temperatureC = computed(() => liveTelemetry.getLatest(SensorType.TEMPERATURE)?.value ?? 0)
const humidityPercent = computed(() => liveTelemetry.getLatest(SensorType.HUMIDITY)?.value ?? 0)
const co2Ppm = computed(() => liveTelemetry.getLatest(SensorType.CO2)?.value ?? 0)
const ecMs = computed(() => liveTelemetry.getLatest(SensorType.EC)?.value ?? 0)
const phValue = computed(() => liveTelemetry.getLatest(SensorType.PH)?.value ?? 0)

// ---------- Active phase environment (Day/Night targets) ----------

const MINUTES_PER_HOUR_ENV = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR_ENV
const DEFAULT_DAY_START_MINUTES = 6 * MINUTES_PER_HOUR_ENV
const DEFAULT_DAY_DURATION_MINUTES = 18 * MINUTES_PER_HOUR_ENV

interface ActiveEnvState {
  day: PhaseEnvironment | null
  night: PhaseEnvironment | null
  loading: boolean
}

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

watch(activePhaseIndex, () => {
  loadActivePhaseEnv()
})

// Wall-clock period detection — tick once a minute so the "Active now" badge flips
// At the schedule boundary without a page reload.
const nowTick = ref(Date.now())
let envTickHandle: ReturnType<typeof setInterval> | null = null

// Second-level ticker for the light transition countdown.
const secondsTick = ref(Date.now())
let secondsTickHandle: ReturnType<typeof setInterval> | null = null

const currentMinutesIntoDay = computed(() => {
  // Read nowTick so this computed re-evaluates on the 60s interval.
  void nowTick.value
  const now = new Date()
  return now.getHours() * MINUTES_PER_HOUR_ENV + now.getMinutes()
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
  // Wrap-around (e.g. day starts 22:00, duration 12h → end = 1380, wraps to 10:00).
  return cur >= start || cur < end - MINUTES_PER_DAY ? 'DAY' : 'NIGHT'
})

const currentSecondsIntoDay = computed(() => {
  void secondsTick.value
  const now = new Date()
  return now.getHours() * MINUTES_PER_HOUR_ENV * 60 + now.getMinutes() * 60 + now.getSeconds()
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
  const startSec = start * MINUTES_PER_HOUR_ENV
  let endSec = (endMin % MINUTES_PER_DAY) * MINUTES_PER_HOUR_ENV
  if (endSec === 0 && endMin > 0) {
    endSec = MINUTES_PER_DAY * MINUTES_PER_HOUR_ENV
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
    diffSecs = startSec + MINUTES_PER_DAY * MINUTES_PER_HOUR_ENV - curSec
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
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${c.label} ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
})

const lightScheduleText = computed(() => {
  const idx = activePhaseIndex.value
  const phase = idx >= 0 ? sortedPhases.value[idx] : null
  const start = phase?.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES
  const duration = phase?.dayDurationMinutes ?? DEFAULT_DAY_DURATION_MINUTES
  const dayH = Math.round(duration / MINUTES_PER_HOUR_ENV)
  const nightH = 24 - dayH
  const onH = Math.floor(start / MINUTES_PER_HOUR_ENV)
  const onM = start % MINUTES_PER_HOUR_ENV
  const off = start + duration
  const offH = Math.floor((off % MINUTES_PER_DAY) / MINUTES_PER_HOUR_ENV)
  const offM = (off % MINUTES_PER_DAY) % MINUTES_PER_HOUR_ENV
  const fmt = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return `${fmt(onH, onM)} → ${fmt(offH, offM)} (${dayH}h day / ${nightH}h night)`
})

const activeEnvConfigured = computed(
  () => activeEnv.value.day !== null || activeEnv.value.night !== null,
)

function envFor(period: 'DAY' | 'NIGHT'): PhaseEnvironment | null {
  return period === 'DAY' ? activeEnv.value.day : activeEnv.value.night
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

// ---------- Automations (active phase rules) ----------

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

async function onRuleToggle(ruleId: string) {
  try {
    await automations.toggleRule(ruleId)
  } catch {
    const { message, status } = extractApiError(new Error('toggle failed'), 'Failed to toggle rule')
    if (status !== 0) {
      toast.add({ detail: message, life: 5000, severity: 'error', summary: 'Toggle failed' })
    }
  }
}

function barFillStyle(info: {
  currentValue: number | null
  thresholdValue: number | null
  rule: { condition: import('../types/grow').RuleCondition }
}): { width: string } {
  const { currentValue, thresholdValue, rule } = info
  if (currentValue == null || thresholdValue == null || thresholdValue === 0) {
    return { width: '0%' }
  }
  const ratio = currentValue / thresholdValue
  const clamped = Math.max(0, Math.min(1.5, ratio))
  return { width: `${(clamped / 1.5) * 100}%` }
}

function proximitySeverity(
  state: 'safe' | 'approaching' | 'firing' | 'unknown' | 'unset' | 'not-applicable',
): 'success' | 'warn' | 'danger' | 'secondary' {
  switch (state) {
    case 'safe': {
      return 'success'
    }
    case 'approaching': {
      return 'warn'
    }
    case 'firing': {
      return 'danger'
    }
    case 'unset': {
      return 'warn'
    }
    case 'unknown': {
      return 'secondary'
    }
    case 'not-applicable': {
      return 'secondary'
    }
  }
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

watch(
  () => growDevices.value,
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

async function onToggle(deviceId: string, checked: boolean, pin: number) {
  deviceToggles[deviceId] = checked
  const action = checked ? 'ON' : 'OFF'

  if (deviceCommandSocket?.connected) {
    deviceCommandSocket.emit(
      'ui_command',
      { action, deviceId, pin },
      (ack: { ok: boolean } | null) => {
        if (!ack?.ok) {
          deviceToggles[deviceId] = !checked
          toast.add({
            detail: 'Device command was not acknowledged',
            life: 5000,
            severity: 'error',
            summary: 'Command failed',
          })
        }
      },
    )
    return
  }
  // Fall back to REST
  const controllerId = linkedController.value?.id
  if (!controllerId) {
    return
  }
  try {
    await store.sendDeviceCommand(deviceId, controllerId, action)
  } catch (error) {
    deviceToggles[deviceId] = !checked
    const { message, status } = extractApiError(error, 'Device command failed')
    if (status !== 0) {
      toast.add({ detail: message, life: 5000, severity: 'error', summary: 'Command failed' })
    }
  }
}

async function reconcileGrowState(cycle: {
  id: string
  startAt: string | null
  isActive: boolean
  phases?: GrowPhase[]
}) {
  const phases = [...(cycle.phases ?? [])].toSorted((a, b) => a.order - b.order)

  function syncPhaseIntoCycle(updated: GrowPhase) {
    if (!updated.id) {
      return
    }
    const live: GrowPhase[] | undefined = currentCycle.value?.phases
    if (!live) {
      return
    }
    const liveIdx = live.findIndex((p: GrowPhase) => p.id === updated.id)
    if (liveIdx !== -1) {
      live[liveIdx] = { ...live[liveIdx], ...updated }
    }
  }
  const growActive = deriveGrowActive(cycle.startAt, phases)
  const activeIdx = deriveActivePhaseIndex(phases)
  const storedActive = phases.find((p) => p.isActive)

  if (activeIdx >= 0) {
    const target = phases[activeIdx]
    if (target && target.id && (!storedActive || storedActive.id !== target.id)) {
      const updated = await store.activateGrowPhase(target.id)
      const localIdx = phases.findIndex((p) => p.id === updated.id)
      if (localIdx !== -1) {
        phases[localIdx] = { ...phases[localIdx], ...updated }
        syncPhaseIntoCycle(updated)
      }
    }
  } else if (storedActive && storedActive.id) {
    const updated = await store.updateGrowPhase(storedActive.id, { isActive: false })
    const localIdx = phases.findIndex((p) => p.id === updated.id)
    if (localIdx !== -1) {
      phases[localIdx] = { ...phases[localIdx], ...updated }
      syncPhaseIntoCycle(updated)
    }
  }

  if (cycle.isActive !== growActive) {
    try {
      await store.updateGrowCycle(cycle.id, { isActive: growActive })
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
    const idx = store.growCycles.findIndex((g) => g.id === cycle.id)
    if (idx !== -1) {
      store.growCycles[idx] = {
        ...store.growCycles[idx],
        isActive: growActive,
      } as (typeof store.growCycles)[number]
    }
  }
}

onMounted(async () => {
  envTickHandle = setInterval(() => {
    nowTick.value = Date.now()
  }, 60_000)
  secondsTickHandle = setInterval(() => {
    secondsTick.value = Date.now()
  }, 1000)
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
      await store.fetchDevices(cycle.controllerId)
      store.pollDevices(cycle.controllerId)
      connectDeviceSocket()
    }
    await reconcileGrowState(cycle)
    await loadActivePhaseEnv()
    await automations.reload()
    liveTelemetry.start()
  }
})

onUnmounted(() => {
  if (envTickHandle) {
    clearInterval(envTickHandle)
    envTickHandle = null
  }
  if (secondsTickHandle) {
    clearInterval(secondsTickHandle)
    secondsTickHandle = null
  }
  store.stopDevicePolling()
  disconnectDeviceSocket()
})

function statusSeverity(status?: string) {
  return status === 'ONLINE' ? 'success' : 'danger'
}
</script>

<template>
  <ConfirmDialog />
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

    <Card class="status-hero">
      <template #content>
        <div v-if="linkedController" class="hero-strip">
          <div class="hero-group hero-controller">
            <span class="status-dot" :class="controllerStatusClass"></span>
            <div class="hero-controller-info">
              <span
                class="hero-controller-name"
                v-tooltip.top="`MAC: ${linkedController.macAddress}`"
              >
                {{ linkedController.name }}
              </span>
              <span class="hero-controller-ip">{{ linkedController.ipAddress }}</span>
            </div>
          </div>

          <div class="hero-divider"></div>

          <div class="hero-group hero-cycle">
            <Tag
              :value="currentCycle.isActive ? 'Running' : 'Idle'"
              :severity="currentCycle.isActive ? 'success' : 'secondary'"
              rounded
            />
            <div class="hero-cycle-info">
              <span class="hero-phase-name">{{ activePhaseName }}</span>
              <span class="hero-phase-sub">{{ activePhaseSub }}</span>
            </div>
          </div>

          <div class="hero-divider"></div>

          <div class="hero-group hero-progress">
            <div class="hero-progress-text">
              <span class="hero-progress-percent">{{ cycleProgressPercent }}%</span>
              <span class="hero-progress-days">
                {{ daysRemaining }} {{ daysRemaining === 1 ? 'day' : 'days' }} to harvest
                <template v-if="daysRemaining === 0"> — Complete</template>
              </span>
            </div>
            <div class="hero-progress-bar">
              <div class="hero-progress-fill" :style="{ width: cycleProgressPercent + '%' }"></div>
            </div>
            <div v-if="estimatedHarvestDate" class="hero-progress-footer">
              <span>{{ elapsedDays }} / {{ totalDurationDays }} days</span>
              <span>est. {{ estimatedHarvestDate }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state error">Controller linkage not configured.</div>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="section-title-row">
          <span>Climate</span>
          <span
            v-if="liveTelemetry.connected"
            class="socket-badge socket-badge--live"
            v-tooltip.top="'Receiving live telemetry'"
          >
            <i class="pi pi-circle-on"></i> Live
          </span>
          <span
            v-else
            class="socket-badge socket-badge--offline"
            v-tooltip.top="'No telemetry connection'"
          >
            <i class="pi pi-circle-off"></i> Offline
          </span>
        </div>
      </template>
      <template #content>
        <div class="climate-grid">
          <div class="hero-metric" v-tooltip.top="'Temperature sensor'">
            <i class="pi pi-sun hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ temperatureC.toFixed(1) }}<span class="hero-metric-unit">°C</span>
              </span>
              <span class="hero-metric-label">Temperature</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'Humidity sensor'">
            <i class="pi pi-cloud hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ humidityPercent.toFixed(0) }}<span class="hero-metric-unit">%</span>
              </span>
              <span class="hero-metric-label">Humidity</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'CO₂ sensor'">
            <i class="pi pi-globe hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ co2Ppm.toFixed(0) }}<span class="hero-metric-unit">ppm</span>
              </span>
              <span class="hero-metric-label">CO₂</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'EC sensor'">
            <i class="pi pi-bolt hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ ecMs.toFixed(0) }}<span class="hero-metric-unit">µS/cm</span>
              </span>
              <span class="hero-metric-label">Water EC</span>
            </div>
          </div>
          <div class="hero-metric" v-tooltip.top="'pH sensor'">
            <i class="pi pi-chart-line hero-metric-icon"></i>
            <div class="hero-metric-info">
              <span class="hero-metric-value">
                {{ phValue.toFixed(1) }}<span class="hero-metric-unit">pH</span>
              </span>
              <span class="hero-metric-label">Water pH</span>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Telemetry History</template>
      <template #content>
        <TelemetryChart v-if="cycleId" :growCycleId="cycleId" />
        <div v-else class="empty-state">No grow cycle selected.</div>
      </template>
    </Card>

    <Card>
      <template #title>Devices</template>
      <template #content>
        <div v-if="growDevices.length" class="device-grid">
          <div
            v-for="device in growDevices"
            :key="device.id"
            class="device-tile"
            :class="{ active: deviceToggles[device.id!] }"
          >
            <span class="device-name">{{ device.name }}</span>
            <ToggleSwitch
              :modelValue="deviceToggles[device.id!]"
              @update:modelValue="(val: boolean) => onToggle(device.id!, val, device.pinNumber)"
            />
          </div>
        </div>
        <div v-else class="empty-state">No devices configured for this grow cycle.</div>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="phase-card-title">
          <span>Phases</span>
          <Button
            v-if="activePhaseIndex >= 0"
            icon="pi pi-ellipsis-v"
            text
            rounded
            severity="secondary"
            size="small"
            aria-label="Phase options"
            :disabled="skipping || ending"
            @click="togglePhaseMenu"
          />
          <Menu ref="phaseMenu" :model="phaseMenuItems" popup />
        </div>
      </template>
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
              <span>{{ elapsedDays }} days</span>
              <span>{{ totalDurationDays }} days</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">No phases configured for this grow cycle.</div>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="env-card-title">
          <span>Environment — {{ activePhaseName }}</span>
          <Tag
            v-if="activePhaseIndex >= 0 && activeEnvConfigured"
            :value="activePeriod"
            severity="success"
            rounded
            v-tooltip.top="'Currently active day/night period'"
          />
          <span
            v-if="activePhaseIndex >= 0"
            class="light-schedule"
            v-tooltip.top="'Light cycle for this phase'"
          >
            <i class="pi pi-sun light-schedule-icon"></i>
            {{ lightScheduleText }}
          </span>
          <span v-if="lightTransitionCountdown" class="light-countdown">
            {{ lightCountdownText }}
          </span>
        </div>
      </template>
      <template #content>
        <div v-if="activeEnv.loading" class="env-loading">
          <i class="pi pi-spin pi-spinner" /> Loading environment…
        </div>
        <div v-else-if="!activeEnvConfigured" class="empty-state">
          No environment configured for this phase.
        </div>
        <div v-else class="env-stack">
          <div
            v-for="period in ['DAY', 'NIGHT'] as const"
            :key="period"
            class="env-block"
            :class="{ 'env-block--active': period === activePeriod }"
          >
            <div class="env-block-header">
              <span class="env-block-title">{{ period }}</span>
              <Tag v-if="period === activePeriod" value="Active now" severity="success" rounded />
            </div>
            <div class="env-block-rows">
              <div class="env-row">
                <span class="env-row-label">Temperature</span>
                <span class="env-row-target"
                  >{{ fmtTarget(envFor(period)?.tempTarget ?? null) }} °C</span
                >
                <span class="env-row-range"
                  >{{
                    fmtRange(envFor(period)?.tempMin ?? null, envFor(period)?.tempMax ?? null)
                  }}
                  °C</span
                >
              </div>
              <div class="env-row">
                <span class="env-row-label">Humidity</span>
                <span class="env-row-target"
                  >{{ fmtTarget(envFor(period)?.humidityTarget ?? null) }} %</span
                >
                <span class="env-row-range"
                  >{{
                    fmtRange(
                      envFor(period)?.humidityMin ?? null,
                      envFor(period)?.humidityMax ?? null,
                    )
                  }}
                  %</span
                >
              </div>
              <div class="env-row">
                <span class="env-row-label">CO₂</span>
                <span class="env-row-target"
                  >{{ fmtTarget(envFor(period)?.co2Target ?? null) }} ppm</span
                >
                <span class="env-row-range"
                  >{{
                    fmtRange(envFor(period)?.co2Min ?? null, envFor(period)?.co2Max ?? null)
                  }}
                  ppm</span
                >
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="auto-card-title">
          <span>Automations — {{ activePhaseName }}</span>
          <Tag
            v-if="activePhaseIndex >= 0 && automations.hasRules"
            :value="activePeriod"
            severity="success"
            rounded
            v-tooltip.top="'Currently active day/night period'"
          />
        </div>
      </template>
      <template #content>
        <div v-if="automations.loading" class="auto-loading">
          <i class="pi pi-spin pi-spinner" /> Loading automations…
        </div>
        <div v-else-if="activePhaseIndex < 0" class="empty-state">
          No active phase — automations are scoped to a phase.
        </div>
        <div v-else-if="!automations.hasRules" class="empty-state">
          No automation rules configured for this phase.
        </div>
        <div v-else class="auto-content">
          <div v-for="group in automations.groups" :key="group.key" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">{{ group.label }}</span>
              <span class="auto-group-reading">
                <span class="auto-group-reading-value">{{ group.currentReading }}</span>
              </span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in group.rules"
                :key="info.rule.id"
                class="auto-rule"
                :class="{ 'auto-rule--disabled': !info.rule.enabled }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <div class="auto-rule-status">
                    <Tag
                      v-if="!info.rule.enabled"
                      value="OFF"
                      severity="secondary"
                      rounded
                      class="auto-rule-off-tag"
                    />
                    <span class="auto-rule-current" :class="`auto-rule-current--${info.proximity}`">
                      {{ info.currentValue ?? '—' }}{{ info.unit }}
                    </span>
                    <Tag
                      v-if="info.thresholdValue != null"
                      :value="proximityLabel(info.proximity)"
                      :severity="proximitySeverity(info.proximity)"
                      rounded
                    />
                    <i
                      v-else
                      class="pi pi-exclamation-triangle auto-rule-warn-icon"
                      v-tooltip.top="
                        'Threshold not set on active period environment — this rule will never fire.'
                      "
                    ></i>
                  </div>
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="automations.loading"
                    @update:modelValue="onRuleToggle(info.rule.id)"
                  />
                </div>
                <div class="auto-rule-row2">
                  <span class="auto-rule-cond"
                    >{{ info.conditionShort }} → {{ actionLabel(info.rule.action) }}</span
                  >
                  <div v-if="info.thresholdValue != null" class="auto-rule-mini">
                    <div class="auto-rule-mini-bar">
                      <div
                        class="auto-rule-mini-fill"
                        :class="`auto-rule-mini-fill--${info.proximity}`"
                        :style="barFillStyle(info)"
                      ></div>
                      <div class="auto-rule-mini-tick" :style="{ left: '66.66%' }"></div>
                    </div>
                    <span class="auto-rule-mini-text"
                      >{{ info.thresholdValue }}{{ info.unit }}</span
                    >
                  </div>
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                  <i
                    class="pi pi-info-circle auto-rule-info"
                    v-tooltip.top="
                      info.rule.lastTriggeredAt
                        ? `Last triggered: ${formatLastTriggered(info.rule.lastTriggeredAt)}`
                        : 'Never triggered'
                    "
                  ></i>
                </div>
              </div>
            </div>
          </div>

          <div v-if="automations.pinnedRules.length" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">Pinned</span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in automations.pinnedRules"
                :key="info.rule.id"
                class="auto-rule auto-rule--pinned"
                :class="{
                  'auto-rule--disabled': !info.rule.enabled,
                }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <Tag
                    v-if="!info.rule.enabled"
                    value="OFF"
                    severity="secondary"
                    rounded
                    class="auto-rule-off-tag"
                  />
                  <span class="auto-rule-cond">{{ info.conditionShort }}</span>
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="automations.loading"
                    @update:modelValue="onRuleToggle(info.rule.id)"
                  />
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                  <i
                    class="pi pi-info-circle auto-rule-info"
                    v-tooltip.top="
                      info.rule.lastTriggeredAt
                        ? `Last triggered: ${formatLastTriggered(info.rule.lastTriggeredAt)}`
                        : 'Never triggered'
                    "
                  ></i>
                </div>
              </div>
            </div>
          </div>

          <div v-if="automations.intervalRules.length" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">Interval</span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in automations.intervalRules"
                :key="info.rule.id"
                class="auto-rule auto-rule--pinned"
                :class="{
                  'auto-rule--disabled': !info.rule.enabled,
                }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <Tag
                    v-if="!info.rule.enabled"
                    value="OFF"
                    severity="secondary"
                    rounded
                    class="auto-rule-off-tag"
                  />
                  <span class="auto-rule-cond"
                    >{{ info.conditionShort }} → {{ actionLabel(info.rule.action) }}</span
                  >
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="automations.loading"
                    @update:modelValue="onRuleToggle(info.rule.id)"
                  />
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                  <i
                    class="pi pi-info-circle auto-rule-info"
                    v-tooltip.top="
                      info.rule.lastTriggeredAt
                        ? `Last triggered: ${formatLastTriggered(info.rule.lastTriggeredAt)}`
                        : 'Never triggered'
                    "
                  ></i>
                </div>
              </div>
            </div>
          </div>

          <div v-if="automations.scheduleRules.length" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">Schedule</span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in automations.scheduleRules"
                :key="info.rule.id"
                class="auto-rule auto-rule--pinned"
                :class="{
                  'auto-rule--disabled': !info.rule.enabled,
                }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <Tag
                    v-if="!info.rule.enabled"
                    value="OFF"
                    severity="secondary"
                    rounded
                    class="auto-rule-off-tag"
                  />
                  <span class="auto-rule-cond">{{ info.conditionShort }}</span>
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="automations.loading"
                    @update:modelValue="onRuleToggle(info.rule.id)"
                  />
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                  <i
                    class="pi pi-info-circle auto-rule-info"
                    v-tooltip.top="
                      info.rule.lastTriggeredAt
                        ? `Last triggered: ${formatLastTriggered(info.rule.lastTriggeredAt)}`
                        : 'Never triggered'
                    "
                  ></i>
                </div>
              </div>
            </div>
          </div>
        </div>
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

.meta-code {
  background: var(--color-code-bg);
  padding: 0.1875rem 0.4375rem;
  border-radius: var(--radius-sm);
  color: var(--color-code-text);
  font-size: var(--text-base);
  border: 1px solid var(--color-border);
}

.status-hero :deep(.p-card-body) {
  padding: var(--space-4) var(--space-5);
}

.status-hero {
  border-top: 2px solid var(--color-accent);
}

.hero-strip {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.hero-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.hero-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border);
  flex-shrink: 0;
}

.hero-controller-info,
.hero-cycle-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.hero-controller-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
  cursor: help;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.hero-controller-ip {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.hero-phase-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-phase-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: 500;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
  animation: pulse-dot 2s var(--ease-default) infinite;
}

.status-dot.offline {
  background: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-bg);
}

.status-dot.error {
  background: var(--color-warning);
  box-shadow: 0 0 0 3px var(--color-warning-bg);
}

.hero-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 200px;
}

.hero-progress-text {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.hero-progress-percent {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-accent);
  font-family: var(--font-mono);
  line-height: 1;
}

.hero-progress-days {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.hero-progress-bar {
  width: 100%;
  max-width: 220px;
  height: 4px;
  background: var(--color-track-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.hero-progress-fill {
  height: 100%;
  background: var(--color-track-fill);
  border-radius: var(--radius-sm);
  transition: width var(--duration-slow) var(--ease-default);
  box-shadow: 0 0 8px var(--color-accent-glow);
}

.hero-progress-footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.climate-grid {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  width: 100%;
}

.hero-metric {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: help;
  flex: 1;
  min-width: 140px;
}

.hero-metric-icon {
  font-size: var(--text-xl);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.hero-metric-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.hero-metric-value {
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  line-height: 1;
}

.hero-metric-unit {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 500;
  margin-left: 0.125rem;
}

.hero-metric-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: 500;
}

.env-card-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.light-schedule {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.light-schedule-icon {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.light-countdown {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-weight: 600;
}

.env-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  padding: var(--space-2) 0;
}

.env-stack {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

@media (max-width: 640px) {
  .env-stack {
    grid-template-columns: 1fr;
  }
}

.env-block {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border-left-width: 3px;
  transition:
    border-color var(--duration-normal) var(--ease-default),
    background var(--duration-normal) var(--ease-default);
}

.env-block--active {
  border-left-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 6%, var(--color-bg-elevated));
}

.env-block-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  justify-content: space-between;
}

.env-block-title {
  font-size: var(--text-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.env-block-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.env-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: baseline;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.env-row-label {
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: var(--text-xs);
  font-weight: 500;
}

.env-row-target {
  font-weight: 700;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.env-row-range {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

@media (max-width: 767px) {
  .hero-strip {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  .hero-divider {
    display: none;
  }
  .hero-progress,
  .hero-progress-bar,
  .climate-grid {
    width: 100%;
  }
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

.phase-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
}

.auto-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
}

.auto-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--color-text-muted);
}

.auto-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auto-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.auto-group-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
}

.auto-group-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
}

.auto-group-reading {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.auto-group-reading-value {
  color: var(--color-accent);
  font-weight: 600;
}

.auto-rules {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

@media (max-width: 860px) {
  .auto-rules {
    grid-template-columns: 1fr;
  }
}

.auto-rule {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  transition: all var(--duration-normal) var(--ease-default);
  min-width: 0;
}

.auto-rule--disabled {
  opacity: 0.7;
  border-style: dashed;
  border-color: var(--color-text-muted);
}

.auto-rule--legacy {
  border-style: dashed;
}

.auto-rule :deep(.p-toggleswitch) {
  transform: scale(0.75);
  transform-origin: center;
}

.auto-rule-row1 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.auto-rule-device {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 0 1 auto;
}

.auto-rule-icon {
  color: var(--color-accent);
  font-size: var(--text-md);
  flex-shrink: 0;
}

.auto-rule-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auto-rule-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 0 0 auto;
  margin-left: auto;
  min-width: 0;
}

.auto-rule-current {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
}

.auto-rule-current--safe {
  color: var(--color-success);
}

.auto-rule-current--approaching {
  color: var(--color-warning);
}

.auto-rule-current--firing {
  color: var(--color-danger);
}

.auto-rule-current--unset,
.auto-rule-current--unknown,
.auto-rule-current--not-applicable {
  color: var(--color-text-muted);
}

.auto-rule-warn-icon {
  color: var(--color-warning);
  font-size: var(--text-sm);
}

.auto-rule-off-tag {
  font-size: 0.625rem;
  padding: 0 0.4rem;
}

.auto-rule-row2 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  min-width: 0;
}

.auto-rule-cond {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 0 1 auto;
}

.auto-rule-mini {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex: 0 0 auto;
  min-width: 0;
}

.auto-rule-mini-bar {
  position: relative;
  width: 48px;
  height: 4px;
  background: var(--color-track-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.auto-rule-mini-fill {
  height: 100%;
  border-radius: var(--radius-sm);
  transition:
    width var(--duration-slow) var(--ease-default),
    background var(--duration-normal) var(--ease-default);
}

.auto-rule-mini-fill--safe {
  background: var(--color-success);
}

.auto-rule-mini-fill--approaching {
  background: var(--color-warning);
}

.auto-rule-mini-fill--firing {
  background: var(--color-danger);
}

.auto-rule-mini-fill--unset,
.auto-rule-mini-fill--unknown,
.auto-rule-mini-fill--not-applicable {
  background: var(--color-bg-muted);
}

.auto-rule-mini-tick {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--color-text-secondary);
  opacity: 0.6;
  transform: translateX(-1px);
}

.auto-rule-mini-text {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.auto-rule-period {
  padding: 0.0625rem var(--space-2);
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  font-size: 0.625rem;
  color: var(--color-text-secondary);
  flex: 0 0 auto;
  margin-left: auto;
}

.auto-rule-info {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  cursor: help;
  flex: 0 0 auto;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.socket-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 0.125rem var(--space-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
}

.socket-badge--live {
  color: var(--color-success);
}

.socket-badge--offline {
  color: var(--color-text-muted);
}

.socket-badge i {
  font-size: 0.5rem;
}
</style>
