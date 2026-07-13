# PiGrow BE API Endpoints

Based on the Prisma schema and FE codebase analysis. All IDs are UUIDv4. Request/response bodies are JSON. Timestamps are ISO 8601.

---

## Controllers

| Method   | Endpoint                         | FE Scenario                                                           |
| -------- | -------------------------------- | --------------------------------------------------------------------- |
| `GET`    | `/api/controllers`               | HomeView dashboard, AdminView list                                    |
| `GET`    | `/api/controllers/:id`           | ControllerFormView edit mode (load with sensors + active grow cycles) |
| `POST`   | `/api/controllers`               | ControllerFormView create (optionally seed `sensors[]` atomically)    |
| `PUT`    | `/api/controllers/:id`           | ControllerFormView edit save                                          |
| `DELETE` | `/api/controllers/:id`           | AdminView delete                                                      |
| `PATCH`  | `/api/controllers/:id/heartbeat` | Pi status reporting (ONLINE/OFFLINE)                                  |

---

## Sensors

Sensors are scoped to a **Controller** (physical Pi hub), not a grow cycle — they are hardware probes wired to the Pi and shared across its lifetime. Devices, by contrast, are scoped per-grow cycle.

| Method   | Endpoint                                | FE Scenario                                                                |
| -------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `GET`    | `/api/sensors/controller/:controllerId` | ControllerFormView Sensors tab (also nested in `GET /api/controllers/:id`) |
| `GET`    | `/api/sensors/:id`                      | Sensor detail (with controller { id, name, status })                       |
| `POST`   | `/api/sensors`                          | ControllerFormView add sensor to existing controller                       |
| `PUT`    | `/api/sensors/:id`                      | ControllerFormView edit sensor                                             |
| `DELETE` | `/api/sensors/:id`                      | ControllerFormView remove sensor (cascades telemetry)                      |

