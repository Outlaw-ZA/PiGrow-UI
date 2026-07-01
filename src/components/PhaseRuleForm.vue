<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { DayNightPeriod, DeviceAction, DeviceType, RuleCondition, SensorType } from '../types/grow'
import type {
  AutomationRule,
  CreateAutomationRulePayload,
  Device,
  UpdateAutomationRulePayload,
} from '../types/grow'
import { SENSOR_TYPE_OPTIONS } from '../utils/sensors'

const props = defineProps<{
  mode: 'create' | 'edit'
  growPhaseId: string
  devices: Device[]
  initialRule?: AutomationRule
  initialCondition?: RuleCondition
  fieldError?: { field: FieldKey; message: string } | null
}>()

const emit = defineEmits<{
  cancel: []
  submit: [
    payload:
      | { kind: 'create'; payload: CreateAutomationRulePayload }
      | { kind: 'update'; id: string; payload: UpdateAutomationRulePayload },
  ]
}>()

type FieldKey = 'deviceId' | 'watchedSensorType' | 'condition' | 'action' | 'period'
// FieldKey is also referenced (by string-literal contract) in
// PhaseAutomationRulesDialog.vue. Keep the union values in sync there.

interface Draft {
  deviceId: string | null
  watchedSensorType: SensorType | null
  condition: RuleCondition
  period: DayNightPeriod | null
  action: DeviceAction
  cooldownSeconds: number
}

const BOTH = 'BOTH' as const
type PeriodChoice = DayNightPeriod | typeof BOTH

const deviceOptions = computed(() =>
  props.devices
    .filter((d) => d.isActive && d.type !== DeviceType.LIGHT)
    .map((d) => ({ label: d.name, type: d.type, value: d.id })),
)

const sensorOptions = SENSOR_TYPE_OPTIONS

const conditionOptions = [
  {
    description: 'Trigger when reading exceeds the max threshold',
    label: 'Above max',
    value: RuleCondition.ABOVE_MAX,
  },
  {
    description: 'Trigger when reading falls below the min threshold',
    label: 'Below min',
    value: RuleCondition.BELOW_MIN,
  },
  {
    description: 'Pin device to ON within the rule scope',
    label: 'Pin ON (this phase)',
    value: RuleCondition.ALWAYS_ON,
  },
  {
    description: 'Pin device to OFF within the rule scope',
    label: 'Pin OFF (this phase)',
    value: RuleCondition.ALWAYS_OFF,
  },
]

const periodOptions: { label: string; value: PeriodChoice }[] = [
  { label: 'Day', value: DayNightPeriod.DAY },
  { label: 'Night', value: DayNightPeriod.NIGHT },
  { label: 'Both (day & night)', value: BOTH },
]

const actionOptions = [
  { label: 'Turn ON', value: DeviceAction.ON },
  { label: 'Turn OFF', value: DeviceAction.OFF },
]

const isAlways = computed(
  () =>
    draft.value.condition === RuleCondition.ALWAYS_ON ||
    draft.value.condition === RuleCondition.ALWAYS_OFF,
)

const isThreshold = computed(
  () =>
    draft.value.condition === RuleCondition.ABOVE_MAX ||
    draft.value.condition === RuleCondition.BELOW_MIN,
)

function emptyDraft(): Draft {
  return {
    action: DeviceAction.ON,
    condition: props.initialCondition ?? RuleCondition.ABOVE_MAX,
    cooldownSeconds: 180,
    deviceId: props.devices.find((d) => d.isActive && d.type !== DeviceType.LIGHT)?.id ?? null,
    period: null,
    watchedSensorType: SensorType.TEMPERATURE,
  }
}

const draft = ref<Draft>(emptyDraft())

function hydrate() {
  if (props.mode === 'edit' && props.initialRule) {
    draft.value = {
      action: props.initialRule.action,
      condition: props.initialRule.condition,
      cooldownSeconds: props.initialRule.cooldownSeconds,
      deviceId: props.initialRule.deviceId,
      period: props.initialRule.period,
      watchedSensorType: props.initialRule.watchedSensorType,
    }
  } else {
    draft.value = emptyDraft()
  }
}

watch(
  () => [props.mode, props.initialRule?.id, props.devices.length, props.initialCondition],
  () => hydrate(),
  { immediate: true },
)

watch(
  () => draft.value.condition,
  (next, prev) => {
    if (next === RuleCondition.ALWAYS_ON) {
      draft.value.action = DeviceAction.ON
      draft.value.watchedSensorType = null
    } else if (next === RuleCondition.ALWAYS_OFF) {
      draft.value.action = DeviceAction.OFF
      draft.value.watchedSensorType = null
    } else if (prev === RuleCondition.ALWAYS_ON || prev === RuleCondition.ALWAYS_OFF) {
      draft.value.watchedSensorType = SensorType.TEMPERATURE
    }
  },
)

const periodChoice = computed<PeriodChoice>({
  get: () => (draft.value.period === null ? BOTH : draft.value.period),
  set: (val) => {
    draft.value.period = val === BOTH ? null : val
  },
})

const actionOptionsForCondition = computed(() => {
  if (draft.value.condition === RuleCondition.ALWAYS_ON) {
    return actionOptions.filter((o) => o.value === DeviceAction.ON)
  }
  if (draft.value.condition === RuleCondition.ALWAYS_OFF) {
    return actionOptions.filter((o) => o.value === DeviceAction.OFF)
  }
  return actionOptions
})

