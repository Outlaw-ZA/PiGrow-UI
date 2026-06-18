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

export enum TriggerType {
  SCHEDULE = 'SCHEDULE',
  THRESHOLD = 'THRESHOLD',
  ALWAYS_ON = 'ALWAYS_ON',
  ALWAYS_OFF = 'ALWAYS_OFF',
}

export interface Controller {
  id: string
  macAddress: string
  ipAddress: string
  name: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  devices?: Device[]
  growCycles?: GrowCycle[]
  createdAt: string
  updatedAt: string
}

export interface Device {
  id: string
  controllerId: string
  name: string
  type: DeviceType
  pinNumber: number
  mqttTopic: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GrowCycleListItem {
  id: string
  controllerId: string
  name: string
  isActive: boolean
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
  createdAt: string
  updatedAt: string
  controller?: Controller
  phases?: GrowPhase[]
}

export interface GrowPhase {
  id?: string
  growCycleId?: string
  name: string
  order: number
  durationDays: number
  isActive: boolean
  startAt: string | null
  endAt: string | null
  createdAt?: string
  updatedAt?: string
  deviceConfigs?: DeviceConfig[]
}

export interface DeviceConfig {
  id?: string
  growPhaseId: string
  deviceId: string
  triggerType: TriggerType
  configData: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
  device?: Device
}

export interface Telemetry {
  id: string
  growCycleId: string
  sensorType: string
  value: number
  createdAt: string
}
