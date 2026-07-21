import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { CreateNutrientPayload, Nutrient, UpdateNutrientPayload } from '../types/grow'
import { API_BASE } from './apiBase'

export const useNutrientStore = defineStore('nutrient', () => {
  const nutrients = ref<Nutrient[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const res = await axios.get(`${API_BASE}/nutrients`)
      nutrients.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function createNutrient(payload: CreateNutrientPayload) {
    const res = await axios.post(`${API_BASE}/nutrients`, payload)
    const created = res.data as Nutrient
    const idx = nutrients.value.findIndex((n) => n.id === created.id)
    if (idx === -1) {
      nutrients.value.push(created)
    } else {
      nutrients.value[idx] = created
    }
    return created
  }

  async function updateNutrient(id: string, payload: UpdateNutrientPayload) {
    const res = await axios.patch(`${API_BASE}/nutrients/${id}`, payload)
    const updated = res.data as Nutrient
    const idx = nutrients.value.findIndex((n) => n.id === id)
    if (idx !== -1) {
      nutrients.value[idx] = updated
    }
    return updated
  }

  async function deleteNutrient(id: string) {
    await axios.delete(`${API_BASE}/nutrients/${id}`)
    nutrients.value = nutrients.value.filter((n) => n.id !== id)
  }

  return {
    createNutrient,
    deleteNutrient,
    fetchAll,
    loading,
    nutrients,
    updateNutrient,
  }
})
