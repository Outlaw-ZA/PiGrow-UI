// src/stores/growStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { Controller, Device, GrowCycle } from '../types/grow'

const API_BASE = 'http://localhost:4000/api' // Change to your backend URL

export const useGrowStore = defineStore('grow', () => {
  // Reactive App States
  const controllers = ref<Controller[]>([])
  const growCycles = ref<GrowCycle[]>([])
  const loading = ref(false)

  // Fetch actions
  async function fetchAll() {
    loading.value = true
    try {
      const [resC, resG] = await Promise.all([
        axios.get(`${API_BASE}/controllers`),
        axios.get(`${API_BASE}/grow-cycles`),
      ])
      controllers.value = resC.data
      growCycles.value = resG.data
    } catch (err) {
      console.error('Failed to sync state from backend', err)
    } finally {
      loading.value = false
    }
  }

  // Create Operations
  async function createController(payload: Controller) {
    const res = await axios.post(`${API_BASE}/controllers`, payload)
    controllers.value.push(res.data)
  }

  async function createDevice(payload: Device) {
    const res = await axios.post(`${API_BASE}/devices`, payload)
    // Find local controller and append device locally
    const ctrl = controllers.value.find((c) => c.id === payload.controllerId)
    if (ctrl) {
      if (!ctrl.devices) ctrl.devices = []
      ctrl.devices.push(res.data)
    }
  }

  async function createGrowCycle(payload: GrowCycle) {
    const res = await axios.post(`${API_BASE}/grow-cycles`, payload)
    growCycles.value.push(res.data)
  }

  return {
    controllers,
    growCycles,
    loading,
    fetchAll,
    createController,
    createDevice,
    createGrowCycle,
  }
})
