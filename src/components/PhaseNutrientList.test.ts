import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

const useConfirmMock = { require: vi.fn() }
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => useConfirmMock,
}))

interface TestNutrient {
  id: string
  name: string
  brand: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface TestPhaseNutrient {
  id: string
  growPhaseId: string
  nutrientId: string
  period: 'DAY' | 'NIGHT'
  doseMlPerL: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

const nutrients: TestNutrient[] = [
  {
    brand: 'GH',
    createdAt: '2026-07-21T00:00:00.000Z',
    id: 'nut1',
    name: 'FloraGro',
    notes: null,
    updatedAt: '2026-07-21T00:00:00.000Z',
  },
  {
    brand: 'GH',
    createdAt: '2026-07-21T00:00:00.000Z',
    id: 'nut2',
    name: 'FloraBloom',
    notes: null,
    updatedAt: '2026-07-21T00:00:00.000Z',
  },
]

let phaseNutrients: TestPhaseNutrient[] = []

vi.mock('../stores/apiStore', () => ({
  useApiStore: () => ({
    get nutrients(): TestNutrient[] {
      return nutrients
    },
    phaseNutrients: {
      addOne: (
        _growPhaseId: string,
        payload: Omit<TestPhaseNutrient, 'id' | 'createdAt' | 'updatedAt'>,
      ) => {
        const created: TestPhaseNutrient = {
          ...payload,
          createdAt: '2026-07-21T00:00:00.000Z',
          id: `pn${phaseNutrients.length + 1}`,
          updatedAt: '2026-07-21T00:00:00.000Z',
        }
        phaseNutrients.push(created)
        return Promise.resolve(created)
      },
      fetchForPhase: (_growPhaseId: string, _period?: 'DAY' | 'NIGHT') =>
        Promise.resolve(phaseNutrients),
      removeOne: (_growPhaseId: string, id: string) => {
        phaseNutrients = phaseNutrients.filter((pn) => pn.id !== id)
        return Promise.resolve()
      },
      updateOne: (
        _growPhaseId: string,
        id: string,
        payload: Partial<Omit<TestPhaseNutrient, 'id' | 'createdAt' | 'updatedAt'>>,
      ) => {
        const idx = phaseNutrients.findIndex((pn) => pn.id === id)
        if (idx !== -1) {
          phaseNutrients[idx] = { ...phaseNutrients[idx]!, ...payload } as TestPhaseNutrient
          return Promise.resolve(phaseNutrients[idx]!)
        }
        return Promise.reject(new Error('not found'))
      },
    },
  }),
}))

import PhaseNutrientList from './PhaseNutrientList.vue'
import { primeVueStubs } from '../utils/testStub'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('PhaseNutrientList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    phaseNutrients = []
    useConfirmMock.require.mockReset()
  })

  afterEach(() => {
    setActivePinia(null as unknown as ReturnType<typeof createPinia>)
    vi.restoreAllMocks()
  })

  it('renders the locked-hint when no phaseId is provided', () => {
    const w = mount(PhaseNutrientList, {
      global: { stubs: primeVueStubs },
      props: { growPhaseId: '' },
    })
    expect(w.text()).toMatch(/save the grow first/i)
  })

  it('shows the empty state when no rows exist for the phase', async () => {
    const w = mount(PhaseNutrientList, {
      global: { stubs: primeVueStubs },
      props: { growPhaseId: 'p1' },
    })
    await flush()

    expect(w.text()).toMatch(/no nutrients configured/i)
  })

  it('renders phase nutrient rows with resolved nutrient name, dose, and period chip', async () => {
    phaseNutrients = [
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 2.5,
        growPhaseId: 'p1',
        id: 'pn1',
        nutrientId: 'nut1',
        period: 'DAY',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
    ]
    const w: VueWrapper = mount(PhaseNutrientList, {
      global: { stubs: primeVueStubs },
      props: { growPhaseId: 'p1' },
    })
    await flush()

    expect(w.text()).toContain('FloraGro')
    expect(w.text()).toContain('2.5')
    expect(w.text()).toContain('DAY')
  })

  it('renders a NIGHT row with the resolved name', async () => {
    phaseNutrients = [
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 3,
        growPhaseId: 'p1',
        id: 'pn9',
        nutrientId: 'nut2',
        period: 'NIGHT',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
    ]
    const w = mount(PhaseNutrientList, {
      global: { stubs: primeVueStubs },
      props: { growPhaseId: 'p1' },
    })
    await flush()

    expect(w.text()).toContain('FloraBloom')
    expect(w.text()).toContain('NIGHT')
  })

  it('renders edit and delete actions for each row', async () => {
    phaseNutrients = [
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 1,
        growPhaseId: 'p1',
        id: 'pn1',
        nutrientId: 'nut1',
        period: 'DAY',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
    ]
    const w = mount(PhaseNutrientList, {
      global: { stubs: primeVueStubs },
      props: { growPhaseId: 'p1' },
    })
    await flush()

    expect(w.find('[data-testid="pn-edit-pn1"]').exists()).toBe(true)
    expect(w.find('[data-testid="pn-delete-pn1"]').exists()).toBe(true)
  })

  it('disables the "both periods" toggle when every available nutrient already has both periods', async () => {
    // Both nutrients have BOTH DAY and NIGHT entries — nothing left to add
    phaseNutrients = [
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 1,
        growPhaseId: 'p1',
        id: 'pn1',
        nutrientId: 'nut1',
        period: 'DAY',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 1,
        growPhaseId: 'p1',
        id: 'pn2',
        nutrientId: 'nut1',
        period: 'NIGHT',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 1,
        growPhaseId: 'p1',
        id: 'pn3',
        nutrientId: 'nut2',
        period: 'DAY',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 1,
        growPhaseId: 'p1',
        id: 'pn4',
        nutrientId: 'nut2',
        period: 'NIGHT',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
    ]
    const w = mount(PhaseNutrientList, {
      global: { stubs: primeVueStubs },
      props: { growPhaseId: 'p1' },
    })
    await flush()

    const toggle = w.find('[data-testid="pn-both-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('disabled')).toBeDefined()
  })

  it('enables the "both periods" toggle when at least one nutrient is missing a period', async () => {
    // nut1 has only DAY entry; nut2 has nothing
    phaseNutrients = [
      {
        createdAt: '2026-07-21T00:00:00.000Z',
        doseMlPerL: 1,
        growPhaseId: 'p1',
        id: 'pn1',
        nutrientId: 'nut1',
        period: 'DAY',
        sortOrder: 1,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
    ]
    const w = mount(PhaseNutrientList, {
      global: { stubs: primeVueStubs },
      props: { growPhaseId: 'p1' },
    })
    await flush()

    const toggle = w.find('[data-testid="pn-both-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('disabled')).toBeUndefined()
  })
})
