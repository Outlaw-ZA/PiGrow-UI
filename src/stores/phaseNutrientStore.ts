import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { DayNightPeriod } from '../types/grow'
import type {
  CreatePhaseNutrientPayload,
  PhaseNutrient,
  UpdatePhaseNutrientPayload,
} from '../types/grow'
import { API_BASE } from './apiBase'

export const usePhaseNutrientStore = defineStore('phaseNutrient', () => {
  const byPhase = ref<Record<string, PhaseNutrient[]>>({})
  const loading = ref(false)

  function setForPhase(growPhaseId: string, list: PhaseNutrient[]): void {
    byPhase.value = { ...byPhase.value, [growPhaseId]: list }
  }

  function getForPhase(growPhaseId: string): PhaseNutrient[] {
    return byPhase.value[growPhaseId] ?? []
  }

  function upsertLocal(growPhaseId: string, item: PhaseNutrient): void {
    const current = byPhase.value[growPhaseId] ?? []
    const idx = current.findIndex((pn) => pn.id === item.id)
    const next =
      idx === -1 ? [...current, item] : current.map((pn) => (pn.id === item.id ? item : pn))
    setForPhase(growPhaseId, next)
  }

  function removeLocal(growPhaseId: string, id: string): void {
    const current = byPhase.value[growPhaseId] ?? []
    setForPhase(
      growPhaseId,
      current.filter((pn) => pn.id !== id),
    )
  }

  async function fetchForPhase(growPhaseId: string, period?: DayNightPeriod) {
    loading.value = true
    try {
      const params = period ? { period } : {}
      const res = await axios.get(`${API_BASE}/grow-phases/${growPhaseId}/phase-nutrients`, {
        params,
      })
      const list = res.data as PhaseNutrient[]
      setForPhase(growPhaseId, list)
      return list
    } finally {
      loading.value = false
    }
  }

  async function addOne(growPhaseId: string, payload: CreatePhaseNutrientPayload) {
    const res = await axios.post(`${API_BASE}/grow-phases/${growPhaseId}/phase-nutrients`, payload)
    const created = res.data as PhaseNutrient
    upsertLocal(growPhaseId, created)
    return created
  }

  async function updateOne(growPhaseId: string, id: string, payload: UpdatePhaseNutrientPayload) {
    const res = await axios.patch(
      `${API_BASE}/grow-phases/${growPhaseId}/phase-nutrients/${id}`,
      payload,
    )
    const updated = res.data as PhaseNutrient
    upsertLocal(growPhaseId, updated)
    return updated
  }

  async function removeOne(growPhaseId: string, id: string) {
    await axios.delete(`${API_BASE}/grow-phases/${growPhaseId}/phase-nutrients/${id}`)
    removeLocal(growPhaseId, id)
  }

  return {
    addOne,
    byPhase,
    fetchForPhase,
    getForPhase,
    loading,
    removeOne,
    updateOne,
  }
})
