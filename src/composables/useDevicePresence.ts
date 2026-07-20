import { onUnmounted, shallowRef } from 'vue'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { API_BASE } from '../stores/apiBase'
import { useControllerStore } from '../stores/controllerStore'
import { useDeviceStore } from '../stores/deviceStore'
import type { DeviceStateUpdate } from '../types/grow'

function applyDeviceStateUpdate(update: DeviceStateUpdate) {
  const controllerStore = useControllerStore()
  const deviceStore = useDeviceStore()
  const owner = controllerStore.controllers.find(
    (c) => Array.isArray(c.devices) && c.devices.some((d) => d.id === update.deviceId),
  )
  if (!owner) {
    return
  }
  deviceStore.updateDeviceInCache(owner.id, { id: update.deviceId, isActive: update.isActive })
}

export function useDevicePresence() {
  const socket = shallowRef<Socket | null>(null)
  let isStarted = false

  function start() {
    if (isStarted) {
      return
    }
    isStarted = true

    const { origin } = new URL(API_BASE)
    const next = io(origin, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    })
    socket.value = next
    next.on('device_state_update', applyDeviceStateUpdate)
  }

  function stop() {
    if (!isStarted) {
      return
    }
    isStarted = false
    if (socket.value) {
      socket.value.off('device_state_update', applyDeviceStateUpdate)
      socket.value.removeAllListeners()
      socket.value.disconnect()
      socket.value = null
    }
  }

  onUnmounted(stop)

  return {
    socket,
    start,
    stop,
  }
}