`POST /api/controllers` also accepts `sensors: SeedSensorInput[]` to atomically seed sensors on a fresh controller create (ignored on a MAC re-register). See [Grow Cycle Creation](#grow-cycle-creation) for the parallel pattern.

### Sensor enums

```ts
type SensorType = 'HUMIDITY' | 'TEMPERATURE' | 'TEMP_HUMIDITY' | 'CO2' | 'PH' | 'EC'
type SensorProtocol = 'I2C' | 'SPI' | 'UART' | 'RS485'
```

`pinNumbers` is an array of integers in the range `0–40` representing physical pins on the Pi's 40-pin GPIO header.

---

## Devices

| Method   | Endpoint                                | FE Scenario                                                 |
| -------- | --------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/devices/controller/:controllerId` | ControllerFormView device list, GrowMonitorView device card |
| `GET`    | `/api/devices/:id`                      | Device detail (with controller summary)                     |
| `POST`   | `/api/devices`                          | ControllerFormView add device (to an existing controller)   |
| `POST`   | `/api/devices/batch`                    | Bulk add devices to a controller                            |
| `PUT`    | `/api/devices/:id`                      | Edit device                                                 |
| `DELETE` | `/api/devices/:id`                      | Remove device                                               |
| `POST`   | `/api/devices/:id/command`              | GrowMonitorView toggle switches (ON/OFF)                    |

Devices are scoped to a **Controller** (persistent GPIO inventory), not a grow cycle. They are physical relays/actuators wired to the Pi and shared across the controller's lifetime. The initial provisioning happens via `POST /api/devices` or `POST /api/devices/batch` targeting a controller. Add/edit/remove afterwards targets a specific device by ID.

---

## Grow Cycles

| Method   | Endpoint                          | FE Scenario                                                                                                                                          |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/grow-cycles`                | HomeView cards, AdminView list (includes basic controller info)                                                                                      |
| `GET`    | `/api/grow-cycles/:id`            | GrowMonitorView full detail (controller, phases with environments nested — devices are NOT nested here)                                              |
| `POST`   | `/api/grow-cycles`                | GrowFormView create (provisions grow only; phases created separately via `/api/grow-phases`, devices via `/api/devices`)                             |
| `PUT`    | `/api/grow-cycles/:id`            | GrowFormView edit (name, isActive, startAt as YYYY-MM-DD — `controllerId` is **not** accepted)                                                       |
| `DELETE` | `/api/grow-cycles/:id`            | AdminView delete (cascades to phases, devices, and telemetry)                                                                                        |
| `POST`   | `/api/grow-cycles/:id/skip-phase` | GrowMonitorView skip active phase (atomic: trims duration + cascades dates + activates next phase). Optional `?today=YYYY-MM-DD` query.              |
| `POST`   | `/api/grow-cycles/:id/end-grow`   | GrowMonitorView end the grow cycle (atomic: trims active phase + marks cycle inactive + deactivates all phases). Optional `?today=YYYY-MM-DD` query. |

---

## Grow Phases

| Method   | Endpoint                              | FE Scenario                                                         |
| -------- | ------------------------------------- | ------------------------------------------------------------------- |
| `GET`    | `/api/grow-phases/cycle/:growCycleId` | GrowFormView phase list, GrowMonitorView timeline                   |
| `GET`    | `/api/grow-phases/:id`                | Phase detail                                                        |
| `POST`   | `/api/grow-phases`                    | GrowFormView add custom phase                                       |
| `PUT`    | `/api/grow-phases/:id`                | GrowFormView edit phase (name, durationDays, order, startAt, endAt) |
| `DELETE` | `/api/grow-phases/:id`                | GrowFormView remove phase                                           |
| `PATCH`  | `/api/grow-phases/:id/activate`       | GrowMonitorView phase transition (sets isActive, clears others)     |

---

## Telemetry

| Method | Endpoint                                        | FE Scenario                                 |
| ------ | ----------------------------------------------- | ------------------------------------------- |
| `GET`  | `/api/telemetry/grow-cycle/:growCycleId`        | Historical charts (future feature)          |
| `GET`  | `/api/telemetry/grow-cycle/:growCycleId/latest` | Latest sensor readings per sensorType       |
| `GET`  | `/api/telemetry/grow-cycle/:growCycleId/range`  | Filtered by date range (`?from=ISO&to=ISO`) |
| `POST` | `/api/telemetry`                                | Pi ingestion endpoint                       |

---

## Socket.IO Events (Real-time)

| Event                | Direction   | Payload                                                               | FE Scenario                     |
| -------------------- | ----------- | --------------------------------------------------------------------- | ------------------------------- |
| `ui_command`         | FE → Server | `{ deviceId: string, action: "ON"\|"OFF", pin: number }`              | GrowMonitorView toggle switches |
| `frontend_telemetry` | Server → FE | `{ growCycleId, sensorId, sensorName, sensorType, timestamp, value }` | Real-time sensor dashboard      |

> **Note:** The server does NOT emit `device:status` or `controller:status` via Socket.IO. Device state is handled via MQTT topic `devices/<id>/state`. Controller status is updated via `PATCH /api/controllers/:id/heartbeat`.

---

## Key Rules & Conventions

### Naming

- Use `/api/grow-phases/cycle/:growCycleId` (not `/api/phases/grow-cycle/:id`)
- Use `startAt`/`endAt` on phases (not `startDate`/`endDate`)

### Grow Cycle Creation

`POST /api/grow-cycles` accepts `{ name, controllerId, isActive? }`. **No phases are created automatically** — create phases explicitly via `POST /api/grow-phases`. **Devices are NOT created here** — they belong to the controller and are provisioned separately via `POST /api/devices` or `POST /api/devices/batch`. The cycle-level `startAt` is **not** accepted on create — a new cycle always has `startAt: null` until set via `PUT /api/grow-cycles/:id` with `{ startAt: "YYYY-MM-DD" }`. Full ISO date-time values for `startAt` are rejected (`400`).

If `isActive: true` is sent but the controller already has an active grow, the response is `409 Conflict`:

```json
{
  "error": "Controller already has an active grow cycle. End the current grow before starting a new one."
}
```

> **Note:** DeviceConfig, TriggerType, and per-phase device-configuration rules are no longer part of the API. Devices are managed at the grow-cycle level only. A replacement device-to-phase rules solution is pending.

### Grow Cycle Update

`PUT /api/grow-cycles/:id` accepts `{ name?, isActive?, startAt? }`. **`controllerId` is intentionally rejected** — a grow is bound to its controller for life. Setting `isActive: true` returns `409` if the controller already has another active grow.

### Error Format

All errors return `{ error: string }` with appropriate HTTP status (400 for validation, 404 for not found, 409 for controller-busy conflicts).

### Response Nesting Convention

- **List endpoints** (`GET /api/grow-cycles`, `/api/controllers`) — flat with only `controller: { name, status }` included
- **Detail endpoints**:
  - `GET /api/grow-cycles/:id` — full nested: `controller`, `phases[]` (each with `environments[]`). Devices are NOT nested — they are owned by the controller.
  - `GET /api/controllers/:id` — `devices[]` (persistent GPIO inventory), `growCycles` (only active cycles) with each cycle's `phases` (only active phase) nested, and `sensors[]`.
