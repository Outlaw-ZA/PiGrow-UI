import { TriggerType } from '@/types/grow'

export interface ScheduleConfigData {
  onTime: string
  durationHours: number
}

export interface ThresholdConfigData {
  metric: string
  high: number
}

export interface ConfigFormState {
  id?: string
  triggerType: TriggerType
  onTime: string
  durationHours: number
  metric: string
  high: number
  dirty: boolean
}

export const TRIGGER_TYPE_OPTIONS: { label: string; value: TriggerType }[] = [
  { label: 'Schedule', value: TriggerType.SCHEDULE },
  { label: 'Threshold', value: TriggerType.THRESHOLD },
  { label: 'Always On', value: TriggerType.ALWAYS_ON },
  { label: 'Always Off', value: TriggerType.ALWAYS_OFF },
]

function isScheduleShape(
  data: Record<string, unknown>,
): data is { onTime: string; durationHours?: number; offTime?: string } {
  return 'onTime' in data
}

function isThresholdCanonicalShape(
  data: Record<string, unknown>,
): data is { metric: string; high: number } {
  return 'metric' in data && 'high' in data
}

function isThresholdAltShape(
  data: Record<string, unknown>,
): data is { sensor: string; condition: string; value: number; action: string } {
  return 'sensor' in data && 'condition' in data && 'value' in data && 'action' in data
}

export function normalizeScheduleConfig(data: Record<string, unknown>): ScheduleConfigData {
  if (!isScheduleShape(data)) {
    return { durationHours: 0, onTime: '00:00' }
  }
  if (typeof data.durationHours === 'number') {
    return { durationHours: data.durationHours, onTime: data.onTime }
  }
  if (typeof data.offTime === 'string') {
    const hours = computeDurationHours(data.onTime, data.offTime)
    return { durationHours: hours, onTime: data.onTime }
  }
  return { durationHours: 0, onTime: data.onTime }
}

export function normalizeThresholdConfig(data: Record<string, unknown>): ThresholdConfigData {
  if (isThresholdCanonicalShape(data)) {
    return { high: data.high, metric: data.metric }
  }
  if (isThresholdAltShape(data)) {
    return { high: data.value, metric: data.sensor }
  }
  return { high: 0, metric: '' }
}

function computeDurationHours(onTime: string, offTime: string): number {
  const [onH = 0, onM = 0] = onTime.split(':').map(Number)
  const [offH = 0, offM = 0] = offTime.split(':').map(Number)
  let minutes = offH * 60 + offM - (onH * 60 + onM)
  if (minutes < 0) {
    minutes += 24 * 60
  }
  return Math.round((minutes / 60) * 10) / 10
}

export function defaultConfigForm(): ConfigFormState {
  return {
    dirty: false,
    durationHours: 18,
    high: 0,
    metric: '',
    onTime: '06:00',
    triggerType: TriggerType.SCHEDULE,
  }
}

export function buildConfigPayload(form: ConfigFormState): {
  triggerType: TriggerType
  configData: Record<string, unknown>
} {
  switch (form.triggerType) {
    case TriggerType.SCHEDULE: {
      return {
        configData: { durationHours: form.durationHours, onTime: form.onTime },
        triggerType: TriggerType.SCHEDULE,
      }
    }
    case TriggerType.THRESHOLD: {
      return {
        configData: { high: form.high, metric: form.metric },
        triggerType: TriggerType.THRESHOLD,
      }
    }
    case TriggerType.ALWAYS_ON:
    case TriggerType.ALWAYS_OFF: {
      return {
        configData: {},
        triggerType: form.triggerType,
      }
    }
  }
}

export const TRIGGER_TYPE_LABEL: Record<TriggerType, string> = {
  [TriggerType.SCHEDULE]: 'Schedule',
  [TriggerType.THRESHOLD]: 'Threshold',
  [TriggerType.ALWAYS_ON]: 'Always On',
  [TriggerType.ALWAYS_OFF]: 'Always Off',
}

export const TRIGGER_TYPE_SEVERITY: Record<TriggerType, 'info' | 'warn' | 'success' | 'secondary'> =
  {
    [TriggerType.SCHEDULE]: 'info',
    [TriggerType.THRESHOLD]: 'warn',
    [TriggerType.ALWAYS_ON]: 'success',
    [TriggerType.ALWAYS_OFF]: 'secondary',
  }

export function formatConfigSummary(
  triggerType: TriggerType,
  configData: Record<string, unknown>,
): string {
  switch (triggerType) {
    case TriggerType.SCHEDULE: {
      const sched = normalizeScheduleConfig(configData)
      const hours =
        sched.durationHours % 1 === 0 ? sched.durationHours : sched.durationHours.toFixed(1)
      return `On @ ${sched.onTime} · ${hours}h`
    }
    case TriggerType.THRESHOLD: {
      const thresh = normalizeThresholdConfig(configData)
      return `${thresh.metric || '—'} > ${thresh.high}`
    }
    case TriggerType.ALWAYS_ON: {
      return 'Always On'
    }
    case TriggerType.ALWAYS_OFF: {
      return 'Always Off'
    }
  }
}
