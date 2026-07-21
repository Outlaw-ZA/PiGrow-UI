<script setup lang="ts">
import { computed, ref } from 'vue'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useApiStore } from '../stores/apiStore'
import { useNutrientStore } from '../stores/nutrientStore'

type Period = 'DAY' | 'NIGHT'
type WarningCode =
  | 'NO_NUTRIENTS_CONFIGURED'
  | 'NO_DAY_NUTRIENTS'
  | 'NO_NIGHT_NUTRIENTS'
  | 'NO_PH_BANDS'
  | 'PH_DAY_NIGHT_MISMATCH'
  | 'RESERVOIR_TOO_SMALL'

interface DosingPreviewResult {
  mlByNutrientId: Record<string, number>
  totalMl: number
  warnings: WarningCode[]
}

const props = defineProps<{ growPhaseId: string; modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const apiStore = useApiStore()
const nutrientStore = useNutrientStore()
const reservoirLiters = ref(1)
const period = ref<Period>('DAY')
const loading = ref(false)
const result = ref<DosingPreviewResult | null>(null)

const periodOptions = [
  { label: 'Day', value: 'DAY' as const },
  { label: 'Night', value: 'NIGHT' as const },
]
const warningText: Record<WarningCode, string> = {
  NO_NUTRIENTS_CONFIGURED: 'No nutrients configured for this phase.',
  NO_DAY_NUTRIENTS: 'No nutrients configured for the DAY period.',
  NO_NIGHT_NUTRIENTS: 'No nutrients configured for the NIGHT period.',
  NO_PH_BANDS: "No pH bands configured for this period. Auto-dosing won't correct drift.",
  PH_DAY_NIGHT_MISMATCH: 'DAY and NIGHT pH bands differ. Review before relying on auto-dosing.',
  RESERVOIR_TOO_SMALL: 'Reservoir volume must be > 0.',
}

const nutrientById = computed(() => new Map(nutrientStore.nutrients.map((n) => [n.id, n.name])))
const rows = computed(() =>
  Object.entries(result.value?.mlByNutrientId ?? {}).map(([nutrientId, ml]) => ({
    ml,
    name: nutrientById.value.get(nutrientId) ?? nutrientId,
    nutrientId,
  })),
)

async function calculate() {
  loading.value = true
  try {
    result.value = await apiStore.dosing.preview(props.growPhaseId, {
      period: period.value,
      reservoirLiters: reservoirLiters.value,
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="props.modelValue"
    header="Dosing Calculator"
    modal
    :style="{ width: '90vw', maxWidth: '560px' }"
    @update:visible="emit('update:modelValue', $event)"
  >
    <div class="form-stack">
      <div class="field-row-2">
        <div class="field">
          <label for="dosing-reservoir" class="field-label">Reservoir (liters)</label>
          <InputNumber
            inputId="dosing-reservoir"
            data-testid="reservoir-liters"
            v-model="reservoirLiters"
            :min="0"
            :max="100000"
            :step="0.1"
          />
        </div>
        <div class="field">
          <label for="dosing-period" class="field-label">Period</label>
          <Select
            inputId="dosing-period"
            v-model="period"
            :options="periodOptions"
            option-label="label"
            option-value="value"
          />
        </div>
      </div>
      <Button
        label="Calculate"
        icon="pi pi-calculator"
        data-testid="calculate-dosing"
        :loading="loading"
        @click="calculate"
      />

      <section v-if="result" data-testid="dosing-results" class="dosing-results">
        <div v-if="rows.length" class="dosing-rows">
          <div v-for="row in rows" :key="row.nutrientId" class="dosing-row">
            <span>{{ row.name }}</span>
            <strong>{{ row.ml.toFixed(2) }} ml</strong>
          </div>
        </div>
        <p v-else class="muted">No nutrient dosing configured for this period.</p>
        <span data-testid="dosing-total" class="dosing-total">
          Total: {{ result.totalMl.toFixed(2) }} ml
        </span>
        <Message
          v-for="warning in result.warnings"
          :key="warning"
          data-testid="dosing-warning"
          severity="warn"
        >
          {{ warningText[warning] ?? warning }}
        </Message>
      </section>
    </div>
  </Dialog>
</template>