const validationError = computed<string | null>(() => {
  if (!draft.value.deviceId) {
    return 'Select a device.'
  }
  if (isThreshold.value && draft.value.watchedSensorType == null) {
    return 'watchedSensorType is required for ABOVE_MAX / BELOW_MIN rules'
  }
  if (isAlways.value && draft.value.watchedSensorType != null) {
    return 'watchedSensorType must be null for ALWAYS_ON / ALWAYS_OFF rules'
  }
  if (draft.value.condition === RuleCondition.ALWAYS_ON && draft.value.action !== DeviceAction.ON) {
    return 'action must be ON for condition ALWAYS_ON'
  }
  if (
    draft.value.condition === RuleCondition.ALWAYS_OFF &&
    draft.value.action !== DeviceAction.OFF
  ) {
    return 'action must be OFF for condition ALWAYS_OFF'
  }
  if (draft.value.cooldownSeconds < 0) {
    return 'Cooldown cannot be negative.'
  }
  return null
})

const isValid = computed(() => validationError.value === null)

const inlineErrorFor = (field: FieldKey): string | null => {
  if (props.fieldError && props.fieldError.field === field) {
    return props.fieldError.message
  }
  return null
}

function onSubmit() {
  if (!isValid.value || draft.value.deviceId === null) {
    return
  }
  if (props.mode === 'create') {
    const payload: CreateAutomationRulePayload = {
      action: draft.value.action,
      condition: draft.value.condition,
      cooldownSeconds: draft.value.cooldownSeconds,
      deviceId: draft.value.deviceId,
      enabled: true,
      growPhaseId: props.growPhaseId,
      period: draft.value.period,
      watchedSensorType: draft.value.watchedSensorType,
    }
    emit('submit', { kind: 'create', payload })
  } else if (props.initialRule) {
    const payload: UpdateAutomationRulePayload = {
      action: draft.value.action,
      condition: draft.value.condition,
      cooldownSeconds: draft.value.cooldownSeconds,
      deviceId: draft.value.deviceId,
      period: draft.value.period,
      watchedSensorType: draft.value.watchedSensorType,
    }
    emit('submit', { id: props.initialRule.id, kind: 'update', payload })
  }
}
</script>

<template>
  <form class="rule-form" @submit.prevent="onSubmit">
    <div class="form-grid">
      <div class="field">
        <label class="field-label">Device</label>
        <Select
          v-model="draft.deviceId"
          :options="deviceOptions"
          option-label="label"
          option-value="value"
          placeholder="Select a device"
          class="full-width"
          :invalid="!!inlineErrorFor('deviceId')"
        />
        <p v-if="inlineErrorFor('deviceId')" class="field-error">
          {{ inlineErrorFor('deviceId') }}
        </p>
      </div>

      <div class="field" v-if="isThreshold">
        <label class="field-label">Watched sensor</label>
        <Select
          v-model="draft.watchedSensorType"
          :options="sensorOptions"
          option-label="label"
          option-value="value"
          placeholder="Select sensor"
          class="full-width"
          :invalid="!!inlineErrorFor('watchedSensorType')"
        />
        <p v-if="inlineErrorFor('watchedSensorType')" class="field-error">
          {{ inlineErrorFor('watchedSensorType') }}
        </p>
      </div>
      <div class="field" v-else>
        <label class="field-label">Watched sensor</label>
        <p class="field-hint locked">N/A — pinned rule (always-on/always-off)</p>
      </div>

      <div class="field">
        <label class="field-label">Condition</label>
        <Select
          v-model="draft.condition"
          :options="conditionOptions"
          option-label="label"
          option-value="value"
          class="full-width"
        />
      </div>

      <div class="field">
        <label class="field-label">Period</label>
        <Select
          v-model="periodChoice"
          :options="periodOptions"
          option-label="label"
          option-value="value"
          class="full-width"
          :invalid="!!inlineErrorFor('period')"
        />
        <p v-if="inlineErrorFor('period')" class="field-error">
          {{ inlineErrorFor('period') }}
        </p>
      </div>

      <div class="field">
        <label class="field-label">Action</label>
        <Select
          v-model="draft.action"
          :options="actionOptionsForCondition"
          option-label="label"
          option-value="value"
          :disabled="isAlways"
          class="full-width"
          :invalid="!!inlineErrorFor('action')"
        />
        <p v-if="isAlways" class="field-hint">
          Locked to {{ draft.action }} for condition {{ draft.condition }}.
        </p>
        <p v-else-if="inlineErrorFor('action')" class="field-error">
          {{ inlineErrorFor('action') }}
        </p>
      </div>

      <div class="field">
        <label class="field-label">Cooldown (seconds)</label>
        <InputNumber
          v-model="draft.cooldownSeconds"
          :min="0"
          :max="86400"
          show-buttons
          class="full-width"
        />
      </div>
    </div>

    <Message v-if="validationError" severity="warn" :closable="false" class="form-message">
      {{ validationError }}
    </Message>

    <div class="form-actions">
      <Button label="Cancel" severity="secondary" type="button" @click="emit('cancel')" />
      <Button
        :label="mode === 'create' ? 'Add rule' : 'Save changes'"
        severity="success"
        type="submit"
        :disabled="!isValid"
      />
    </div>
  </form>
</template>

<style scoped>
.rule-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3) var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
}

.field-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.field-hint.locked {
  font-style: italic;
  padding: 0.4375rem 0.625rem;
  background: var(--color-bg-elevated);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
}

.field-error {
  font-size: var(--text-xs);
  color: var(--color-danger-600, #d32f2f);
  margin: 0;
}

.full-width {
  width: 100%;
}

.form-message {
  margin: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
