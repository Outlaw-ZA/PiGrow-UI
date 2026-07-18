<script setup lang="ts">
import { ref } from 'vue'
import { useProvidedGrowMonitorState } from './useGrowMonitorState'
import Card from 'primevue/card'
import TelemetryChart from '../../components/TelemetryChart.vue'
import DeviceHistoryChart from '../../components/DeviceHistoryChart.vue'

const state = useProvidedGrowMonitorState()

const TIME_PRESETS = [
  { label: '1h', seconds: 3600 },
  { label: '6h', seconds: 21_600 },
  { label: '24h', seconds: 86_400 },
  { label: '7d', seconds: 604_800 },
] as const

const deviceHistoryRange = ref(86_400)
</script>

<template>
  <div class="history-tab">
    <Card>
      <template #title>Telemetry History</template>
      <template #content>
        <TelemetryChart v-if="state.cycleId.value" :growCycleId="state.cycleId.value" />
        <div v-else class="empty-state">No grow cycle selected.</div>
      </template>
    </Card>

    <Card>
      <template #title>Device History</template>
      <template #content>
        <div v-if="state.growDevices.value.length" class="device-history-section">
          <div class="chart-controls">
            <div class="chart-controls-group">
              <label class="chart-label">Range</label>
              <div class="chart-chip-group">
                <button
                  v-for="p in TIME_PRESETS"
                  :key="p.seconds"
                  class="chart-chip"
                  :class="{ 'chart-chip--active': deviceHistoryRange === p.seconds }"
                  @click="deviceHistoryRange = p.seconds"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
          </div>
          <div class="device-history-grid">
            <div
              v-for="device in state.growDevices.value"
              :key="device.id"
              class="device-history-cell"
            >
              <span class="device-history-name">{{ device.name }}</span>
              <DeviceHistoryChart
                :deviceId="device.id!"
                :deviceName="device.name"
                :selectedRange="deviceHistoryRange"
              />
            </div>
          </div>
        </div>
        <div v-else class="empty-state">No devices configured.</div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.history-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.device-history-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.chart-controls-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.chart-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.chart-chip-group {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-elevated);
}

.chart-chip {
  background: transparent;
  border: none;
  padding: 0.375rem 0.75rem;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-right: 1px solid var(--color-border);
  transition:
    background var(--duration-fast) var(--ease-default),
    color var(--duration-fast) var(--ease-default);
  font-family: var(--font-mono);
}

.chart-chip:last-child {
  border-right: none;
}

.chart-chip:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.chart-chip--active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 600;
}

.device-history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.device-history-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.device-history-name {
  font-weight: 500;
  color: var(--color-text-primary);
  font-size: var(--text-md);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  text-align: center;
}
</style>
