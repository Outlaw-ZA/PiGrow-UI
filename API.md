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

Get a controller with its currently-active grow cycles (each with their devices and active phase) and its wired sensors.

**Response `200`** — Controller plus:

```ts
{
  // ...all Controller fields above...
  growCycles: Array<{
    // Full GrowCycle fields plus:
    devices: Device[] // Per-grow device inventory
    phases: GrowPhase[] // Only the currently-active phase
  }> // Only cycles where isActive === true
  sensors: Sensor[] // All sensors wired to this controller, ordered by createdAt asc
}
```

No top-level `devices` on the controller — devices are now scoped to grow cycles.

**`404`** — `{ error: "Raspberry Pi configuration profile not found" }`

### `POST /api/controllers`

Register a new controller (upserts by macAddress). Optionally seed sensors atomically on a fresh create.

**Request body:**

```ts
{
  macAddress: string // Pattern: ^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$
  name: string // max 100 chars
  ipAddress: string // IPv4 format
  sensors?: SeedSensorInput[] // Atomic sensor seed (ignored on MAC re-register)
}
```

**Response `201`** — Full Controller object (with `status: "OFFLINE"` default and nested `sensors[]` on a fresh create).
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

Get a single device with its grow cycle.

**Response `200`** — Device plus:

```ts
{
  // ...all Device fields above...
  growCycle: GrowCycle // Full GrowCycle object
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

## Sensors (GPIO Probes)

Sensors are scoped to a **Controller** (physical Pi hub), not a grow cycle. They are hardware probes wired to the Pi and shared across the controller's lifetime. Devices, by contrast, are scoped per-grow cycle. Deleting a sensor cascades to its telemetry history.

Where `SensorType` is one of:
`"HUMIDITY" | "TEMPERATURE" | "TEMP_HUMIDITY" | "CO2" | "PH" | "EC"`

And `SensorProtocol` is one of:
`"I2C" | "SPI" | "UART" | "RS485"`

### `GET /api/sensors/controller/:controllerId`

List all sensors wired to a specific controller.

**Response `200`** — Array of:

```ts
{
  id: string
  controllerId: string
  name: string // e.g., "Tent 1 Climate Sensor"
  type: SensorType
  mqttTopic: string // e.g., "tent1/sensors/climate/state"
  pinNumbers: number[] // Array of physical pin numbers 0–40
  protocol: SensorProtocol
  lastActive: string | null // ISO 8601, server-managed
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}
```

**`400`** — `{ error: "Failed to load sensor inventory" }`

### `GET /api/sensors/:id`

Get a single sensor with its parent controller.

**Response `200`** — Sensor plus:

```ts
{
  // ...all Sensor fields above...
  controller: {
    id: string
    name: string
    status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  }
}
```

**`404`** — `{ error: "Sensor not found" }`

### `POST /api/sensors`

Provision a new sensor on an existing controller.

**Request body:**

```ts
{
  controllerId: string;     // UUID
  name: string;             // max 100 chars
  type: SensorType;
  mqttTopic: string;        // max 200 chars
  pinNumbers: number[];     // integers 0–40
  protocol: SensorProtocol;
}
```

**Response `201`** — Full Sensor object.
**`400`** — `{ error: "Failed to register sensor" }`

### `PUT /api/sensors/:id`

Update sensor configuration.

**Request body:**

```ts
{
  name?: string;            // max 100 chars
  type?: SensorType;
  mqttTopic?: string;       // max 200 chars
  pinNumbers?: number[];    // integers 0–40
  protocol?: SensorProtocol;
  lastActive?: string;      // ISO 8601 — server-managed in the normal flow
}
```

**Response `200`** — Updated Sensor object.
**`400`** — `{ error: "Failed to update sensor configuration" }`

### `DELETE /api/sensors/:id`

Remove a sensor (cascades to its telemetry rows).

**Response `204`** — No body.
**`404`** — `{ error: "Sensor deletion failed" }`

### Sensor seeding on controller create

`POST /api/controllers` accepts an optional `sensors` array of `SeedSensorInput` (same shape as `POST /api/sensors` minus `controllerId`) to atomically seed sensors on a fresh controller. **Sensor seeding is ignored when the controller's `macAddress` already exists** (the controller is upserted by MAC and sensors are not mutated on re-registration).

```ts
// POST /api/controllers
{
  macAddress: string;
  name: string;
  ipAddress: string;
  sensors?: SeedSensorInput[]; // [{ name, type, mqttTopic, pinNumbers, protocol }, ...]
}
```

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

Get a grow cycle with full nested details (phases, devices).

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
    startAt: string | null // "YYYY-MM-DD"
    endAt: string | null // "YYYY-MM-DD"
    createdAt: string
    updatedAt: string
  }[]
  devices: Device[]
}
```

**`404`** — `{ error: "Grow cycle record not found" }`

### `POST /api/grow-cycles`

Create a new grow cycle. **Atomically** provisions: the grow cycle + the per-grow devices. **No phases are created automatically** — create phases explicitly via `POST /api/grow-phases`.

**Request body:**

```ts
{
  name: string;           // max 100 chars
  controllerId: string;   // UUID
  isActive?: boolean;     // default: false
  devices: Array<{        // REQUIRED
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

**Response `201`** — Full GrowCycle with nested `controller`, `devices: Device[]`, and `phases: GrowPhase[]` (phases will be an empty array — create phases separately).
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

Delete a grow cycle (cascades to phases, devices, and telemetry).

**Response `204`** — No body.
**`404`** — `{ error: "Record could not be deleted" }`

---

## Grow Phases

### `GET /api/grow-phases/cycle/:growCycleId`

List all phases for a grow cycle.

**Response `200`** — Array of:

```ts
{
  id: string
  growCycleId: string
  name: string
  order: number
  durationDays: number
  isActive: boolean
  startAt: string | null // "YYYY-MM-DD"
  endAt: string | null // "YYYY-MM-DD"
  createdAt: string
  updatedAt: string
}
```

**`400`** — `{ error: "Failed to retrieve phases for this cycle" }`

### `GET /api/grow-phases/:id`

Get a single phase.

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
  startAt?: string;       // "YYYY-MM-DD" (date only, no timestamp)
  endAt?: string;         // "YYYY-MM-DD" (date only, no timestamp)
}
```

**Response `201`** — Full GrowPhase object.
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

type SensorType = 'HUMIDITY' | 'TEMPERATURE' | 'TEMP_HUMIDITY' | 'CO2' | 'PH' | 'EC'
type SensorProtocol = 'I2C' | 'SPI' | 'UART' | 'RS485'

// Models
interface Controller {
  id: string
  macAddress: string
  ipAddress: string
  name: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  createdAt: string
  updatedAt: string
  // Nested on GET /api/controllers/:id:
  //   growCycles: GrowCycle[] (only active cycles; each with devices + active phase)
  //   sensors: Sensor[] (all sensors wired to this controller)
}

interface Sensor {
  id: string
  controllerId: string
  name: string
  type: SensorType
  mqttTopic: string
  pinNumbers: number[] // Physical pin numbers 0–40
  protocol: SensorProtocol
  lastActive: string | null
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
  // Nested on GET /api/device/:id:
  //   growCycle: GrowCycle
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

interface Telemetry {
  id: string
  growCycleId: string
  sensorType: string // "TEMPERATURE" | "HUMIDITY" | "CO2" | "PH" | "EC"
  value: number
  createdAt: string
}
```
