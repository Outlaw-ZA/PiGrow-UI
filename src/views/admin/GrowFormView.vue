<!-- src/views/admin/GrowFormView.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../../stores/growStore'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Card from 'primevue/card'

const store = useGrowStore()
const route = useRoute()
const router = useRouter()

const growId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => !!growId.value)

const form = ref({ controllerId: '', name: '', isActive: false })

onMounted(async () => {
  await store.fetchAll()
  if (isEditMode.value && growId.value) {
    const existing = store.growCycles.find((g) => g.id === growId.value)
    if (existing) {
      form.value = {
        controllerId: existing.controllerId,
        name: existing.name,
        isActive: existing.isActive,
      }
    }
  }
})

const handleSave = async () => {
  if (isEditMode.value && growId.value) {
    await store.updateGrowCycle(growId.value, form.value)
  } else {
    await store.createGrowCycle(form.value)
  }
  router.push('/admin')
}
</script>

<template>
  <div style="max-width: 600px; margin: 0 auto">
    <Card>
      <template #title>{{
        isEditMode ? '📝 Adjust Grow Lifecycle Plan' : '🌱 Schedule New Botanical Run'
      }}</template>
      <template #content>
        <div style="display: flex; flex-direction: column; gap: 1.5rem">
          <div>
            <label style="display: block; margin-bottom: 0.5rem"
              >Assigned Controller Infrastructure Host</label
            >
            <Select
              v-model="form.controllerId"
              :options="store.controllers"
              optionLabel="name"
              optionValue="id"
              placeholder="Select Pi Host Room"
              style="width: 100%"
            />
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem">Grow Batch Track Name</label>
            <InputText
              v-model="form.name"
              placeholder="Run #5 - White Widow Pheno"
              style="width: 100%"
            />
          </div>
          <div style="display: flex; align-items: center; gap: 1rem">
            <label>Set Target Execution State Active</label>
            <ToggleSwitch v-model="form.isActive" />
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1rem">
            <Button
              :label="isEditMode ? 'Commit Changes' : 'Initialize Batch'"
              severity="success"
              @click="handleSave"
            />
            <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
