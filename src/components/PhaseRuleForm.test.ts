import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { DeviceAction, RuleCondition } from '../types/grow'
import PhaseRuleForm from './PhaseRuleForm.vue'
import { primeVueStubs } from '../utils/testStub'

const devices = [{ id: 'd1', isActive: true, name: 'Exhaust', type: 'EXHAUST_FAN' } as never]
const props = (over: any = {}) => ({ devices, growPhaseId: 'p1', mode: 'create' as const, ...over })

describe('PhaseRuleForm INTERVAL branch', () => {
  it('shows interval inputs and hides sensor when condition=INTERVAL', async () => {
    const w = mount(PhaseRuleForm, {
      global: { stubs: primeVueStubs },
      props: props({ initialCondition: RuleCondition.INTERVAL }),
    })
    expect(w.find('[data-testid="interval-on"]').exists()).toBe(true)
    expect(w.find('[data-testid="sensor-picker"]').exists()).toBe(false)
  })
  it('hides interval inputs for ABOVE_MAX', async () => {
    const w = mount(PhaseRuleForm, {
      global: { stubs: primeVueStubs },
      props: props({ initialCondition: RuleCondition.ABOVE_MAX }),
    })
    expect(w.find('[data-testid="interval-on"]').exists()).toBe(false)
    expect(w.find('[data-testid="sensor-picker"]').exists()).toBe(true)
  })

  it('INTERVAL → ALWAYS_OFF sets action to OFF and clears interval fields', async () => {
    const w = mount(PhaseRuleForm, {
      global: { stubs: primeVueStubs },
      props: props({ initialCondition: RuleCondition.INTERVAL }),
    })
    // Start in INTERVAL mode: interval inputs visible, sensor hidden
    expect(w.find('[data-testid="interval-on"]').exists()).toBe(true)
    expect(w.find('[data-testid="sensor-picker"]').exists()).toBe(false)

    // Mutate draft condition to ALWAYS_OFF to trigger the condition watch
    ;(w.vm as any).draft.condition = RuleCondition.ALWAYS_OFF
    await w.vm.$nextTick()

    // Interval inputs should now be hidden
    expect(w.find('[data-testid="interval-on"]').exists()).toBe(false)
    // Action must be OFF (the bug was that it stayed ON)
    expect((w.vm as any).draft.action).toBe(DeviceAction.OFF)
    // Interval fields must be cleared
    expect((w.vm as any).draft.intervalOnSeconds).toBeNull()
    expect((w.vm as any).draft.intervalCycleSeconds).toBeNull()
  })
})
