<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApiStore } from '../../stores/apiStore'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { extractApiError } from '../../utils/errors'
import type { Nutrient } from '../../types/grow'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ConfirmDialog from 'primevue/confirmdialog'
import NutrientList from '../../components/NutrientList.vue'

interface DraftNutrient {
  name: string
  brand: string
  notes: string
}

function emptyDraft(): DraftNutrient {
  return { brand: '', name: '', notes: '' }
}

const store = useApiStore()
const toast = useToast()
const confirm = useConfirm()

const dialogOpen = ref(false)
const editingId = ref<string | null>(null)
const draft = ref<DraftNutrient>(emptyDraft())
const saving = ref(false)
const deletingId = ref<string | null>(null)

const isEdit = computed(() => editingId.value !== null)

const nutrients = computed<Nutrient[]>(() => store.nutrients)

const canSave = computed(() => draft.value.name.trim().length > 0 && !saving.value)

function resetDraft() {
  draft.value = emptyDraft()
  editingId.value = null
}

function openCreate() {
  resetDraft()
  dialogOpen.value = true
}

function openEdit(nutrient: Nutrient) {
  editingId.value = nutrient.id
  draft.value = {
    brand: nutrient.brand ?? '',
    name: nutrient.name,
    notes: nutrient.notes ?? '',
  }
  dialogOpen.value = true
}

function closeDialog() {
  dialogOpen.value = false
  resetDraft()
}

async function save() {
  if (!canSave.value) {
    return
  }
  saving.value = true
  const payload = {
    brand: draft.value.brand.trim().length > 0 ? draft.value.brand.trim() : null,
    name: draft.value.name.trim(),
    notes: draft.value.notes.trim().length > 0 ? draft.value.notes.trim() : null,
  }
  try {
    if (editingId.value) {
      const updated = await store.updateNutrient(editingId.value, payload)
      toast.add({
        detail: `Nutrient "${updated.name}" saved.`,
        life: 3000,
        severity: 'success',
        summary: 'Nutrient updated',
      })
    } else {
      const created = await store.createNutrient(payload)
      toast.add({
        detail: `Nutrient "${created.name}" added.`,
        life: 3000,
        severity: 'success',
        summary: 'Nutrient created',
      })
    }
    closeDialog()
  } catch (error) {
    const { status, message } = extractApiError(error, 'Failed to save nutrient')
    if (status === 409) {
      toast.add({
        detail: 'A nutrient with that name and brand already exists.',
        life: 6000,
        severity: 'warn',
        summary: 'Duplicate nutrient',
      })
      return
    }
    toast.add({
      detail: message,
      life: 6000,
      severity: 'error',
      summary: 'Save failed',
    })
  } finally {
    saving.value = false
  }
}

function handleDelete(nutrient: Nutrient) {
  confirm.require({
    accept: () => deleteConfirmed(nutrient),
    acceptLabel: 'Delete nutrient',
    acceptProps: { severity: 'danger' },
    header: `Delete "${nutrient.name}"`,
    icon: 'pi pi-exclamation-triangle',
    message:
      'This will permanently remove the nutrient. Any phase nutrient dosing record that references it must be deleted first — otherwise the request will be rejected.',
    rejectLabel: 'Cancel',
  })
}

async function deleteConfirmed(nutrient: Nutrient) {
  deletingId.value = nutrient.id
  try {
    await store.deleteNutrient(nutrient.id)
    toast.add({
      detail: `Nutrient "${nutrient.name}" removed.`,
      life: 3000,
      severity: 'success',
      summary: 'Deleted',
    })
  } catch (error) {
    const { status, message } = extractApiError(error, 'Failed to delete nutrient')
    if (status === 409) {
      toast.add({
        detail: `${message} — remove the referencing phase nutrient records first.`,
        life: 8000,
        severity: 'warn',
        summary: 'Nutrient in use',
      })
    } else {
      toast.add({
        detail: message,
        life: 6000,
        severity: 'error',
        summary: 'Delete failed',
      })
    }
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  void store.fetchNutrients()
})

defineExpose({
  handleDelete,
  openCreate,
  openEdit,
})
</script>

<template>
  <ConfirmDialog />
  <div class="nutrients-page">
    <Card>
      <template #title>
        <div class="section-header">
          <span>Nutrients</span>
          <Button
            data-testid="nutrient-new"
            label="New Nutrient"
            icon="pi pi-plus"
            size="small"
            severity="success"
            @click="openCreate"
          />
        </div>
      </template>
      <template #content>
        <NutrientList
          :nutrients="nutrients"
          :busy-id="deletingId"
          @edit="openEdit"
          @remove="handleDelete"
        />
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogOpen"
      :header="isEdit ? 'Edit Nutrient' : 'New Nutrient'"
      :style="{ width: '90vw', maxWidth: '560px' }"
      modal
      dismissable-mask
      class="nutrient-dialog"
      @hide="resetDraft"
    >
      <div class="form-stack">
        <div class="field">
          <label for="nutrient-name" class="field-label">Name *</label>
          <InputText
            id="nutrient-name"
            v-model="draft.name"
            data-testid="nutrient-name"
            placeholder="FloraGro 2-1-1"
            class="full-width"
            :maxlength="200"
            autofocus
          />
        </div>

        <div class="field">
          <label for="nutrient-brand" class="field-label">Brand</label>
          <InputText
            id="nutrient-brand"
            v-model="draft.brand"
            data-testid="nutrient-brand"
            placeholder="General Hydroponics"
            class="full-width"
            :maxlength="200"
          />
          <span class="field-hint">Optional. Brand + name uniquely identifies a nutrient.</span>
        </div>

        <div class="field">
          <label for="nutrient-notes" class="field-label">Notes</label>
          <Textarea
            id="nutrient-notes"
            v-model="draft.notes"
            data-testid="nutrient-notes"
            placeholder="Application rates, dilution, target NPK ratio…"
            class="full-width"
            rows="3"
            auto-resize
          />
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" text :disabled="saving" @click="closeDialog" />
        <Button
          :label="isEdit ? 'Save Changes' : 'Create Nutrient'"
          :loading="saving"
          :disabled="!canSave"
          data-testid="nutrient-save"
          @click="save"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.nutrients-page {
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
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
  font-weight: 400;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.full-width {
  width: 100%;
}
</style>
