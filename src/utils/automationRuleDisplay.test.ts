import { describe, expect, it } from 'vitest'
import { formatIntervalRule } from './automationRuleDisplay'
import type { AutomationRule } from '../types/grow'

const r = (on: number | null, cyc: number | null) =>
  ({ intervalCycleSeconds: cyc, intervalOnSeconds: on }) as AutomationRule

describe('formatIntervalRule', () => {
  it('formats 30/300', () => {
    expect(formatIntervalRule(r(30, 300))).toBe('ON 30s every 5m (OFF 4m 30s)')
  })
  it('formats 60/3600', () => {
    expect(formatIntervalRule(r(60, 3600))).toBe('ON 1m every 1h (OFF 59m)')
  })
  it('handles nulls', () => {
    expect(formatIntervalRule(r(null, null))).toBe('Interval')
  })
})
