# PiGrow Control Center

Vue 3 + TypeScript dashboard for managing Raspberry Pi-based grow
environments. Real-time telemetry, grow-cycle management, device control,
and **zero-touch controller claiming** via a network scan.

## Stack

| Layer      | Tech                                                |
| ---------- | --------------------------------------------------- |
| Framework  | Vue 3 (Composition API)                             |
| Language   | TypeScript 6                                        |
| Build      | Vite 8                                              |
| UI Library | PrimeVue 4 (Aura theme, dark mode)                  |
| State      | Pinia                                               |
| Routing    | Vue Router 5                                        |
| Real-time  | Socket.IO (`useLiveTelemetry`, `useDevicePresence`) |
| HTTP       | Axios                                               |
| Fonts      | Inter, JetBrains Mono                               |

## Setup

```sh
bun install
```

### Development

```sh
bun run dev
```

Serves on **http://localhost:5173** — API expects the backend at
`VITE_API_BASE_URL` (default: `http://192.168.0.105:4000/api`).

### Production

```sh
bun run build
bun run preview
```

## Zero-Touch Controller Onboarding

The flagship feature for non-technical operators.

### User flow

1. Flash a Pi with the PiGrow client (see [PiGrow-Client README](../PiGrow-Client/README.md)).
2. Plug it in. Within 7 s it starts advertising itself on the LAN.
3. Open the UI → **Admin → Scan for Controllers** (or click "Scan for
   Controllers" in the Admin header). Discovered Pis appear within 2 s.
4. Read the 6-digit PIN from the Pi's `journalctl` (or from the UI's
   "detected controllers" list — the PIN is **never** shown in the UI;
   see security note below).
5. Type the PIN and click **Claim**. The server validates it against
   the beacon, auto-creates the Controller + Sensor + Device rows, and
   the Pi flips to active mode within seconds.

The "Scan for Controllers" button is **additive** alongside the manual
**New Controller** form — both work; scan is just the easier path when
you have a Pi on the LAN.

### Where it lives

| Path                                                                                                              | Purpose                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/views/admin/ScanControllersView.vue`                                                                         | The scan + claim view (polls `/scan` 2 s × 30 s)                 |
| `src/composables/useDevicePresence.ts`                                                                            | Live ONLINE/OFFLINE via `device_state_update` Socket.IO event    |
| `src/stores/controllerStore.ts` → `scanControllers()`, `claimController(payload)`                                 | State management for the flow                                    |
| `src/stores/apiStore.ts`                                                                                          | `axios` facade exposing the new methods                          |
| `src/types/grow.ts` → `DiscoveredController`, `ScanResponse`, `ClaimRequest`, `ClaimResponse`, `HardwareManifest` | Type definitions matching the server's `/api`                    |
| `src/views/admin/ControllerFormView.vue`                                                                          | Now surfaces `maxOnSeconds` on the Device sub-form (was missing) |

## Project Structure

```
src/
├── main.ts                                # App bootstrap (PrimeVue preset, Pinia, Router)
├── App.vue                                # Root shell with sticky nav + useDevicePresence().start()
├── router.ts                              # Routes incl. /admin/controllers/scan
├── stores/
│   ├── apiStore.ts                        # axios facade: scanControllers, claimController, ...
│   └── controllerStore.ts                 # Pinia store: controllers, scan, claim
├── types/
│   └── grow.ts                            # TypeScript enums & interfaces (Controller, Device, …, Provisioning types)
├── composables/
│   ├── useLiveTelemetry.ts                # Socket.IO → telemetry + cycle events
│   └── useDevicePresence.ts               # Socket.IO → device_state_update (instant ONLINE/OFFLINE)
├── views/
│   ├── HomeView.vue                       # Dashboard — active grow cycles & controller status
│   ├── AdminView.vue                      # CRUD tables for controllers & grow cycles
│   ├── GrowMonitorView.vue                # Real-time per-cycle monitor with device toggles & phase timeline
│   └── admin/
│       ├── ControllerFormView.vue         # Create/edit controller + manage its GPIO devices (now with maxOnSeconds)
│       ├── GrowFormView.vue               # Create/edit grow cycle with configurable phases
│       └── ScanControllersView.vue        # **NEW** — network scan + PIN claim
└── assets/                                # Global styles, design tokens
```

## Routes

| Path                          | Component               | Purpose                              |
| ----------------------------- | ----------------------- | ------------------------------------ |
| `/`                           | HomeView                | Dashboard                            |
| `/admin`                      | AdminView               | Controllers + grow cycles tables     |
| `/admin/controllers/new`      | ControllerFormView      | Manual Controller create (legacy)    |
| `/admin/controllers/:id/edit` | ControllerFormView      | Edit controller, rename, manage GPIO |
| **`/admin/controllers/scan`** | **ScanControllersView** | **Network scan + PIN claim (new)**   |
| `/monitor/:id`                | GrowMonitorView         | Real-time cycle monitor              |

## Tests

```sh
bun run test      # 80 tests across 9 files
```

The new +9 provisioning tests cover: scan polling starts and stops on
the 30-second window, "Scan Again" restarts the window, claim with a
correct PIN navigates to the prefilled edit form, claim with the wrong
PIN renders an inline error and does NOT navigate, a row with
`pinActive: false` disables the claim button, `useDevicePresence`
updates the device store from a `device_state_update` event and is
start/stop-safe, the `maxOnSeconds` field renders in the Add Device
dialog.

Run gates:

```sh
bun run type-check    # vue-tsc --build, 0 errors
bun run lint          # oxlint, 0 errors
```

## Security / threat model (UI side)

- The UI shows `pinActive: true/false` per discovered Pi, but **never
  displays the PIN itself** — the operator reads the PIN from the Pi's
  physical display or `journalctl`, or from a note printed by the
  install script. This prevents a casual onlooker with UI access from
  reading a neighbour's PIN and racing the owner during the 5-minute
  window.
- All claim API calls go through the existing `apiStore` facade, which
  uses the same `axios` instance and auth headers as the rest of the
  app. No new auth surface.

## What v1 deliberately does NOT do

- **No custom Pi image** (Phase 4). The Pi is still installed manually
  via `scp` + `systemctl`. The full setup walkthrough is in the
  top-level [SETUP.md](../SETUP.md).
- **No setup-codes / Matter-style commissioning** — 6-digit PIN only.
  Phase-2 security work tracks credential rotation + per-credential
  MQTT auth.
- **No remote/cloud support** — scan and claim are LAN-only.
