# PiGrow Control Center

A Vue 3 + TypeScript web dashboard for managing Raspberry Pi-based grow environments. Provides real-time telemetry monitoring, grow cycle management, and device control via a RESTful backend and MQTT/Socket.IO.

## Stack

| Layer      | Tech                               |
| ---------- | ---------------------------------- |
| Framework  | Vue 3 (Composition API)            |
| Language   | TypeScript 6                       |
| Build      | Vite 8                             |
| UI Library | PrimeVue 4 (Aura theme, dark mode) |
| State      | Pinia                              |
| Routing    | Vue Router 5                       |
| HTTP       | Axios                              |
| Fonts      | Inter, JetBrains Mono              |

## Setup

```sh
npm install
```

### Development

```sh
npm run dev
```

Serves on `http://localhost:5173` — API expects a backend at `VITE_API_BASE_URL` (default: `http://192.168.0.105:4000/api`).

### Production

```sh
npm run build
npm run preview
```

## Project Structure

```
src/
├── main.ts                        # App bootstrap (PrimeVue preset, Pinia, Router)
├── App.vue                        # Root shell with sticky nav
├── router.ts                      # Routes: home, admin, controller/grow forms, monitor
├── stores/
│   └── growStore.ts               # Pinia store: controllers, devices, cycles, phases, telemetry
├── types/
│   └── grow.ts                    # TypeScript enums & interfaces (Controller, Device, GrowCycle, etc.)
├── views/
│   ├── HomeView.vue               # Dashboard — active grow cycles & controller status
│   ├── AdminView.vue              # CRUD tables for controllers & grow cycles
│   ├── GrowMonitorView.vue        # Real-time per-cycle monitor with device toggles & phase timeline
│   └── admin/
│       ├── ControllerFormView.vue # Create/edit controller + manage its GPIO devices
│       └── GrowFormView.vue       # Create/edit grow cycle with configurable phases
└── assets/
    ├── main.css                   # Global styles
    ├── base.css                   # Design tokens
    ├── design-tokens.css          # Semantic color/spacing tokens
    └── transitions.css            # Shared animations
```

## Routes

| Path                          | View               | Purpose                                                             |
| ----------------------------- | ------------------ | ------------------------------------------------------------------- |
| `/`                           | HomeView           | Dashboard — live overview of active cycles & controller status      |
| `/admin`                      | AdminView          | CRUD tables for controllers and grow cycles                         |
| `/admin/controllers/new`      | ControllerFormView | Register a new Raspberry Pi                                         |
| `/admin/controllers/edit/:id` | ControllerFormView | Edit controller + manage attached devices                           |
| `/admin/grows/new`            | GrowFormView       | Create a grow cycle and provision devices (phases added separately) |
| `/admin/grows/edit/:id`       | GrowFormView       | Edit grow cycle phases and duration                                 |
| `/grow/:id`                   | GrowMonitorView    | Real-time monitor — device toggles, phase timeline, telemetry       |

## API

Backend REST API documentation is in [`API.md`](API.md) and [`API-ENDPOINTS.md`](API-ENDPOINTS.md).

## Quality

```sh
npm run lint              # oxlint
npm run lint:fix          # oxlint with auto-fix
npm run format            # oxfmt (format in place)
npm run format:check      # oxfmt (check only)
npm run type-check        # vue-tsc
npm run type-check:fast   # tsgo (Go-based, faster)
npm run quality           # lint + format:check + type-check:fast
```

Pre-commit hooks (via lefthook) run lint, format, and type-check on staged files. Pre-push runs the full build.
