# System Reliability & State Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate silent state divergences between the backend DB, physical device state, and the frontend UI through periodic rule re-evaluation, MQTT command tracking with retry, and faster frontend polling.

**Architecture:** Three reliability layers: (1) scheduler re-evaluates threshold rules every 60s using the latest DB telemetry — catches missed transitions; (2) in-memory command tracker with 3-retry ensures MQTT commands reach the RPi; (3) frontend polls every 15s, detects stale socket state, and re-syncs on reconnect.

**Tech Stack:** Node.js, TypeScript, Fastify, Prisma, MQTT.js, Socket.IO, Vue 3

## Global Constraints

- `coerceTypes: false` — query string types must match schema exactly (no coercion)
- All new features must work without RPi firmware changes — only backend + frontend
- MQTT command tracker is in-memory (survives short blips; full recovery from scheduler tick)
- Frontend stale-state timeout: 30s
- Device poll interval must not exceed 15s for the active monitor view
- Maximum MQTT command retries: 3, with 30s between retries

---

### Task 1: Add threshold rule re-evaluation to automation scheduler

**Files:**

- Modify: `src/automation/scheduler.ts`

**Interfaces:**

- Consumes: `evaluateThresholds({ growCycleId, sensorType, value, now })` from `./evaluator.js`
- No new interfaces — extends the existing `tick()` method

- [ ] **Step 1: Add telemetry queries and threshold evaluation to scheduler.ts**

Edit the `tick()` method in `src/automation/scheduler.ts` to add Step 3 after the existing ALWAYS rules loop. The new step:

```
(3) Read the latest telemetry per sensor type for each active grow cycle
    and re-evaluate every threshold rule against those readings.
```

Add the import:

```ts
import { evaluateThresholds } from './evaluator.js'
```

After the ALWAYS rules loop (line 196), add:

```ts
// (3) Re-evaluate threshold rules using the latest telemetry per sensor type.
//     This provides a safety net if the real-time evaluator (triggered by MQTT)
//     misses a condition — e.g., dropped MQTT message, stale sensor, or race.
{
  const sensors = await prisma.sensor.findMany({
    include: {
      controller: {
        select: {
          id: true,
          growCycles: { take: 1, where: { isActive: true }, select: { id: true } },
        },
      },
    },
    where: { controllerId: cycle.controller.id },
  })

  for (const sensor of sensors) {
    const activeCycle = sensor.controller.growCycles[0]
    if (!activeCycle) continue

    const latest = await prisma.telemetry.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { sensorId: sensor.id, growCycleId: activeCycle.id },
      select: { sensorType: true, value: true },
    })
    if (!latest) continue

    await evaluateThresholds({
      growCycleId: activeCycle.id,
      sensorId: sensor.id,
      sensorType: latest.sensorType,
      value: latest.value,
      now,
    }).catch((error: Error) => {
      console.error(`[scheduler] Threshold re-evaluation failed for sensor ${sensor.id}:`, error)
    })
  }
}
```

- [ ] **Step 2: Run type-check**

```bash
cd /home/apollo/code/PiGrow-Server && npm run type-check
```

Expected: clean exit.

- [ ] **Step 3: Run the automation engine tests**

```bash
cd /home/apollo/code/PiGrow-Server && npm test 2>&1 | grep -E '(pass|fail|error)'
```

Expected: existing tests pass (the new code only runs when cycles are active; existing tests may not exercise it but must not regress).

- [ ] **Step 4: Commit**

```bash
cd /home/apollo/code/PiGrow-Server && git add -A && git commit -m "feat(scheduler): re-evaluate threshold rules on every tick using latest telemetry"
```

---

### Task 2: Add in-memory MQTT command tracker with retry

**Files:**

- Create: `src/automation/command-tracker.ts`
- Modify: `src/automation/command-publisher.ts`
- Modify: `src/automation/scheduler.ts` (start the tracker retry loop)

**Interfaces:**

- Produces: `CommandTracker` class with `track(commandId, deviceId, action)`, `confirm(commandId)`, `startRetryLoop()`, `stopRetryLoop()` methods
- Consumes: N/A — the tracker is referenced by `issueAutoCommand` and the scheduler

- [ ] **Step 1: Create `src/automation/command-tracker.ts`**

