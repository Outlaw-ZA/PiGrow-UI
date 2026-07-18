import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

let handlers: Record<string, (...args: unknown[]) => void> = {}
const onMock = vi.fn((name: string, fn: (...args: unknown[]) => void) => {
  handlers[name] = fn
})
const offMock = vi.fn((name: string, fn?: (...args: unknown[]) => void) => {
  if (fn && handlers[name] === fn) {
    delete handlers[name]
  } else if (!fn) {
    delete handlers[name]
  }
})
const removeAllListenersMock = vi.fn(() => {
  for (const key of Object.keys(handlers)) {
    delete handlers[key]
  }
})
const disconnectMock = vi.fn()

const socketInstance = {
  connected: true,
  disconnect: disconnectMock,
  off: offMock,
  on: onMock,
  removeAllListeners: removeAllListenersMock,
}

const ioMock = vi.fn(() => socketInstance)

const fetchGrowCycleMock = vi.fn().mockResolvedValue({ id: 'c1' })

// Cast through `never`: the real `io()` has a complex variadic + overload
// signature that TypeScript can't reconcile with a single `vi.fn(() => ...)`
// returning a plain object. The wrapper function keeps the reference to
// `ioMock` lazy (so the vi.mock factory can hoist cleanly) while `as never`
// silences the structural type mismatch — the runtime contract is "returns
// socketInstance", which the tests verify.
vi.mock('socket.io-client', () => ({
  io: ((..._args: unknown[]) => ioMock()) as never,
}))

vi.mock('../stores/growCycleStore', () => ({
  useGrowCycleStore: () => ({
    fetchGrowCycle: fetchGrowCycleMock,
  }),
}))

import { useLiveTelemetry } from './useLiveTelemetry'

describe('useLiveTelemetry cycle-event wiring', () => {
  let scope: ReturnType<typeof effectScope>
  let telemetry: ReturnType<typeof useLiveTelemetry> | undefined
  let getCycleId: () => string | null

  beforeEach(() => {
    handlers = {}
    onMock.mockClear()
    offMock.mockClear()
    removeAllListenersMock.mockClear()
    disconnectMock.mockClear()
    fetchGrowCycleMock.mockClear()
    ioMock.mockClear()
    scope = effectScope()
    getCycleId = () => 'c1'
  })

  afterEach(() => {
    scope.stop()
  })

  it('refreshes the cycle when cycle_phase_changed is emitted', async () => {
    scope.run(() => {
      telemetry = useLiveTelemetry(getCycleId)
    })
    telemetry!.start()
    await nextTick()
    handlers.cycle_phase_changed?.({ cycleId: 'c1', fromPhaseId: 'a', toPhaseId: 'b' })
    await nextTick()
    expect(fetchGrowCycleMock).toHaveBeenCalledWith('c1')
  })

  it('refreshes the cycle when cycle_completed is emitted', async () => {
    scope.run(() => {
      telemetry = useLiveTelemetry(getCycleId)
    })
    telemetry!.start()
    await nextTick()
    handlers.cycle_completed?.({ cycleId: 'c1', completedPhaseId: 'a' })
    await nextTick()
    expect(fetchGrowCycleMock).toHaveBeenCalledWith('c1')
  })

  it('refreshes the cycle when cycle_phase_extended is emitted', async () => {
    scope.run(() => {
      telemetry = useLiveTelemetry(getCycleId)
    })
    telemetry!.start()
    await nextTick()
    handlers.cycle_phase_extended?.({
      afterEndAt: '2026-09-01',
      beforeEndAt: '2026-08-22',
      cycleId: 'c1',
      daysAdded: 7,
      extendedAt: '2026-08-15T12:00:00Z',
      newEstimatedHarvestDate: '2026-10-15',
      phaseId: 'p1',
    })
    await nextTick()
    expect(fetchGrowCycleMock).toHaveBeenCalledWith('c1')
  })

  it('ignores events for a different cycle', async () => {
    scope.run(() => {
      telemetry = useLiveTelemetry(getCycleId)
    })
    telemetry!.start()
    await nextTick()
    handlers.cycle_phase_changed?.({ cycleId: 'OTHER', fromPhaseId: 'a', toPhaseId: 'b' })
    await nextTick()
    expect(fetchGrowCycleMock).not.toHaveBeenCalled()
  })

  it('removes named handlers on stop', async () => {
    scope.run(() => {
      telemetry = useLiveTelemetry(getCycleId)
    })
    telemetry!.start()
    await nextTick()
    telemetry!.stop()
    handlers.cycle_phase_changed?.({ cycleId: 'c1' })
    handlers.cycle_completed?.({ cycleId: 'c1' })
    handlers.cycle_phase_extended?.({ cycleId: 'c1' })
    await nextTick()
    expect(fetchGrowCycleMock).not.toHaveBeenCalled()
  })
})
