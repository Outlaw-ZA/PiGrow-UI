<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import type { GrowPhase } from '../../types/grow'
import { useProvidedGrowMonitorState } from './useGrowMonitorState'
import { extractApiError } from '../../utils/errors'
import { proximitySeverity, barFillStyle } from './ruleDisplay'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputSwitch from 'primevue/inputswitch'

// Lazy-load the rules editor — pulls in DataTable + form bits that the
// Plan tab doesn't otherwise need.
const PhaseAutomationRulesDialog = defineAsyncComponent(
  () => import('../../components/PhaseAutomationRulesDialog.vue'),
)

const state = useProvidedGrowMonitorState()
const toast = useToast()

const activePhase = computed<GrowPhase | null>(() => {
  const idx = state.activePhaseIndex.value
  if (idx < 0) {
    return null
  }
  return state.sortedPhases.value[idx] ?? null
})

function formatLastTriggered(iso: string): string {
  return state.formatLastTriggered(iso)
}

async function onRuleToggle(ruleId: string) {
  try {
    await state.onRuleToggle(ruleId)
  } catch {
    const { message, status } = extractApiError(new Error('toggle failed'), 'Failed to toggle rule')
    if (status !== 0) {
      toast.add({ detail: message, life: 5000, severity: 'error', summary: 'Toggle failed' })
    }
  }
}

const showRulesDialog = ref(false)

function openRulesDialog(phase: GrowPhase | null) {
  if (!phase?.id) {
    return
  }
  showRulesDialog.value = true
}
</script>

