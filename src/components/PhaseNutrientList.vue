<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputSwitch from 'primevue/inputswitch'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type {
  CreatePhaseNutrientPayload,
  PhaseNutrient,
  UpdatePhaseNutrientPayload,
} from '../types/grow'
import { DayNightPeriod } from '../types/grow'
import { useApiStore } from '../stores/apiStore'
import { extractApiError } from '../utils/errors'

const props = defineProps<{
  growPhaseId: string
}>()

const store = useApiStore()
const toast = useToast()
const confirm = useConfirm()

type Period = DayNightPeriod.DAY | DayNightPeriod.NIGHT

const phaseNutrients = ref<PhaseNutrient[]>([])
const loading = ref(false)
const saving = ref(false)
const deletingId = ref<string | null>(null)

const dialogOpen = ref(false)
const dialogMode = ref<'single' | 'both'>('single')
const editingId = ref<string | null>(null)
const draftNutrientId = ref<string | null>(null)
const draftDose = ref<number>(0)
const draftPeriod = ref<Period>(DayNightPeriod.DAY)
const bothToggleOn = ref(false)

const nutrientById = computed(() => {
  const m = new Map<string, (typeof store.nutrients)[number]>()
  for (const n of store.nutrients) {
    m.set(n.id, n)
  }
  return m
})

const dayRows = computed(() =>
  phaseNutrients.value
    .filter((pn) => pn.period === DayNightPeriod.DAY)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder),
)
const nightRows = computed(() =>
  phaseNutrients.value
    .filter((pn) => pn.period === DayNightPeriod.NIGHT)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder),
)

const nutrientsWithBothPeriods = computed(() => {
  const set = new Set<string>()
  for (const pn of phaseNutrients.value) {
    set.add(`${pn.nutrientId}|${pn.period}`)
  }
  const out = new Set<string>()
  for (const n of store.nutrients) {
    if (set.has(`${n.id}|${DayNightPeriod.DAY}`) && set.has(`${n.id}|${DayNightPeriod.NIGHT}`)) {
      out.add(n.id)
    }
  }
  return out
})

const bothToggleDisabled = computed(
  () =>
    store.nutrients.length > 0 && nutrientsWithBothPeriods.value.size === store.nutrients.length,
)

const nutrientOptions = computed(() => {
  if (dialogMode.value === 'both') {
    return store.nutrients.filter((n) => !nutrientsWithBothPeriods.value.has(n.id))
  }
  return store.nutrients.filter(
    (n) =>
      !phaseNutrients.value.some((pn) => pn.nutrientId === n.id && pn.period === draftPeriod.value),
  )
})

const isEdit = computed(() => editingId.value !== null)

const canSaveDialog = computed(
  () => draftNutrientId.value !== null && draftDose.value > 0 && !saving.value,
)

function hasNutrientsAvailable(period: Period): boolean {
  return store.nutrients.some(
    (n) => !phaseNutrients.value.some((pn) => pn.nutrientId === n.id && pn.period === period),
  )
}

function resetDialog() {
  dialogOpen.value = false
  editingId.value = null
  draftNutrientId.value = null
  draftDose.value = 0
  draftPeriod.value = DayNightPeriod.DAY
  dialogMode.value = 'single'
}

function openCreate(period: Period) {
  resetDialog()
  dialogMode.value = 'single'
  draftPeriod.value = period
  dialogOpen.value = true
}

function openCreateBoth() {
  resetDialog()
  dialogMode.value = 'both'
  bothToggleOn.value = true
  dialogOpen.value = true
}

function openEdit(row: PhaseNutrient) {
  resetDialog()
  dialogMode.value = 'single'
  editingId.value = row.id
  draftNutrientId.value = row.nutrientId
  draftDose.value = row.doseMlPerL
  draftPeriod.value = row.period
  dialogOpen.value = true
}

function onBothToggle(next: boolean) {
  if (next) {
    openCreateBoth()
  } else {
    bothToggleOn.value = false
  }
}

