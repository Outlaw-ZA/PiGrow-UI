<!-- src/views/AdminView.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGrowStore } from '../stores/growStore'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Card from 'primevue/card'

const store = useGrowStore()
const router = useRouter()

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 3rem">
    <!-- SECTION 1: PHYSICAL INFRASTRUCTURE CONTROLLERS -->
    <Card>
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>📟 Physical Infrastructure Controllers</span>
          <Button
            label="Create New Controller"
            icon="pi pi-plus"
            @click="router.push('/admin/controllers/new')"
          />
        </div>
      </template>
      <template #content>
        <DataTable :value="store.controllers" responsiveLayout="scroll">
          <Column field="name" header="Name"></Column>
          <Column field="ipAddress" header="IP Address"></Column>
          <Column field="macAddress" header="MAC Address"></Column>
          <Column header="Actions">
            <template #body="slotProps">
              <Button
                label="Update"
                icon="pi pi-pencil"
                severity="secondary"
                size="small"
                @click="router.push(`/admin/controllers/edit/${slotProps.data.id}`)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- SECTION 2: LOGICAL GROW CYCLES -->
    <Card>
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>🌱 Logical Grow Running Cycles</span>
          <Button
            label="Create New Grow Cycle"
            icon="pi pi-calendar-plus"
            severity="success"
            @click="router.push('/admin/grows/new')"
          />
        </div>
      </template>
      <template #content>
        <DataTable :value="store.growCycles" responsiveLayout="scroll">
          <Column field="name" header="Run Identification Name"></Column>
          <Column field="isActive" header="Status">
            <template #body="slotProps">
              <span>{{ slotProps.data.isActive ? '🟢 Running' : '⚪ Static' }}</span>
            </template>
          </Column>
          <Column header="Actions">
            <template #body="slotProps">
              <Button
                label="Update"
                icon="pi pi-cog"
                severity="secondary"
                size="small"
                @click="router.push(`/admin/grows/edit/${slotProps.data.id}`)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
