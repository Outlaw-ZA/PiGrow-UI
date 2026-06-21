import { defineStore } from 'pinia'
import axios from 'axios'
import type { GrowPhase } from '../types/grow'
import { API_BASE } from './apiBase'

export const useGrowPhaseStore = defineStore('growPhase', () => {
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

  return {
    activateGrowPhase,
    createGrowPhase,
    deleteGrowPhase,
    fetchPhases,
    updateGrowPhase,
  }
})
