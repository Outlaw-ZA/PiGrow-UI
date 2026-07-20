import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

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

const updateDeviceInCacheMock = vi.fn()

vi.mock('socket.io-client', () => ({
  io: ((..._args: unknown[]) => ioMock()) as never,
}))

vi.mock('../stores/deviceStore', () => ({
  useDeviceStore: () => ({
    updateDeviceInCache: updateDeviceInCacheMock,
  }),
}))

const findMock = vi.fn()
vi.mock('../stores/controllerStore', () => ({
  useControllerStore: () => ({
    controllers: [
      {
        devices: [
          { id: 'd1', isActive: false },
          { id: 'd2', isActive: true },
        ],
        id: 'ctrl-1',
      },
    ],
    find: findMock,
  }),
}))

import { useDevicePresence } from './useDevicePresence'

describe('useDevicePresence device_state_update wiring', () => {
  let scope: ReturnType<typeof effectScope>
  let presence: ReturnType<typeof useDevicePresence> | undefined

  beforeEach(() => {
    handlers = {}
    onMock.mockClear()
    offMock.mockClear()
    removeAllListenersMock.mockClear()
    disconnectMock.mockClear()
    updateDeviceInCacheMock.mockClear()
    ioMock.mockClear()
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
  })

  it('updates the matching device cache entry when device_state_update fires', () => {
    scope.run(() => {
      presence = useDevicePresence()
    })
    presence!.start()

    handlers.device_state_update?.({ deviceId: 'd1', isActive: true })

    expect(updateDeviceInCacheMock).toHaveBeenCalledWith('ctrl-1', {
      id: 'd1',
      isActive: true,
    })
  })

  it('ignores updates for devices not present in any cached controller', () => {
    scope.run(() => {
      presence = useDevicePresence()
    })
    presence!.start()

    handlers.device_state_update?.({ deviceId: 'unknown-device', isActive: false })

    expect(updateDeviceInCacheMock).not.toHaveBeenCalled()
  })

  it('subscribes once and tears down handlers on stop', () => {
    scope.run(() => {
      presence = useDevicePresence()
    })
    presence!.start()
    expect(onMock).toHaveBeenCalledWith('device_state_update', expect.any(Function))

    presence!.stop()
    expect(removeAllListenersMock).toHaveBeenCalled()
    expect(disconnectMock).toHaveBeenCalled()

    handlers.device_state_update?.({ deviceId: 'd1', isActive: true })
    expect(updateDeviceInCacheMock).not.toHaveBeenCalled()
  })
})
