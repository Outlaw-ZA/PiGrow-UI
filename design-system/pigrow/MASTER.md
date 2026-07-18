# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** PiGrow
**Category:** Smart Home/IoT Dashboard (dark, single-operator, desktop + occasional tablet)
**Last refreshed:** 2026-07-17 (against `main`)

---

## Stack & Source of Truth

- **Framework:** Vue 3 (Composition API, `<script setup>`)
- **UI library:** PrimeVue 4 (Aura preset, dark-mode override in `src/main.ts`)
- **Theming:** custom `AppPreset = definePreset(Aura, …)` in `src/main.ts` is the source of truth for PrimeVue component tokens (button, card, datatable, dialog, inputs, switch, tag, tooltip). When the preset changes, the project changes.
- **CSS tokens:** `src/assets/design-tokens.css` — semantic color, spacing, radius, shadow, transition, z-index, focus.
- **Global styles:** `src/assets/base.css` (reset + focus ring), `src/assets/main.css` (imports the above), `src/assets/transitions.css` (keyframes + `prefers-reduced-motion`).

If this file and the code disagree, the **code wins**. Update this file whenever you change the preset or tokens.

---

## Color Palette

### Surfaces

| Token                 | Hex       | Role                                 |
| --------------------- | --------- | ------------------------------------ |
| `--color-bg-base`     | `#0b1120` | App background                       |
| `--color-bg-surface`  | `#151d2e` | Card / panel background              |
| `--color-bg-elevated` | `#1c2640` | Hover, code blocks, elevated widgets |
| `--color-bg-hover`    | `#222e48` | Interactive hover surface            |
| `--color-bg-muted`    | `#2a3654` | Scrollbar thumb                      |

### Borders

| Token                   | Hex       | Role                                                         |
| ----------------------- | --------- | ------------------------------------------------------------ |
| `--color-border`        | `#1c2640` | Default border (cards, inputs, tables)                       |
| `--color-border-subtle` | `#243049` | Soft divider (≥1.4:1 against `bg-base` so it actually shows) |
| `--color-border-active` | `#22c55e` | Focused / active border                                      |

### Text

| Token                    | Hex       | Role                                | Min contrast against `bg-base`                                         |
| ------------------------ | --------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `--color-text-primary`   | `#f1f5f9` | Headings, body                      | ~16:1                                                                  |
| `--color-text-secondary` | `#94a3b8` | Subheads, helper text               | ~9.4:1                                                                 |
| `--color-text-muted`     | `#94a3b8` | Captions, hints, disabled           | ~9.4:1 (was `#64748b` ≈ 5.2:1, failed AA on elevated surfaces — fixed) |
| `--color-text-inverse`   | `#0f172a` | Text on accent / bright backgrounds | —                                                                      |

### Accent (status + CTA)

| Token                   | Hex / value               | Role                                                     |
| ----------------------- | ------------------------- | -------------------------------------------------------- |
| `--color-accent`        | `#22c55e`                 | Primary CTA, "running" status, active phase, focused pin |
| `--color-accent-hover`  | `#16a34a`                 | CTA hover                                                |
| `--color-accent-dim`    | `#059669`                 | Pressed / accent secondary                               |
| `--color-accent-glow`   | `rgba(34, 197, 94, 0.2)`  | Glow ring / focus halo                                   |
| `--color-accent-bg`     | `rgba(34, 197, 94, 0.08)` | Soft fill (active nav, badges)                           |
| `--color-accent-border` | `rgba(34, 197, 94, 0.25)` | Soft border                                              |

### Semantic

Each semantic color ships with a base, a soft `-bg`, and a soft `-border`.

| Token             | Base      | Use                                 |
| ----------------- | --------- | ----------------------------------- |
| `--color-success` | `#22c55e` | Online, running, success toast      |
| `--color-danger`  | `#ef4444` | Offline, error, destructive confirm |
| `--color-warning` | `#f59e0b` | Approaching threshold, ID_SD pin    |
| `--color-info`    | `#3b82f6` | 3V3 rail, info banner               |

### Code / monospace

| Token               | Hex                     | Role                   |
| ------------------- | ----------------------- | ---------------------- |
| `--color-code-bg`   | `rgba(15, 23, 42, 0.6)` | Inline code background |
| `--color-code-text` | `#7dd3fc`               | Inline code text       |

### Phase / progress tracker

| Token                          | Hex       | Role                                          |
| ------------------------------ | --------- | --------------------------------------------- |
| `--color-phase-done`           | `#475569` | Completed phase dot (muted slate, NOT accent) |
| `--color-phase-done-text`      | `#f1f5f9` | Done-phase label text                         |
| `--color-phase-active`         | `#22c55e` | Current phase dot (accent)                    |
| `--color-phase-pending-bg`     | `#1c2640` | Pending phase fill                            |
| `--color-phase-pending-border` | `#334155` | Pending phase border                          |
| `--color-phase-pending-text`   | `#94a3b8` | Pending phase label text                      |
| `--color-track-bg`             | `#1c2640` | Progress track rail                           |
| `--color-track-fill`           | `#22c55e` | Progress track fill                           |

