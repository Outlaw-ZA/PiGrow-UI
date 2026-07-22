import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

import type { GrowPhase } from '../types/grow'

interface UpdateGrowPhaseCall {
  id: string
  payload: Partial<GrowPhase>
}

const mockApiStore = {
  updateGrowPhase: vi.fn(),
}

vi.mock('../stores/apiStore', () => ({
  useApiStore: () => mockApiStore,
}))

import PhasePhBandEditor from './PhasePhBandEditor.vue'
import { primeVueStubs } from '../utils/testStub'

const basePhase: GrowPhase = {
  durationDays: 14,
  endAt: null,
  id: 'p-saved',
  isActive: false,
  name: 'Vegetative',
  order: 1,
  phMax: null,
  phMin: null,
  phTarget: null,
  startAt: null,
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function makePhase(overrides: Partial<GrowPhase> = {}): GrowPhase {
  return { ...basePhase, ...overrides } as GrowPhase
}

function pHInputs(wrapper: VueWrapper) {
  return wrapper.findAll('[data-testid^="phase-ph-"]')
}

function mockGrow(id: string, payload: Partial<GrowPhase>): GrowPhase {
  return {
    durationDays: 1,
    endAt: null,
    id,
    isActive: false,
    name: 'Mock',
    order: 1,
    phMax: null,
    phMin: null,
    phTarget: null,
    startAt: null,
    ...payload,
  } as GrowPhase
}

describe('PhasePhBandEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockApiStore.updateGrowPhase.mockReset()
    mockApiStore.updateGrowPhase.mockImplementation((id: string, payload: Partial<GrowPhase>) =>
      Promise.resolve(mockGrow(id, payload)),
    )
  })

  afterEach(() => {
    setActivePinia(null as unknown as ReturnType<typeof createPinia>)
    vi.restoreAllMocks()
  })

  it('renders the shared-applicability help copy for both DAY and NIGHT', () => {
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase() },
    })
    expect(w.text()).toMatch(/day and night/i)
  })

  it('renders all three pH inputs (min / target / max)', () => {
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase({ phMin: 5.8, phTarget: 6.2, phMax: 6.5 }) },
    })
    expect(pHInputs(w).length).toBe(3)
  })

  it('persists a phMin value via the grow-phase update API', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(PhasePhBandEditor, {
        global: { stubs: primeVueStubs },
        props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
      })
      await flush()

      await w.get('[data-testid="phase-ph-min"]').setValue('5.8')
      await vi.advanceTimersByTimeAsync(500)
      await flush()

      const calls = mockApiStore.updateGrowPhase.mock.calls as unknown as [
        string,
        Partial<GrowPhase>,
      ][]
      expect(calls.length).toBeGreaterThan(0)
      const lastCall = calls[calls.length - 1]!
      const last: UpdateGrowPhaseCall = { id: lastCall[0], payload: lastCall[1] }
      expect(last.id).toBe('p-saved')
      expect(last.payload.phMin).toBe(5.8)
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists a phTarget value via the grow-phase update API', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(PhasePhBandEditor, {
        global: { stubs: primeVueStubs },
        props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
      })
      await flush()

      await w.get('[data-testid="phase-ph-target"]').setValue('6.2')
      await vi.advanceTimersByTimeAsync(500)
      await flush()

      const calls = mockApiStore.updateGrowPhase.mock.calls as unknown as [
        string,
        Partial<GrowPhase>,
      ][]
      const lastCall = calls[calls.length - 1]!
      const last: UpdateGrowPhaseCall = { id: lastCall[0], payload: lastCall[1] }
      expect(last.payload.phTarget).toBe(6.2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists a phMax value via the grow-phase update API', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(PhasePhBandEditor, {
        global: { stubs: primeVueStubs },
        props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
      })
      await flush()

      await w.get('[data-testid="phase-ph-max"]').setValue('6.5')
      await vi.advanceTimersByTimeAsync(500)
      await flush()

      const calls = mockApiStore.updateGrowPhase.mock.calls as unknown as [
        string,
        Partial<GrowPhase>,
      ][]
      const lastCall = calls[calls.length - 1]!
      const last: UpdateGrowPhaseCall = { id: lastCall[0], payload: lastCall[1] }
      expect(last.payload.phMax).toBe(6.5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders the locked-hint when the phase has no id yet', () => {
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase({ id: '' }) },
    })
    expect(w.text()).toMatch(/save the grow first/i)
  })

  it('constrains inputs to the 0..14 range with 0.01 precision', () => {
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase({ phMin: 5.8, phTarget: 6.2, phMax: 6.5 }) },
    })
    const minInput = w.get('[data-testid="phase-ph-min"]')
    const targetInput = w.get('[data-testid="phase-ph-target"]')
    const maxInput = w.get('[data-testid="phase-ph-max"]')
    expect(minInput.attributes('min')).toBe('0')
    expect(minInput.attributes('max')).toBe('14')
    expect(minInput.attributes('step')).toBe('0.01')
    expect(targetInput.attributes('step')).toBe('0.01')
    expect(maxInput.attributes('step')).toBe('0.01')
  })

  it('resyncs the local pH inputs when the parent swaps to a different phase', async () => {
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase({ phMin: 5.8, phTarget: 6.2, phMax: 6.5 }) },
    })
    await flush()
    const minInput = () => w.get('[data-testid="phase-ph-min"]').element as HTMLInputElement
    expect(minInput().value).toBe('5.8')

    await w.setProps({
      phase: makePhase({
        id: 'p2',
        name: 'Flowering',
        phMin: 6,
        phTarget: 6.5,
        phMax: 7,
      }),
    })
    await flush()

    const maxInput = w.get('[data-testid="phase-ph-max"]').element as HTMLInputElement
    expect(minInput().value).toBe('6')
    expect(maxInput.value).toBe('7')
  })

  it('debounces rapid edits so only the last value reaches the server', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(PhasePhBandEditor, {
        global: { stubs: primeVueStubs },
        props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
      })
      await flush()

      const minInput = w.get('[data-testid="phase-ph-min"]')
      await minInput.setValue('5')
      await minInput.setValue('5.5')
      await minInput.setValue('6')

      expect(mockApiStore.updateGrowPhase).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(500)
      await flush()

      const calls = mockApiStore.updateGrowPhase.mock.calls as unknown as [
        string,
        Partial<GrowPhase>,
      ][]
      expect(calls.length).toBe(1)
      expect(calls[0]![1].phMin).toBe(6)
    } finally {
      vi.useRealTimers()
    }
  })

  it("emits 'updated' with the server-returned phase after a successful save", async () => {
    vi.useFakeTimers()
    try {
      mockApiStore.updateGrowPhase.mockImplementation((id: string, payload: Partial<GrowPhase>) =>
        Promise.resolve(
          mockGrow(id, {
            phMax: payload.phMax ?? null,
            phMin: payload.phMin ?? null,
            phTarget: payload.phTarget ?? null,
          }),
        ),
      )

      const w = mount(PhasePhBandEditor, {
        global: { stubs: primeVueStubs },
        props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
      })
      await flush()

      await w.get('[data-testid="phase-ph-min"]').setValue('5.8')
      await vi.advanceTimersByTimeAsync(500)
      await flush()

      const events = w.emitted('updated') as unknown as Array<[GrowPhase]>
      expect(events).toBeTruthy()
      expect(events.length).toBe(1)
      expect(events[0]![0].id).toBe('p-saved')
      expect(events[0]![0].phMin).toBe(5.8)
    } finally {
      vi.useRealTimers()
    }
  })

  it('still propagates a nullable (cleared) value through the debounce', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(PhasePhBandEditor, {
        global: { stubs: primeVueStubs },
        props: { phase: makePhase({ phMin: 5.8, phTarget: null, phMax: null }) },
      })
      await flush()

      const minInput = w.get('[data-testid="phase-ph-min"]')
      await minInput.setValue('')
      await vi.advanceTimersByTimeAsync(500)
      await flush()

      const calls = mockApiStore.updateGrowPhase.mock.calls as unknown as [
        string,
        Partial<GrowPhase>,
      ][]
      const lastCall = calls[calls.length - 1]!
      expect(lastCall[1]).toMatchObject({ phMin: null })
    } finally {
      vi.useRealTimers()
    }
  })
})
