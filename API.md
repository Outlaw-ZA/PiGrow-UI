# PiGrow REST API Reference

Base URL: `http://<host>:4000`

All IDs are UUIDv4 strings. Request bodies are JSON. All timestamps are ISO 8601.

---

## Controllers (Raspberry Pi Hubs)

### `GET /api/controllers`

List all registered controllers.

**Response `200`** — Array of:

```ts
{
  id: string
  macAddress: string // e.g. "AA:BB:CC:DD:EE:FF"
  ipAddress: string // e.g. "192.168.1.100"
  name: string // e.g. "Tent 1 Pi"
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}
```

### `GET /api/controllers/:id`

Get a controller with its currently-active grow cycles (each with their devices and active phase).

**Response `200`** — Controller plus:

```ts
{
  // ...all Controller fields above...
  growCycles: Array<{
    // Full GrowCycle fields plus:
    devices: Device[] // Per-grow device inventory
    phases: GrowPhase[] // Only the currently-active phase
  }> // Only cycles where isActive === true
}
```

No top-level `devices` on the controller — devices are now scoped to grow cycles.

**`404`** — `{ error: "Raspberry Pi configuration profile not found" }`

### `POST /api/controllers`

Register a new controller (upserts by macAddress).

**Request body:**

```ts
{
  macAddress: string // Pattern: ^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$
  name: string // max 100 chars
  ipAddress: string // IPv4 format
}
```

**Response `201`** — Full Controller object (with `status: "OFFLINE"` default).
**`400`** — `{ error: "Failed to map controller network identity" }`

### `PUT /api/controllers/:id`

Update controller name or status.

**Request body:**

```ts
{
  name?: string;                   // max 100 chars
  status?: "ONLINE" | "OFFLINE" | "ERROR";
}
```

**Response `200`** — Updated Controller object.
**`400`** — `{ error: "Unable to reconcile device parameters" }`

### `DELETE /api/controllers/:id`

Remove a controller.

**Response `204`** — No body.
**`404`** — `{ error: "Profile unlinking rejected" }`

---

## Devices (GPIO Hardware)

### `GET /api/devices/grow-cycle/:growCycleId`

List all devices assigned to a specific grow cycle.

**Response `200`** — Array of:

```ts
{
  id: string
  growCycleId: string
  name: string // e.g. "SpiderFarmer SF2000"
  type: DeviceType
  pinNumber: number // 0-40 (GPIO pin)
  mqttTopic: string // e.g. "tent1/device/light/cmd"
  isActive: boolean
  createdAt: string
  updatedAt: string
}
```

Where `DeviceType` is one of:
`"LIGHT" | "EXHAUST_FAN" | "INTAKE_FAN" | "CIRCULATION_FAN" | "WATER_PUMP" | "AIR_CONDITIONER" | "HEATER" | "HUMIDIFIER" | "DEHUMIDIFIER" | "CO2_INJECTOR"`

**`400`** — `{ error: "Failed to load hardware profiles" }`

### `GET /api/device/:id`

Get a single device with its grow cycle and device configs.

**Response `200`** — Device plus:

```ts
{
  // ...all Device fields above...
  growCycle: GrowCycle;            // Full GrowCycle object
  deviceConfigs: DeviceConfig[];   // All DeviceConfig objects for this device
}
```

**`404`** — `{ error: "Physical hardware device not found" }`

### `POST /api/device`

Provision a new device onto a grow cycle.

**Request body:**

```ts
{
  growCycleId: string;   // UUID
  name: string;           // max 100 chars
  type: DeviceType;       // see above
  pinNumber: number;      // integer 0-40
  mqttTopic: string;      // max 150 chars
  isActive?: boolean;     // default: true
}
```

**Response `201`** — Full Device object.
**`400`** — `{ error: "Failed to map new hardware device" }`

### `POST /api/device/batch`

Bulk provision multiple devices onto a single grow cycle.

**Request body:**

```ts
{
  growCycleId: string // UUID
  devices: Array<{
    name: string // max 100 chars
    type: DeviceType
    pinNumber: number // 0-40
    mqttTopic: string // max 150 chars
    isActive?: boolean // default: true
  }> // min 1 device
}
```

**Response `201`** — Array of created Device objects.
**`400`** — `{ error: "Failed to map batch hardware devices" }`

### `PUT /api/device/:id`

Update device configuration.

**Request body:**

```ts
{
  name?: string;
  type?: DeviceType;
  pinNumber?: number;      // 0-40
  mqttTopic?: string;      // max 150 chars
  isActive?: boolean;
}
```

**Response `200`** — Updated Device object.
**`400`** — `{ error: "Hardware parameter update rejected" }`

### `DELETE /api/device/:id`

Remove a device.

**Response `204`** — No body.
**`404`** — `{ error: "Hardware profile deletion failed" }`