> Historical note: `phase-done` was previously `#22c55e` (same as `phase-active`) which made "done" and "active" visually indistinguishable.

### Device tiles

| Token                          | Hex / value               | Role               |
| ------------------------------ | ------------------------- | ------------------ |
| `--color-device-active-bg`     | `rgba(34, 197, 94, 0.06)` | Active tile fill   |
| `--color-device-active-border` | `rgba(34, 197, 94, 0.35)` | Active tile border |

### Bus / protocol annotations

Used on the GPIO pinout diagram only.

| Family | Hex                |
| ------ | ------------------ |
| I²C    | `#a78bfa` (purple) |
| SPI    | `#22d3ee` (cyan)   |
| UART   | `#fb923c` (orange) |
| PWM    | `#2dd4bf` (teal)   |

---

## Typography

- **Heading + body font:** Inter (self-hosted via `@fontsource/inter`)
- **Monospace font:** JetBrains Mono (self-hosted via `@fontsource/jetbrains-mono`)

Load weights 400 / 500 / 600 / 700 for Inter, 400 / 500 for JetBrains Mono. Already wired in `src/main.ts`.

| Token         | Value       | Use                                   |
| ------------- | ----------- | ------------------------------------- |
| `--text-xs`   | `0.6875rem` | Uppercase micro labels, table headers |
| `--text-sm`   | `0.75rem`   | Inline meta, code chips               |
| `--text-base` | `0.8125rem` | Default body (also `body` font-size)  |
| `--text-md`   | `0.875rem`  | Comfortable body, page subtitles      |
| `--text-lg`   | `1rem`      | Section subheads                      |
| `--text-xl`   | `1.125rem`  | Card titles                           |
| `--text-2xl`  | `1.5rem`    | Page titles                           |

| Token               | Value     |
| ------------------- | --------- |
| `--leading-tight`   | `1.25`    |
| `--leading-normal`  | `1.5`     |
| `--leading-relaxed` | `1.625`   |
| `--tracking-tight`  | `-0.01em` |
| `--tracking-normal` | `0`       |
| `--tracking-wide`   | `0.025em` |
| `--tracking-wider`  | `0.05em`  |

---

## Spacing

`--space-0` through `--space-12`, step sequence 0 / 0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.5 / 2 / 2.5 / 3 (`rem`). No `--space-7`, `--space-9`, or `--space-11`.

| Token        | rem       | Typical use               |
| ------------ | --------- | ------------------------- |
| `--space-1`  | `0.25rem` | Tight gaps                |
| `--space-2`  | `0.5rem`  | Icon gaps, inline spacing |
| `--space-3`  | `0.75rem` | Inside cards              |
| `--space-4`  | `1rem`    | Standard padding          |
| `--space-6`  | `1.5rem`  | Section padding           |
| `--space-8`  | `2rem`    | Page padding              |
| `--space-12` | `3rem`    | Hero padding              |

---

## Border Radius

| Token           | Value    | Use                    |
| --------------- | -------- | ---------------------- |
| `--radius-sm`   | `4px`    | Code chips, small tags |
| `--radius-md`   | `6px`    | Buttons, inputs        |
| `--radius-lg`   | `8px`    | Cards, datatables      |
| `--radius-xl`   | `10px`   | Dialogs                |
| `--radius-full` | `9999px` | Pills, status badges   |

---

## Shadow

| Token                  | Value                                                              | Use                       |
| ---------------------- | ------------------------------------------------------------------ | ------------------------- |
| `--shadow-sm`          | `0 1px 2px 0 rgba(0,0,0,0.3)`                                      | Subtle lift               |
| `--shadow-md`          | `0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)`   | Cards, buttons            |
| `--shadow-lg`          | `0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.3)` | Modals, dropdowns         |
| `--shadow-glow`        | `0 0 12px rgba(34, 197, 94, 0.15)`                                 | Live indicator            |
| `--shadow-glow-strong` | `0 0 20px rgba(34, 197, 94, 0.25)`                                 | Hover lift on cycle cards |

---

## Transitions

| Token               | Value                          |
| ------------------- | ------------------------------ |
| `--duration-fast`   | `150ms`                        |
| `--duration-normal` | `200ms`                        |
| `--duration-slow`   | `300ms`                        |
| `--ease-default`    | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-in`         | `cubic-bezier(0.4, 0, 1, 1)`   |
| `--ease-out`        | `cubic-bezier(0, 0, 0.2, 1)`   |

All transitions **must** use these tokens — never hardcode ms values.

`prefers-reduced-motion: reduce` is honored in `src/assets/transitions.css` (animation/transition durations set to 0).

---

## Z-Index

| Token          | Value  | Use                       |
| -------------- | ------ | ------------------------- |
| `--z-dropdown` | `50`   | Popovers, dropdown panels |
| `--z-sticky`   | `100`  | Sticky nav, table headers |
| `--z-overlay`  | `500`  | Confirmation masks        |
| `--z-modal`    | `1000` | Dialogs                   |

---

## Focus

| Token                 | Value                 |
| --------------------- | --------------------- |
| `--focus-ring-width`  | `2px`                 |
| `--focus-ring-offset` | `2px`                 |
| `--focus-ring-color`  | `var(--color-accent)` |

Applied globally via `#app *:focus-visible` in `base.css`. Don't override per-component unless you have a strong reason — keyboard users depend on this being consistent.

