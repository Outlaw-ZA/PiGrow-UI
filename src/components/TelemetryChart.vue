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
import { getTimeAxisConfig } from '../utils/chartTimeAxis'
import { SensorType } from '../types/grow'
import type { Telemetry } from '../types/grow'

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const props = defineProps<{
  growCycleId: string
}>()

const TIME_PRESETS = [
  { label: '1h', seconds: 3600 },
  { label: '6h', seconds: 21_600 },
  { label: '24h', seconds: 86_400 },
  { label: '7d', seconds: 604_800 },
] as const

const SENSOR_TYPES: { key: SensorType; label: string; unit: string; color: string }[] = [
  { color: 'rgb(255, 159, 64)', key: SensorType.TEMPERATURE, label: 'Temperature', unit: '°C' },
  { color: 'rgb(54, 162, 235)', key: SensorType.HUMIDITY, label: 'Humidity', unit: '%' },
  { color: 'rgb(75, 192, 192)', key: SensorType.CO2, label: 'CO₂', unit: 'ppm' },
  { color: 'rgb(153, 102, 255)', key: SensorType.PH, label: 'pH', unit: 'pH' },
  { color: 'rgb(255, 99, 132)', key: SensorType.EC, label: 'EC', unit: 'µS/cm' },
]

const selectedType = ref<SensorType>(SensorType.TEMPERATURE)
const selectedRange = ref(86_400)
const loading = ref(false)
const telemetryData = ref<Telemetry[]>([])
const error = ref<string | null>(null)

const sensorConfig = computed(() => SENSOR_TYPES.find((s) => s.key === selectedType.value))

const Y_RANGES: Partial<Record<SensorType, { min: number; max: number }>> = {
  [SensorType.TEMPERATURE]: { max: 35, min: 10 },
  [SensorType.HUMIDITY]: { max: 80, min: 20 },
}

const store = useApiStore()

async function fetchRange() {
  if (!props.growCycleId) {
    return
  }
  loading.value = true
  error.value = null
  const to = new Date().toISOString()
  const from = new Date(Date.now() - selectedRange.value * 1000).toISOString()
  try {
    const data = await store.fetchTelemetryRange(props.growCycleId, { from, to })
    telemetryData.value = data.filter((t) => t.sensorType === selectedType.value)
  } catch {
    error.value = 'Failed to load telemetry'
    telemetryData.value = []
  } finally {
    loading.value = false
  }
}

const chartData = computed(() => {
  const config = sensorConfig.value
  const data = telemetryData.value
  return {
    datasets: [
      {
        backgroundColor: `${config?.color?.replace('rgb', 'rgba').replace(')', ', 0.1)') ?? 'rgba(75, 192, 192, 0.1)'}`,
        borderColor: config?.color ?? 'rgb(75, 192, 192)',
        borderWidth: 2,
        data: data.map((d) => ({ x: new Date(d.createdAt).getTime(), y: d.value })),
        fill: true,
        label: config?.label ?? selectedType.value,
        pointHitRadius: 8,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const config = sensorConfig.value
  return {
    animation: { duration: 200 },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            if (ctx.parsed.y == null) {
              return ''
            }
            return `${ctx.parsed.y} ${config?.unit ?? ''}`
          },
        },
        enabled: true,
      },
    },
    responsive: true,
    scales: {
      x: {
        display: true,
        grid: { display: false },
        type: 'time',
        time: getTimeAxisConfig(selectedRange.value),
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: { size: 11 },
          source: 'auto',
        },
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.06)',
        },
        max: Y_RANGES[selectedType.value]?.max,
        min: Y_RANGES[selectedType.value]?.min,
        ticks: {
          callback: (v: number | string) => `${v} ${config?.unit ?? ''}`,
          color: 'rgba(255, 255, 255, 0.5)',
          font: { size: 11 },
        },
      },
    },
  } as const
})

watch(selectedType, () => {
  fetchRange()
})

watch(selectedRange, () => {
  fetchRange()
})

let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchRange()
  refreshTimer = setInterval(fetchRange, 30_000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div class="telemetry-chart">
    <div class="chart-controls">
      <div class="chart-controls-group">
        <label class="chart-label">Sensor</label>
        <div class="chart-chip-group">
          <button
            v-for="s in SENSOR_TYPES"
            :key="s.key"
            class="chart-chip"
            :class="{ 'chart-chip--active': selectedType === s.key }"
            @click="selectedType = s.key"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
      <div class="chart-controls-group">
        <label class="chart-label">Range</label>
        <div class="chart-chip-group">
          <button
            v-for="p in TIME_PRESETS"
            :key="p.seconds"
            class="chart-chip"
            :class="{ 'chart-chip--active': selectedRange === p.seconds }"
            @click="selectedRange = p.seconds"
          >
            {{ p.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="chart-container">
      <div v-if="loading" class="chart-loading"><i class="pi pi-spin pi-spinner" /> Loading…</div>
      <div v-else-if="error" class="chart-error">{{ error }}</div>
      <div v-else-if="!telemetryData.length" class="chart-empty">
        No telemetry data for this sensor and time range.
      </div>
      <Line v-else :data="chartData" :options="chartOptions" class="chart-canvas" />
    </div>
  </div>
</template>

<style scoped>
.telemetry-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.chart-controls-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.chart-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
  font-weight: 500;
}

.chart-chip-group {
  display: flex;
  gap: 0.25rem;
}

.chart-chip {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.chart-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.chart-chip--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg-base);
  font-weight: 600;
}

.chart-container {
  position: relative;
  height: 280px;
}

.chart-canvas {
  height: 100% !important;
  width: 100% !important;
}

.chart-loading,
.chart-error,
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 280px;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.chart-error {
  color: var(--color-danger);
}
</style>
