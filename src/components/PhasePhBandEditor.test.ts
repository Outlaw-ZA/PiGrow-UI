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
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
    })
    await flush()

    await w.get('[data-testid="phase-ph-min"]').setValue('5.8')
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
  })

  it('persists a phTarget value via the grow-phase update API', async () => {
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
    })
    await flush()

    await w.get('[data-testid="phase-ph-target"]').setValue('6.2')
    await flush()

    const calls = mockApiStore.updateGrowPhase.mock.calls as unknown as [
      string,
      Partial<GrowPhase>,
    ][]
    const lastCall = calls[calls.length - 1]!
    const last: UpdateGrowPhaseCall = { id: lastCall[0], payload: lastCall[1] }
    expect(last.payload.phTarget).toBe(6.2)
  })

  it('persists a phMax value via the grow-phase update API', async () => {
    const w = mount(PhasePhBandEditor, {
      global: { stubs: primeVueStubs },
      props: { phase: makePhase({ phMin: null, phTarget: null, phMax: null }) },
    })
    await flush()

    await w.get('[data-testid="phase-ph-max"]').setValue('6.5')
    await flush()

    const calls = mockApiStore.updateGrowPhase.mock.calls as unknown as [
      string,
      Partial<GrowPhase>,
    ][]
    const lastCall = calls[calls.length - 1]!
    const last: UpdateGrowPhaseCall = { id: lastCall[0], payload: lastCall[1] }
    expect(last.payload.phMax).toBe(6.5)
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
})
