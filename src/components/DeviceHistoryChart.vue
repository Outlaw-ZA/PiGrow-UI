<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import type { TooltipItem } from 'chart.js'
import { useApiStore } from '../stores/apiStore'
import type { DeviceStateLog } from '../types/grow'
import { getTimeAxisConfig } from '../utils/chartTimeAxis'

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const props = defineProps<{
  deviceId: string
  deviceName: string
  selectedRange: number
}>()

const store = useApiStore()

const loading = ref(false)
const error = ref<string | null>(null)
const logs = ref<DeviceStateLog[]>([])
const priorAction = ref<'ON' | 'OFF' | null>(null)

async function fetchLogs() {
  if (!props.deviceId) {
    return
  }
  loading.value = true
  error.value = null
  const to = new Date().toISOString()
  const from = new Date(Date.now() - props.selectedRange * 1000).toISOString()
  try {
    const data = await store.fetchDeviceStateLogs(props.deviceId, { from, to })
    logs.value = data.logs ?? []
    priorAction.value = data.priorAction ?? null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('DeviceHistoryChart fetch failed:', msg)
    error.value = 'Failed to load device history'
    logs.value = []
    priorAction.value = null
  } finally {
    loading.value = false
  }
}

const chartData = computed(() => {
  const data = logs.value
  const rangeSec = props.selectedRange
  const to = new Date()
  const from = new Date(to.getTime() - rangeSec * 1000)

  const points: { time: Date; value: number }[] = []

  const initialVal = priorAction.value === 'ON' ? 1 : 0
  points.push({ time: from, value: initialVal })

  let prevAction: 'ON' | 'OFF' | null = priorAction.value
  for (const log of data) {
    if (log.action === prevAction) {
      continue
    }
    prevAction = log.action
    points.push({
      time: new Date(log.createdAt),
      value: log.action === 'ON' ? 1 : 0,
    })
  }

  const lastVal = data.length > 0 ? (prevAction === 'ON' ? 1 : 0) : initialVal
  points.push({ time: to, value: lastVal })

  return {
    datasets: [
      {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1.5,
        data: points.map((p) => ({ x: p.time.getTime(), y: p.value })),
        fill: true,
        label: props.deviceName,
        pointHitRadius: 4,
        pointRadius: 0,
        stepped: 'before' as const,
        tension: 0,
      },
    ],
  }
})

const chartOptions = computed(() => {
  return {
    animation: { duration: 200 },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => (ctx.parsed.y === 1 ? 'ON' : 'OFF'),
        },
        enabled: true,
      },
    },
    responsive: true,
    scales: {
      x: {
        display: true,
        grid: { display: false },
        type: 'time' as const,
        time: getTimeAxisConfig(props.selectedRange),
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          font: { size: 10 },
          source: 'auto',
        },
      },
      y: {
        display: true,
        grid: { display: false },
        max: 1.1,
        min: -0.1,
        ticks: {
          callback: (v: number | string) => (Number(v) > 0.5 ? 'ON' : 'OFF'),
          color: 'rgba(255, 255, 255, 0.4)',
          font: { size: 10 },
          stepSize: 1,
        },
      },
    },
  } as const
})

watch(() => props.selectedRange, fetchLogs)

let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchLogs()
  refreshTimer = setInterval(fetchLogs, 30_000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div class="device-history-chart">
    <div class="chart-container">
      <div v-if="loading" class="chart-state"><i class="pi pi-spin pi-spinner" /> Loading…</div>
      <div v-else-if="error" class="chart-state chart-error">
        {{ error }}
      </div>
      <div v-else-if="!logs.length && priorAction === null" class="chart-state chart-empty">
        No state changes
      </div>
      <Line v-else :data="chartData" :options="chartOptions" class="chart-canvas" />
    </div>
  </div>
</template>

<style scoped>
.device-history-chart {
  display: flex;
  flex-direction: column;
}

.chart-container {
  position: relative;
  height: 100px;
}

.chart-canvas {
  height: 100% !important;
  width: 100% !important;
}

.chart-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.chart-error {
  color: var(--color-danger);
}
</style>
