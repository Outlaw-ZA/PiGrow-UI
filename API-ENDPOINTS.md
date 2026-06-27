# PiGrow BE API Endpoints

Based on the Prisma schema and FE codebase analysis. All IDs are UUIDv4. Request/response bodies are JSON. Timestamps are ISO 8601.

---

## Controllers

| Method   | Endpoint                         | FE Scenario                                                           |
| -------- | -------------------------------- | --------------------------------------------------------------------- |
| `GET`    | `/api/controllers`               | HomeView dashboard, AdminView list                                    |
| `GET`    | `/api/controllers/:id`           | ControllerFormView edit mode (load with devices + active grow cycles) |
| `POST`   | `/api/controllers`               | ControllerFormView create                                             |
| `PUT`    | `/api/controllers/:id`           | ControllerFormView edit save                                          |
| `DELETE` | `/api/controllers/:id`           | AdminView delete                                                      |
| `PATCH`  | `/api/controllers/:id/heartbeat` | Pi status reporting (ONLINE/OFFLINE)                                  |

---

## Devices

| Method   | Endpoint                               | FE Scenario                                                  |
| -------- | -------------------------------------- | ------------------------------------------------------------ |
| `GET`    | `/api/devices/grow-cycle/:growCycleId` | GrowFormView (edit) device list, GrowMonitorView device card |
| `GET`    | `/api/devices/:id`                     | Device detail (with configs + grow info)                     |
| `POST`   | `/api/devices`                         | GrowFormView add device (to an existing grow)                |
| `POST`   | `/api/devices/batch`                   | Bulk add devices to a grow                                   |
| `PUT`    | `/api/devices/:id`                     | Edit device                                                  |
| `DELETE` | `/api/devices/:id`                     | Remove device                                                |
| `POST`   | `/api/devices/:id/command`             | GrowMonitorView toggle switches (ON/OFF)                     |

Devices are scoped to a grow cycle. The initial provisioning happens in the grow-create payload (see below). Add/edit/remove afterwards targets a specific grow via `growCycleId`.

---

## Grow Cycles

| Method   | Endpoint                          | FE Scenario                                                                                                                                          |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/grow-cycles`                | HomeView cards, AdminView list (includes basic controller info)                                                                                      |
| `GET`    | `/api/grow-cycles/:id`            | GrowMonitorView full detail (controller, phases, deviceConfigs, devices nested)                                                                      |
| `POST`   | `/api/grow-cycles`                | GrowFormView create (bundles devices + atomically provisions grow, devices, 4 phases, per-phase device configs)                                      |
| `PUT`    | `/api/grow-cycles/:id`            | GrowFormView edit (name, isActive, startAt as YYYY-MM-DD — `controllerId` is **not** accepted)                                                       |
| `DELETE` | `/api/grow-cycles/:id`            | AdminView delete                                                                                                                                     |
| `POST`   | `/api/grow-cycles/:id/skip-phase` | GrowMonitorView skip active phase (atomic: trims duration + cascades dates + activates next phase). Optional `?today=YYYY-MM-DD` query.              |
| `POST`   | `/api/grow-cycles/:id/end-grow`   | GrowMonitorView end the grow cycle (atomic: trims active phase + marks cycle inactive + deactivates all phases). Optional `?today=YYYY-MM-DD` query. |

---

## Grow Phases

| Method   | Endpoint                              | FE Scenario                                                                                         |
| -------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/grow-phases/cycle/:growCycleId` | GrowFormView phase list, GrowMonitorView timeline (includes deviceConfigs with full Device objects) |
| `GET`    | `/api/grow-phases/:id`                | Phase detail (with deviceConfigs)                                                                   |
| `POST`   | `/api/grow-phases`                    | GrowFormView add custom phase                                                                       |
| `PUT`    | `/api/grow-phases/:id`                | GrowFormView edit phase (name, durationDays, order, startAt, endAt)                                 |
| `DELETE` | `/api/grow-phases/:id`                | GrowFormView remove phase                                                                           |
| `PATCH`  | `/api/grow-phases/:id/activate`       | GrowMonitorView phase transition (sets isActive, clears others)                                     |

