import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { AxiosError, AxiosResponse } from 'axios'

const routerPush = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRouter: () => ({ push: routerPush }),
  }
})

import ScanControllersView from './ScanControllersView.vue'
import { useApiStore } from '../../stores/apiStore'
import type { Controller, DiscoveredController } from '../../types/grow'
import { primeVueStubs } from '../../utils/testStub'

interface RowVm {
  controller: DiscoveredController
  pin: string
  claiming: boolean
  error: string | null
}

interface ExposedVm {
  rows: RowVm[]
  scanning: boolean
  scansCompleted: number
  startScanning: () => void
  stopScanning: () => void
  claim: (row: RowVm) => Promise<void>
  onPinInput: (row: RowVm, event: Event) => void
}

function makeDiscovery(over: Partial<DiscoveredController> = {}): DiscoveredController {
  return {
    fwVersion: '0.4.0',
    hwManifest: { relays: [], sensors: [] },
    ip: '192.168.1.42',
    mac: 'AA:BB:CC:DD:EE:FF',
    pinActive: true,
    serial: 'PIGROW-A1B2C3',
    ...over,
  }
}

function makeController(over: Partial<Controller> = {}): Controller {
  return {
    createdAt: '2026-07-20T00:00:00Z',
    id: 'c1',
    ipAddress: '192.168.1.42',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    name: 'PIGROW-A1B2C3',
    status: 'OFFLINE',
    updatedAt: '2026-07-20T00:00:00Z',
    ...over,
  }
}

function axiosError(status: number, errorMessage: string): AxiosError {
  const err = new Error(errorMessage) as AxiosError
  err.isAxiosError = true
  err.name = 'AxiosError'
  err.response = { data: { error: errorMessage }, status } as AxiosResponse
  return err
}

describe('ScanControllersView scan polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    routerPush.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    setActivePinia(null as unknown as ReturnType<typeof createPinia>)
    vi.restoreAllMocks()
  })

  it('polls /scan on mount and stops after the 30s window', async () => {
    const apiStore = useApiStore()
    const scanSpy = vi.spyOn(apiStore, 'scanControllers').mockResolvedValue({
      controllers: [makeDiscovery()],
    })
    vi.spyOn(apiStore, 'claimController').mockResolvedValue(makeController())

    mount(ScanControllersView, { global: { stubs: primeVueStubs } })

    await vi.advanceTimersByTimeAsync(0)
    expect(scanSpy).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(6_000)
    expect(scanSpy).toHaveBeenCalledTimes(4)

    await vi.advanceTimersByTimeAsync(30_000)
    const callsAtStop = scanSpy.mock.calls.length

    await vi.advanceTimersByTimeAsync(10_000)
    expect(scanSpy).toHaveBeenCalledTimes(callsAtStop)
  })

  it('populates a row per discovered controller and lets the user restart scanning', async () => {
    const apiStore = useApiStore()
    const scanSpy = vi.spyOn(apiStore, 'scanControllers').mockResolvedValue({
      controllers: [
        makeDiscovery({ mac: 'AA:AA:AA:AA:AA:01', serial: 'PIGROW-1' }),
        makeDiscovery({ mac: 'AA:AA:AA:AA:AA:02', serial: 'PIGROW-2' }),
      ],
    })
    vi.spyOn(apiStore, 'claimController').mockResolvedValue(makeController())

    const w = mount(ScanControllersView, { global: { stubs: primeVueStubs } })
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    await nextTick()

    const vm = w.vm as unknown as ExposedVm
    expect(vm.rows.map((r) => r.controller.serial).toSorted()).toEqual(['PIGROW-1', 'PIGROW-2'])

    await vi.advanceTimersByTimeAsync(30_000)
    await nextTick()
    const callsAtStop = scanSpy.mock.calls.length

    vm.startScanning()
    await vi.advanceTimersByTimeAsync(0)
    expect(scanSpy.mock.calls.length).toBeGreaterThan(callsAtStop)
  })
})

describe('ScanControllersView claim flow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    routerPush.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    setActivePinia(null as unknown as ReturnType<typeof createPinia>)
    vi.restoreAllMocks()
  })

  it('claims a row with the typed PIN and navigates to the edit route on success', async () => {
    const apiStore = useApiStore()
    vi.spyOn(apiStore, 'scanControllers').mockResolvedValue({
      controllers: [makeDiscovery({ mac: 'AA:BB:CC:DD:EE:FF', serial: 'PIGROW-XYZ' })],
    })
    const claimSpy = vi
      .spyOn(apiStore, 'claimController')
      .mockResolvedValue(makeController({ id: 'c-claimed', name: 'PIGROW-XYZ' }))

    const w = mount(ScanControllersView, { global: { stubs: primeVueStubs } })
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    await nextTick()

    const vm = w.vm as unknown as ExposedVm
    const row = vm.rows[0]
    expect(row).toBeTruthy()
    if (!row) {
      throw new Error('row missing')
    }

    vm.onPinInput(row, { target: { value: '123456' } } as unknown as Event)
    await vm.claim(row)
    await flushPromises()

    expect(claimSpy).toHaveBeenCalledWith({
      claimPin: '123456',
      mac: 'AA:BB:CC:DD:EE:FF',
      name: 'PIGROW-XYZ',
    })
    expect(routerPush).toHaveBeenCalledWith('/admin/controllers/edit/c-claimed')
  })

  it('sets an inline error on the row and does not navigate when the PIN is rejected', async () => {
    const apiStore = useApiStore()
    vi.spyOn(apiStore, 'scanControllers').mockResolvedValue({
      controllers: [makeDiscovery()],
    })
    vi.spyOn(apiStore, 'claimController').mockRejectedValue(axiosError(401, 'Wrong PIN'))

    const w = mount(ScanControllersView, { global: { stubs: primeVueStubs } })
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    await nextTick()

    const vm = w.vm as unknown as ExposedVm
    const row = vm.rows[0]
    if (!row) {
      throw new Error('row missing')
    }
    vm.onPinInput(row, { target: { value: '000000' } } as unknown as Event)
    await vm.claim(row)
    await flushPromises()

    expect(row.error).toBe('Wrong or expired PIN.')
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('refuses to claim a row whose PIN has expired', async () => {
    const apiStore = useApiStore()
    vi.spyOn(apiStore, 'scanControllers').mockResolvedValue({
      controllers: [makeDiscovery({ pinActive: false, serial: 'PIGROW-DEAD' })],
    })
    const claimSpy = vi.spyOn(apiStore, 'claimController').mockResolvedValue(makeController())

    const w = mount(ScanControllersView, { global: { stubs: primeVueStubs } })
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    await nextTick()

    const vm = w.vm as unknown as ExposedVm
    const row = vm.rows[0]
    if (!row) {
      throw new Error('row missing')
    }
    expect(row.controller.pinActive).toBe(false)
    vm.onPinInput(row, { target: { value: '123456' } } as unknown as Event)
    await vm.claim(row)
    await flushPromises()

    expect(claimSpy).not.toHaveBeenCalled()
    expect(row.error).toContain('PIN expired')
    expect(routerPush).not.toHaveBeenCalled()
  })
})
