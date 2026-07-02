import { describe, expect, it } from 'vitest'
import { DeviceAction, DeviceType, RuleCondition, SensorType } from '../types/grow'
import type { Device } from '../types/grow'
import {
  buildCreatePayload,
  buildUpdatePayload,
  validateRuleDraft,
} from './automationRuleValidation'
import type { RuleDraft } from './automationRuleValidation'

const fan: Device = {
  automationMode: 'MANUAL' as never,
  controllerId: 'c',
  createdAt: '',
  id: 'd1',
  isActive: true,
  mqttTopic: '',
  name: 'Exhaust',
  pinNumber: 1,
  type: DeviceType.EXHAUST_FAN,
  updatedAt: '',
}
const base = (over: Partial<RuleDraft> = {}): RuleDraft => ({
  action: DeviceAction.ON,
  condition: RuleCondition.ABOVE_MAX,
  cooldownSeconds: 60,
  deviceId: 'd1',
  intervalCycleSeconds: null,
  intervalOnSeconds: null,
  period: null,
  watchedSensorType: SensorType.TEMPERATURE,
  ...over,
})

describe('validateRuleDraft INTERVAL', () => {
  it('passes for 30/300 ON', () => {
    expect(
      validateRuleDraft(
        base({
          condition: RuleCondition.INTERVAL,
          intervalCycleSeconds: 300,
          intervalOnSeconds: 30,
          watchedSensorType: null,
        }),
        [fan],
      ),
    ).toBeNull()
  })
  it('blocks cycle <= on', () => {
    expect(
      validateRuleDraft(
        base({
          condition: RuleCondition.INTERVAL,
          intervalCycleSeconds: 300,
          intervalOnSeconds: 300,
          watchedSensorType: null,
        }),
        [fan],
      ),
    ).toMatch(/greater than intervalOnSeconds/)
  })
  it('blocks missing onSeconds', () => {
    expect(
      validateRuleDraft(
        base({
          condition: RuleCondition.INTERVAL,
          intervalCycleSeconds: 300,
          intervalOnSeconds: null,
          watchedSensorType: null,
        }),
        [fan],
      ),
    ).toMatch(/intervalOnSeconds is required/)
  })
  it('blocks LIGHT device', () => {
    const light = { ...fan, id: 'dL', type: DeviceType.LIGHT }
    expect(
      validateRuleDraft(
        base({
          condition: RuleCondition.INTERVAL,
          deviceId: 'dL',
          intervalCycleSeconds: 300,
          intervalOnSeconds: 30,
          watchedSensorType: null,
        }),
        [light],
      ),
    ).toMatch(/LIGHT devices are not eligible/)
  })
  it('blocks action != ON', () => {
    expect(
      validateRuleDraft(
        base({
          action: DeviceAction.OFF,
          condition: RuleCondition.INTERVAL,
          intervalCycleSeconds: 300,
          intervalOnSeconds: 30,
          watchedSensorType: null,
        }),
        [fan],
      ),
    ).toMatch(/action must be ON for condition INTERVAL/)
  })
  it('blocks non-null sensor', () => {
    expect(
      validateRuleDraft(
        base({
          condition: RuleCondition.INTERVAL,
          intervalCycleSeconds: 300,
          intervalOnSeconds: 30,
        }),
        [fan],
      ),
    ).toMatch(/watchedSensorType must be null for INTERVAL/)
  })
})

describe('buildCreatePayload', () => {
  it('includes interval fields for INTERVAL', () => {
    const p = buildCreatePayload(
      base({
        condition: RuleCondition.INTERVAL,
        intervalCycleSeconds: 300,
        intervalOnSeconds: 30,
        watchedSensorType: null,
      }),
      'phase1',
    )
    expect(p).toMatchObject({
      action: 'ON',
      condition: 'INTERVAL',
      intervalCycleSeconds: 300,
      intervalOnSeconds: 30,
      watchedSensorType: null,
    })
  })
  it('omits interval fields for ABOVE_MAX', () => {
    const p = buildCreatePayload(base(), 'phase1')
    expect('intervalOnSeconds' in p).toBe(false)
    expect('intervalCycleSeconds' in p).toBe(false)
  })
})

describe('buildUpdatePayload', () => {
  it('includes interval fields for INTERVAL', () => {
    const p = buildUpdatePayload(
      base({
        condition: RuleCondition.INTERVAL,
        intervalCycleSeconds: 300,
        intervalOnSeconds: 30,
        watchedSensorType: null,
      }),
    )
    expect(p).toMatchObject({ intervalCycleSeconds: 300, intervalOnSeconds: 30 })
  })
  it('sends explicit null for non-INTERVAL to clear stale values', () => {
    const p = buildUpdatePayload(base()) as Record<string, unknown>
    expect(p.intervalOnSeconds).toBeNull()
    expect(p.intervalCycleSeconds).toBeNull()
  })
})