---

## Grow Cycles

### `GET /api/grow-cycles`

List all grow cycles (includes basic controller info).

**Response `200`** — Array of:

```ts
{
  id: string
  controllerId: string
  name: string
  isActive: boolean
  startAt: string | null // "YYYY-MM-DD" or null — date only, no timestamp
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  controller: {
    name: string
    status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  }
}
```

### `GET /api/grow-cycles/:id`

Get a grow cycle with full nested details (phases, device configs, devices).

**Response `200`** — GrowCycle plus:

```ts
{
  // ...all GrowCycle fields above...
  controller: Controller // Full Controller object
  phases: {
    id: string
    growCycleId: string
    name: string
    order: number
    durationDays: number
    isActive: boolean
    startAt: string | null // ISO 8601
    endAt: string | null // ISO 8601
    createdAt: string
    updatedAt: string
    deviceConfigs: {
      id: string
      growPhaseId: string
      deviceId: string
      triggerType: TriggerType
      configData: Record<string, unknown> // JSON payload
      createdAt: string
      updatedAt: string
      device: Device // Full Device object
    }
    ;[]
  }
  ;[]
}
```

Where `TriggerType` is: `"SCHEDULE" | "THRESHOLD" | "ALWAYS_ON" | "ALWAYS_OFF"`

**`404`** — `{ error: "Grow cycle record not found" }`

### `POST /api/grow-cycles`

Create a new grow cycle. **Atomically** provisions: the grow cycle + the per-grow devices + 4 default phases + per-phase device configs.

**Request body:**

```ts
{
  name: string;           // max 100 chars
  controllerId: string;   // UUID
  isActive?: boolean;     // default: false
  devices: Array<{
    name: string;         // max 100 chars
    type: DeviceType;
    pinNumber: number;    // 0-40
    mqttTopic: string;    // max 150 chars
    isActive?: boolean;   // default: true
  }>;
  // startAt is NOT accepted on create. A new cycle always has startAt: null
  // until set via PUT /api/grow-cycles/:id.
}
```

**Default phases created automatically:**

| #   | Phase Name        | Duration | Light Config            | Exhaust Config           | Pump Config |
| --- | ----------------- | -------- | ----------------------- | ------------------------ | ----------- |
| 1   | Seedling / Clone  | 14d      | SCHEDULE, 18h on @06:00 | THRESHOLD, TEMP > 25°C   | —           |
| 2   | Vegetative Stage  | 30d      | SCHEDULE, 22h on @06:00 | THRESHOLD, TEMP > 26.5°C | —           |
| 3   | Flowering / Bloom | 60d      | SCHEDULE, 12h on @06:00 | THRESHOLD, TEMP > 26°C   | —           |
| 4   | Curing / Harvest  | 7d       | ALWAYS_OFF              | —                        | ALWAYS_OFF  |

A config is only created for a phase if the freshly-provisioned device set contains a device of the corresponding type (LIGHT, EXHAUST_FAN, WATER_PUMP).

**Response `201`** — Full GrowCycle with nested `devices`, `phases`, and `phases[].deviceConfigs[].device` (same shape as `GET /:id`).
**`400`** — `{ error: "Failed to create grow cycle record" }`
**`409`** — `{ error: "Controller already has an active grow cycle. End the current grow before starting a new one." }` (only when `isActive: true` and the controller already has an active grow)

### `PUT /api/grow-cycles/:id`

Update a grow cycle. `controllerId` is **not** accepted — a grow is bound to its controller for life.

**Request body:**

```ts
{
  name?: string;           // max 100 chars
  isActive?: boolean;
  startAt?: string;        // "YYYY-MM-DD" — date only, NO timestamp
}
```

- Omit `startAt` to leave the existing value unchanged. `null` is not supported on this path (use undefined to leave unchanged). To clear, confirm with backend — the current update path does not support clearing.
- Full ISO date-time strings (e.g. `"2026-06-16T00:00:00.000Z"`) are rejected with `400`.

**Response `200`** — Updated GrowCycle (without nested relations).
**`400`** — `{ error: "Failed to update grow cycle record" }`
**`409`** — `{ error: "Controller already has an active grow cycle. End the current grow before starting a new one." }` (only when `isActive: true` and the controller already has another active grow)

### `DELETE /api/grow-cycles/:id`

Delete a grow cycle (cascades to phases, device configs, and telemetry).

**Response `204`** — No body.
**`404`** — `{ error: "Record could not be deleted" }`

---

## Grow Phases

### `GET /api/grow-phases/cycle/:growCycleId`

List all phases for a grow cycle (includes device configs).

**Response `200`** — Array of:

