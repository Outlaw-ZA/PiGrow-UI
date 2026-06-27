import { defineStore } from 'pinia'
import axios from 'axios'
import type { Device, DeviceSeed } from '../types/grow'
import { API_BASE } from './apiBase'
import { useGrowCycleStore } from './growCycleStore'

export const useDeviceStore = defineStore('device', () => {
  async function fetchDevices(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/devices/grow-cycle/${growCycleId}`)
    const devices = res.data as Device[]
    const { growCycles } = useGrowCycleStore()
    const idx = growCycles.findIndex((g) => g.id === growCycleId)
    if (idx !== -1) {
      growCycles[idx] = { ...growCycles[idx] } as (typeof growCycles)[number]
      ;(growCycles[idx] as { devices?: Device[] }).devices = devices
    }
    return devices
  }

  function setDevicesOnGrow(growCycleId: string, devices: Device[]) {
    const { growCycles } = useGrowCycleStore()
    const idx = growCycles.findIndex((g) => g.id === growCycleId)
    if (idx !== -1) {
      ;(growCycles[idx] as { devices?: Device[] }).devices = devices
    }
  }

  function findDeviceInGrow(growCycleId: string, deviceId: string): Device | undefined {
    const { growCycles } = useGrowCycleStore()
    const cycle = growCycles.find((g) => g.id === growCycleId) as
      | ((typeof growCycles)[number] & { devices?: Device[] })
      | undefined
    return cycle?.devices?.find((d) => d.id === deviceId)
  }

  function updateDeviceInCache(device: Device) {
    const found = findDeviceInGrow(device.growCycleId, device.id)
    if (found) {
      Object.assign(found, device)
    }
  }

  function removeDeviceFromCache(growCycleId: string, deviceId: string) {
    const { growCycles } = useGrowCycleStore()
    const cycle = growCycles.find((g) => g.id === growCycleId) as
      | ((typeof growCycles)[number] & { devices?: Device[] })
      | undefined
    if (cycle?.devices) {
      cycle.devices = cycle.devices.filter((d) => d.id !== deviceId)
    }
  }

  async function createDevice(payload: { growCycleId: string } & DeviceSeed) {
    const res = await axios.post(`${API_BASE}/devices`, payload)
    const created = res.data as Device
    const { growCycles } = useGrowCycleStore()
    const cycle = growCycles.find((g) => g.id === payload.growCycleId) as
      | ((typeof growCycles)[number] & { devices?: Device[] })
      | undefined
    if (cycle) {
      if (!cycle.devices) {
        cycle.devices = []
      }
      cycle.devices.push(created)
    }
    return created
  }

  async function createDevicesBatch(growCycleId: string, devices: DeviceSeed[]) {
    const res = await axios.post(`${API_BASE}/devices/batch`, { devices, growCycleId })
    const created = res.data as Device[]
    const { growCycles } = useGrowCycleStore()
    const cycle = growCycles.find((g) => g.id === growCycleId) as
      | ((typeof growCycles)[number] & { devices?: Device[] })
      | undefined
    if (cycle) {
      if (!cycle.devices) {
        cycle.devices = []
      }
      cycle.devices.push(...created)
    }
    return created
  }

  async function updateDevice(id: string, growCycleId: string, payload: Partial<DeviceSeed>) {
    const res = await axios.put(`${API_BASE}/devices/${id}`, payload)
    const updated = res.data as Device
    updateDeviceInCache({ ...updated, growCycleId })
    return updated
  }

  async function deleteDevice(id: string, growCycleId: string) {
    await axios.delete(`${API_BASE}/devices/${id}`)
    removeDeviceFromCache(growCycleId, id)
  }

  async function sendDeviceCommand(deviceId: string, growCycleId: string, action: 'ON' | 'OFF') {
    await axios.post(`${API_BASE}/devices/${deviceId}/command`, { action })
    const found = findDeviceInGrow(growCycleId, deviceId)
    if (found) {
      found.isActive = action === 'ON'
    }
  }

  return {
    createDevice,
    createDevicesBatch,
    deleteDevice,
    fetchDevices,
    findDeviceInGrow,
    removeDeviceFromCache,
    sendDeviceCommand,
    setDevicesOnGrow,
    updateDevice,
    updateDeviceInCache,
  }
})