function nameFor(nutrientId: string): string {
  return nutrientById.value.get(nutrientId)?.name ?? nutrientId
}

function nextSortOrder(period: Period, nutrientId: string): number {
  const existing = phaseNutrients.value.filter(
    (pn) => pn.period === period && pn.nutrientId === nutrientId,
  )
  if (existing.length === 0) {
    return 1
  }
  return Math.max(...existing.map((pn) => pn.sortOrder)) + 1
}

async function loadForPhase() {
  if (!props.growPhaseId) {
    return
  }
  loading.value = true
  try {
    const list = await store.phaseNutrients.fetchForPhase(props.growPhaseId)
    phaseNutrients.value = list
  } catch (error) {
    const { message } = extractApiError(error, 'Failed to load phase nutrients')
    toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Load failed' })
  } finally {
    loading.value = false
  }
}

watch(
  () => props.growPhaseId,
  () => {
    void loadForPhase()
  },
)

onMounted(() => {
  void loadForPhase()
  if (store.nutrients.length === 0) {
    void store.fetchNutrients()
  }
})

async function saveDialog() {
  if (!canSaveDialog.value || !props.growPhaseId || draftNutrientId.value === null) {
    return
  }
  saving.value = true
  try {
    if (dialogMode.value === 'both') {
      const dayPayload: CreatePhaseNutrientPayload = {
        doseMlPerL: draftDose.value,
        nutrientId: draftNutrientId.value,
        period: DayNightPeriod.DAY,
        sortOrder: nextSortOrder(DayNightPeriod.DAY, draftNutrientId.value),
      }
      const nightPayload: CreatePhaseNutrientPayload = {
        doseMlPerL: draftDose.value,
        nutrientId: draftNutrientId.value,
        period: DayNightPeriod.NIGHT,
        sortOrder: nextSortOrder(DayNightPeriod.NIGHT, draftNutrientId.value),
      }
      await store.phaseNutrients.addOne(props.growPhaseId, dayPayload)
      await store.phaseNutrients.addOne(props.growPhaseId, nightPayload)
      toast.add({
        detail: `${nameFor(draftNutrientId.value)} added for both periods.`,
        life: 3000,
        severity: 'success',
        summary: 'Created',
      })
    } else if (editingId.value) {
      const updatePayload: UpdatePhaseNutrientPayload = {
        doseMlPerL: draftDose.value,
        nutrientId: draftNutrientId.value,
        period: draftPeriod.value,
      }
      const updated = await store.phaseNutrients.updateOne(
        props.growPhaseId,
        editingId.value,
        updatePayload,
      )
      toast.add({
        detail: `${nameFor(updated.nutrientId)} updated.`,
        life: 3000,
        severity: 'success',
        summary: 'Saved',
      })
    } else {
      const createPayload: CreatePhaseNutrientPayload = {
        doseMlPerL: draftDose.value,
        nutrientId: draftNutrientId.value,
        period: draftPeriod.value,
        sortOrder: nextSortOrder(draftPeriod.value, draftNutrientId.value),
      }
      const created = await store.phaseNutrients.addOne(props.growPhaseId, createPayload)
      toast.add({
        detail: `${nameFor(created.nutrientId)} added.`,
        life: 3000,
        severity: 'success',
        summary: 'Created',
      })
    }
    await loadForPhase()
    bothToggleOn.value = false
    dialogOpen.value = false
  } catch (error) {
    const { status, message } = extractApiError(error, 'Failed to save phase nutrient')
    if (status === 409) {
      toast.add({
        detail: message,
        life: 6000,
        severity: 'warn',
        summary: 'Duplicate',
      })
      return
    }
    toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Save failed' })
  } finally {
    saving.value = false
  }
}

function onDelete(row: PhaseNutrient) {
  const label = nameFor(row.nutrientId)
  confirm.require({
    accept: () => deleteConfirmed(row),
    acceptLabel: 'Delete',
    acceptProps: { severity: 'danger' },
    header: `Delete ${label}`,
    icon: 'pi pi-exclamation-triangle',
    message: `Remove the ${row.period} entry for "${label}"?`,
    rejectLabel: 'Cancel',
  })
}

