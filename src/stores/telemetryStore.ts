import { defineStore } from 'pinia'
import axios from 'axios'
import type { Telemetry, TelemetryFilterParams } from '../types/grow'
import { API_BASE } from './apiBase'

export const useTelemetryStore = defineStore('telemetry', () => {
  async function fetchTelemetry(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/telemetry/grow-cycle/${growCycleId}`)
    return res.data as Telemetry[]
  }

  async function fetchLatestTelemetry(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/telemetry/grow-cycle/${growCycleId}/latest`)
    return res.data as Telemetry[]
  }

  async function fetchTelemetryRange(growCycleId: string, params: TelemetryFilterParams) {
    const res = await axios.get(`${API_BASE}/telemetry/grow-cycle/${growCycleId}/range`, {
      params,
    })
    return res.data as Telemetry[]
  }

  return {
    fetchLatestTelemetry,
    fetchTelemetry,
    fetchTelemetryRange,
  }
})