---

## Component Conventions

### Buttons

PrimeVue `Button` is themed in `main.ts`. Use:

- `severity="success"` for primary CTA (Save, Create, Add).
- `severity="secondary"` for cancel / back.
- `severity="danger"` only for destructive actions.
- `severity="warn"` / `severity="info"` for contextual actions.
- `text rounded size="small"` for table row actions (Edit, Delete).
- `:loading="saving"` on save buttons to prevent double-submit (every form must have a `saving` ref).

### Inputs

- `InputText`, `Select`, `MultiSelect`, `DatePicker`, `InputNumber` from PrimeVue.
- Every form input must have a `<label for="…">` paired to its `id`.
- `InputNumber` must declare `:min` and `:max` when the value has a sensible range (env: temp −10..50, humidity 0..100, CO₂ 0..10000).
- Numeric precision via `:minFractionDigits` / `:maxFractionDigits`.

### Cards

PrimeVue `Card`. Sub-component sections live inside `<template #title>` and `<template #content>`.

### Tables

PrimeVue `DataTable` with `:value="…"` and `<Column>` children. Page size: `size="small"`. Always include an empty state for the `length === 0` case (dashed-border placeholder with icon + text).

### Dialogs

- `<Dialog modal dismissable-mask>`.
- Footer: Cancel (`secondary`) on the left, primary action (`success`) on the right, both `size="small"`.
- Destructive actions go through `<ConfirmDialog>` (`useConfirm()`), never `window.confirm()`.

### Toasts

- `useToast()` from PrimeVue.
- Success: 3 s life, severity `success`.
- Informational / warning: 6–8 s life, severity `warn` / `info`.
- Error: 6 s life, severity `error`.

### Charts

- `TelemetryChart`, `DeviceHistoryChart` from `src/components/…`.
- Chart.js via `vue-chartjs`. Dark axis/grid; accent colors for active series.

---

## Page Patterns

### Dashboard (`HomeView`, `/`)

- Cycle cards: grid, `minmax(280px, 1fr)`, hover lift + accent border.
- Active count badge top-right with pulsing dot.
- Empty state: `pi pi-server` icon + onboarding nudge.

### Monitor (`GrowMonitorView`, `/grow/:id`)

- Sticky back row + page title.
- "Hero" status card at the top (controller status, current phase, overall progress). Don't duplicate progress elsewhere — show supplementary detail under it.
- Cards in fixed order: Hero → Climate → Telemetry History → Devices → Device History → Phases → Environment → Automations.

### Admin (`AdminView`, `/admin`)

- Two sections (Controllers, Grow Cycles), each its own `Card`.
- New-entity button in the section header.
- Empty states when zero rows.

### Forms (`ControllerFormView`, `GrowFormView`)

- Tabs for sections (Details, Sensors, Devices / Details, Phases).
- Save in the footer: Cancel + Save Changes / Create.
- Staged entities (sensors, devices, phases) get atomic-create on first save.
- `useUnsavedGuard(dirtyRef)` for navigation guard on dirty forms.

---

## Anti-Patterns

- ❌ **Native `window.confirm()` / `window.alert()`** — always use PrimeVue `ConfirmDialog` / `Toast`.
- ❌ **Emojis as icons** — use `primeicons` (`pi pi-…`).
- ❌ **Hardcoded hex values in components** — use semantic tokens.
- ❌ **Hardcoded `transition: …ms`** — use `--duration-*` + `--ease-*`.
- ❌ **Invisible borders** — never use a border color with <1.5:1 contrast against the surface it sits on (this is why `--color-border-subtle` was bumped from `#151d2e` → `#243049`).
- ❌ **Layout-shifting hover** — don't use `scale()` transforms on cards.
- ❌ **Missing `cursor: pointer`** — every clickable element must have it.
- ❌ **Loading flags on top-level buttons only** — disable row actions too while a save is in flight.

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons (`pi pi-…` instead).
- [ ] All icons from PrimeIcons; mix-and-match avoided.
- [ ] `cursor: pointer` on every clickable element.
- [ ] Hover states with `var(--duration-fast)` + `var(--ease-default)`.
- [ ] Body text contrast ≥ 4.5:1 (now guaranteed by `--color-text-muted = #94a3b8`).
- [ ] Focus ring visible (default `2px solid --color-accent` with 2px offset).
- [ ] `prefers-reduced-motion` respected (verified by `transitions.css`).
- [ ] No content hidden behind sticky nav (16 px `top` offset min).
- [ ] Forms: `:loading` on save buttons, `useUnsavedGuard` for navigation, ConfirmDialog for destructive actions.
- [ ] Empty states exist for every collection (controllers, grows, phases, sensors, devices, rules).
