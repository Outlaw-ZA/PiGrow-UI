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