<template>
  <div class="plan-tab">
    <Card>
      <template #title>Phases</template>
      <template #content>
        <div v-if="state.sortedPhases.value.length" class="phases-wrapper">
          <div class="phase-track">
            <div class="phase-line">
              <div
                class="phase-line-fill"
                :style="{ width: state.cycleProgressPercent.value + '%' }"
              ></div>
            </div>
            <div
              v-for="(phase, idx) in state.sortedPhases.value"
              :key="phase.id || idx"
              class="phase-step"
            >
              <div
                class="phase-dot"
                :class="{
                  active: idx === state.activePhaseIndex.value,
                  done: idx < state.activePhaseIndex.value,
                  pending: idx > state.activePhaseIndex.value,
                }"
              >
                {{ idx + 1 }}
              </div>
              <div class="phase-name" :class="{ active: idx === state.activePhaseIndex.value }">
                {{ phase.name }}
              </div>
              <div class="phase-duration">
                {{ phase.durationDays }} day{{ phase.durationDays !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>

          <div class="progress-block">
            <div class="progress-header">
              <span class="progress-label">
                Phase
                {{ state.activePhaseIndex.value >= 0 ? state.activePhaseIndex.value + 1 : '—' }} /
                {{ state.sortedPhases.value.length }} elapsed
              </span>
              <span class="progress-value">
                {{ state.elapsedDays.value }} / {{ state.totalDurationDays.value }} days
              </span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: state.cycleProgressPercent.value + '%' }"
              ></div>
            </div>
            <div class="progress-footer">
              <span v-if="state.estimatedHarvestDate.value">
                est. harvest {{ state.estimatedHarvestDate.value }}
              </span>
              <span v-else>—</span>
              <span>
                {{ state.daysRemaining.value }}
                {{ state.daysRemaining.value === 1 ? 'day' : 'days' }} remaining
              </span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">No phases configured for this grow cycle.</div>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="auto-card-title">
          <span>Automations — {{ state.activePhaseName.value }}</span>
          <Button
            v-if="activePhase?.id"
            label="Manage rules"
            icon="pi pi-cog"
            severity="success"
            size="small"
            @click="openRulesDialog(activePhase)"
          />
        </div>
      </template>
      <template #content>
        <div v-if="state.automations.loading" class="auto-loading">
          <i class="pi pi-spin pi-spinner" /> Loading automations…
        </div>
        <div v-else-if="state.activePhaseIndex.value < 0" class="empty-state">
          No active phase — automations are scoped to a phase.
        </div>
        <div v-else-if="!state.automations.hasRules" class="empty-state">
          No automation rules configured for this phase.
        </div>
        <div v-else class="auto-content">
          <div v-for="group in state.automations.groups" :key="group.key" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">{{ group.label }}</span>
              <span class="auto-group-reading">
                <span class="auto-group-reading-value">{{ group.currentReading }}</span>
              </span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in group.rules"
                :key="info.rule.id"
                class="auto-rule"
                :class="{ 'auto-rule--disabled': !info.rule.enabled }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <div class="auto-rule-status">
                    <Tag
                      v-if="!info.rule.enabled"
                      value="OFF"
                      severity="secondary"
                      rounded
                      class="auto-rule-off-tag"
                    />
                    <span class="auto-rule-current" :class="`auto-rule-current--${info.proximity}`">
                      {{ info.currentValue ?? '—' }}{{ info.unit }}
                    </span>
                    <Tag
                      v-if="info.thresholdValue != null"
                      :value="state.proximityLabel(info.proximity)"
                      :severity="proximitySeverity(info.proximity)"
                      rounded
                    />
                    <i
                      v-else
                      class="pi pi-exclamation-triangle auto-rule-warn-icon"
                      v-tooltip.top="
                        'Threshold not set on active period environment — this rule will never fire.'
                      "
                    ></i>
                  </div>
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="state.automations.loading"
                    @update:modelValue="() => onRuleToggle(info.rule.id)"
                  />
                </div>
                <div class="auto-rule-row2">
                  <span class="auto-rule-cond">
                    {{ info.conditionShort }} → {{ state.actionLabel(info.rule.action) }}
                  </span>
                  <div v-if="info.thresholdValue != null" class="auto-rule-mini">
                    <div class="auto-rule-mini-bar">
                      <div
                        class="auto-rule-mini-fill"
                        :class="`auto-rule-mini-fill--${info.proximity}`"
                        :style="barFillStyle(info)"
                      ></div>
                      <div class="auto-rule-mini-tick" :style="{ left: '66.66%' }"></div>
                    </div>
                    <span class="auto-rule-mini-text"
                      >{{ info.thresholdValue }}{{ info.unit }}</span
                    >
                  </div>
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                  <i
                    class="pi pi-info-circle auto-rule-info"
                    v-tooltip.top="
                      info.rule.lastTriggeredAt
                        ? `Last triggered: ${formatLastTriggered(info.rule.lastTriggeredAt)}`
                        : 'Never triggered'
                    "
                  ></i>
                </div>
              </div>
            </div>
          </div>

          <div v-if="state.automations.pinnedRules.length" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">Pinned</span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in state.automations.pinnedRules"
                :key="info.rule.id"
                class="auto-rule auto-rule--pinned"
                :class="{ 'auto-rule--disabled': !info.rule.enabled }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <Tag v-if="!info.rule.enabled" value="OFF" severity="secondary" rounded />
                  <span class="auto-rule-cond">{{ info.conditionShort }}</span>
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="state.automations.loading"
                    @update:modelValue="() => onRuleToggle(info.rule.id)"
                  />
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="state.automations.intervalRules.length" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">Interval</span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in state.automations.intervalRules"
                :key="info.rule.id"
                class="auto-rule auto-rule--pinned"
                :class="{ 'auto-rule--disabled': !info.rule.enabled }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <Tag v-if="!info.rule.enabled" value="OFF" severity="secondary" rounded />
                  <span class="auto-rule-cond">{{ info.conditionShort }}</span>
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="state.automations.loading"
                    @update:modelValue="() => onRuleToggle(info.rule.id)"
                  />
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="state.automations.scheduleRules.length" class="auto-group">
            <div class="auto-group-header">
              <span class="auto-group-label">Schedule</span>
            </div>
            <div class="auto-rules">
              <div
                v-for="info in state.automations.scheduleRules"
                :key="info.rule.id"
                class="auto-rule auto-rule--pinned"
                :class="{ 'auto-rule--disabled': !info.rule.enabled }"
              >
                <div class="auto-rule-row1">
                  <div class="auto-rule-device">
                    <i :class="info.deviceIcon" class="auto-rule-icon"></i>
                    <span class="auto-rule-name">{{ info.device?.name ?? 'Unknown device' }}</span>
                  </div>
                  <Tag v-if="!info.rule.enabled" value="OFF" severity="secondary" rounded />
                  <span class="auto-rule-cond">{{ info.conditionShort }}</span>
                  <InputSwitch
                    :modelValue="info.rule.enabled"
                    :disabled="state.automations.loading"
                    @update:modelValue="() => onRuleToggle(info.rule.id)"
                  />
                  <span class="auto-rule-period">{{ info.periodLabel }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <PhaseAutomationRulesDialog
      v-if="activePhase"
      v-model:visible="showRulesDialog"
      :phase="activePhase"
      :devices="state.growDevices.value"
    />
  </div>
</template>

<style scoped>
.plan-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Phases timeline */

.phases-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.phase-track {
  display: flex;
  align-items: flex-start;
  gap: 0;
  position: relative;
  padding: var(--space-2) 0;
}

.phase-line {
  position: absolute;
  top: 14px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-phase-pending-border);
  z-index: 0;
}

.phase-line-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--color-track-fill);
  transition: width var(--duration-slow) var(--ease-default);
}

