# Chart Time Axis Cleanup — Design Spec

## Problem

Monitor view charts (`TelemetryChart.vue` and `DeviceHistoryChart.vue`) use Chart.js **`CategoryScale`**, which treats every data point as an independent category. X-axis labels are raw `toLocaleTimeString()` output from each point's timestamp, producing uneven, unrounded values like `2:17:43 PM` — no time-axis semantics, no snapping to clean boundaries.

## Solution

Replace `CategoryScale` with Chart.js **`TimeScale`** + `chartjs-adapter-date-fns`, configure per-preset time units and step sizes so ticks snap to round time boundaries. No changes to chart appearance beyond the x-axis.

**Dependencies added:** `chartjs-adapter-date-fns`

## Per-Preset Time Configuration

| Preset | Time Unit | Step Size | Display Format | Approx. Labels |
| ------ | --------- | --------- | -------------- | -------------- |
| 1h     | minute    | 10        | HH:mm          | 6              |
| 6h     | minute    | 30        | HH:mm          | 12             |
| 24h    | hour      | 2         | HH:mm          | 12             |
| 7d     | hour      | 12        | MMM dd HH:mm   | ~14            |

The config is derived from the selected range (in seconds) and applied to `scales.x.time.*`.

## Architecture

### New File: `src/utils/chartTimeAxis.ts`

Exports one interface and one function:

```ts
interface TimeAxisConfig {
  unit: 'minute' | 'hour'
  stepSize: number
  displayFormats: Record<string, string>
}

function getTimeAxisConfig(rangeSeconds: number): TimeAxisConfig
```

Maps the four known presets (3600, 21600, 86400, 604800) to their config; defaults to `{ unit: 'hour', stepSize: 1 }` for unknown ranges.

### Changes: `TelemetryChart.vue`

Before:

- Imports `CategoryScale` (registered)
- `chartData`: `labels: data.map(d => new Date(d.createdAt).toLocaleTimeString())`, `data: data.map(d => d.value)`
- `chartOptions.scales.x`: no `type`, `maxTicksLimit: 10`

After:

- Imports `TimeScale` instead of `CategoryScale`
- Adds `import 'chartjs-adapter-date-fns'`
- Registers `TimeScale`
- `chartData`: `data: data.map(d => ({ x: new Date(d.createdAt).getTime(), y: d.value }))`, no `labels`
- `chartOptions.scales.x`: `type: 'time'`, `time: getTimeAxisConfig(selectedRange.value)`, `ticks.source: 'auto'`

### Changes: `DeviceHistoryChart.vue`

Before:

- Imports `CategoryScale` (registered)
- `chartData`: builds `{ time, value }` points → splits to `labels` + `data` arrays
- `chartOptions.scales.x`: no `type`, `maxTicksLimit: 6`

After:

- Imports `TimeScale` instead of `CategoryScale`
- Adds `import 'chartjs-adapter-date-fns'`
- Registers `TimeScale`
- `chartData`: `data: points.map(p => ({ x: p.time.getTime(), y: p.value }))`, no `labels`
- `chartOptions.scales.x`: `type: 'time'`, `time: getTimeAxisConfig(props.selectedRange)`, `ticks.source: 'auto'`

### Edge Cases

- **No data / loading / error:** handled by existing template guards — the chart component is not rendered.
- **Single data point:** TimeScale still renders correctly with a single `{ x, y }` entry.
- **Irregular telemetry intervals:** TimeScale distributes ticks at the configured step size regardless of data spacing — exactly fixing the "all over the place" problem. The line connects points at their actual timestamps, but grid lines and labels are at rounded boundaries.
- **7d range with 12h step:** `displayFormats.hour: 'MMM dd HH:mm'` shows date+time for each tick to disambiguate days.

## Implementation Order

1. Install `chartjs-adapter-date-fns`
2. Create `src/utils/chartTimeAxis.ts`
3. Update `TelemetryChart.vue`
4. Update `DeviceHistoryChart.vue`
5. Run type-check + tests to verify
