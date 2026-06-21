<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApiStore } from '../stores/apiStore'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Card from 'primevue/card'
import Tag from 'primevue/tag'

const store = useApiStore()
const router = useRouter()

onMounted(() => {
  store.fetchAll()
})

async function deleteController(id: string) {
  if (confirm('Delete this controller and all its devices?')) {
    await store.deleteController(id)
  }
}

async function deleteGrowCycle(id: string) {
  if (confirm('Delete this grow cycle and all associated data?')) {
    await store.deleteGrowCycle(id)
  }
}
</script>

<template>
  <div class="admin-page">
    <Card>
      <template #title>
        <div class="section-header">
          <span>Controllers</span>
          <Button
            label="New Controller"
            icon="pi pi-plus"
            size="small"
            @click="router.push('/admin/controllers/new')"
          />
        </div>
      </template>
      <template #content>
        <DataTable
          :value="store.controllers"
          size="small"
          paginator
          :rows="10"
          :rowsPerPageOptions="[10, 20, 50]"
        >
          <Column field="name" header="Name" sortable style="font-weight: 600"></Column>
          <Column field="ipAddress" header="IP Address" sortable>
            <template #body="slotProps">
              <code class="meta-code">{{ slotProps.data.ipAddress }}</code>
            </template>
          </Column>
          <Column field="macAddress" header="MAC Address" sortable>
            <template #body="slotProps">
              <code class="meta-code">{{ slotProps.data.macAddress }}</code>
            </template>
          </Column>
          <Column header="Actions" style="width: 140px">
            <template #body="slotProps">
              <div class="row-actions">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  aria-label="Edit"
                  @click="router.push(`/admin/controllers/edit/${slotProps.data.id}`)"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  size="small"
                  aria-label="Delete"
                  @click="deleteController(slotProps.data.id)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="section-header">
          <span>Grow Cycles</span>
          <Button
            label="New Grow Cycle"
            icon="pi pi-plus"
            size="small"
            severity="success"
            @click="router.push('/admin/grows/new')"
          />
        </div>
      </template>
      <template #content>
        <DataTable
          :value="store.growCycles"
          size="small"
          paginator
          :rows="10"
          :rowsPerPageOptions="[10, 20, 50]"
        >
          <Column field="name" header="Name" sortable style="font-weight: 600"></Column>
          <Column field="isActive" header="Status" sortable>
            <template #body="slotProps">
              <Tag
                :value="slotProps.data.isActive ? 'Running' : 'Idle'"
                :severity="slotProps.data.isActive ? 'success' : 'secondary'"
                rounded
              />
            </template>
          </Column>
          <Column field="startAt" header="Start Date" sortable>
            <template #body="slotProps">
              <code v-if="slotProps.data.startAt" class="meta-code">
                {{ slotProps.data.startAt }}
              </code>
              <span v-else class="muted">—</span>
            </template>
          </Column>
          <Column header="Actions" style="width: 140px">
            <template #body="slotProps">
              <div class="row-actions">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  aria-label="Edit"
                  @click="router.push(`/admin/grows/edit/${slotProps.data.id}`)"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  size="small"
                  aria-label="Delete"
                  @click="deleteGrowCycle(slotProps.data.id)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.row-actions {
  display: flex;
  gap: var(--space-1);
}

.meta-code {
  background: var(--color-code-bg);
  padding: 0.1875rem 0.4375rem;
  border-radius: var(--radius-sm);
  color: var(--color-code-text);
  font-size: var(--text-sm);
  border: 1px solid var(--color-border);
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
</style>
