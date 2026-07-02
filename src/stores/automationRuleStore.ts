import { defineStore } from 'pinia'
import axios from 'axios'
import type {
  AutomationRule,
  CreateAutomationRulePayload,
  UpdateAutomationRulePayload,
} from '../types/grow'
import { API_BASE } from './apiBase'

export const useAutomationRuleStore = defineStore('automationRule', () => {
  async function fetchRulesByPhase(growPhaseId: string) {
    const res = await axios.get(`${API_BASE}/automation-rules/grow-phase/${growPhaseId}`)
    return res.data as AutomationRule[]
  }

  async function fetchRulesByCycle(growCycleId: string) {
    const res = await axios.get(`${API_BASE}/automation-rules/grow-cycle/${growCycleId}`)
    return res.data as AutomationRule[]
  }

  async function fetchRulesByDevice(deviceId: string) {
    const res = await axios.get(`${API_BASE}/automation-rules/device/${deviceId}`)
    return res.data as AutomationRule[]
  }

  async function createRule(payload: CreateAutomationRulePayload) {
    const res = await axios.post(`${API_BASE}/automation-rules`, payload)
    return res.data as AutomationRule
  }

  async function updateRule(id: string, payload: UpdateAutomationRulePayload) {
    const res = await axios.put(`${API_BASE}/automation-rules/${id}`, payload)
    return res.data as AutomationRule
  }

  async function toggleRule(id: string) {
    const res = await axios.patch(`${API_BASE}/automation-rules/${id}/toggle`)
    return res.data as AutomationRule
  }

  async function deleteRule(id: string) {
    await axios.delete(`${API_BASE}/automation-rules/${id}`)
  }

  return {
    createRule,
    deleteRule,
    fetchRulesByCycle,
    fetchRulesByDevice,
    fetchRulesByPhase,
    toggleRule,
    updateRule,
  }
})
