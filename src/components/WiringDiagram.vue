<script setup lang="ts">
import { computed } from 'vue'
import type { Device } from '../types/grow'
import { getDeviceWiring } from '../utils/wiring'
import { BCM_TO_PHYS, LEFT_COLUMN, RIGHT_COLUMN } from '../data/gpio-pins'

const DEVICE_COLORS = [
  '#22d3ee',
  '#f472b6',
  '#a3e635',
  '#f59e0b',
  '#818cf8',
  '#fb7185',
  '#34d399',
  '#c084fc',
]

interface DeviceSlot {
  device: Device
  color: string
  signalPhys: number
  signalBcm: number
}

const props = defineProps<{ devices: Device[] }>()

const sortedSlots = computed<DeviceSlot[]>(() =>
  [...props.devices]
    .filter((d) => Number.isFinite(d.pinNumber))
    .map((device) => {
      const wiring = getDeviceWiring(device)
      const signalBcm = wiring.signal
      const signalPhys = BCM_TO_PHYS.get(signalBcm) ?? -1
      return { color: '', device, signalBcm, signalPhys }
    })
    .sort((a, b) => a.signalPhys - b.signalPhys)
    .map((slot, i) => ({ ...slot, color: DEVICE_COLORS[i % DEVICE_COLORS.length] as string })),
)

const usedSignalBcms = computed(() => new Set(sortedSlots.value.map((s) => s.signalBcm)))

const bcmColorMap = computed(() => {
  const map = new Map<number, string>()
  for (const slot of sortedSlots.value) {
    map.set(slot.signalBcm, slot.color)
  }
  return map
})

const piHeaderPinCount = LEFT_COLUMN.length

const svgWidth = 820
const padding = 20
const headerX = padding
const headerY = 40
const headerWidth = 240
const colGap = 12
const pinHeight = 13
const pinGap = 2
const colPinWidth = (headerWidth - colGap) / 2
const headerHeight = piHeaderPinCount * (pinHeight + pinGap) + 8
const devicesX = headerX + headerWidth + 80
const deviceCardWidth = 240
const deviceCardHeight = 38
const deviceGap = 10
const deviceStackTop = headerY + 4
const devicesBottom = computed(() =>
  sortedSlots.value.length === 0
    ? deviceStackTop
    : deviceStackTop +
      (sortedSlots.value.length - 1) * (deviceCardHeight + deviceGap) +
      deviceCardHeight,
)

const totalHeight = computed(() => Math.max(headerY + headerHeight, devicesBottom.value) + 20)

const leftColX = headerX
const rightColX = headerX + colPinWidth + colGap

function pinCenterY(phys: number): number {
  return headerY + 4 + Math.floor((phys - 1) / 2) * (pinHeight + pinGap) + pinHeight / 2
}

function pinX(phys: number): number {
  return phys % 2 === 1 ? leftColX : rightColX
}

function deviceY(index: number): number {
  return deviceStackTop + index * (deviceCardHeight + deviceGap) + deviceCardHeight / 2
}

const slotLines = computed(() =>
  sortedSlots.value.map((slot, i) => {
    const y = deviceY(i)
    const pinY = pinCenterY(slot.signalPhys)
    const pinLeftEdge = pinX(slot.signalPhys) + colPinWidth
    return { slot, i, y, pinY, pinLeftEdge }
  }),
)
</script>

