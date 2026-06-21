import { defineStore } from 'pinia'
import axios from 'axios'
import type { DeviceConfig } from '../types/grow'
import { API_BASE } from './apiBase'

export const useDeviceConfigStore = defineStore('deviceConfig', () => {
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

  return {
    createDeviceConfig,
    deleteDeviceConfig,
    fetchDeviceConfigs,
    updateDeviceConfig,
  }
})
