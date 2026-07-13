import { defineStore } from 'pinia'
import axios from 'axios'
import type { Device, DeviceSeed, DeviceStateLog } from '../types/grow'
import { API_BASE } from './apiBase'
import { useControllerStore } from './controllerStore'

export const useDeviceStore = defineStore('device', () => {
  function findController(controllerId: string) {
    const { controllers } = useControllerStore()
    return controllers.find((c) => c.id === controllerId) as
      | ((typeof controllers)[number] & { devices?: Device[] })
      | undefined
  }

  function findDeviceOnController(controllerId: string, deviceId: string): Device | undefined {
    return findController(controllerId)?.devices?.find((d) => d.id === deviceId)
  }

  function ensureDevicesArray(controllerId: string): Device[] | undefined {
    const controller = findController(controllerId)
    if (!controller) {
      return undefined
    }
    if (!controller.devices) {
      controller.devices = []
    }
    return controller.devices
  }

  async function fetchDevices(controllerId: string) {
    const res = await axios.get(`${API_BASE}/devices/controller/${controllerId}`)
    const devices = res.data as Device[]
    const arr = ensureDevicesArray(controllerId)
    if (arr) {
      arr.splice(0, arr.length, ...devices)
    }
    return devices
  }

  function updateDeviceInCache(controllerId: string, device: Partial<Device> & { id: string }) {
    const arr = ensureDevicesArray(controllerId)
    if (!arr) {
      return
    }
    const idx = arr.findIndex((d) => d.id === device.id)
    if (idx !== -1) {
      const found = arr[idx]
      if (found) {
        Object.assign(found, device)
      }
    }
  }

  function removeDeviceFromCache(controllerId: string, deviceId: string) {
    const arr = ensureDevicesArray(controllerId)
    if (arr) {
      const idx = arr.findIndex((d) => d.id === deviceId)
      if (idx !== -1) {
        arr.splice(idx, 1)
      }
    }
  }

  async function createDevice(payload: { controllerId: string } & DeviceSeed) {
    const { controllerId, ...seed } = payload
    const res = await axios.post(`${API_BASE}/devices`, { controllerId, ...seed })
    const created = res.data as Device
    const arr = ensureDevicesArray(controllerId)
    if (arr) {
      arr.push(created)
    }
    return created
  }

  async function createDevicesBatch(controllerId: string, devices: DeviceSeed[]) {
    const res = await axios.post(`${API_BASE}/devices/batch`, { controllerId, devices })
    const created = res.data as Device[]
    const arr = ensureDevicesArray(controllerId)
    if (arr) {
      arr.push(...created)
    }
    return created
  }

  async function updateDevice(id: string, controllerId: string, payload: Partial<DeviceSeed>) {
    const res = await axios.put(`${API_BASE}/devices/${id}`, payload)
    const updated = res.data as Device
    updateDeviceInCache(controllerId, updated)
    return updated
  }

  async function deleteDevice(id: string, controllerId: string) {
    await axios.delete(`${API_BASE}/devices/${id}`)
    removeDeviceFromCache(controllerId, id)
  }

  async function sendDeviceCommand(deviceId: string, controllerId: string, action: 'ON' | 'OFF') {
    await axios.post(`${API_BASE}/devices/${deviceId}/command`, { action })
    updateDeviceInCache(controllerId, { id: deviceId, isActive: action === 'ON' })
  }

  async function fetchDeviceStateLogs(
    deviceId: string,
    params?: { from?: string; to?: string; limit?: number },
  ) {
    const res = await axios.get(`${API_BASE}/devices/${deviceId}/state-logs`, { params })
    return res.data as { logs: DeviceStateLog[]; priorAction: 'ON' | 'OFF' | null }
  }

  let pollingTimer: ReturnType<typeof setInterval> | null = null

  function pollDevices(controllerId: string, intervalMs = 5000) {
    stopDevicePolling()
    pollingTimer = setInterval(async () => {
      try {
        await fetchDevices(controllerId)
      } catch {
        // Polling errors are non-critical
      }
    }, intervalMs)
  }

  function stopDevicePolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  return {
    createDevice,
    createDevicesBatch,
    deleteDevice,
    fetchDeviceStateLogs,
    fetchDevices,
    findDeviceOnController,
    pollDevices,
    removeDeviceFromCache,
    sendDeviceCommand,
    stopDevicePolling,
    updateDevice,
    updateDeviceInCache,
  }
})
