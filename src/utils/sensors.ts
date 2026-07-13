import { RuleCondition, SensorProtocol, SensorType } from '../types/grow'
import type { AutomationRule, PhaseEnvironment } from '../types/grow'

export const SENSOR_TYPE_OPTIONS: { label: string; value: SensorType }[] = [
  { label: 'Humidity', value: SensorType.HUMIDITY },
  { label: 'Temperature', value: SensorType.TEMPERATURE },
  { label: 'Temp + Humidity', value: SensorType.TEMP_HUMIDITY },
  { label: 'CO₂', value: SensorType.CO2 },
  { label: 'pH', value: SensorType.PH },
  { label: 'EC', value: SensorType.EC },
]

export const SENSOR_PROTOCOL_OPTIONS: { label: string; value: SensorProtocol }[] = [
  { label: 'I²C', value: SensorProtocol.I2C },
  { label: 'SPI', value: SensorProtocol.SPI },
  { label: 'UART', value: SensorProtocol.UART },
  { label: 'RS-485', value: SensorProtocol.RS485 },
]

export const SENSOR_PIN_OPTIONS: { label: string; value: number }[] = Array.from(
  { length: 40 },
  (_, i) => ({
    label: String(i + 1),
    value: i + 1,
  }),
)

export function formatSensorType(type: SensorType | null | undefined): string {
  if (type == null) {
    return '—'
  }
  return SENSOR_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

export function formatSensorProtocol(protocol: SensorProtocol): string {
  return SENSOR_PROTOCOL_OPTIONS.find((o) => o.value === protocol)?.label ?? protocol
}

export function defaultSensorForm(): {
  name: string
  type: SensorType
  pinNumbers: number[]
  protocol: SensorProtocol
} {
  return {
    name: '',
    pinNumbers: [],
    protocol: SensorProtocol.I2C,
    type: SensorType.TEMP_HUMIDITY,
  }
}

export interface BoundaryKey {
  min: 'tempMin' | 'humidityMin' | 'co2Min'
  max: 'tempMax' | 'humidityMax' | 'co2Max'
  target: 'tempTarget' | 'humidityTarget' | 'co2Target'
  label: string
  unit: string
  payloadKey: 'temp' | 'humidity' | 'co2'
}

const BOUNDARY_MAP: Partial<Record<SensorType, BoundaryKey>> = {
  [SensorType.TEMPERATURE]: {
    label: 'Temperature',
    max: 'tempMax',
    min: 'tempMin',
    payloadKey: 'temp',
    target: 'tempTarget',
    unit: '°C',
  },
  [SensorType.TEMP_HUMIDITY]: {
    label: 'Temperature',
    max: 'tempMax',
    min: 'tempMin',
    payloadKey: 'temp',
    target: 'tempTarget',
    unit: '°C',
  },
  [SensorType.HUMIDITY]: {
    label: 'Humidity',
    max: 'humidityMax',
    min: 'humidityMin',
    payloadKey: 'humidity',
    target: 'humidityTarget',
    unit: '%',
  },
  [SensorType.CO2]: {
    label: 'CO₂',
    max: 'co2Max',
    min: 'co2Min',
    payloadKey: 'co2',
    target: 'co2Target',
    unit: 'ppm',
  },
}

export function getBoundaryKey(sensorType: SensorType): BoundaryKey | null {
  return BOUNDARY_MAP[sensorType] ?? null
}

export const THRESHOLD_RELEVANT_SENSOR_TYPES: SensorType[] = [
  SensorType.TEMPERATURE,
  SensorType.TEMP_HUMIDITY,
  SensorType.HUMIDITY,
  SensorType.CO2,
]

export type BoundarySide = 'min' | 'max' | 'target'

export function conditionToBoundarySide(condition: RuleCondition): BoundarySide | null {
  switch (condition) {
    case RuleCondition.ABOVE_MAX:
    case RuleCondition.BELOW_MAX: {
      return 'max'
    }
    case RuleCondition.BELOW_MIN:
    case RuleCondition.ABOVE_MIN: {
      return 'min'
    }
    case RuleCondition.ABOVE_TARGET:
    case RuleCondition.BELOW_TARGET: {
      return 'target'
    }
    default: {
      return null
    }
  }
}

export function isRuleBoundarySet(rule: AutomationRule, env: PhaseEnvironment | null): boolean {
  if (rule.watchedSensorType == null) {
    return true
  }
  const boundary = getBoundaryKey(rule.watchedSensorType)
  if (!boundary) {
    return true
  }
  const side = conditionToBoundarySide(rule.condition)
  if (!side) {
    return true
  }
  if (!env) {
    return false
  }
  const fieldKey = boundary[side]
  return env[fieldKey] != null
}