.phase-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  position: relative;
  z-index: 1;
  min-width: 0;
}

.phase-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  border: 2px solid var(--color-phase-pending-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-phase-pending-text);
  transition:
    background var(--duration-fast) var(--ease-default),
    border-color var(--duration-fast) var(--ease-default),
    color var(--duration-fast) var(--ease-default);
}

.phase-dot.done {
  background: var(--color-phase-done);
  border-color: var(--color-phase-done);
  color: var(--color-phase-done-text);
}

.phase-dot.active {
  background: var(--color-phase-active);
  border-color: var(--color-phase-active);
  color: var(--color-text-inverse);
  box-shadow: 0 0 0 4px var(--color-accent-glow);
}

.phase-name {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-align: center;
  font-weight: 500;
}

.phase-name.active {
  color: var(--color-accent);
  font-weight: 600;
}

.phase-duration {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.progress-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  font-weight: 500;
}

.progress-label {
  color: var(--color-text-secondary);
}

.progress-value {
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  height: 6px;
  background: var(--color-track-bg);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-track-fill);
  transition: width var(--duration-slow) var(--ease-default);
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

/* Automations */

.auto-card-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}

.auto-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--color-text-muted);
}

.auto-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auto-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.auto-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.auto-group-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
}

.auto-group-reading {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.auto-rules {
  display: flex;
  flex-direction: column;
}

.auto-rule {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.auto-rule:last-child {
  border-bottom: none;
}

.auto-rule--disabled {
  opacity: 0.55;
}

.auto-rule--pinned {
  padding: var(--space-2) 0;
}

.auto-rule-row1 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-3);
}

.auto-rule-device {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.auto-rule-icon {
  color: var(--color-accent);
  font-size: var(--text-md);
}

.auto-rule-name {
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auto-rule-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.auto-rule-off-tag {
  margin-right: var(--space-1);
}

.auto-rule-current {
  font-weight: 600;
  color: var(--color-text-primary);
}

.auto-rule-current--safe {
  color: var(--color-success);
}

.auto-rule-current--approaching {
  color: var(--color-warning);
}

.auto-rule-current--firing {
  color: var(--color-danger);
}

.auto-rule-current--unset,
.auto-rule-current--unknown,
.auto-rule-current--not-applicable {
  color: var(--color-text-muted);
}

.auto-rule-warn-icon {
  color: var(--color-warning);
  font-size: var(--text-md);
}

.auto-rule-row2 {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  font-size: var(--text-sm);
}

.auto-rule-cond {
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.auto-rule-mini {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.auto-rule-mini-bar {
  position: relative;
  width: 64px;
  height: 4px;
  background: var(--color-track-bg);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.auto-rule-mini-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width var(--duration-slow) var(--ease-default);
}

.auto-rule-mini-fill--safe {
  background: var(--color-success);
}

.auto-rule-mini-fill--approaching {
  background: var(--color-warning);
}

.auto-rule-mini-fill--firing {
  background: var(--color-danger);
}

.auto-rule-mini-fill--unset,
.auto-rule-mini-fill--unknown,
.auto-rule-mini-fill--not-applicable {
  background: var(--color-text-muted);
}

.auto-rule-mini-tick {
  position: absolute;
  top: -2px;
  width: 1px;
  height: 8px;
  background: var(--color-text-secondary);
}

.auto-rule-mini-text {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.auto-rule-period {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  padding: 0.125rem 0.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.auto-rule-info {
  color: var(--color-text-muted);
  font-size: var(--text-base);
  cursor: help;
}
</style>
