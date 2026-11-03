import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteRoutine, toggleRoutine, type Routine } from '../db'
import { AreaSelect, AreaTag, Empty, Modal, useAreas } from '../components'
import { WEEK_ORDER, WEEKDAYS_SHORT, addDays, describeDays, fromISO, isRoutineDue, routineStreak, today } from '../utils'

/** Alle Erledigt-Daten je Routine als Set. */
export function useRoutineLogs(since: string) {
  return useLiveQuery(async () => {
    const logs = await db.routineLogs.where('date').aboveOrEqual(since).toArray()
    const m = new Map<string, Set<string>>()
    for (const l of logs) {
      if (!m.has(l.routineId)) m.set(l.routineId, new Set())
      m.get(l.routineId)!.add(l.date)
    }
    return m
  }, [since]) ?? new Map<string, Set<string>>()
}

export function RoutinesView() {
  const areas = useAreas()
  const routines = useLiveQuery(() => db.routines.where('archived').equals(0).toArray(), []) ?? []
  const logs = useRoutineLogs(addDays(today(), -400))
  const [editing, setEditing] = useState<Routine | 'new' | null>(null)

  // Aktuelle Woche Mo–So
  const t = today()
  const monday = addDays(t, -((fromISO(t).getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <div className="page">
      <header className="page-head">
        <h1>Routinen</h1>
        <button className="primary" onClick={() => setEditing('new')}>＋ Routine</button>
      </header>
      <p className="muted-text">Wiederkehrende Gewohnheiten, die du täglich oder an bestimmten Wochentagen abhakst.</p>
      {routines.length === 0 && <Empty>Noch keine Routinen. Wie wäre es mit „Vorlesung nachbereiten“ werktags oder „10 Minuten Sport“ täglich?</Empty>}
      {routines.length > 0 && (
        <div className="week-table">
          <div className="week-row head">
            <span />
            {week.map((d) => (
              <span key={d} className={d === t ? 'is-today' : ''}>{WEEKDAYS_SHORT[fromISO(d).getDay()]}<small>{fromISO(d).getDate()}</small></span>
            ))}
            <span>🔥</span>
          </div>
          {routines.map((r) => {
            const done = logs.get(r.id) ?? new Set<string>()
            return (
              <div key={r.id} className="week-row">
                <button className="routine-name" onClick={() => setEditing(r)}>
                  <span>{r.title}</span>
                  <span className="item-meta">{describeDays(r.days)} <AreaTag area={areas.find((a) => a.id === r.areaId)} /></span>
                </button>
                {week.map((d) => {
                  const due = isRoutineDue(r, d)
                  const on = done.has(d)
                  return (
                    <button
                      key={d}
                      className={`cell ${on ? 'on' : ''} ${due ? '' : 'off'} ${d > t ? 'future' : ''}`}
                      disabled={d > t}
                      onClick={() => toggleRoutine(r.id, d)}
                      aria-label={`${r.title} am ${d}`}
                    >
                      {on ? '✓' : due ? '' : '·'}
                    </button>
                  )
                })}
                <span className="streak">{routineStreak(r, done)}</span>
              </div>
            )
          })}
        </div>
      )}
      {editing && <RoutineForm routine={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RoutineForm({ routine, onClose }: { routine?: Routine; onClose: () => void }) {
  const [title, setTitle] = useState(routine?.title ?? '')
  const [areaId, setAreaId] = useState(routine?.areaId)
  const [days, setDays] = useState<number[]>(routine?.days ?? [])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const data = { title: title.trim(), areaId, days: days.length === 7 ? [] : days }
    if (routine) await db.routines.update(routine.id, data)
    else await db.routines.add({ ...data, archived: 0, createdAt: Date.now() } as Routine)
    onClose()
  }

  async function remove() {
    if (!routine || !confirm(`Routine „${routine.title}“ samt Verlauf löschen?`)) return
    await deleteRoutine(routine.id)
    onClose()
  }

  const toggleDay = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])

  return (
    <Modal title={routine ? 'Routine bearbeiten' : 'Neue Routine'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <input autoFocus placeholder="z.B. 30 Min. lernen" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Bereich<AreaSelect value={areaId} onChange={setAreaId} /></label>
        <div>
          <span className="label">An welchen Tagen? <small>(keiner gewählt = täglich)</small></span>
          <div className="picker days">
            {WEEK_ORDER.map((d) => (
              <button type="button" key={d} className={days.includes(d) ? 'sel' : ''} onClick={() => toggleDay(d)}>{WEEKDAYS_SHORT[d]}</button>
            ))}
          </div>
          <div className="picker">
            <button type="button" className="small ghost" onClick={() => setDays([])}>Täglich</button>
            <button type="button" className="small ghost" onClick={() => setDays([1, 2, 3, 4, 5])}>Werktags</button>
            <button type="button" className="small ghost" onClick={() => setDays([6, 0])}>Wochenende</button>
          </div>
        </div>
        <div className="form-actions">
          {routine && <button type="button" className="danger" onClick={remove}>Löschen</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="primary">Speichern</button>
        </div>
      </form>
    </Modal>
  )
}
