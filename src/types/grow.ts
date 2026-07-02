export enum DeviceType {
  LIGHT = 'LIGHT',
  EXHAUST_FAN = 'EXHAUST_FAN',
  INTAKE_FAN = 'INTAKE_FAN',
  CIRCULATION_FAN = 'CIRCULATION_FAN',
  WATER_PUMP = 'WATER_PUMP',
  AIR_CONDITIONER = 'AIR_CONDITIONER',
  HEATER = 'HEATER',
  HUMIDIFIER = 'HUMIDIFIER',
  DEHUMIDIFIER = 'DEHUMIDIFIER',
  CO2_INJECTOR = 'CO2_INJECTOR',
}

export enum SensorType {
  HUMIDITY = 'HUMIDITY',
  TEMPERATURE = 'TEMPERATURE',
  TEMP_HUMIDITY = 'TEMP_HUMIDITY',
  CO2 = 'CO2',
  PH = 'PH',
  EC = 'EC',
}

export enum SensorProtocol {
  I2C = 'I2C',
  SPI = 'SPI',
  UART = 'UART',
  RS485 = 'RS485',
}

export enum AutomationMode {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
  THRESHOLD = 'THRESHOLD',
  ALWAYS_ON = 'ALWAYS_ON',
  ALWAYS_OFF = 'ALWAYS_OFF',
}

export enum DayNightPeriod {
  DAY = 'DAY',
  NIGHT = 'NIGHT',
}

export enum RuleCondition {
  ABOVE_MAX = 'ABOVE_MAX',
  BELOW_MIN = 'BELOW_MIN',
  BELOW_MAX = 'BELOW_MAX',
  ABOVE_MIN = 'ABOVE_MIN',
  ABOVE_TARGET = 'ABOVE_TARGET',
  BELOW_TARGET = 'BELOW_TARGET',
  ALWAYS_ON = 'ALWAYS_ON',
  ALWAYS_OFF = 'ALWAYS_OFF',
  INTERVAL = 'INTERVAL',
}

export enum DeviceAction {
  ON = 'ON',
  OFF = 'OFF',
}

export interface Device {
  id: string
  controllerId: string
  name: string
  type: DeviceType
  pinNumber: number
  mqttTopic: string
  automationMode: AutomationMode
  isActive: boolean
  createdAt: string
  updatedAt: string
  controller?: Controller
  localKey?: string
}

export interface DeviceSeed {
  name: string
  type: DeviceType
  pinNumber: number
  mqttTopic: string
  automationMode?: AutomationMode
  isActive?: boolean
}

export interface Sensor {
  id: string
  controllerId: string
  name: string
  type: SensorType
  mqttTopic: string
  pinNumbers: number[]
  protocol: SensorProtocol
  lastActive?: string | null
  createdAt: string
  updatedAt: string
  localKey?: string
}

export interface SensorSeed {
  name: string
  type: SensorType
  mqttTopic: string
  pinNumbers: number[]
  protocol: SensorProtocol
}

export interface Controller {
  id: string
  macAddress: string
  ipAddress: string
  name: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  growCycles?: GrowCycle[]
  sensors?: Sensor[]
  devices?: Device[]
  createdAt: string
  updatedAt: string
}

export interface GrowCycleListItem {
  id: string
  controllerId: string
  name: string
  isActive: boolean
  startAt: string | null
  createdAt: string
  updatedAt: string
  controller: {
    name: string
    status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  }
}

export interface GrowCycle {
  id: string
  controllerId: string
  name: string
  isActive: boolean
  startAt: string | null
  createdAt: string
  updatedAt: string
  controller?: Controller
  phases?: GrowPhase[]
}

export interface PhaseEnvironment {
  id: string
  growPhaseId: string
  period: DayNightPeriod
  tempMin: number | null
  tempMax: number | null
  tempTarget: number | null
  humidityMin: number | null
  humidityMax: number | null
  humidityTarget: number | null
  co2Min: number | null
  co2Max: number | null
  co2Target: number | null
  createdAt: string
  updatedAt: string
}

export interface PhaseEnvironmentPayload {
  tempMin?: number | null
  tempMax?: number | null
  tempTarget?: number | null
  humidityMin?: number | null
  humidityMax?: number | null
  humidityTarget?: number | null
  co2Min?: number | null
  co2Max?: number | null
  co2Target?: number | null
}

export interface GrowPhase {
  id?: string
  growCycleId?: string
  name: string
  order: number
  durationDays: number
  dayStartMinutes?: number
  dayDurationMinutes?: number
  isActive: boolean
  startAt: string | null
  endAt: string | null
  environments?: PhaseEnvironment[]
  createdAt?: string
  updatedAt?: string
  localKey?: string
}

export interface AutomationRule {
  id: string
  growCycleId: string | null
  growPhaseId: string | null
  deviceId: string
  watchedSensorType: SensorType | null
  period: DayNightPeriod | null
  condition: RuleCondition
  action: DeviceAction
  cooldownSeconds: number
  intervalOnSeconds: number | null
  intervalCycleSeconds: number | null
  enabled: boolean
  lastTriggeredAt: string | null
  createdAt: string
  updatedAt: string
  device?: Device
}

export interface CreateAutomationRulePayload {
  growPhaseId: string
  deviceId: string
  watchedSensorType: SensorType | null
  period: DayNightPeriod | null
  condition: RuleCondition
  action: DeviceAction
  cooldownSeconds?: number
  intervalOnSeconds?: number
  intervalCycleSeconds?: number
  enabled?: boolean
}

export interface UpdateAutomationRulePayload {
  deviceId?: string
  watchedSensorType?: SensorType | null
  period?: DayNightPeriod | null
  condition?: RuleCondition
  action?: DeviceAction
  cooldownSeconds?: number
  intervalOnSeconds?: number | null
  intervalCycleSeconds?: number | null
  enabled?: boolean
}

export interface Telemetry {
  id: string
  growCycleId: string
  sensorType: string
  value: number
  createdAt: string
}

export interface DeviceStateLog {
  id: string
  deviceId: string
  action: DeviceAction
  source: 'MANUAL' | 'AUTO' | 'UI'
  reason: string | null
  createdAt: string
}

// TODO: when a device history view is built, render `reason` tolerating new
// AUTO reason strings: "day cycle start (phase <id>)", "night cycle start
// (phase <id>)", "ALWAYS_ON rule (<id>)", "ALWAYS_OFF rule (<id>)" (alongside
// The existing "TEMPERATURE 31.2 > max 28 (DAY)" and "state confirmed").
