<!-- src/views/HomeView.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useGrowStore } from '../stores/growStore'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const store = useGrowStore()

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div class="space-y-6">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
      "
    >
      <!-- Explicitly override the color to a deep slate color (#0f172a) -->
      <h1 style="font-size: 1.875rem; font-weight: 700; color: #0f172a; margin: 0">
        🌿 Real-time Facility Monitor
      </h1>
      <span
        style="
          background: #10b981;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-weight: bold;
        "
      >
        Active Cycles: {{ store.growCycles.filter((g) => g.isActive).length }}
      </span>
    </div>

    <!-- MAIN METRIC GRID LAYOUT -->
    <div
      style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-bottom: 3rem;
      "
    >
      <div
        v-for="cycle in store.growCycles"
        :key="cycle.id"
        @click="$router.push(`/grow/${cycle.id}`)"
        style="cursor: pointer; transition: transform 0.15s ease-in-out"
        class="hover-scale-card"
      >
        <Card style="border-left: 5px solid #22c55e; height: 100%">
          <!-- Update the #title template slot with an explicit white color override -->
          <template #title>
            <span
              style="
                color: #ffffff;
                font-weight: 700;
                font-size: 1.25rem;
                display: block;
                margin-bottom: 0.25rem;
              "
            >
              📋 {{ cycle.name }}
            </span>
          </template>

          <template #subtitle>
            <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap">
              <span :style="{ color: cycle.isActive ? '#22c55e' : '#94a3b8', fontWeight: 'bold' }">
                {{ cycle.isActive ? '● RUNNING' : '○ PAUSED' }}
              </span>
              <span
                v-if="cycle.controller"
                :style="{
                  color: cycle.controller.status === 'ONLINE' ? '#22c55e' : '#ef4444',
                  fontSize: '0.75rem',
                }"
              >
                {{ cycle.controller.status === 'ONLINE' ? '●' : '○' }}
                {{ cycle.controller.name }}
              </span>
            </div>
          </template>
          <template #content>
            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem">Linked Node IP:</p>
            <code
              style="
                background: #f1f5f9;
                padding: 0.2rem 0.4rem;
                border-radius: 4px;
                color: #334155;
              "
            >
              {{
                store.controllers.find((c) => c.id === cycle.controllerId)?.ipAddress ||
                'Unassigned Host'
              }}
            </code>
            <div style="margin-top: 1rem; font-size: 0.85rem; color: #10b981; font-weight: 600">
              Click to open monitoring panel →
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- CONTROLLERS OVERVIEW -->
    <Card>
      <template #title>📡 Physical Hardware Nodes (`Controllers` Layer)</template>
      <template #content>
        <DataTable :value="store.controllers" responsiveLayout="scroll" class="p-datatable-striped">
          <Column field="name" header="Name" style="font-weight: bold"></Column>
          <Column field="ipAddress" header="Local IP Address"></Column>
          <Column field="macAddress" header="MAC Address"></Column>
          <Column field="status" header="Network State">
            <template #body="slotProps">
              <span
                :style="{
                  color: slotProps.data.status === 'ONLINE' ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold',
                }"
              >
                ● {{ slotProps.data.status || 'OFFLINE' }}
              </span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.hover-scale-card:hover {
  transform: translateY(-4px);
}
</style>
