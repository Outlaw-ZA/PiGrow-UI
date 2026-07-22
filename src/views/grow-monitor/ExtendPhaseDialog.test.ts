import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

import ExtendPhaseDialog from './ExtendPhaseDialog.vue'
import type { GrowPhase } from '../../types/grow'
import { primeVueStubs } from '../../utils/testStub'

function makePhase(over: Partial<GrowPhase> = {}): GrowPhase {
  return {
    durationDays: 30,
    endAt: '2026-08-15',
    growCycleId: 'c1',
    id: 'p1',
    isActive: true,
    name: 'Vegetative',
    order: 0,
    phMax: null,
    phMin: null,
    phTarget: null,
    startAt: '2026-07-16',
    ...over,
  }
}

function props(over: Record<string, unknown> = {}) {
  return {
    activePhase: makePhase(),
    cycleId: 'c1',
    startAt: '2026-07-16',
    totalDurationDays: 60,
    visible: true,
    ...over,
  }
}

describe('ExtendPhaseDialog preview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    setActivePinia(null as unknown as ReturnType<typeof createPinia>)
  })

  it('shows current end date and the new harvest in the preview header', () => {
    const w = mount(ExtendPhaseDialog, {
      global: { stubs: primeVueStubs },
      props: props(),
    })
    // default days=1: new end = 2026-08-15 + 1 = 2026-08-16
    //                  new harvest = 2026-07-16 + 60 + 1 = 2026-09-15
    expect(w.text()).toContain('2026-08-15')
    expect(w.text()).toContain('2026-08-16')
    expect(w.text()).toContain('2026-09-15')
  })

  it('updates new end date and harvest when days changes', async () => {
    const w = mount(ExtendPhaseDialog, {
      global: { stubs: primeVueStubs },
      props: props(),
    })
    // Drive the days ref directly — InputNumber is stubbed (testStub pattern).
    ;(w.vm as unknown as { days: number }).days = 7
    await nextTick()
    // 2026-08-15 + 7 = 2026-08-22; harvest 2026-09-14 + 7 = 2026-09-21
    expect(w.text()).toContain('2026-08-22')
    expect(w.text()).toContain('2026-09-21')
  })

  it('falls back to start date for harvest when startAt missing', () => {
    const w = mount(ExtendPhaseDialog, {
      global: { stubs: primeVueStubs },
      props: props({ startAt: null, totalDurationDays: 0 }),
    })
    // No harvest preview line is rendered
    expect(w.text()).not.toContain('New estimated harvest')
  })
})
