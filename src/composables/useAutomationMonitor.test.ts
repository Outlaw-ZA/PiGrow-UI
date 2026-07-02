import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useAutomationMonitor } from './useAutomationMonitor'
import { DayNightPeriod, DeviceAction, RuleCondition, SensorType } from '../types/grow'
import type { AutomationRule, PhaseEnvironment } from '../types/grow'

const baseEnv = { day: null, night: null } as {
  day: PhaseEnvironment | null
  night: PhaseEnvironment | null
}

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    action: DeviceAction.ON,
    condition: RuleCondition.ABOVE_MAX,
    deviceId: 'd1',
    enabled: true,
    growCycleId: 'c1',
    growPhaseId: 'p1',
    id: 'r1',
    intervalCycleSeconds: null,
    intervalOnSeconds: null,
    lastTriggeredAt: null,
    period: DayNightPeriod.DAY,
    watchedSensorType: SensorType.TEMPERATURE,
    ...overrides,
  } as AutomationRule
}

describe('useAutomationMonitor.toggleRule', () => {
  it('preserves rule identity when API response is partial', async () => {
    const rule = makeRule()
    const fetchRulesApi = vi.fn().mockResolvedValue([rule])
    // Simulate a backend toggle response that only carries { id, enabled } —
    // Omitting the rule's identity fields (watchedSensorType, condition, etc.).
    const toggleRuleApi = vi.fn().mockResolvedValue({ enabled: false, id: 'r1' })

    let automations!: ReturnType<typeof useAutomationMonitor>
    const scope = effectScope()
    scope.run(() => {
      automations = useAutomationMonitor({
        fetchRulesApi,
        getActiveEnv: () => baseEnv,
        getActivePeriod: () => DayNightPeriod.DAY,
        getActivePhaseId: () => 'p1',
        getDevices: () => [],
        getReadings: () => ({ temperature: 20, humidity: 50, co2: 400 }),
        toggleRuleApi,
      })
    })

    try {
      await automations.reload()
      expect(automations.rules.length).toBe(1)
      expect(automations.groups.length).toBe(1)
      expect(automations.groups[0]?.rules.length).toBe(1)

      await automations.toggleRule('r1')

      // Rule must remain in the list and keep its identity so it stays
      // Visible in the Temperature group.
      expect(automations.rules.length).toBe(1)
      expect(automations.rules[0]?.watchedSensorType).toBe(SensorType.TEMPERATURE)
      expect(automations.rules[0]?.condition).toBe(RuleCondition.ABOVE_MAX)
      expect(automations.rules[0]?.enabled).toBe(false)
      expect(automations.groups.length).toBe(1)
      expect(automations.groups[0]?.rules.length).toBe(1)
    } finally {
      scope.stop()
    }
  })
})
