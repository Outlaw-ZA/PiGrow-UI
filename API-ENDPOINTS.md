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

| Method   | Endpoint                                | FE Scenario                                                 |
| -------- | --------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/devices/controller/:controllerId` | ControllerFormView device list, GrowMonitorView device card |
| `GET`    | `/api/devices/:id`                      | Device detail (with configs + controller info)              |
| `POST`   | `/api/devices`                          | ControllerFormView add device                               |
| `POST`   | `/api/devices/batch`                    | ControllerFormView bulk add (practical UX)                  |
| `PUT`    | `/api/devices/:id`                      | ControllerFormView edit device                              |
| `DELETE` | `/api/devices/:id`                      | ControllerFormView remove device                            |
| `POST`   | `/api/devices/:id/command`              | GrowMonitorView toggle switches (ON/OFF)                    |

---

## Grow Cycles

| Method   | Endpoint                          | FE Scenario                                                                                                                                          |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/grow-cycles`                | HomeView cards, AdminView list (includes basic controller info)                                                                                      |
| `GET`    | `/api/grow-cycles/:id`            | GrowMonitorView full detail (controller, phases, deviceConfigs, devices nested)                                                                      |
| `POST`   | `/api/grow-cycles`                | GrowFormView create (auto-generates 4 default phases with device configs)                                                                            |
| `PUT`    | `/api/grow-cycles/:id`            | GrowFormView edit (name, controllerId, isActive, startAt as YYYY-MM-DD)                                                                              |
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

`POST /api/grow-cycles` accepts only `{ name, controllerId, isActive? }` and **auto-generates** 4 default phases. The cycle-level `startAt` is **not** accepted on create — a new cycle always has `startAt: null` until set via `PUT /api/grow-cycles/:id` with `{ startAt: "YYYY-MM-DD" }`. Full ISO date-time values for `startAt` are rejected (`400`).

| #   | Phase Name        | Duration | Light Config            | Exhaust Config           | Pump Config |
| --- | ----------------- | -------- | ----------------------- | ------------------------ | ----------- |
| 1   | Seedling / Clone  | 14d      | SCHEDULE, 18h on @06:00 | THRESHOLD, TEMP > 25°C   | —           |
| 2   | Vegetative Stage  | 30d      | SCHEDULE, 22h on @06:00 | THRESHOLD, TEMP > 26.5°C | —           |
| 3   | Flowering / Bloom | 60d      | SCHEDULE, 12h on @06:00 | THRESHOLD, TEMP > 26°C   | —           |
| 4   | Curing / Harvest  | 7d       | ALWAYS_OFF              | —                        | ALWAYS_OFF  |

Configs are only created if the controller has an active device of the corresponding type.

### Error Format

All errors return `{ error: string }` with appropriate HTTP status (400 for validation, 404 for not found).

### Response Nesting Convention

- **List endpoints** (`GET /api/grow-cycles`, `/api/controllers`) — flat with only `controller: { name, status }` included
- **Detail endpoints** (`GET /api/grow-cycles/:id`, `/api/controllers/:id`) — full nested relations