```ts
{
  id: string
  growCycleId: string
  name: string
  order: number
  durationDays: number
  isActive: boolean
  startAt: string | null
  endAt: string | null
  createdAt: string
  updatedAt: string
  deviceConfigs: {
    id: string
    growPhaseId: string
    deviceId: string
    triggerType: TriggerType
    configData: Record<string, unknown>
    createdAt: string
    updatedAt: string
    device: Device // Full Device object
  }
  ;[]
}
```

**`400`** — `{ error: "Failed to retrieve phases for this cycle" }`

### `GET /api/grow-phases/:id`

Get a single phase with device configs.

**Response `200`** — Same shape as individual phase above.
**`404`** — `{ error: "Grow phase record not found" }`

### `POST /api/grow-phases`

Create a custom phase.

**Request body:**

```ts
{
  growCycleId: string;    // UUID
  name: string;           // max 100 chars
  order: number;          // integer >= 1
  durationDays: number;   // integer >= 1
  isActive?: boolean;     // default: false
  startAt?: string;       // ISO 8601
  endAt?: string;         // ISO 8601
}
```

**Response `201`** — Full GrowPhase object (without deviceConfigs).
**`400`** — `{ error: "Failed to create grow phase record" }`

### `PUT /api/grow-phases/:id`

Update a phase.

**Request body:**

```ts
{
  name?: string;
  order?: number;          // >= 1
  durationDays?: number;   // >= 1
  isActive?: boolean;
  startAt?: string;        // ISO 8601
  endAt?: string;          // ISO 8601
}
```

**Response `200`** — Updated GrowPhase object.
**`400`** — `{ error: "Failed to update grow phase record" }`

### `DELETE /api/grow-phases/:id`

Delete a phase.

**Response `204`** — No body.
**`404`** — `{ error: "Record could not be deleted" }`

---

## Device Configs

> **Note:** Device configs are managed indirectly through grow cycle creation (which auto-generates them) and do not have standalone REST endpoints. They are returned as nested resources under phases.

### Trigger Types & ConfigData Shapes

| TriggerType  | Example configData                           |
| ------------ | -------------------------------------------- |
| `SCHEDULE`   | `{ "onTime": "06:00", "durationHours": 18 }` |
| `THRESHOLD`  | `{ "metric": "TEMP", "high": 26.5 }`         |
| `ALWAYS_ON`  | `{}`                                         |
| `ALWAYS_OFF` | `{}`                                         |

---

## Telemetry

> **Note:** Telemetry has no REST endpoints. Data flows from Raspberry Pi → MQTT → Server → Socket.IO broadcast to frontend.

### MQTT Ingestion

- Pi publishes to: `devices/<deviceId>/telemetry`
- Backend subscribed to: `devices/+/telemetry`
- Payload fields: `temperature` (float), `humidity` (float)

### Socket.IO Events

| Event                | Direction         | Payload                                                 |
| -------------------- | ----------------- | ------------------------------------------------------- |
| `ui_command`         | Frontend → Server | `{ deviceId: string, action: string, pin: number }`     |
| `frontend_telemetry` | Server → Frontend | Broadcasts parsed telemetry to all connected UI clients |

---

## Error Response Format

All error responses return:

```ts
{
  error: string
}
```

A `404` is returned when a resource by ID is not found. A `400` is returned for validation or database operation failures.

---

## TypeScript Types Summary (for FE)

```ts
// Enums
type DeviceType =
  | 'LIGHT'
  | 'EXHAUST_FAN'
  | 'INTAKE_FAN'
  | 'CIRCULATION_FAN'
  | 'WATER_PUMP'
  | 'AIR_CONDITIONER'
  | 'HEATER'
  | 'HUMIDIFIER'
  | 'DEHUMIDIFIER'
  | 'CO2_INJECTOR'

type TriggerType = 'SCHEDULE' | 'THRESHOLD' | 'ALWAYS_ON' | 'ALWAYS_OFF'

// Models
interface Controller {
  id: string
  macAddress: string
  ipAddress: string
  name: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  createdAt: string
  updatedAt: string
}

interface Device {
  id: string
  growCycleId: string
  name: string
  type: DeviceType
  pinNumber: number
  mqttTopic: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface GrowCycle {
  id: string
  controllerId: string
  name: string
  isActive: boolean
  startAt: string | null // "YYYY-MM-DD" | null — date only, no timestamp
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

interface GrowPhase {
  id: string
  growCycleId: string
  name: string
  order: number
  durationDays: number
  isActive: boolean
  startAt: string | null
  endAt: string | null
  createdAt: string
  updatedAt: string
}

interface DeviceConfig {
  id: string
  growPhaseId: string
  deviceId: string
  triggerType: TriggerType
  configData: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface Telemetry {
  id: string
  growCycleId: string
  sensorType: string // "TEMPERATURE" | "HUMIDITY" | "CO2" | "PH" | "EC"
  value: number
  createdAt: string
}
```