---

## Device Configs

| Method   | Endpoint                             | FE Scenario                                  |
| -------- | ------------------------------------ | -------------------------------------------- |
| `GET`    | `/api/device-configs/phase/:phaseId` | Phase detail view (schedule/threshold rules) |
| `GET`    | `/api/device-configs/:id`            | Single config detail                         |
| `POST`   | `/api/device-configs`                | Add device config to a phase                 |
| `PUT`    | `/api/device-configs/:id`            | Edit triggerType and configData              |
| `DELETE` | `/api/device-configs/:id`            | Remove device config                         |

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

| Event               | Direction   | Payload                                         | FE Scenario                       |
| ------------------- | ----------- | ----------------------------------------------- | --------------------------------- |
| `device:command`    | FE → Server | `{ deviceId, action: "ON"\|"OFF" }`             | GrowMonitorView toggle switches   |
| `device:status`     | Server → FE | `{ deviceId, isActive, timestamp }`             | Reflect device state changes      |
| `telemetry:update`  | Server → FE | `{ growCycleId, sensorType, value, timestamp }` | Real-time sensor dashboard        |
| `controller:status` | Server → FE | `{ controllerId, status, timestamp }`           | Online/offline alerts in HomeView |

---

## Key Rules & Conventions

### Naming

- Use `/api/grow-phases/cycle/:growCycleId` (not `/api/phases/grow-cycle/:id`)
- Use `startAt`/`endAt` on phases (not `startDate`/`endDate`)

### Grow Cycle Creation

`POST /api/grow-cycles` accepts `{ name, controllerId, isActive?, devices: [...] }` and **atomically** provisions: grow cycle + per-grow devices + 4 default phases + per-phase device configs. The cycle-level `startAt` is **not** accepted on create — a new cycle always has `startAt: null` until set via `PUT /api/grow-cycles/:id` with `{ startAt: "YYYY-MM-DD" }`. Full ISO date-time values for `startAt` are rejected (`400`).

Each device in the `devices` array: `{ name, type, pinNumber (0–40), mqttTopic, isActive? (default true) }`.

If `isActive: true` is sent but the controller already has an active grow, the response is `409 Conflict`:

```json
{
  "error": "Controller already has an active grow cycle. End the current grow before starting a new one."
}
```

| #   | Phase Name        | Duration | Light Config            | Exhaust Config           | Pump Config |
| --- | ----------------- | -------- | ----------------------- | ------------------------ | ----------- |
| 1   | Seedling / Clone  | 14d      | SCHEDULE, 18h on @06:00 | THRESHOLD, TEMP > 25°C   | —           |
| 2   | Vegetative Stage  | 30d      | SCHEDULE, 22h on @06:00 | THRESHOLD, TEMP > 26.5°C | —           |
| 3   | Flowering / Bloom | 60d      | SCHEDULE, 12h on @06:00 | THRESHOLD, TEMP > 26°C   | —           |
| 4   | Curing / Harvest  | 7d       | ALWAYS_OFF              | —                        | ALWAYS_OFF  |

Configs are only created for a phase if the freshly-provisioned device set contains a device of the corresponding type (LIGHT, EXHAUST_FAN, WATER_PUMP).

### Grow Cycle Update

`PUT /api/grow-cycles/:id` accepts `{ name?, isActive?, startAt? }`. **`controllerId` is intentionally rejected** — a grow is bound to its controller for life. Setting `isActive: true` returns `409` if the controller already has another active grow.

### Error Format

All errors return `{ error: string }` with appropriate HTTP status (400 for validation, 404 for not found, 409 for controller-busy conflicts).

### Response Nesting Convention

- **List endpoints** (`GET /api/grow-cycles`, `/api/controllers`) — flat with only `controller: { name, status }` included
- **Detail endpoints**:
  - `GET /api/grow-cycles/:id` — full nested: `controller`, `devices[]`, `phases[].deviceConfigs[].device`
  - `GET /api/controllers/:id` — `growCycles` (only active cycles) with each cycle's `phases` (only active phase) + `devices[]` nested. No top-level `devices` on the controller.
