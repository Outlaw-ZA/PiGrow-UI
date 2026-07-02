import { DeviceAction, DeviceType, RuleCondition } from '../types/grow'
import type {
  CreateAutomationRulePayload,
  DayNightPeriod,
  Device,
  SensorType,
  UpdateAutomationRulePayload,
} from '../types/grow'

export interface RuleDraft {
  deviceId: string | null
  watchedSensorType: SensorType | null
  condition: RuleCondition
  period: DayNightPeriod | null
  action: DeviceAction
  cooldownSeconds: number
  intervalOnSeconds: number | null
  intervalCycleSeconds: number | null
}

const THRESHOLD = new Set<RuleCondition>([
  RuleCondition.ABOVE_MAX,
  RuleCondition.BELOW_MIN,
  RuleCondition.BELOW_MAX,
  RuleCondition.ABOVE_MIN,
  RuleCondition.ABOVE_TARGET,
  RuleCondition.BELOW_TARGET,
])

export function validateRuleDraft(d: RuleDraft, devices: Device[]): string | null {
  if (!d.deviceId) {
    return 'Select a device.'
  }
  const device = devices.find((x) => x.id === d.deviceId)
  if (device && device.type === DeviceType.LIGHT) {
    return 'LIGHT devices are not eligible for automation rules; light scheduling is driven by the grow-phase day/night clock'
  }
  if (d.condition === RuleCondition.INTERVAL) {
    if (d.action !== DeviceAction.ON) {
      return 'action must be ON for condition INTERVAL'
    }
    if (d.watchedSensorType != null) {
      return 'watchedSensorType must be null for INTERVAL rules'
    }
    if (d.intervalOnSeconds == null || d.intervalOnSeconds < 1) {
      return 'intervalOnSeconds is required for INTERVAL rules'
    }
    if (d.intervalCycleSeconds == null || d.intervalCycleSeconds < 2) {
      return 'intervalCycleSeconds is required for INTERVAL rules'
    }
    if (d.intervalCycleSeconds <= d.intervalOnSeconds) {
      return 'intervalCycleSeconds must be greater than intervalOnSeconds'
    }
  } else {
    if (d.intervalOnSeconds != null || d.intervalCycleSeconds != null) {
      return 'intervalOnSeconds and intervalCycleSeconds must be null for non-INTERVAL rules'
    }
    if (THRESHOLD.has(d.condition) && d.watchedSensorType == null) {
      return 'watchedSensorType is required for threshold conditions (ABOVE_MAX, BELOW_MIN, ABOVE_MIN, BELOW_MAX, ABOVE_TARGET, BELOW_TARGET)'
    }
    if (
      (d.condition === RuleCondition.ALWAYS_ON || d.condition === RuleCondition.ALWAYS_OFF) &&
      d.watchedSensorType != null
    ) {
      return 'watchedSensorType must be null for ALWAYS_ON / ALWAYS_OFF rules'
    }
    if (d.condition === RuleCondition.ALWAYS_ON && d.action !== DeviceAction.ON) {
      return 'action must be ON for condition ALWAYS_ON'
    }
    if (d.condition === RuleCondition.ALWAYS_OFF && d.action !== DeviceAction.OFF) {
      return 'action must be OFF for condition ALWAYS_OFF'
    }
  }
  if (d.cooldownSeconds < 0) {
    return 'Cooldown cannot be negative.'
  }
  return null
}

export function buildCreatePayload(d: RuleDraft, growPhaseId: string): CreateAutomationRulePayload {
  const base: CreateAutomationRulePayload = {
    action: d.action,
    condition: d.condition,
    cooldownSeconds: d.cooldownSeconds,
    deviceId: d.deviceId!,
    enabled: true,
    growPhaseId,
    period: d.period,
    watchedSensorType: d.watchedSensorType,
  }
  if (d.condition === RuleCondition.INTERVAL) {
    return {
      ...base,
      intervalCycleSeconds: d.intervalCycleSeconds!,
      intervalOnSeconds: d.intervalOnSeconds!,
    }
  }
  return base
}

export function buildUpdatePayload(d: RuleDraft): UpdateAutomationRulePayload {
  const base: UpdateAutomationRulePayload = {
    action: d.action,
    condition: d.condition,
    cooldownSeconds: d.cooldownSeconds,
    deviceId: d.deviceId!,
    period: d.period,
    watchedSensorType: d.watchedSensorType,
  }
  if (d.condition === RuleCondition.INTERVAL) {
    return {
      ...base,
      intervalCycleSeconds: d.intervalCycleSeconds!,
      intervalOnSeconds: d.intervalOnSeconds!,
    }
  }
  return { ...base, intervalCycleSeconds: null, intervalOnSeconds: null }
}
