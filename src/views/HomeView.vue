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
      <h1 class="text-3xl font-bold">🌿 Real-time Facility Monitor</h1>
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
      <div v-for="cycle in store.growCycles" :key="cycle.id">
        <Card style="border-left: 5px solid #22c55e">
          <template #title>📋 {{ cycle.name }}</template>
          <template #subtitle>
            Operational Node Status:
            <span :style="{ color: cycle.isActive ? '#22c55e' : '#64748b', fontWeight: 'bold' }">
              {{ cycle.isActive ? 'RUNNING' : 'PAUSED' }}
            </span>
          </template>
          <template #content>
            <p style="color: #64748b; font-size: 0.9rem">Linked Controller ID:</p>
            <code
              style="
                background: #f1f5f9;
                padding: 0.2rem 0.4rem;
                display: block;
                border-radius: 4px;
                word-break: break-all;
              "
            >
              {{ cycle.controllerId }}
            </code>
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
