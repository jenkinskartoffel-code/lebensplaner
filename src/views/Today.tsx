import { useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, toggleRoutine, type CalEvent, type Task } from '../db'
import { AreaTag, Empty, QuickAdd, TaskForm, TaskItem, sortTasks, useAreas } from '../components'
import { addDays, formatDate, isRoutineDue, routineStreak, today } from '../utils'
import { EventForm, EventItem } from './Calendar'
import { useRoutineLogs } from './Routines'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Hallo'
  return 'Guten Abend'
}

export function TodayView() {
  const t = today()
  const areas = useAreas()
  const events = useLiveQuery(() => db.events.where('date').equals(t).toArray(), [t]) ?? []
  const routines = useLiveQuery(() => db.routines.where('archived').equals(0).toArray(), []) ?? []
  const logs = useRoutineLogs(addDays(t, -400))
  const openTasks = useLiveQuery(() => db.tasks.where('done').equals(0).toArray(), []) ?? []
  // Heute erledigte Aufgaben bleiben sichtbar, damit man den Fortschritt sieht
  const doneToday = useLiveQuery(() => db.tasks.where('done').equals(1).filter((x) => !!x.doneAt && x.doneAt >= new Date(new Date().setHours(0, 0, 0, 0)).getTime()).toArray(), [t]) ?? []
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editEvent, setEditEvent] = useState<CalEvent | 'new' | null>(null)

  const dueRoutines = routines.filter((r) => isRoutineDue(r, t))
  const routinesDone = dueRoutines.filter((r) => logs.get(r.id)?.has(t)).length

  const overdue = sortTasks(openTasks.filter((x) => x.dueDate && x.dueDate < t))
  const todayTasks = sortTasks([...openTasks.filter((x) => x.dueDate === t), ...doneToday.filter((x) => x.dueDate === t || !x.dueDate || x.dueDate < t)])
  const upcoming = sortTasks(openTasks.filter((x) => x.dueDate && x.dueDate > t && x.dueDate <= addDays(t, 7)))
  const inbox = sortTasks(openTasks.filter((x) => !x.dueDate && !x.areaId && !x.projectId))
  const important = sortTasks(openTasks.filter((x) => !x.dueDate && x.important && (x.areaId || x.projectId)))

  const allToday = overdue.length + todayTasks.length + dueRoutines.length
  const doneCount = todayTasks.filter((x) => x.done).length + routinesDone
  const pct = allToday ? Math.round((doneCount / allToday) * 100) : 0

  const list = (tasks: Task[]) => (
    <ul className="list">{tasks.map((x) => <TaskItem key={x.id} task={x} areas={areas} onEdit={setEditTask} />)}</ul>
  )

  return (
    <div className="page">
      <header className="today-head">
        <div>
          <p className="muted-text">{formatDate(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1>{greeting()}!</h1>
        </div>
        {allToday > 0 && (
          <div className="ring" style={{ '--p': pct } as CSSProperties} title={`${doneCount} von ${allToday} erledigt`}>
            <span>{pct}%</span>
          </div>
        )}
      </header>

      <section>
        <div className="section-head">
          <h2>Termine heute</h2>
          <button className="small" onClick={() => setEditEvent('new')}>＋ Termin</button>
        </div>
        {events.length === 0 ? <Empty>Heute stehen keine Termine an.</Empty> : (
          <ul className="list">
            {[...events].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '')).map((e) => <EventItem key={e.id} event={e} areas={areas} onEdit={setEditEvent} />)}
          </ul>
        )}
      </section>

      {dueRoutines.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Routinen</h2>
            <span className="muted-text">{routinesDone}/{dueRoutines.length}</span>
          </div>
          <ul className="list">
            {dueRoutines.map((r) => {
              const done = logs.get(r.id) ?? new Set<string>()
              const on = done.has(t)
              const streak = routineStreak(r, done)
              return (
                <li key={r.id} className={`item ${on ? 'done' : ''}`}>
                  <button className={`check round ${on ? 'on' : ''}`} onClick={() => toggleRoutine(r.id, t)} aria-label="Abhaken">{on ? '✓' : ''}</button>
                  <span className="item-body static">
                    <span className="item-title">{r.title}</span>
                    <span className="item-meta">
                      {streak > 0 && <span>🔥 {streak}</span>}
                      <AreaTag area={areas.find((a) => a.id === r.areaId)} />
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section>
        <h2>Aufgaben für heute</h2>
        <QuickAdd defaults={{ dueDate: t }} placeholder="Aufgabe für heute …" />
        {overdue.length > 0 && <><h3 className="overdue">Überfällig</h3>{list(overdue)}</>}
        {todayTasks.length === 0 && overdue.length === 0 ? <Empty>Nichts fällig – genieß den Tag oder plane etwas.</Empty> : list(todayTasks)}
      </section>

      {important.length > 0 && <section><h2>★ Wichtig, ohne Datum</h2>{list(important)}</section>}
      {upcoming.length > 0 && <section><h2>Nächste 7 Tage</h2>{list(upcoming)}</section>}

      <section>
        <h2>Eingang</h2>
        <p className="muted-text">Schnell notiert, noch keinem Bereich zugeordnet.</p>
        <QuickAdd placeholder="Gedanke oder Aufgabe festhalten …" />
        {list(inbox)}
      </section>

      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} />}
      {editEvent && <EventForm event={editEvent === 'new' ? undefined : editEvent} date={t} onClose={() => setEditEvent(null)} />}
    </div>
  )
}
