import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { DeviceSeed, GrowCycle, GrowCycleListItem } from '../types/grow'
import { API_BASE } from './apiBase'

function toListItem(cycle: GrowCycle): GrowCycleListItem {
  return {
    controller: {
      name: cycle.controller?.name ?? '',
      status: cycle.controller?.status ?? 'OFFLINE',
    },
    controllerId: cycle.controllerId,
    createdAt: cycle.createdAt,
    id: cycle.id,
    isActive: cycle.isActive,
    name: cycle.name,
    startAt: cycle.startAt ?? null,
    updatedAt: cycle.updatedAt,
  }
}

export interface CreateGrowCyclePayload {
  name: string
  controllerId: string
  isActive?: boolean
  startAt?: string
  devices: DeviceSeed[]
}

export interface UpdateGrowCyclePayload {
  name?: string
  isActive?: boolean
  startAt?: string
}

export const useGrowCycleStore = defineStore('growCycle', () => {
  const growCycles = ref<GrowCycleListItem[]>([])

  async function fetchAll() {
    const res = await axios.get(`${API_BASE}/grow-cycles`)
    growCycles.value = res.data
  }

  async function createGrowCycle(payload: CreateGrowCyclePayload) {
    const { startAt, isActive, devices, ...rest } = payload
    const createBody = { ...rest, devices, isActive }
    const res = await axios.post(`${API_BASE}/grow-cycles`, createBody)
    const cycle = res.data as GrowCycle
    if (startAt) {
      const updated = await axios.put(`${API_BASE}/grow-cycles/${cycle.id}`, { isActive, startAt })
      Object.assign(cycle, { isActive: updated.data.isActive, startAt: updated.data.startAt })
    }
    growCycles.value.push(toListItem(cycle))
    return cycle
  }

  async function updateGrowCycle(id: string, payload: UpdateGrowCyclePayload) {
    const res = await axios.put(`${API_BASE}/grow-cycles/${id}`, payload)
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      const merged = { ...growCycles.value[idx] } as Partial<GrowCycleListItem>
      const incoming = res.data as Partial<GrowCycleListItem>
      for (const key of Object.keys(incoming) as (keyof GrowCycleListItem)[]) {
        const value = incoming[key]
        if (value !== undefined) {
          ;(merged as Record<string, unknown>)[key] = value
        }
      }
      growCycles.value[idx] = merged as GrowCycleListItem
    }
    return res.data as GrowCycle
  }

  async function deleteGrowCycle(id: string) {
    await axios.delete(`${API_BASE}/grow-cycles/${id}`)
    growCycles.value = growCycles.value.filter((g) => g.id !== id)
  }

  async function fetchGrowCycle(id: string) {
    const res = await axios.get(`${API_BASE}/grow-cycles/${id}`)
    const cycle = res.data as GrowCycle
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      growCycles.value[idx] = { ...growCycles.value[idx], ...toListItem(cycle) }
    }
    return cycle
  }

  async function skipGrowPhase(id: string, today?: string) {
    const res = await axios.post(`${API_BASE}/grow-cycles/${id}/skip-phase`, undefined, {
      params: today ? { today } : undefined,
    })
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      growCycles.value[idx] = { ...growCycles.value[idx], ...toListItem(res.data as GrowCycle) }
    }
    return res.data as GrowCycle
  }

  async function endGrow(id: string, today?: string) {
    const res = await axios.post(`${API_BASE}/grow-cycles/${id}/end-grow`, undefined, {
      params: today ? { today } : undefined,
    })
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      growCycles.value[idx] = { ...growCycles.value[idx], ...toListItem(res.data as GrowCycle) }
    }
    return res.data as GrowCycle
  }

  return {
    createGrowCycle,
    deleteGrowCycle,
    endGrow,
    fetchAll,
    fetchGrowCycle,
    growCycles,
    skipGrowPhase,
    updateGrowCycle,
  }
})
