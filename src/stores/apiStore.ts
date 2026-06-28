import { defineStore, storeToRefs } from 'pinia'
import { useControllerStore } from './controllerStore'
import { useDeviceConfigStore } from './deviceConfigStore'
import { useDeviceStore } from './deviceStore'
import { useGrowCycleStore } from './growCycleStore'
import { useGrowPhaseStore } from './growPhaseStore'
import { useSensorStore } from './sensorStore'
import { useTelemetryStore } from './telemetryStore'

export const useApiStore = defineStore('api', () => {
  const controllerStore = useControllerStore()
  const deviceStore = useDeviceStore()
  const growCycleStore = useGrowCycleStore()
  const growPhaseStore = useGrowPhaseStore()
  const deviceConfigStore = useDeviceConfigStore()
  const sensorStore = useSensorStore()
  const telemetryStore = useTelemetryStore()

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
    createDeviceConfig: deviceConfigStore.createDeviceConfig,
    createGrowCycle: growCycleStore.createGrowCycle,
    createGrowPhase: growPhaseStore.createGrowPhase,
    createSensor: sensorStore.createSensor,
    deleteController: controllerStore.deleteController,
    deleteDevice: deviceStore.deleteDevice,
    deleteDeviceConfig: deviceConfigStore.deleteDeviceConfig,
    deleteGrowCycle: growCycleStore.deleteGrowCycle,
    deleteGrowPhase: growPhaseStore.deleteGrowPhase,
    deleteSensor: sensorStore.deleteSensor,
    endGrow: growCycleStore.endGrow,
    fetchAll,
    fetchController: controllerStore.fetchController,
    fetchDeviceConfigs: deviceConfigStore.fetchDeviceConfigs,
    fetchDevices: deviceStore.fetchDevices,
    fetchGrowCycle: growCycleStore.fetchGrowCycle,
    fetchLatestTelemetry: telemetryStore.fetchLatestTelemetry,
    fetchPhases: growPhaseStore.fetchPhases,
    fetchSensor: sensorStore.fetchSensor,
    fetchSensors: sensorStore.fetchSensors,
    fetchTelemetry: telemetryStore.fetchTelemetry,
    growCycles,
    loading,
    sendDeviceCommand: deviceStore.sendDeviceCommand,
    skipGrowPhase: growCycleStore.skipGrowPhase,
    updateController: controllerStore.updateController,
    updateDevice: deviceStore.updateDevice,
    updateDeviceConfig: deviceConfigStore.updateDeviceConfig,
    updateGrowCycle: growCycleStore.updateGrowCycle,
    updateGrowPhase: growPhaseStore.updateGrowPhase,
    updateSensor: sensorStore.updateSensor,
  }
})
