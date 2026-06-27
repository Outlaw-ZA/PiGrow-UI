<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '../../stores/apiStore'
import type { Device, GrowCycle } from '../../types/grow'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import WiringDiagram from '../../components/WiringDiagram.vue'

const store = useApiStore()
const route = useRoute()
const router = useRouter()

const controllerId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => Boolean(controllerId.value))

const form = ref({ ipAddress: '', macAddress: '', name: '' })

const activeGrows = computed<GrowCycle[]>(() => {
  if (!controllerId.value) {
    return []
  }
  const controller = store.controllers.find((c) => c.id === controllerId.value) as
    | ((typeof store.controllers)[number] & { growCycles?: GrowCycle[] })
    | undefined
  return controller?.growCycles ?? []
})

const totalDevices = computed(() =>
  activeGrows.value.reduce((sum, g) => sum + (g.devices?.filter((d) => d.isActive).length ?? 0), 0),
)

const selectedGrowId = ref<string | null>(null)
const selectedGrow = computed<GrowCycle | null>(
  () => activeGrows.value.find((g) => g.id === selectedGrowId.value) ?? null,
)
const selectedDevices = computed<Device[]>(() => selectedGrow.value?.devices ?? [])
const showWiring = ref(false)

onMounted(async () => {
  await store.fetchAll()
  if (isEditMode.value && controllerId.value) {
    const existing = store.controllers.find((c) => c.id === controllerId.value)
    if (existing) {
      form.value = {
        ipAddress: existing.ipAddress,
        macAddress: existing.macAddress,
        name: existing.name,
      }
    }
    await store.fetchController(controllerId.value)
    if (activeGrows.value.length > 0) {
      selectedGrowId.value = activeGrows.value[0]?.id ?? null
    }
  }
})

const handleSave = async () => {
  if (isEditMode.value && controllerId.value) {
    await store.updateController(controllerId.value, form.value)
  } else {
    await store.createController(form.value)
  }
  router.push('/admin')
}
</script>

<template>
  <div class="form-page">
    <div :class="['form-grid', { single: !isEditMode }]">
      <div class="form-column">
        <Card>
          <template #title>
            {{ isEditMode ? 'Controller' : 'New Controller' }}
          </template>
          <template #content>
            <div class="form-stack">
              <div class="field">
                <label for="ctrl-name" class="field-label">Name</label>
                <InputText
                  id="ctrl-name"
                  v-model="form.name"
                  placeholder="Tent 1 Raspberry Pi"
                  fluid
                />
              </div>
              <div class="field">
                <label for="ctrl-mac" class="field-label">MAC Address</label>
                <InputText
                  id="ctrl-mac"
                  v-model="form.macAddress"
                  placeholder="00:1A:2B:3C:4D:5E"
                  :disabled="isEditMode"
                  fluid
                />
              </div>
              <div class="field">
                <label for="ctrl-ip" class="field-label">IP Address</label>
                <InputText
                  id="ctrl-ip"
                  v-model="form.ipAddress"
                  placeholder="192.168.0.105"
                  fluid
                />
              </div>

              <div class="form-actions">
                <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
                <Button :label="isEditMode ? 'Save Changes' : 'Create'" @click="handleSave" />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <div v-if="isEditMode" class="devices-column">
        <Card class="devices-card">
          <template #title>
            <div class="section-header">
              <span>Linked Devices</span>
              <span class="section-header__actions">
                <span class="muted">
                  {{ totalDevices }} active across {{ activeGrows.length }} grow{{
                    activeGrows.length === 1 ? '' : 's'
                  }}
                </span>
                <Button
                  v-if="selectedDevices.length > 0"
                  icon="pi pi-sitemap"
                  label="Wiring"
                  severity="secondary"
                  size="small"
                  text
                  rounded
                  v-tooltip.top="'View generated wiring diagram'"
                  @click="showWiring = true"
                />
              </span>
            </div>
          </template>
          <template #content>
            <div v-if="activeGrows.length > 1" class="field">
              <label for="grow-selector" class="field-label">Grow cycle</label>
              <select id="grow-selector" v-model="selectedGrowId" class="grow-select">
                <option v-for="grow in activeGrows" :key="grow.id" :value="grow.id">
                  {{ grow.name }}
                </option>
              </select>
            </div>

            <DataTable v-if="selectedDevices.length > 0" :value="selectedDevices" size="small">
              <Column field="name" header="Name" sortable style="font-weight: 600"></Column>
              <Column field="type" header="Type" sortable>
                <template #body="slotProps">
                  <span class="type-pill">
                    {{ slotProps.data.type.replace(/_/g, ' ') }}
                  </span>
                </template>
              </Column>
              <Column field="pinNumber" header="GPIO Pin" sortable>
                <template #body="slotProps">
                  <code class="meta-code">{{ slotProps.data.pinNumber }}</code>
                </template>
              </Column>
              <Column field="mqttTopic" header="MQTT Topic" sortable>
                <template #body="slotProps">
                  <code class="meta-code">{{ slotProps.data.mqttTopic }}</code>
                </template>
              </Column>
              <Column field="isActive" header="Active" sortable>
                <template #body="slotProps">
                  <Tag
                    :value="slotProps.data.isActive ? 'Active' : 'Inactive'"
                    :severity="slotProps.data.isActive ? 'success' : 'secondary'"
                    rounded
                  />
                </template>
              </Column>
            </DataTable>

            <div v-else-if="activeGrows.length > 0" class="empty-state">
              <span class="pi pi-box empty-icon"></span>
              <p>This grow cycle has no devices configured yet.</p>
            </div>
            <div v-else class="empty-state">
              <span class="pi pi-box empty-icon"></span>
              <p>
                No active grow cycle is running on this controller. Devices are scoped to a grow
                cycle, so start a grow to provision devices.
              </p>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <Dialog
      v-model:visible="showWiring"
      :header="selectedGrow ? `Wiring — ${selectedGrow.name}` : 'Controller Wiring Diagram'"
      :style="{ width: '90vw', maxWidth: '1100px' }"
      modal
      dismissable-mask
    >
      <WiringDiagram :devices="selectedDevices" />
    </Dialog>
  </div>
</template>

<style scoped>
.form-page {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: var(--space-6);
}

.form-grid.single {
  display: block;
  max-width: 600px;
  margin: 0 auto;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.devices-card {
  height: 100%;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.grow-select {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-md);
  font-family: inherit;
  width: 100%;
}

.grow-select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.form-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.section-header__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.muted {
  font-size: var(--text-base);
  color: var(--color-text-muted);
  font-weight: 500;
  font-family: var(--font-mono);
}

.type-pill {
  text-transform: capitalize;
  padding: 0.1875rem 0.5rem;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
  border: 1px solid var(--color-border);
}

.meta-code {
  background: var(--color-code-bg);
  padding: 0.1875rem 0.4375rem;
  border-radius: var(--radius-sm);
  color: var(--color-code-text);
  font-size: var(--text-sm);
  border: 1px solid var(--color-border);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  text-align: center;
  background: var(--color-bg-elevated);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-md);
}
</style>
