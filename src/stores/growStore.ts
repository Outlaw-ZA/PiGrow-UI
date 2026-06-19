import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type {
  Controller,
  Device,
  DeviceConfig,
  GrowCycle,
  GrowCycleListItem,
  GrowPhase,
  Telemetry,
} from '../types/grow'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.105:4000/api'

export const useGrowStore = defineStore('grow', () => {
  const controllers = ref<Controller[]>([])
  const growCycles = ref<GrowCycleListItem[]>([])
  const loading = ref(false)

  // ==================== FETCH ALL ====================

  async function fetchAll() {
    loading.value = true
    try {
      const [resC, resG] = await Promise.all([
        axios.get(`${API_BASE}/controllers`),
        axios.get(`${API_BASE}/grow-cycles`),
      ])
      controllers.value = resC.data
      growCycles.value = resG.data
    } catch (error) {
      console.error('Failed to sync state from backend', error)
    } finally {
      loading.value = false
    }
  }

  // ==================== CONTROLLERS ====================

  async function createController(payload: Partial<Controller>) {
    const res = await axios.post(`${API_BASE}/controllers`, payload)
    controllers.value.push(res.data)
  }

  async function updateController(id: string, payload: Partial<Controller>) {
    const res = await axios.put(`${API_BASE}/controllers/${id}`, payload)
    const idx = controllers.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      controllers.value[idx] = res.data
    }
  }

  async function deleteController(id: string) {
    await axios.delete(`${API_BASE}/controllers/${id}`)
    controllers.value = controllers.value.filter((c) => c.id !== id)
  }

  async function fetchController(id: string) {
    const res = await axios.get(`${API_BASE}/controllers/${id}`)
    const idx = controllers.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      controllers.value[idx] = res.data
    }
    return res.data as Controller
  }

  // ==================== DEVICES ====================

  async function fetchDevices(controllerId: string) {
    const res = await axios.get(`${API_BASE}/devices/controller/${controllerId}`)
    const ctrl = controllers.value.find((c) => c.id === controllerId)
    if (ctrl) {
      ctrl.devices = res.data
    }
    return res.data as Device[]
  }

  async function createDevice(payload: Partial<Device>) {
    const res = await axios.post(`${API_BASE}/devices`, payload)
    const ctrl = controllers.value.find((c) => c.id === payload.controllerId)
    if (ctrl) {
      if (!ctrl.devices) {
        ctrl.devices = []
      }
      ctrl.devices.push(res.data)
    }
  }

  async function updateDevice(id: string, payload: Partial<Device>) {
    const res = await axios.put(`${API_BASE}/devices/${id}`, payload)
    for (const ctrl of controllers.value) {
      const idx = ctrl.devices?.findIndex((d) => d.id === id)
      if (idx !== undefined && idx !== -1) {
        ctrl.devices![idx] = res.data
        break
      }
    }
  }

  async function deleteDevice(id: string) {
    await axios.delete(`${API_BASE}/devices/${id}`)
    for (const ctrl of controllers.value) {
      if (ctrl.devices) {
        ctrl.devices = ctrl.devices.filter((d) => d.id !== id)
      }
    }
  }

  async function sendDeviceCommand(deviceId: string, action: 'ON' | 'OFF') {
    await axios.post(`${API_BASE}/devices/${deviceId}/command`, { action })
    for (const ctrl of controllers.value) {
      const device = ctrl.devices?.find((d) => d.id === deviceId)
      if (device) {
        device.isActive = action === 'ON'
        break
      }
    }
  }

  // ==================== GROW CYCLES ====================

  async function createGrowCycle(payload: {
    name: string
    controllerId: string
    isActive?: boolean
  }) {
    const res = await axios.post(`${API_BASE}/grow-cycles`, payload)
    growCycles.value.push(res.data)
  }

  async function updateGrowCycle(id: string, payload: Partial<GrowCycle>) {
    const res = await axios.put(`${API_BASE}/grow-cycles/${id}`, payload)
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      growCycles.value[idx] = res.data
    }
  }

  async function deleteGrowCycle(id: string) {
    await axios.delete(`${API_BASE}/grow-cycles/${id}`)
    growCycles.value = growCycles.value.filter((g) => g.id !== id)
  }

  async function fetchGrowCycle(id: string) {
    const res = await axios.get(`${API_BASE}/grow-cycles/${id}`)
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      growCycles.value[idx] = res.data
    }
    return res.data as GrowCycle
  }

  // ==================== GROW PHASES ====================

  async function fetchPhases(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/grow-phases/cycle/${growCycleId}`)
    return res.data as GrowPhase[]
  }

  async function createGrowPhase(payload: Partial<GrowPhase>) {
    const res = await axios.post(`${API_BASE}/grow-phases`, payload)
    return res.data as GrowPhase
  }

  async function updateGrowPhase(id: string, payload: Partial<GrowPhase>) {
    const res = await axios.put(`${API_BASE}/grow-phases/${id}`, payload)
    return res.data as GrowPhase
  }

  async function deleteGrowPhase(id: string) {
    await axios.delete(`${API_BASE}/grow-phases/${id}`)
  }

  async function activateGrowPhase(id: string) {
    const res = await axios.patch(`${API_BASE}/grow-phases/${id}/activate`)
    return res.data as GrowPhase
  }

  // ==================== DEVICE CONFIGS ====================

  async function fetchDeviceConfigs(phaseId: string) {
    const res = await axios.get(`${API_BASE}/device-configs/phase/${phaseId}`)
    return res.data as DeviceConfig[]
  }

  async function createDeviceConfig(payload: Partial<DeviceConfig>) {
    const res = await axios.post(`${API_BASE}/device-configs`, payload)
    return res.data as DeviceConfig
  }

  async function updateDeviceConfig(id: string, payload: Partial<DeviceConfig>) {
    const res = await axios.put(`${API_BASE}/device-configs/${id}`, payload)
    return res.data as DeviceConfig
  }

  async function deleteDeviceConfig(id: string) {
    await axios.delete(`${API_BASE}/device-configs/${id}`)
  }

  // ==================== TELEMETRY ====================

  async function fetchTelemetry(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/telemetry/grow-cycle/${growCycleId}`)
    return res.data as Telemetry[]
  }

  async function fetchLatestTelemetry(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/telemetry/grow-cycle/${growCycleId}/latest`)
    return res.data as Telemetry[]
  }

  // ==================== EXPORTS ====================

  return {
    activateGrowPhase,
    controllers,
    createController,
    createDevice,
    createDeviceConfig,
    createGrowCycle,
    createGrowPhase,
    deleteController,
    deleteDevice,
    deleteDeviceConfig,
    deleteGrowCycle,
    deleteGrowPhase,
    fetchAll,
    fetchController,
    fetchDeviceConfigs,
    fetchDevices,
    fetchGrowCycle,
    fetchLatestTelemetry,
    fetchPhases,
    fetchTelemetry,
    growCycles,
    loading,
    sendDeviceCommand,
    updateController,
    updateDevice,
    updateDeviceConfig,
    updateGrowCycle,
    updateGrowPhase,
  }
})
