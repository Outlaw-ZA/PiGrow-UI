# Surface per-phase day/night environment editor

**Date:** 2026-07-01
**Status:** Approved (design)
**Scope:** Frontend-only. No backend changes.

## Context

The PiGrow system stores per-phase environment (Temp / Humidity / CO₂ × min/target/max × DAY/NIGHT) and the backend already exposes full CRUD on it:

- `GET /api/grow-phases/:id/environment` → `{ growPhaseId, day: PhaseEnvironment | null, night: PhaseEnvironment | null }`
- `PUT /api/grow-phases/:id/environment/:period` (period = `DAY` | `NIGHT`) → upsert `PhaseEnvironmentPayload`
- `DELETE /api/grow-phases/:id/environment/:period`

The FE types and Pinia store mirror this (`src/types/grow.ts:140-167`, `src/stores/growPhaseStore.ts:18-37`).

The problem: the per-phase env editor lives **inside each phase row's expand chevron** in `GrowFormView.vue` (`src/views/admin/GrowFormView.vue:1018-1164` for the inline panel, `:1402-1476` for the single-period edit dialog). Users don't discover it — they have to click a tiny chevron to even see the env section exists, then click another pencil to edit a single period at a time. The user has reported the editor "is too hidden."

## Goal

Make per-phase day/night temp/humidity/CO₂ target editing discoverable in a single click, without changing the data model or backend.

## Non-goals

- Cycle-level default env (bulk-apply across phases).
- Backend schema or API changes.
- Removing per-phase env (it's the source of truth).
- Changing the Automation Rules UX (still lives in the expand panel).

## Design

### 1. Per-row "Environment" action button

In each phase row's Actions column (`src/views/admin/GrowFormView.vue:967-992`), add a `pi-sun` (or `pi-temperature`) text button between the existing Edit pencil and Delete trash. Tooltip: "Environment".

**Disabled when:**

- The phase has no `id` (create mode / unsaved grow) — tooltip: "Save the grow first to configure environment."
- Either `savingDay` or `savingNight` is true.

### 2. Combined Day+Night dialog

Replaces the current single-period edit modal at `src/views/admin/GrowFormView.vue:1402-1476`.

- Header: `Environment — {phase.name}`
- Width: `90vw` / `maxWidth: 800px`
- Two columns: **Day** (left) and **Night** (right).
- Each column has three sub-groups — Temperature (°C), Humidity (%), CO₂ (ppm) — each with Min / Target / Max inputs (9 inputs per column, 18 total).
- Per-column **Clear** button (top-right of each column) with the existing `clearPhaseEnv` confirm flow.
- Footer: **Cancel** | **Save** (disabled while saving). Save triggers both periods.

**Empty/never-configured state:** drafts default to all-null inputs with placeholder example values. "Leave blank to leave a threshold unconstrained" hint is preserved.

**Loading state:** brief "Loading…" guard on the dialog body while `loadPhaseEnv` is in flight (refetch on open to ensure fresh data).

### 3. State refactor

Replace the single-period state with two drafts:

```ts
const envDraftDay = ref<PhaseEnvironmentPayload>({
  /* all-null fields */
})
const envDraftNight = ref<PhaseEnvironmentPayload>({
  /* all-null fields */
})
const envEditingPhase = ref<GrowPhase | null>(null)
const showEnvForm = ref(false) // stays
```

Replace these functions:

- `openEditEnv(phase, period)` → `openEnvDialog(phase)` — awaits `loadPhaseEnv(phase)`, then populates both drafts from `envCache`.
- `saveEnvForm(phase)` → `saveEnvDialog()` — calls `savePhaseEnv(envEditingPhase, 'DAY', envDraftDay)` and `savePhaseEnv(envEditingPhase, 'NIGHT', envDraftNight)` via `Promise.allSettled`. Closes the dialog.
- `closeEnvForm()` → `closeEnvDialog()`.
- `editingEnvPeriod` → `envEditingPhase`.

Keep unchanged: `PhaseEnvCache`, `envCache`, `getEnvCache`, `loadPhaseEnv`, `savePhaseEnv`, `clearPhaseEnv` (re-used by the per-column Clear button).

### 4. Save flow

```ts
async function saveEnvDialog() {
  const phase = envEditingPhase.value
  if (!phase) return
  const [dayRes, nightRes] = await Promise.allSettled([
    savePhaseEnv(phase, 'DAY', envDraftDay.value),
    savePhaseEnv(phase, 'NIGHT', envDraftNight.value),
  ])
  if (dayRes.status === 'fulfilled' && nightRes.status === 'fulfilled') {
    toast.add({ detail: 'Environment saved', severity: 'success', summary: 'Saved', life: 3000 })
    closeEnvDialog()
  } else {
    // aggregated error toast
  }
}
```

- `savePhaseEnv` already pushes per-call error toasts on failure; to dedupe, suppress its internal toast and let `saveEnvDialog` emit a single aggregated toast.
- Disable the Save button while `savingDay || savingNight` for the editing phase; show a spinner.

### 5. Remove the inline env grid from the expand panel

Delete `src/views/admin/GrowFormView.vue:1018-1164` (the "Environment Thresholds" inline section). The expand chevron now reveals only the "Automation Rules" section. Removes the two-step expand → edit flow.

## What stays unchanged

- Backend: all three endpoints (`GET/PUT/DELETE`).
- Types: `PhaseEnvironment`, `PhaseEnvironmentPayload`, `DayNightPeriod`.
- Store: `useGrowPhaseStore` (no changes).
- Automation Rules UI in the expand panel.
- Phase modal (name, duration, day start, day duration).
- Phase list summary (Day/Night column already shows start/duration; the new dialog complements it for env thresholds).

## Files touched

- `src/views/admin/GrowFormView.vue` — the only file modified.

## Verification

1. **Lint/typecheck/format:** `npm run quality` passes.
2. **Manual smoke:**
   - Edit a grow with phases. Click the new "Environment" button on a phase row.
   - Dialog shows Day and Night columns, all inputs blank or pre-populated.
   - Enter Min/Target/Max for Temp/Humidity/CO₂ on Day, save. Reload — values persist.
   - Open again, edit Night, save. Both periods persist.
   - Click Clear on Day — confirm dialog, after clearing, the Day inputs blank and BE has no Day env.
   - In create mode (no grow id), the button is disabled with the right tooltip.
3. **Regression:** expand chevron still shows Automation Rules and works; phase modal still works; phase CRUD still works.

## Edge cases

- **Refetch on open** ensures drafts are never stale.
- **Clear mid-edit** zeroes the matching draft locally so the dialog reflects state without refetch.
- **Partial save failure** shows which period failed and which succeeded; doesn't auto-close the dialog on failure.
- **Concurrent saves** (e.g. automation rule saves) are unaffected — env state lives in `envCache` per phase, no shared state.
- **Disabled during save** prevents double-submit.