async function deleteConfirmed(row: PhaseNutrient) {
  if (!props.growPhaseId) {
    return
  }
  deletingId.value = row.id
  try {
    await store.phaseNutrients.removeOne(props.growPhaseId, row.id)
    phaseNutrients.value = phaseNutrients.value.filter((pn) => pn.id !== row.id)
    toast.add({
      detail: `${nameFor(row.nutrientId)} removed.`,
      life: 3000,
      severity: 'success',
      summary: 'Deleted',
    })
  } catch (error) {
    const { message } = extractApiError(error, 'Failed to delete phase nutrient')
    toast.add({ detail: message, life: 6000, severity: 'error', summary: 'Delete failed' })
  } finally {
    deletingId.value = null
  }
}

defineExpose({
  dayRows,
  deleteConfirmed,
  loadForPhase,
  nameFor,
  nightRows,
  nutrientById,
  phaseNutrients,
})
</script>

<template>
  <ConfirmDialog />
  <div v-if="!growPhaseId" class="locked-hint">
    <i class="pi pi-lock" /> Save the grow first to configure nutrient dosing.
  </div>
  <div v-else-if="loading" class="loading">
    <i class="pi pi-spin pi-spinner" /> Loading phase nutrients…
  </div>
  <div v-else class="phase-nutrient-list">
    <div class="both-toggle-row">
      <label class="both-toggle-label" for="pn-both-toggle">
        <span class="both-toggle-text">Add for both DAY &amp; NIGHT</span>
        <span class="both-toggle-hint">Creates one row per period with the same dose.</span>
      </label>
      <InputSwitch
        inputId="pn-both-toggle"
        data-testid="pn-both-toggle"
        :model-value="bothToggleOn"
        :disabled="bothToggleDisabled"
        @update:model-value="onBothToggle"
      />
    </div>

    <Card class="period-card">
      <template #title>
        <div class="period-header">
          <Tag value="DAY" severity="warn" rounded />
          <span class="period-title">Day dosing</span>
          <Button
            label="Add"
            icon="pi pi-plus"
            size="small"
            severity="success"
            data-testid="pn-add-day"
            :disabled="!hasNutrientsAvailable(DayNightPeriod.DAY)"
            @click="openCreate(DayNightPeriod.DAY)"
          />
        </div>
      </template>
      <template #content>
        <div v-if="dayRows.length > 0" class="rows">
          <div v-for="row in dayRows" :key="row.id" class="row">
            <span class="period-chip" :data-testid="`pn-period-${row.id}`">{{ row.period }}</span>
            <span class="nutrient-name" :data-testid="`pn-name-${row.id}`">{{
              nameFor(row.nutrientId)
            }}</span>
            <span class="meta-code" :data-testid="`pn-dose-${row.id}`"
              >{{ row.doseMlPerL }} mL/L</span
            >
            <span class="muted order">#{{ row.sortOrder }}</span>
            <div class="row-actions">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                size="small"
                :data-testid="`pn-edit-${row.id}`"
                aria-label="Edit day nutrient"
                :disabled="deletingId === row.id"
                @click="openEdit(row)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                :data-testid="`pn-delete-${row.id}`"
                aria-label="Delete day nutrient"
                :disabled="deletingId === row.id"
                @click="onDelete(row)"
              />
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="pi pi-sun empty-icon" />
          <p>No day nutrients configured.</p>
        </div>
      </template>
    </Card>

    <Card class="period-card">
      <template #title>
        <div class="period-header">
          <Tag value="NIGHT" severity="info" rounded />
          <span class="period-title">Night dosing</span>
          <Button
            label="Add"
            icon="pi pi-plus"
            size="small"
            severity="success"
            data-testid="pn-add-night"
            :disabled="!hasNutrientsAvailable(DayNightPeriod.NIGHT)"
            @click="openCreate(DayNightPeriod.NIGHT)"
          />
        </div>
      </template>
      <template #content>
        <div v-if="nightRows.length > 0" class="rows">
          <div v-for="row in nightRows" :key="row.id" class="row">
            <span class="period-chip" :data-testid="`pn-period-${row.id}`">{{ row.period }}</span>
            <span class="nutrient-name" :data-testid="`pn-name-${row.id}`">{{
              nameFor(row.nutrientId)
            }}</span>
            <span class="meta-code" :data-testid="`pn-dose-${row.id}`"
              >{{ row.doseMlPerL }} mL/L</span
            >
            <span class="muted order">#{{ row.sortOrder }}</span>
            <div class="row-actions">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                size="small"
                :data-testid="`pn-edit-${row.id}`"
                aria-label="Edit night nutrient"
                :disabled="deletingId === row.id"
                @click="openEdit(row)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                :data-testid="`pn-delete-${row.id}`"
                aria-label="Delete night nutrient"
                :disabled="deletingId === row.id"
                @click="onDelete(row)"
              />
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="pi pi-moon empty-icon" />
          <p>No night nutrients configured.</p>
        </div>
      </template>
    </Card>

    <div
      v-if="dayRows.length === 0 && nightRows.length === 0"
      class="empty-state empty-state--global"
    >
      <span class="pi pi-flask empty-icon" />
      <p>
        No nutrients configured for this phase. Click <strong>Add</strong> or toggle "Add for both
        DAY &amp; NIGHT" to start.
      </p>
    </div>

    <Dialog
      v-model:visible="dialogOpen"
      :header="
        dialogMode === 'both'
          ? 'Add nutrient for both periods'
          : isEdit
            ? 'Edit phase nutrient'
            : `Add ${draftPeriod.toLowerCase()} nutrient`
      "
      :style="{ width: '90vw', maxWidth: '480px' }"
      modal
      dismissable-mask
      class="pn-dialog"
      @hide="resetDialog"
    >
      <div class="form-stack">
        <div class="field">
          <label for="pn-nutrient" class="field-label">Nutrient</label>
          <Select
            inputId="pn-nutrient"
            v-model="draftNutrientId"
            :options="nutrientOptions"
            option-label="name"
            option-value="id"
            placeholder="Select a nutrient"
            class="full-width"
            data-testid="pn-nutrient-select"
          />
        </div>
        <div class="field">
          <label for="pn-dose" class="field-label">Dose (mL per L)</label>
          <InputNumber
            inputId="pn-dose"
            v-model="draftDose"
            :min="0"
            :step="0.1"
            :max="100"
            show-buttons
            data-testid="pn-dose"
            class="full-width"
          />
        </div>
        <p v-if="dialogMode === 'both'" class="field-hint">
          Both DAY and NIGHT rows will be created with the dose above.
        </p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text :disabled="saving" @click="resetDialog" />
        <Button
          :label="isEdit ? 'Save changes' : 'Add nutrient'"
          :loading="saving"
          :disabled="!canSaveDialog"
          data-testid="pn-save"
          @click="saveDialog"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.phase-nutrient-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.both-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.both-toggle-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.both-toggle-text {
  font-weight: 500;
}

.both-toggle-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.period-card {
  width: 100%;
}

.period-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}

.period-title {
  font-size: var(--text-md);
  font-weight: 500;
  flex: 1;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.row {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
}

.period-chip {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.nutrient-name {
  font-weight: 500;
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
}

.order {
  font-size: var(--text-xs);
}

.row-actions {
  display: inline-flex;
  gap: var(--space-1);
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
  gap: var(--space-2);
}

.empty-state--global {
  margin-top: var(--space-2);
}

.empty-icon {
  font-size: 1.5rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-sm);
}

.loading,
.locked-hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  padding: var(--space-6);
  justify-content: center;
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

.field-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.full-width {
  width: 100%;
}
</style>
