import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { GrowCycle, GrowCycleListItem } from '../types/grow'
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

export const useGrowCycleStore = defineStore('growCycle', () => {
  const growCycles = ref<GrowCycleListItem[]>([])

  async function fetchAll() {
    const res = await axios.get(`${API_BASE}/grow-cycles`)
    growCycles.value = res.data
  }

  async function createGrowCycle(payload: {
    name: string
    controllerId: string
    isActive?: boolean
    startAt?: string
  }) {
    const { startAt, isActive, ...createBody } = payload
    const res = await axios.post(`${API_BASE}/grow-cycles`, createBody)
    let cycle = res.data as GrowCycle
    const phases = cycle.phases ?? []
    if (startAt) {
      const updated = await axios.put(`${API_BASE}/grow-cycles/${cycle.id}`, { isActive, startAt })
      cycle = { ...updated.data, phases } as GrowCycle
    }
    growCycles.value.push(toListItem(cycle))
    return cycle
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

  async function skipGrowPhase(id: string, today?: string) {
    const res = await axios.post(`${API_BASE}/grow-cycles/${id}/skip-phase`, undefined, {
      params: today ? { today } : undefined,
    })
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      growCycles.value[idx] = res.data
    }
    return res.data as GrowCycle
  }

  async function endGrow(id: string, today?: string) {
    const res = await axios.post(`${API_BASE}/grow-cycles/${id}/end-grow`, undefined, {
      params: today ? { today } : undefined,
    })
    const idx = growCycles.value.findIndex((g) => g.id === id)
    if (idx !== -1) {
      growCycles.value[idx] = res.data
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
