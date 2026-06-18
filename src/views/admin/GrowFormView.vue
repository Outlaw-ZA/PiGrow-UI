<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrowStore } from '../../stores/growStore'
import type { GrowPhase } from '../../types/grow'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
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
const phases = ref<GrowPhase[]>([])
const ready = ref(false)
const saving = ref(false)

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

function recalculateDates() {
  let cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (const phase of phases.value) {
    phase.startAt = formatDate(cursor)
    cursor.setDate(cursor.getDate() + phase.durationDays)
    phase.endAt = formatDate(cursor)
  }
}

const controllerOptions = computed(() =>
  store.controllers.filter((c) => c.id != null),
)

const totalCycleDays = computed(() =>
  phases.value.reduce((sum, p) => sum + p.durationDays, 0),
)

function getDefaultPhases(): GrowPhase[] {
  return [
    { name: 'Germination', order: 1, durationDays: 7, isActive: false, startAt: null, endAt: null },
    { name: 'Seedling', order: 2, durationDays: 14, isActive: false, startAt: null, endAt: null },
    { name: 'Vegetative', order: 3, durationDays: 28, isActive: false, startAt: null, endAt: null },
    { name: 'Flowering', order: 4, durationDays: 56, isActive: false, startAt: null, endAt: null },
    { name: 'Flush', order: 5, durationDays: 14, isActive: false, startAt: null, endAt: null },
  ]
}

watch(
  () => phases.value.map((p) => p.durationDays),
  () => recalculateDates(),
  { deep: true },
)

onMounted(async () => {
  try {
    await store.fetchAll()
    if (isEditMode.value && growId.value) {
      await loadExistingCycle(growId.value)
    } else {
      phases.value = getDefaultPhases()
      recalculateDates()
    }
  } catch (err) {
    console.error('Failed to load form data', err)
  } finally {
    ready.value = true
  }
})

async function loadExistingCycle(id: string) {
  const cycle = await store.fetchGrowCycle(id)
  form.value.controllerId = cycle.controllerId ?? ''
  form.value.name = cycle.name
  form.value.isActive = cycle.isActive
  phases.value = cycle.phases ? [...cycle.phases] : []
  recalculateDates()
}

function addPhase() {
  const nextOrder = phases.value.length > 0
    ? Math.max(...phases.value.map((p) => p.order)) + 1
    : 1
  phases.value.push({
    name: '',
    order: nextOrder,
    durationDays: 7,
    isActive: false,
    startAt: null,
    endAt: null,
  })
  recalculateDates()
}

async function removePhase(index: number) {
  const phase = phases.value[index]
  if (!phase) return
  if (phase.id) {
    await store.deleteGrowPhase(phase.id)
  }
  phases.value.splice(index, 1)
  phases.value.forEach((p, i) => (p.order = i + 1))
  recalculateDates()
}

async function savePhase(phase: GrowPhase): Promise<GrowPhase | null> {
  if (phase.id) {
    return await store.updateGrowPhase(phase.id, {
      name: phase.name,
      order: phase.order,
      durationDays: phase.durationDays,
      isActive: phase.isActive,
    })
  }
  return null
}

