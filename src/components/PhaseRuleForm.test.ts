import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { RuleCondition } from '../types/grow'
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
})
