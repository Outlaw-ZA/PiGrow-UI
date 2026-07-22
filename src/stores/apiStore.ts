import { defineStore, storeToRefs } from 'pinia'
import { useControllerStore } from './controllerStore'
import { useDeviceStore } from './deviceStore'
import { useGrowCycleStore } from './growCycleStore'
import { useGrowPhaseStore } from './growPhaseStore'
import { useNutrientStore } from './nutrientStore'
import { usePhaseNutrientStore } from './phaseNutrientStore'
import { useSensorStore } from './sensorStore'
import { useTelemetryStore } from './telemetryStore'
import { useAutomationRuleStore } from './automationRuleStore'
import axios from 'axios'
import { API_BASE } from './apiBase'

export type DosingWarningCode = 'NO_NUTRIENTS_CONFIGURED' | 'NO_PH_BANDS' | 'RESERVOIR_TOO_SMALL'

export interface DosingPreviewPayload {
  reservoirLiters: number
}

export interface DosingPreviewResponse {
  mlByNutrientId: Record<string, number>
  totalMl: number
  warnings: DosingWarningCode[]
}

export const useApiStore = defineStore('api', () => {
  const controllerStore = useControllerStore()
  const deviceStore = useDeviceStore()
  const growCycleStore = useGrowCycleStore()
  const growPhaseStore = useGrowPhaseStore()
  const nutrientStore = useNutrientStore()
  const phaseNutrientStore = usePhaseNutrientStore()
  const sensorStore = useSensorStore()
  const telemetryStore = useTelemetryStore()
  const automationRuleStore = useAutomationRuleStore()

  async function previewDosing(growPhaseId: string, payload: DosingPreviewPayload) {
    const res = await axios.post(`${API_BASE}/grow-phases/${growPhaseId}/dosing/preview`, payload)
    return res.data as DosingPreviewResponse
  }

  const dosing = { preview: previewDosing }

  const { controllers, loading } = storeToRefs(controllerStore)
  const { growCycles } = storeToRefs(growCycleStore)
  const { nutrients } = storeToRefs(nutrientStore)

  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([controllerStore.fetchAll(), growCycleStore.fetchAll()])
    } catch (error) {
      console.error('Failed to sync state from backend', error)
    } finally {
      loading.value = false
    }
  }

  async function fetchNutrients() {
    return nutrientStore.fetchAll()
  }

  return {
    activateGrowPhase: growPhaseStore.activateGrowPhase,
    claimController: controllerStore.claimController,
    controllers,
    createController: controllerStore.createController,
    createDevice: deviceStore.createDevice,
    createDevicesBatch: deviceStore.createDevicesBatch,
    createGrowCycle: growCycleStore.createGrowCycle,
    createGrowPhase: growPhaseStore.createGrowPhase,
    createNutrient: nutrientStore.createNutrient,
    createRule: automationRuleStore.createRule,
    createSensor: sensorStore.createSensor,
    deleteController: controllerStore.deleteController,
    deleteDevice: deviceStore.deleteDevice,
    deleteGrowCycle: growCycleStore.deleteGrowCycle,
    deleteGrowPhase: growPhaseStore.deleteGrowPhase,
    deleteNutrient: nutrientStore.deleteNutrient,
    deletePhaseEnvironment: growPhaseStore.deletePhaseEnvironment,
    deleteRule: automationRuleStore.deleteRule,
    dosing,
    deleteSensor: sensorStore.deleteSensor,
    endGrow: growCycleStore.endGrow,
    extendActivePhase: growCycleStore.extendActivePhase,
    fetchAll,
    fetchController: controllerStore.fetchController,
    fetchDeviceStateLogs: deviceStore.fetchDeviceStateLogs,
    fetchDevices: deviceStore.fetchDevices,
    fetchGrowCycle: growCycleStore.fetchGrowCycle,
    fetchLatestTelemetry: telemetryStore.fetchLatestTelemetry,
    fetchNutrients,
    fetchPhaseEnvironment: growPhaseStore.fetchPhaseEnvironment,
    fetchPhases: growPhaseStore.fetchPhases,
    fetchRulesByCycle: automationRuleStore.fetchRulesByCycle,
    fetchRulesByDevice: automationRuleStore.fetchRulesByDevice,
    fetchRulesByPhase: automationRuleStore.fetchRulesByPhase,
    fetchSensor: sensorStore.fetchSensor,
    fetchSensors: sensorStore.fetchSensors,
    fetchTelemetry: telemetryStore.fetchTelemetry,
    fetchTelemetryRange: telemetryStore.fetchTelemetryRange,
    findDeviceOnController: deviceStore.findDeviceOnController,
    growCycles,
    loading,
    nutrients,
    phaseNutrients: {
      addOne: phaseNutrientStore.addOne,
      fetchForPhase: phaseNutrientStore.fetchForPhase,
      removeOne: phaseNutrientStore.removeOne,
      updateOne: phaseNutrientStore.updateOne,
    },
    pollDevices: deviceStore.pollDevices,
    scanControllers: controllerStore.scanControllers,
    sendDeviceCommand: deviceStore.sendDeviceCommand,
    skipGrowPhase: growCycleStore.skipGrowPhase,
    stopDevicePolling: deviceStore.stopDevicePolling,
    toggleRule: automationRuleStore.toggleRule,
    updateController: controllerStore.updateController,
    updateDevice: deviceStore.updateDevice,
    updateDeviceInCache: deviceStore.updateDeviceInCache,
    updateGrowCycle: growCycleStore.updateGrowCycle,
    updateGrowPhase: growPhaseStore.updateGrowPhase,
    updateNutrient: nutrientStore.updateNutrient,
    updateRule: automationRuleStore.updateRule,
    updateSensor: sensorStore.updateSensor,
    upsertPhaseEnvironment: growPhaseStore.upsertPhaseEnvironment,
  }
})