<template>
  <div class="wiring-diagram">
    <svg
      class="wiring-svg"
      :viewBox="`0 0 ${svgWidth} ${totalHeight}`"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Controller wiring diagram"
    >
      <title>Controller wiring diagram</title>
      <desc>
        Auto-generated wiring diagram for {{ sortedSlots.length }} linked
        {{ sortedSlots.length === 1 ? 'device' : 'devices' }} on a Raspberry Pi 40-pin GPIO header.
        Each solid colored wire connects the configured BCM GPIO signal pin to its device.
      </desc>

      <rect
        class="pi-board"
        :x="headerX - 12"
        :y="headerY - 16"
        :width="headerWidth + 24"
        :height="headerHeight + 24"
        rx="8"
        ry="8"
      />
      <text class="pi-label" :x="headerX + headerWidth / 2" :y="headerY - 22" text-anchor="middle">
        Raspberry Pi 40-pin header
      </text>

      <g class="pin-strip">
        <g
          v-for="(pin, i) in LEFT_COLUMN"
          :key="`l-${pin.phys}`"
          :transform="`translate(${leftColX}, ${pinCenterY(pin.phys) - pinHeight / 2})`"
        >
          <rect
            class="pin"
            :class="[
              `pin--${pin.kind}`,
              usedSignalBcms.has(Number(pin.label.replace('BCM ', ''))) ? `pin--used` : '',
            ]"
            :style="{
              stroke: bcmColorMap.get(Number(pin.label.replace('BCM ', ''))),
            }"
            :width="colPinWidth"
            :height="pinHeight"
            rx="3"
            ry="3"
          />
          <text class="pin-phys" :x="6" :y="10">{{ pin.phys }}</text>
          <text class="pin-label" :x="colPinWidth - 6" :y="10" text-anchor="end">
            {{ pin.label }}
          </text>
        </g>
        <g
          v-for="(pin, i) in RIGHT_COLUMN"
          :key="`r-${pin.phys}`"
          :transform="`translate(${rightColX}, ${pinCenterY(pin.phys) - pinHeight / 2})`"
        >
          <rect
            class="pin"
            :class="[
              `pin--${pin.kind}`,
              usedSignalBcms.has(Number(pin.label.replace('BCM ', ''))) ? `pin--used` : '',
            ]"
            :style="{
              stroke: bcmColorMap.get(Number(pin.label.replace('BCM ', ''))),
            }"
            :width="colPinWidth"
            :height="pinHeight"
            rx="3"
            ry="3"
          />
          <text class="pin-phys" :x="6" :y="10">{{ pin.phys }}</text>
          <text class="pin-label" :x="colPinWidth - 6" :y="10" text-anchor="end">
            {{ pin.label }}
          </text>
        </g>
      </g>

      <g class="wires">
        <template v-for="line in slotLines" :key="`wire-${line.i}`">
          <path
            class="wire wire--signal"
            :d="`M ${line.pinLeftEdge} ${line.pinY} L ${line.pinLeftEdge + 16} ${line.pinY} L ${line.pinLeftEdge + 16} ${line.y} L ${devicesX - 4} ${line.y}`"
            :style="{ stroke: line.slot.color }"
          />
        </template>
      </g>

      <g class="devices">
        <g
          v-for="line in slotLines"
          :key="`dev-${line.i}`"
          :transform="`translate(${devicesX}, ${line.y - deviceCardHeight / 2})`"
        >
          <rect
            class="device-card"
            :width="deviceCardWidth"
            :height="deviceCardHeight"
            rx="6"
            ry="6"
            :style="{ '--device-color': line.slot.color }"
          />
          <rect
            class="device-card__accent"
            x="0"
            y="0"
            width="3"
            :height="deviceCardHeight"
            rx="2"
            ry="2"
            :style="{ fill: line.slot.color }"
          />
          <circle class="terminal terminal--sig" :cx="6" :cy="deviceCardHeight / 2" r="3" />
          <text class="device-name" :x="20" :y="16">
            {{ line.slot.device.name }}
          </text>
          <text class="device-type" :x="20" :y="30">
            {{ line.slot.device.type.replaceAll('_', ' ') }} · BCM {{ line.slot.signalBcm }}
          </text>
        </g>
      </g>

      <g class="empty-state" v-if="sortedSlots.length === 0">
        <text :x="svgWidth / 2" :y="totalHeight / 2" text-anchor="middle">
          No devices linked — add a device to generate the wiring diagram.
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.wiring-diagram {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.wiring-svg {
  display: block;
  width: 100%;
  height: auto;
  font-family: var(--font-mono);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
}

.pi-board {
  fill: var(--color-bg-surface);
  stroke: var(--color-border);
  stroke-width: 1;
}

.pi-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  fill: var(--color-text-muted);
}

.pin {
  fill: var(--color-bg-elevated);
  stroke: var(--color-border);
  stroke-width: 1;
}

.pin--gpio {
  stroke: var(--color-accent);
  fill: rgba(34, 197, 94, 0.06);
}

.pin--3v3 {
  stroke: var(--color-info);
  fill: rgba(59, 130, 246, 0.06);
}

.pin--5v {
  stroke: var(--color-danger);
  fill: rgba(239, 68, 68, 0.06);
}

.pin--gnd {
  stroke: var(--color-text-muted);
  fill: var(--color-bg-elevated);
}

.pin--id {
  stroke: var(--color-warning);
  fill: rgba(245, 158, 11, 0.05);
  stroke-dasharray: 3 2;
}

.pin--used {
  stroke-width: 1.75;
  fill: rgba(34, 197, 94, 0.14);
  filter: drop-shadow(0 0 4px var(--color-accent-glow));
}

.pin-phys {
  font-size: 9px;
  fill: var(--color-text-muted);
  font-weight: 500;
}

.pin-label {
  font-size: 10px;
  font-weight: 600;
}

.pin--gpio ~ .pin-label {
  fill: var(--color-accent);
}

.pin--3v3 ~ .pin-label {
  fill: var(--color-info);
}

.pin--5v ~ .pin-label {
  fill: var(--color-danger);
}

.pin--gnd ~ .pin-label {
  fill: var(--color-text-secondary);
}

.pin--id ~ .pin-label {
  fill: var(--color-warning);
}

.wire {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wire--signal {
  stroke-opacity: 1;
}

.device-card {
  fill: var(--color-bg-surface);
  stroke: var(--color-border);
  stroke-width: 1;
}

.device-card__accent {
  fill: var(--device-color, var(--color-accent));
}

.terminal {
  stroke: var(--color-border);
  stroke-width: 1;
}

.terminal--sig {
  fill: var(--device-color, var(--color-accent));
}

.device-name {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  fill: var(--color-text-primary);
}

.device-type {
  font-family: var(--font-mono);
  font-size: 9.5px;
  fill: var(--color-text-secondary);
  text-transform: capitalize;
}

.empty-state {
  font-family: var(--font-sans);
  font-size: 14px;
  fill: var(--color-text-muted);
}
</style>
