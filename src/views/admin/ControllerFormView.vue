<!-- src/views/admin/ControllerFormView.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../../stores/growStore'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'

const store = useGrowStore()
const route = useRoute()
const router = useRouter()

// Retrieve route parameters directly from the browser window URL context
const controllerId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => !!controllerId.value)

const form = ref({ name: '', macAddress: '', ipAddress: '' })

onMounted(async () => {
  await store.fetchAll()
  if (isEditMode.value && controllerId.value) {
    const existing = store.controllers.find((c) => c.id === controllerId.value)
    if (existing) {
      form.value = {
        name: existing.name,
        macAddress: existing.macAddress,
        ipAddress: existing.ipAddress,
      }
    }
  }
})

const handleSave = async () => {
  if (isEditMode.value && controllerId.value) {
    await store.updateController(controllerId.value, form.value)
  } else {
    await store.createController(form.value)
  }
  router.push('/admin') // Return to baseline overview table
}
</script>

<template>
  <div style="max-width: 600px; margin: 0 auto">
    <Card>
      <template #title>{{
        isEditMode ? '⚙️ Modify Controller Matrix' : '📟 Provision New Host Hub'
      }}</template>
      <template #content>
        <div style="display: flex; flex-direction: column; gap: 1.5rem">
          <div>
            <label style="display: block; margin-bottom: 0.5rem">Display Label Name</label>
            <InputText
              v-model="form.name"
              class="w-full"
              placeholder="Tent 1 Raspberry Pi"
              style="width: 100%"
            />
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem">Hardware MAC Address</label>
            <InputText
              v-model="form.macAddress"
              class="w-full"
              placeholder="00:1A:2B:3C:4D:5E"
              :disabled="isEditMode"
              style="width: 100%"
            />
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem">Static Network IP Target</label>
            <InputText
              v-model="form.ipAddress"
              class="w-full"
              placeholder="192.168.0.105"
              style="width: 100%"
            />
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1rem">
            <Button
              :label="isEditMode ? 'Save Changes' : 'Register Node'"
              @click="handleSave"
              class="w-full"
            />
            <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
