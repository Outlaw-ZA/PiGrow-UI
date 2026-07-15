# Chart Time Axis Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CategoryScale with TimeScale in both monitor chart components so x-axis ticks snap to clean, evenly-spaced time boundaries.

**Architecture:** Add `chartjs-adapter-date-fns` dependency and a shared `getTimeAxisConfig()` utility that maps range-seconds to `{ unit, stepSize, displayFormats }`. Both `TelemetryChart.vue` and `DeviceHistoryChart.vue` switch from `CategoryScale` + split `labels`/`data` arrays to `TimeScale` + `{ x, y }` point format.

**Tech Stack:** Vue 3, Chart.js 4, vue-chartjs, chartjs-adapter-date-fns

## Global Constraints

- chartjs-adapter-date-fns must be a runtime dependency (not devDependency)
- The shared utility must handle all four known presets (3600, 21600, 86400, 604800) and a reasonable default for unknown ranges
- No changes to chart appearance beyond x-axis configuration
- Existing Tooltip, legend, and interaction configuration must remain intact

---

### Task 1: Install dependency + Create shared time-axis utility

**Files:**

- Modify: `package.json` (add dependency)
- Create: `src/utils/chartTimeAxis.ts`
- Test: (covered by type-check)

**Interfaces:**

- Produces: `getTimeAxisConfig(rangeSeconds: number): { unit: 'minute' | 'hour'; stepSize: number; displayFormats: Record<string, string> }`

- [ ] **Step 1: Install dependency**

```bash
npm install chartjs-adapter-date-fns
```

- [ ] **Step 2: Create `src/utils/chartTimeAxis.ts`**

```ts
export interface TimeAxisConfig {
  unit: 'minute' | 'hour'
  stepSize: number
  displayFormats: Record<string, string>
}

const PRESET_CONFIGS: Record<number, TimeAxisConfig> = {
  3600: { unit: 'minute', stepSize: 10, displayFormats: { minute: 'HH:mm' } },
  21600: { unit: 'minute', stepSize: 30, displayFormats: { minute: 'HH:mm' } },
  86400: { unit: 'hour', stepSize: 2, displayFormats: { hour: 'HH:mm' } },
  604800: { unit: 'hour', stepSize: 12, displayFormats: { hour: 'MMM dd HH:mm' } },
}

const DEFAULT_CONFIG: TimeAxisConfig = {
  unit: 'hour',
  stepSize: 1,
  displayFormats: { hour: 'HH:mm' },
}

export function getTimeAxisConfig(rangeSeconds: number): TimeAxisConfig {
  return PRESET_CONFIGS[rangeSeconds] ?? DEFAULT_CONFIG
}
```

- [ ] **Step 3: Verify the file compiles**

```bash
npx vue-tsc --noEmit src/utils/chartTimeAxis.ts
```

If vue-tsc requires the full tsconfig, use project's type-check script:

```bash
npm run type-check:fast
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add chartjs-adapter-date-fns and shared time-axis config"
```

---

### Task 2: Update TelemetryChart.vue

**Files:**

- Modify: `src/components/TelemetryChart.vue`

**Interfaces:**

- Consumes: `getTimeAxisConfig(rangeSeconds)` from `src/utils/chartTimeAxis.ts`
- Inputs: `props.growCycleId: string`, internal `selectedRange` (ref initialized to 86400)

- [ ] **Step 1: Update imports and registration**

Replace:

```ts
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
```

With:

```ts
import {
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
```

Change registration:

```ts
ChartJS.register(CategoryScale, ...)
```

→

```ts
ChartJS.register(TimeScale, ...)
```

Add import at top of `<script>`:

```ts
import { getTimeAxisConfig } from '../utils/chartTimeAxis'
```

- [ ] **Step 2: Update chartData computed — switch to {x, y} format**

Replace:

```ts
const chartData = computed(() => {
  const config = sensorConfig.value
  const data = telemetryData.value
  return {
    datasets: [
      {
        ...
        data: data.map((d) => d.value),
        ...
      },
    ],
    labels: data.map((d) => new Date(d.createdAt).toLocaleTimeString()),
  }
})
```

With:

```ts
const chartData = computed(() => {
  const config = sensorConfig.value
  const data = telemetryData.value
  return {
    datasets: [
      {
        ...
        data: data.map((d) => ({ x: new Date(d.createdAt).getTime(), y: d.value })),
        ...
      },
    ],
  }
})
```

- [ ] **Step 3: Update chartOptions computed — add time scale config**

Add import:

```ts
import { getTimeAxisConfig } from '../utils/chartTimeAxis'
```

In `scales.x`, replace:

```ts
x: {
  display: true,
  grid: { display: false },
  ticks: {
    color: 'rgba(255, 255, 255, 0.5)',
    font: { size: 11 },
    maxTicksLimit: 10,
  },
},
```

With:

```ts
x: {
  display: true,
  grid: { display: false },
  type: 'time',
  time: getTimeAxisConfig(selectedRange.value),
  ticks: {
    color: 'rgba(255, 255, 255, 0.5)',
    font: { size: 11 },
    source: 'auto',
  },
},
```

- [ ] **Step 4: Run type-check**

```bash
npm run type-check:fast
```

Expected: clean exit with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate TelemetryChart to TimeScale with clean x-axis ticks"
```

---

### Task 3: Update DeviceHistoryChart.vue

**Files:**

- Modify: `src/components/DeviceHistoryChart.vue`

**Interfaces:**

- Consumes: `getTimeAxisConfig(rangeSeconds)` from `src/utils/chartTimeAxis.ts`
- Inputs: `props.selectedRange: number` (seconds)

- [ ] **Step 1: Same import/registration changes as Task 2**

Replace `CategoryScale` with `TimeScale`, add `import 'chartjs-adapter-date-fns'`, add `import { getTimeAxisConfig } from '../utils/chartTimeAxis'`.

- [ ] **Step 2: Update chartData computed — switch to {x, y} format**

Replace:

```ts
const chartData = computed(() => {
  ...
  return {
    datasets: [
      {
        ...
        data: points.map((p) => p.value),
        ...
      },
    ],
    labels: points.map((p) => p.time.toLocaleTimeString()),
  }
})
```

With:

```ts
const chartData = computed(() => {
  ...
  return {
    datasets: [
      {
        ...
        data: points.map((p) => ({ x: p.time.getTime(), y: p.value })),
        ...
      },
    ],
  }
})
```

- [ ] **Step 3: Update chartOptions computed — add time scale config**

In `scales.x`, replace:

```ts
x: {
  display: true,
  grid: { display: false },
  ticks: {
    color: 'rgba(255, 255, 255, 0.4)',
    font: { size: 10 },
    maxTicksLimit: 6,
  },
},
```

With:

```ts
x: {
  display: true,
  grid: { display: false },
  type: 'time',
  time: getTimeAxisConfig(props.selectedRange),
  ticks: {
    color: 'rgba(255, 255, 255, 0.4)',
    font: { size: 10 },
    source: 'auto',
  },
},
```

- [ ] **Step 4: Run type-check**

```bash
npm run type-check:fast
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate DeviceHistoryChart to TimeScale with clean x-axis ticks"
```

---

### Task 4: Full verification

- [ ] **Step 1: Run type-check**

```bash
npm run type-check:fast
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Run build**

```bash
npm run build
```

- [ ] **Step 5: Verify commit history**

```bash
git log --oneline -5
```