const handleSave = async () => {
  if (!form.value.controllerId) {
    console.error('controllerId is required')
    return
  }
  saving.value = true
  try {
    if (isEditMode.value && growId.value) {
      await store.updateGrowCycle(growId.value, {
        name: form.value.name,
        controllerId: form.value.controllerId,
        isActive: form.value.isActive,
      })
      for (const phase of phases.value) {
        await savePhase(phase)
      }
      router.push('/admin')
    } else {
      await store.createGrowCycle({
        controllerId: form.value.controllerId,
        name: form.value.name,
        isActive: form.value.isActive,
      })
      router.push('/admin')
    }
  } catch (err) {
    console.error('Failed to save', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="ready" style="max-width: 720px; margin: 0 auto">
    <Card>
      <template #title>
        <span style="color: #ffffff; font-weight: 700">
          {{ isEditMode ? 'Adjust Grow Lifecycle Plan' : 'Schedule New Botanical Run' }}
        </span>
      </template>
      <template #content>
        <div style="display: flex; flex-direction: column; gap: 1.5rem">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; color: #cbd5e1"
              >Assigned Controller Infrastructure Host</label
            >
            <Select
              v-model="form.controllerId"
              :options="controllerOptions"
              optionLabel="name"
              optionValue="id"
              placeholder="Select Pi Host Room"
              style="width: 100%"
              show-clear
            />
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; color: #cbd5e1"
              >Grow Batch Track Name</label
            >
            <InputText
              v-model="form.name"
              placeholder="Run #5 - White Widow Pheno"
              style="width: 100%"
            />
          </div>
          <div style="display: flex; align-items: center; gap: 1rem">
            <label style="color: #cbd5e1">Set Target Execution State Active</label>
            <ToggleSwitch v-model="form.isActive" />
          </div>

          <div v-if="isEditMode" style="border-top: 1px solid #334155; padding-top: 1.5rem">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem">
              <h3 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 1.1rem">
                Grow Phases
              </h3>
              <Button
                label="Add Phase"
                icon="pi pi-plus"
                size="small"
                severity="success"
                @click="addPhase"
              />
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem">
              <div
                v-for="(phase, idx) in phases"
                :key="phase.id || idx"
                style="
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 8px;
                  padding: 1rem;
                  display: flex;
                  flex-direction: column;
                  gap: 0.75rem;
                "
              >
                <div style="display: flex; align-items: center; justify-content: space-between">
                  <span
                    style="
                      background: #3b82f6;
                      color: #ffffff;
                      border-radius: 50%;
                      width: 28px;
                      height: 28px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 0.75rem;
                      font-weight: 700;
                    "
                  >
                    {{ phase.order }}
                  </span>
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    size="small"
                    @click="removePhase(idx)"
                  />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 100px; gap: 0.75rem">
                  <div>
                    <label style="display: block; margin-bottom: 0.25rem; font-size: 0.75rem; color: #94a3b8"
                      >Phase Name</label
                    >
                    <InputText v-model="phase.name" placeholder="e.g. Vegetative" style="width: 100%" />
                  </div>
                  <div style="min-width: 0">
                    <label style="display: block; margin-bottom: 0.25rem; font-size: 0.75rem; color: #94a3b8"
                      >Duration (days)</label
                    >
                    <InputNumber v-model="phase.durationDays" :min="1" :inputStyle="{ width: '100%' }" />
                  </div>
                </div>

                <div
                  v-if="phase.startAt && phase.endAt"
                  style="
                    display: flex;
                    gap: 1rem;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    background: #0f172a;
                    border-radius: 6px;
                    padding: 0.5rem 0.75rem;
                  "
                >
                  <span>
                    <strong style="color: #cbd5e1">Start:</strong> {{ phase.startAt }}
                  </span>
                  <span style="color: #475569">&rarr;</span>
                  <span>
                    <strong style="color: #cbd5e1">End:</strong> {{ phase.endAt }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-if="phases.length > 0"
              style="
                margin-top: 1rem;
                padding: 0.75rem 1rem;
                background: #0f172a;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                font-size: 0.85rem;
              "
            >
              <span style="color: #94a3b8">Total Cycle Duration</span>
              <span style="color: #ffffff; font-weight: 700">{{ totalCycleDays }} days</span>
            </div>
          </div>

          <div style="display: flex; gap: 1rem; margin-top: 0.5rem">
            <Button
              :label="isEditMode ? 'Commit Changes' : 'Initialize Batch'"
              severity="success"
              :loading="saving"
              @click="handleSave"
            />
            <Button label="Cancel" severity="secondary" @click="router.push('/admin')" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
