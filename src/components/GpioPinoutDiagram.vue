<script setup lang="ts">
import { LEFT_COLUMN, RIGHT_COLUMN } from '../data/gpio-pins'

const rowHeight = 30
const pinWidth = 140
const pinHeight = 26
const startX = 60
const startY = 56
const leftX = startX
const rightX = startX + pinWidth + 24
const bodyWidth = pinWidth * 2 + 24

const bodyTopY = startY - 14
const bodyBottomY = startY + LEFT_COLUMN.length * rowHeight + 4
</script>

<template>
  <figure class="gpio-diagram" role="img" aria-label="Raspberry Pi 40-pin GPIO header reference">
    <svg
      class="gpio-svg"
      :viewBox="`0 0 ${bodyWidth + 120} ${bodyBottomY + 32}`"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Raspberry Pi 40-pin GPIO header</title>
      <desc>
        Reference diagram of the Raspberry Pi 40-pin GPIO header showing physical pin numbers, BCM
        GPIO numbers, and special-function annotations for the I2C, SPI, UART and PWM buses. Green
        pins are general-purpose BCM GPIO, blue are 3.3V, red are 5V, grey are ground.
      </desc>

      <rect
        class="board"
        :x="startX - 40"
        :y="bodyTopY - 16"
        :width="bodyWidth + 80"
        :height="bodyBottomY - bodyTopY + 32"
        rx="8"
        ry="8"
      />

      <text class="board-label" :x="startX - 24" :y="bodyTopY - 2" text-anchor="end">Pi</text>
      <text class="board-label" :x="startX + bodyWidth + 24" :y="bodyTopY - 2" text-anchor="start">
        Pi
      </text>

      <rect
        class="connector"
        :x="startX"
        :y="startY - 14"
        :width="bodyWidth"
        :height="bodyBottomY - startY + 14"
        rx="4"
        ry="4"
      />

      <g class="pins-left">
        <g
          v-for="(pin, i) in LEFT_COLUMN"
          :key="`l-${pin.phys}`"
          :transform="`translate(${leftX}, ${startY + i * rowHeight})`"
        >
          <rect
            class="pin"
            :class="[
              `pin--${pin.kind}`,
              { 'pin--highlight': pin.label === 'BCM 4' },
              pin.fn ? `pin--has-fn` : null,
              pin.fn ? `pin--fn-${pin.fn.family.toLowerCase()}` : null,
            ]"
            :width="pinWidth"
            :height="pinHeight"
            rx="4"
            ry="4"
          />
          <text class="pin-phys" :x="10" :y="12">{{ pin.phys }}</text>
          <text class="pin-label" :x="pinWidth - 10" :y="12" text-anchor="end">
            {{ pin.label }}
          </text>
          <text
            v-if="pin.fn"
            class="pin-fn"
            :class="`pin-fn--${pin.fn.family.toLowerCase()}`"
            :x="10"
            :y="22"
          >
            {{ pin.fn.family }} · {{ pin.fn.role }}
          </text>
        </g>
      </g>

      <g class="pins-right">
        <g
          v-for="(pin, i) in RIGHT_COLUMN"
          :key="`r-${pin.phys}`"
          :transform="`translate(${rightX}, ${startY + i * rowHeight})`"
        >
          <rect
            class="pin"
            :class="[
              `pin--${pin.kind}`,
              { 'pin--highlight': pin.label === 'BCM 4' },
              pin.fn ? `pin--has-fn` : null,
              pin.fn ? `pin--fn-${pin.fn.family.toLowerCase()}` : null,
            ]"
            :width="pinWidth"
            :height="pinHeight"
            rx="4"
            ry="4"
          />
          <text class="pin-phys" :x="10" :y="12">{{ pin.phys }}</text>
          <text class="pin-label" :x="pinWidth - 10" :y="12" text-anchor="end">
            {{ pin.label }}
          </text>
          <text
            v-if="pin.fn"
            class="pin-fn"
            :class="`pin-fn--${pin.fn.family.toLowerCase()}`"
            :x="10"
            :y="22"
          >
            {{ pin.fn.family }} · {{ pin.fn.role }}
          </text>
        </g>
      </g>

      <text class="axis-label" :x="leftX + pinWidth / 2" :y="startY - 22" text-anchor="middle">
        Physical pin →
      </text>
    </svg>
  </figure>
</template>

<style scoped>
.gpio-diagram {
  margin: 0;
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow-x: auto;
}

.gpio-svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 560px;
  font-family: var(--font-mono);
}

.board {
  fill: var(--color-bg-surface);
  stroke: var(--color-border);
  stroke-width: 1;
}

.board-label {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  fill: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.connector {
  fill: var(--color-bg-base);
  stroke: var(--color-border);
  stroke-width: 1;
}

.axis-label {
  font-family: var(--font-sans);
  font-size: 10px;
  fill: var(--color-text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pin {
  fill: var(--color-bg-elevated);
  stroke: var(--color-border);
  stroke-width: 1;
  transition:
    fill var(--duration-fast) var(--ease-default),
    stroke var(--duration-fast) var(--ease-default);
}

.pin--gpio {
  stroke: var(--color-accent);
  fill: rgba(34, 197, 94, 0.08);
}

.pin--3v3 {
  stroke: var(--color-info);
  fill: rgba(59, 130, 246, 0.08);
}

.pin--5v {
  stroke: var(--color-danger);
  fill: rgba(239, 68, 68, 0.08);
}

.pin--gnd {
  stroke: var(--color-text-muted);
  fill: var(--color-bg-elevated);
}

.pin--id {
  stroke: var(--color-warning);
  fill: rgba(245, 158, 11, 0.06);
  stroke-dasharray: 3 2;
}

.pin--highlight {
  stroke: var(--color-accent);
  stroke-width: 2;
  filter: drop-shadow(0 0 6px var(--color-accent-glow));
  fill: rgba(34, 197, 94, 0.18);
}

.pin--has-fn.pin--fn-i2c {
  stroke: var(--color-bus-i2c);
  fill: var(--color-bus-i2c-bg);
}

.pin--has-fn.pin--fn-spi {
  stroke: var(--color-bus-spi);
  fill: var(--color-bus-spi-bg);
}

.pin--has-fn.pin--fn-uart {
  stroke: var(--color-bus-uart);
  fill: var(--color-bus-uart-bg);
}

.pin--has-fn.pin--fn-pwm {
  stroke: var(--color-bus-pwm);
  fill: var(--color-bus-pwm-bg);
}

.pin-phys {
  font-size: 10px;
  fill: var(--color-text-muted);
  font-weight: 500;
}

.pin-label {
  font-size: 11px;
  font-weight: 600;
}

.pin-fn {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pin-fn--i2c {
  fill: var(--color-bus-i2c);
}

.pin-fn--spi {
  fill: var(--color-bus-spi);
}

.pin-fn--uart {
  fill: var(--color-bus-uart);
}

.pin-fn--pwm {
  fill: var(--color-bus-pwm);
}

.pin--gpio + .pin-label,
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

.pin--highlight ~ .pin-label {
  fill: var(--color-accent);
}

.pin--has-fn.pin--fn-i2c ~ .pin-label {
  fill: var(--color-bus-i2c);
}

.pin--has-fn.pin--fn-spi ~ .pin-label {
  fill: var(--color-bus-spi);
}

.pin--has-fn.pin--fn-uart ~ .pin-label {
  fill: var(--color-bus-uart);
}

.pin--has-fn.pin--fn-pwm ~ .pin-label {
  fill: var(--color-bus-pwm);
}
</style>