```ts
const MAX_RETRIES = 3
const RETRY_INTERVAL_MS = 30_000

interface TrackedCommand {
  commandId: string
  deviceId: string
  action: 'ON' | 'OFF'
  issuedAt: Date
  retries: number
  confirmed: boolean
}

export class CommandTracker {
  private commands = new Map<string, TrackedCommand>()
  private timer: ReturnType<typeof setInterval> | null = null
  private retryHandler: ((cmd: TrackedCommand) => Promise<void>) | null = null

  track(commandId: string, deviceId: string, action: 'ON' | 'OFF'): void {
    this.commands.set(commandId, {
      commandId,
      deviceId,
      action,
      issuedAt: new Date(),
      retries: 0,
      confirmed: false,
    })
    // Prune stale entries older than 5 minutes to prevent unbounded growth.
    this.pruneStale()
  }

  confirm(commandId: string): boolean {
    const cmd = this.commands.get(commandId)
    if (!cmd) return false
    cmd.confirmed = true
    this.commands.delete(commandId)
    return true
  }

  setRetryHandler(handler: (cmd: TrackedCommand) => Promise<void>): void {
    this.retryHandler = handler
  }

  startRetryLoop(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.retryTick(), RETRY_INTERVAL_MS)
  }

  stopRetryLoop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getUnconfirmed(): TrackedCommand[] {
    const unconfirmed: TrackedCommand[] = []
    for (const cmd of this.commands.values()) {
      if (!cmd.confirmed) unconfirmed.push(cmd)
    }
    return unconfirmed
  }

  private async retryTick(): Promise<void> {
    if (!this.retryHandler) return
    const unconfirmed = this.getUnconfirmed()
    const agedOut: string[] = []

    for (const cmd of unconfirmed) {
      const elapsed = Date.now() - cmd.issuedAt.getTime()
      if (elapsed < RETRY_INTERVAL_MS) continue

      if (cmd.retries >= MAX_RETRIES) {
        console.warn(
          `[command-tracker] Device ${cmd.deviceId} action ${cmd.action} failed after ${MAX_RETRIES} retries; giving up.`,
        )
        agedOut.push(cmd.commandId)
        continue
      }

      cmd.retries++
      cmd.issuedAt = new Date()
      console.log(
        `[command-tracker] Retry ${cmd.retries}/${MAX_RETRIES} for device ${cmd.deviceId} action ${cmd.action}`,
      )
      await this.retryHandler(cmd).catch((err: Error) =>
        console.error(`[command-tracker] Retry handler failed:`, err),
      )
    }

    for (const id of agedOut) {
      this.commands.delete(id)
    }

    this.pruneStale()
  }

  private pruneStale(): void {
    const cutoff = Date.now() - 5 * 60 * 1000
    for (const [id, cmd] of this.commands) {
      if (cmd.issuedAt.getTime() < cutoff) {
        this.commands.delete(id)
      }
    }
  }
}

export const commandTracker = new CommandTracker()
```

- [ ] **Step 2: Update `command-publisher.ts` to use the tracker**

Add import:

```ts
import { commandTracker } from './command-tracker.js'
import crypto from 'node:crypto'
```

In `issueAutoCommand`, before the MQTT publish, track the command:

```ts
const commandId = crypto.randomUUID()
commandTracker.track(commandId, deviceId, action)

// Pass commandId in the MQTT payload so the RPi can echo it back.
mqttClient.publish(
  `devices/${deviceId}/commands`,
  JSON.stringify({
    action,
    commandId,
    pin: device.pinNumber,
    timestamp: Date.now(),
  }),
)
```

- [ ] **Step 3: Update `device-state-handler.ts` to confirm tracked commands**

Add import:

```ts
import { commandTracker } from '../automation/command-tracker.js'
```

After parsing the payload (line 27), extract and confirm the command:

```ts
const commandId =
  typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>).commandId
    : undefined
if (typeof commandId === 'string') {
  commandTracker.confirm(commandId)
}
```

- [ ] **Step 4: Start the retry loop in scheduler.ts**

Add import:

```ts
import { commandTracker } from './command-tracker.js'
```

In the scheduler's `start()` method, after setting up the timer:

```ts
commandTracker.setRetryHandler(async (cmd) => {
  // Re-issue the MQTT command by re-calling issueAutoCommand.
  // issueAutoCommand checks hysteresis, so it won't re-issue if the
  // state log already reflects the desired state.
  await issueAutoCommand(cmd.deviceId, cmd.action, `retry (#${cmd.retries})`)
})
commandTracker.startRetryLoop()
```

In `stop()`:

```ts
commandTracker.stopRetryLoop()
```

- [ ] **Step 5: Run type-check**

```bash
cd /home/apollo/code/PiGrow-Server && npm run type-check
```

- [ ] **Step 6: Run tests**

```bash
cd /home/apollo/code/PiGrow-Server && npm test 2>&1 | grep -E '(pass|fail|error)'
```

- [ ] **Step 7: Commit**

```bash
cd /home/apollo/code/PiGrow-Server && git add -A && git commit -m "feat: add in-memory MQTT command tracker with 3-retry and confirmation"
```

---

### Task 3: Frontend — reduce polling interval + stale state detection

**Files:**

- Modify: `src/views/GrowMonitorView.vue`

**Interfaces:**

- Consumes: `store.pollDevices(controllerId, intervalMs)` with new 15000ms interval
- Consumes: `liveTelemetry.socket` for reconnection hook
- No new interfaces

- [ ] **Step 1: Reduce polling interval**

Change line 717:

```ts
store.pollDevices(cycle.controllerId, 60000)
```

→

```ts
store.pollDevices(cycle.controllerId, 15000)
```

- [ ] **Step 2: Add stale state detection**

Add a reactive ref to track the last `device_state_update` timestamp per device:

```ts
const lastDeviceStateUpdate = ref<Record<string, number>>({})
```

Update `handleDeviceStateUpdate` to record timestamps:

```ts
function handleDeviceStateUpdate(data: { deviceId: string; isActive: boolean }) {
  deviceToggles[data.deviceId] = data.isActive
  lastDeviceStateUpdate.value[data.deviceId] = Date.now()
  const ctrlId = linkedController.value?.id
  if (ctrlId) {
    store.updateDeviceInCache(ctrlId, { id: data.deviceId, isActive: data.isActive })
  }
}
```

Add a stale-check interval in `onMounted`:

```ts
// Stale state detection: if a device hasn't received a state update in 30s,
// trigger an immediate device fetch.
const STALE_STATE_MS = 30_000
let staleCheckHandle: ReturnType<typeof setInterval> | null = null
staleCheckHandle = setInterval(() => {
  const now = Date.now()
  const ctrlId = linkedController.value?.id
  if (!ctrlId) return
  for (const device of growDevices.value) {
    const last = lastDeviceStateUpdate.value[device.id!]
    if (last && now - last > STALE_STATE_MS) {
      store.fetchDevices(ctrlId)
      break
    }
  }
}, 15_000)
```

Add cleanup in `onUnmounted`:

```ts
if (staleCheckHandle) {
  clearInterval(staleCheckHandle)
  staleCheckHandle = null
}
```

- [ ] **Step 3: Run type-check**

```bash
cd /home/apollo/code/PiGrow-UI && npm run type-check:fast
```

- [ ] **Step 4: Run tests**

```bash
cd /home/apollo/code/PiGrow-UI && npm test
```

Expected: all 63 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/apollo/code/PiGrow-UI && git add -A && git commit -m "feat: reduce device poll to 15s, add 30s stale-state detection with auto-refresh"
```

---

### Task 4: Frontend — socket reconnection state sync

**Files:**

- Modify: `src/views/GrowMonitorView.vue`

**Interfaces:**

- Consumes: `liveTelemetry.socket.value` — Socket.IO socket instance
- No new interfaces

- [ ] **Step 1: Add reconnection state sync in onMounted**

After the existing socket handler setup, add:

```ts
// On Socket.IO reconnect, fetch fresh device state to catch any events
// that were emitted while the frontend was disconnected.
const sock = liveTelemetry.socket.value
if (sock) {
  sock.on('connect', () => {
    const ctrlId = linkedController.value?.id
    if (ctrlId) {
      store.fetchDevices(ctrlId)
    }
  })
  sock.on('device_state_update', handleDeviceStateUpdate)
}
```

But wait — this is already inside `onMounted` where `sock.on('device_state_update', handleDeviceStateUpdate)` is already set up. I need to add the `connect` handler separately.

The existing code:

```ts
const sock = liveTelemetry.socket.value
if (sock) {
  sock.on('device_state_update', handleDeviceStateUpdate)
}
```

Change to:

```ts
const sock = liveTelemetry.socket.value
if (sock) {
  sock.on('device_state_update', handleDeviceStateUpdate)
  sock.on('connect', () => {
    const ctrlId = linkedController.value?.id
    if (ctrlId) {
      store.fetchDevices(ctrlId)
    }
  })
}
```

- [ ] **Step 2: Run type-check**

```bash
cd /home/apollo/code/PiGrow-UI && npm run type-check:fast
```

- [ ] **Step 3: Run tests**

```bash
cd /home/apollo/code/PiGrow-UI && npm test
```

- [ ] **Step 4: Commit**

```bash
cd /home/apollo/code/PiGrow-UI && git add -A && git commit -m "feat: sync full device state on Socket.IO reconnect to catch missed events"
```

---

### Task 5: Full verification

- [ ] **Step 1: Backend type-check + tests**

```bash
cd /home/apollo/code/PiGrow-Server && npm run type-check && npm test 2>&1 | tail -10
```

- [ ] **Step 2: Frontend type-check + lint + tests + build**

```bash
cd /home/apollo/code/PiGrow-UI && npm run type-check:fast && npm run lint 2>&1 | grep 'Found' && npm test && npm run build-only 2>&1 | tail -3
```
