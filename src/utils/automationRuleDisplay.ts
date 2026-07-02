import { RuleCondition, SensorType } from '../types/grow'
import type { AutomationRule } from '../types/grow'

/**
 * Human-readable duration from seconds. Chooses the coarsest readable
 * unit: seconds (< 60 s), minutes (< 60 min), hours (>= 60 min).
 * Remainders are appended only when non-zero to avoid noisy output.
 */
export function fmtDuration(s: number): string {
  if (s < 60) {
    return `${s}s`
  }
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return mm === 0 ? `${h}h` : `${h}h ${mm}m`
  }
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`
}

/**
 * Readable one-line summary of an INTERVAL rule for table display.
 * Falls back to "Interval" when the interval fields are missing.
 */
export function formatIntervalRule(rule: AutomationRule): string {
  const on = rule.intervalOnSeconds
  const cyc = rule.intervalCycleSeconds
  if (on == null || cyc == null) {
    return 'Interval'
  }
  return `ON ${fmtDuration(on)} every ${fmtDuration(cyc)} (OFF ${fmtDuration(cyc - on)})`
}

function isTempSensor(st: SensorType | null | undefined): boolean {
  return st === SensorType.TEMPERATURE || st === SensorType.TEMP_HUMIDITY
}

/**
 * Terse condition phrase for compact rule display (e.g. "temp > max").
 * Mirrors {@link formatIntervalRule} for INTERVAL. Falls back to
 * `String(rule.condition)` for unknown conditions.
 */
export function conditionShort(rule: AutomationRule): string {
  const watched = rule.watchedSensorType
  const isTemp = isTempSensor(watched)
  switch (rule.condition) {
    case RuleCondition.ABOVE_MAX: {
      return isTemp ? 'temp > max' : 'reading > max'
    }
    case RuleCondition.BELOW_MIN: {
      return isTemp ? 'temp < min' : 'reading < min'
    }
    case RuleCondition.BELOW_MAX: {
      return 'reading < max (recovery)'
    }
    case RuleCondition.ABOVE_MIN: {
      return 'reading > min (recovery)'
    }
    case RuleCondition.ABOVE_TARGET: {
      return 'reading > target'
    }
    case RuleCondition.BELOW_TARGET: {
      return 'reading < target'
    }
    case RuleCondition.ALWAYS_ON: {
      return 'Always ON'
    }
    case RuleCondition.ALWAYS_OFF: {
      return 'Always OFF'
    }
    case RuleCondition.INTERVAL: {
      return formatIntervalRule(rule)
    }
    default: {
      return String(rule.condition)
    }
  }
}
