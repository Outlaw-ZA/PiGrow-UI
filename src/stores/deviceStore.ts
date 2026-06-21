import { defineStore } from 'pinia'
import axios from 'axios'
import type { Device } from '../types/grow'
import { API_BASE } from './apiBase'
import { useControllerStore } from './controllerStore'

export const useDeviceStore = defineStore('device', () => {
  async function fetchDevices(controllerId: string) {
    const res = await axios.get(`${API_BASE}/devices/controller/${controllerId}`)
    const { controllers } = useControllerStore()
    const ctrl = controllers.find((c) => c.id === controllerId)
    if (ctrl) {
      ctrl.devices = res.data
    }
    return res.data as Device[]
  }

  async function createDevice(payload: Partial<Device>) {
    const res = await axios.post(`${API_BASE}/devices`, payload)
    const { controllers } = useControllerStore()
    const ctrl = controllers.find((c) => c.id === payload.controllerId)
    if (ctrl) {
      if (!ctrl.devices) {
        ctrl.devices = []
      }
      ctrl.devices.push(res.data)
    }
  }

  async function updateDevice(id: string, payload: Partial<Device>) {
    const res = await axios.put(`${API_BASE}/devices/${id}`, payload)
    const { controllers } = useControllerStore()
    for (const ctrl of controllers) {
      const idx = ctrl.devices?.findIndex((d) => d.id === id)
      if (idx !== undefined && idx !== -1) {
        ctrl.devices![idx] = res.data
        break
      }
    }
  }

  async function deleteDevice(id: string) {
    await axios.delete(`${API_BASE}/devices/${id}`)
    const { controllers } = useControllerStore()
    for (const ctrl of controllers) {
      if (ctrl.devices) {
        ctrl.devices = ctrl.devices.filter((d) => d.id !== id)
      }
    }
  }

  async function sendDeviceCommand(deviceId: string, action: 'ON' | 'OFF') {
    await axios.post(`${API_BASE}/devices/${deviceId}/command`, { action })
    const { controllers } = useControllerStore()
    for (const ctrl of controllers) {
      const device = ctrl.devices?.find((d) => d.id === deviceId)
      if (device) {
        device.isActive = action === 'ON'
        break
      }
    }
  }

  return {
    createDevice,
    deleteDevice,
    fetchDevices,
    sendDeviceCommand,
    updateDevice,
  }
})
