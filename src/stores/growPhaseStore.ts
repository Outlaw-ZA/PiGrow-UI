import { defineStore } from 'pinia'
import axios from 'axios'
import type { GrowPhase, PhaseEnvironment, PhaseEnvironmentPayload } from '../types/grow'
import { API_BASE } from './apiBase'

export interface PhaseEnvironmentResponse {
  growPhaseId: string
  day: PhaseEnvironment | null
  night: PhaseEnvironment | null
}

export const useGrowPhaseStore = defineStore('growPhase', () => {
  async function fetchPhases(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/grow-phases/cycle/${growCycleId}`)
    return res.data as GrowPhase[]
  }

  async function fetchPhaseEnvironment(growPhaseId: string) {
    const res = await axios.get(`${API_BASE}/grow-phases/${growPhaseId}/environment`)
    return res.data as PhaseEnvironmentResponse
  }

  async function upsertPhaseEnvironment(
    growPhaseId: string,
    period: 'DAY' | 'NIGHT',
    payload: PhaseEnvironmentPayload,
  ) {
    const res = await axios.put(
      `${API_BASE}/grow-phases/${growPhaseId}/environment/${period}`,
      payload,
    )
    return res.data as PhaseEnvironment
  }

  async function deletePhaseEnvironment(growPhaseId: string, period: 'DAY' | 'NIGHT') {
    await axios.delete(`${API_BASE}/grow-phases/${growPhaseId}/environment/${period}`)
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
    deletePhaseEnvironment,
    fetchPhaseEnvironment,
    fetchPhases,
    updateGrowPhase,
    upsertPhaseEnvironment,
  }
})
