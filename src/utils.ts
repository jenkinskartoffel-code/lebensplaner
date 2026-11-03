import type { Routine } from './db'

const pad = (n: number) => String(n).padStart(2, '0')

/** Lokales Datum als YYYY-MM-DD (nicht UTC). */
export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toISO(new Date())

export function addDays(iso: string, n: number) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
/** Wochentage in der Reihenfolge Mo–So. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return fromISO(iso).toLocaleDateString('de-DE', opts)
}

/** "Heute", "Morgen", "Gestern" oder ein kurzes Datum. */
export function relativeDate(iso: string) {
  const t = today()
  if (iso === t) return 'Heute'
  if (iso === addDays(t, 1)) return 'Morgen'
  if (iso === addDays(t, -1)) return 'Gestern'
  return formatDate(iso)
}

export function isRoutineDue(r: Routine, iso: string) {
  return r.days.length === 0 || r.days.includes(fromISO(iso).getDay())
}

/** Anzahl der fälligen Tage in Folge, an denen die Routine erledigt wurde (bis heute). */
export function routineStreak(r: Routine, doneDates: Set<string>) {
  let streak = 0
  let day = today()
  // Heute zählt mit, wenn erledigt – bricht aber nicht ab, wenn noch offen
  if (isRoutineDue(r, day) && !doneDates.has(day)) day = addDays(day, -1)
  for (let i = 0; i < 400; i++) {
    if (isRoutineDue(r, day)) {
      if (!doneDates.has(day)) break
      streak++
    }
    day = addDays(day, -1)
  }
  return streak
}

export function describeDays(days: number[]) {
  if (days.length === 0 || days.length === 7) return 'Täglich'
  const sorted = WEEK_ORDER.filter((d) => days.includes(d))
  if (sorted.join() === '1,2,3,4,5') return 'Werktags'
  if (sorted.join() === '6,0') return 'Wochenende'
  return sorted.map((d) => WEEKDAYS_SHORT[d]).join(', ')
}
