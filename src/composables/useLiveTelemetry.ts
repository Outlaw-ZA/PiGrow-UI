import { onUnmounted, reactive, ref, shallowRef } from 'vue'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type { FrontendTelemetry, SensorType } from '../types/grow'
import axios from 'axios'
import { API_BASE } from '../stores/apiBase'

const MAX_HISTORY_PER_SENSOR = 500

export function useLiveTelemetry(getCycleId: () => string | null) {
  const latest = reactive<Record<string, FrontendTelemetry>>({})
  const history = reactive<Record<string, FrontendTelemetry[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const connected = ref(false)

  let pollingHandle: ReturnType<typeof setInterval> | null = null
  const socket = shallowRef<Socket | null>(null)
  let isStarted = false

  function pushReading(data: FrontendTelemetry) {
    latest[data.sensorType] = data
    const arr = history[data.sensorType]
    if (!arr) {
      history[data.sensorType] = [data]
    } else {
      arr.push(data)
      if (arr.length > MAX_HISTORY_PER_SENSOR) {
        arr.splice(0, arr.length - MAX_HISTORY_PER_SENSOR)
      }
    }
  }

  function getLatest(sensorType: SensorType): FrontendTelemetry | undefined {
    return latest[sensorType]
  }

  function getHistory(sensorType: SensorType): FrontendTelemetry[] {
    return history[sensorType] ?? []
  }

  async function seedFromApi() {
    const id = getCycleId()
    if (!id) {
      return
    }
    try {
      const res = await axios.get(`${API_BASE}/telemetry/grow-cycle/${id}/latest`)
      const readings = res.data as FrontendTelemetry[]
      for (const reading of readings) {
        latest[reading.sensorType] = reading
        pushReading(reading)
      }
    } catch {
      // No telemetry yet
    }
  }

  function start() {
    const id = getCycleId()
    if (!id || isStarted) {
      return
    }
    isStarted = true
    loading.value = true
    error.value = null

    const { origin } = new URL(API_BASE)
    socket.value = io(origin, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    })

    socket.value.on('connect', () => {
      loading.value = false
      connected.value = true
      error.value = null
    })

    socket.value.on('connect_error', () => {
      loading.value = false
      error.value = 'Socket connection failed'
    })

    socket.value.on('disconnect', () => {
      connected.value = false
      error.value = null
    })

    socket.value.on('frontend_telemetry', (data: FrontendTelemetry) => {
      const currentId = getCycleId()
      if (currentId && data.growCycleId === currentId) {
        pushReading(data)
      }
    })

    seedFromApi()
    pollingHandle = setInterval(() => {
      if (isStarted) {
        seedFromApi()
      }
    }, 30_000)
  }

  function stop() {
    isStarted = false
    if (socket.value) {
      socket.value.removeAllListeners()
      socket.value.disconnect()
      socket.value = null
    }
    if (pollingHandle) {
      clearInterval(pollingHandle)
      pollingHandle = null
    }
    connected.value = false
    loading.value = false
  }

  onUnmounted(stop)

  return {
    connected,
    error,
    getHistory,
    getLatest,
    history,
    latest,
    loading,
    pushReading,
    socket,
    start,
    stop,
  }
}
