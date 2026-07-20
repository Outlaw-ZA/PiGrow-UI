import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: vi.fn() }),
}))
vi.mock('../../composables/useUnsavedGuard', () => ({
  useUnsavedGuard: () => undefined,
}))

const routerPush = vi.fn()
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => ({ params: { id: 'ctrl-1' } }),
    useRouter: () => ({ push: routerPush }),
  }
})

vi.mock('../../stores/apiStore', () => ({
  useApiStore: () => ({
    controllers: [],
    createController: vi.fn().mockResolvedValue({ id: 'new' }),
    createDevice: () => Promise.resolve(),
    createDevicesBatch: () => Promise.resolve(),
    deleteController: () => Promise.resolve(),
    deleteDevice: () => Promise.resolve(),
    deleteSensor: () => Promise.resolve(),
    fetchAll: vi.fn().mockResolvedValue(undefined),
    fetchController: () => Promise.resolve(),
    fetchDevices: () => Promise.resolve(),
    fetchSensor: () => Promise.resolve(),
    fetchSensors: () => Promise.resolve(),
    updateController: () => Promise.resolve(),
    updateDevice: () => Promise.resolve(),
    updateSensor: () => Promise.resolve(),
  }),
}))

import ControllerFormView from './ControllerFormView.vue'
import { primeVueStubs } from '../../utils/testStub'

describe('ControllerFormView device sub-form', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerPush.mockReset()
  })
  afterEach(() => {
    setActivePinia(null as unknown as ReturnType<typeof createPinia>)
    vi.restoreAllMocks()
  })

  it('renders the maxOnSeconds InputNumber inside the Add Device dialog', async () => {
    const w = mount(ControllerFormView, {
      global: { stubs: primeVueStubs },
    })
    await nextTick()

    ;(w.vm as unknown as { activeTab: string }).activeTab = 'devices'
    await nextTick()

    w.vm.$emit('openAddDevice')
    await (w.vm as unknown as { openAddDevice: () => Promise<void> }).openAddDevice()
    await nextTick()

    expect(w.find('[data-testid="dev-max-on"]').exists()).toBe(true)
  })
})
