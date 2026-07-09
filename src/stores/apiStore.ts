import { defineStore, storeToRefs } from 'pinia'
import { useControllerStore } from './controllerStore'
import { useDeviceStore } from './deviceStore'
import { useGrowCycleStore } from './growCycleStore'
import { useGrowPhaseStore } from './growPhaseStore'
import { useSensorStore } from './sensorStore'
import { useTelemetryStore } from './telemetryStore'
import { useAutomationRuleStore } from './automationRuleStore'

export const useApiStore = defineStore('api', () => {
  const controllerStore = useControllerStore()
  const deviceStore = useDeviceStore()
  const growCycleStore = useGrowCycleStore()
  const growPhaseStore = useGrowPhaseStore()
  const sensorStore = useSensorStore()
  const telemetryStore = useTelemetryStore()
  const automationRuleStore = useAutomationRuleStore()

  const { controllers, loading } = storeToRefs(controllerStore)
  const { growCycles } = storeToRefs(growCycleStore)

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

  return {
    activateGrowPhase: growPhaseStore.activateGrowPhase,
    controllers,
    createController: controllerStore.createController,
    createDevice: deviceStore.createDevice,
    createDevicesBatch: deviceStore.createDevicesBatch,
    createGrowCycle: growCycleStore.createGrowCycle,
    createGrowPhase: growPhaseStore.createGrowPhase,
    createRule: automationRuleStore.createRule,
    createSensor: sensorStore.createSensor,
    deleteController: controllerStore.deleteController,
    deleteDevice: deviceStore.deleteDevice,
    deleteGrowCycle: growCycleStore.deleteGrowCycle,
    deleteGrowPhase: growPhaseStore.deleteGrowPhase,
    deletePhaseEnvironment: growPhaseStore.deletePhaseEnvironment,
    deleteRule: automationRuleStore.deleteRule,
    deleteSensor: sensorStore.deleteSensor,
    endGrow: growCycleStore.endGrow,
    fetchAll,
    fetchController: controllerStore.fetchController,
    fetchDevices: deviceStore.fetchDevices,
    fetchGrowCycle: growCycleStore.fetchGrowCycle,
    fetchLatestTelemetry: telemetryStore.fetchLatestTelemetry,
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
    pollDevices: deviceStore.pollDevices,
    sendDeviceCommand: deviceStore.sendDeviceCommand,
    skipGrowPhase: growCycleStore.skipGrowPhase,
    stopDevicePolling: deviceStore.stopDevicePolling,
    toggleRule: automationRuleStore.toggleRule,
    updateController: controllerStore.updateController,
    updateDevice: deviceStore.updateDevice,
    updateGrowCycle: growCycleStore.updateGrowCycle,
    updateGrowPhase: growPhaseStore.updateGrowPhase,
    updateRule: automationRuleStore.updateRule,
    updateSensor: sensorStore.updateSensor,
    upsertPhaseEnvironment: growPhaseStore.upsertPhaseEnvironment,
  }
})
