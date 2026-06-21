import type { GrowPhase } from '@/types/grow'

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateOnly(value: string): Date {
  const [y = 1970, m = 1, d = 1] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

export function todayStr(): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return formatDate(now)
}

export function recalculatePhaseDates(phases: GrowPhase[], growStart: Date | null): void {
  if (!growStart || Number.isNaN(growStart.getTime())) {
    for (const phase of phases) {
      phase.startAt = null
      phase.endAt = null
    }
    return
  }
  const cursor = new Date(growStart)
  cursor.setHours(0, 0, 0, 0)
  for (const phase of phases) {
    phase.startAt = formatDate(cursor)
    cursor.setDate(cursor.getDate() + phase.durationDays)
    phase.endAt = formatDate(cursor)
  }
}

export function deriveGrowActive(startAt: string | null, sortedPhases: GrowPhase[]): boolean {
  if (!startAt || sortedPhases.length === 0) {
    return false
  }
  const today = todayStr()
  const lastEnd = sortedPhases.at(-1)?.endAt
  if (!lastEnd) {
    return false
  }
  return today >= startAt && today < lastEnd
}

export function deriveActivePhaseIndex(sortedPhases: GrowPhase[]): number {
  const today = todayStr()
  return sortedPhases.findIndex(
    (p) => p.startAt !== null && p.endAt !== null && today >= p.startAt && today < p.endAt,
  )
}

export function daysBetween(fromStr: string | null, toStr: string): number {
  if (!fromStr) {
    return 0
  }
  const from = new Date(fromStr)
  if (Number.isNaN(from.getTime())) {
    return 0
  }
  const to = new Date(toStr)
  if (Number.isNaN(to.getTime())) {
    return 0
  }
  from.setHours(0, 0, 0, 0)
  to.setHours(0, 0, 0, 0)
  const diffMs = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function deriveElapsedDays(sortedPhases: GrowPhase[], activeIdx: number): number {
  if (sortedPhases.length === 0 || activeIdx < 0) {
    return 0
  }
  const completedDays = sortedPhases
    .slice(0, activeIdx)
    .reduce((sum: number, p: GrowPhase) => sum + p.durationDays, 0)
  const active = sortedPhases[activeIdx]
  if (!active || !active.startAt) {
    return completedDays
  }
  const elapsedInActive = Math.min(daysBetween(active.startAt, todayStr()), active.durationDays)
  return completedDays + elapsedInActive
}
