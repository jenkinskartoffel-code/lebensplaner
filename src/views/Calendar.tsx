import { useState, type CSSProperties, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Area, type CalEvent, type Task } from '../db'
import { AreaSelect, AreaTag, Empty, Modal, QuickAdd, TaskForm, TaskItem, sortTasks, useAreas } from '../components'
import { WEEK_ORDER, WEEKDAYS_SHORT, addDays, formatDate, fromISO, toISO, today } from '../utils'

export function CalendarView() {
  const areas = useAreas()
  const [month, setMonth] = useState(() => today().slice(0, 7)) // YYYY-MM
  const [selected, setSelected] = useState(today())

  const first = fromISO(`${month}-01`)
  const gridStart = addDays(toISO(first), -((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const gridEnd = days[41]

  const events = useLiveQuery(() => db.events.where('date').between(gridStart, gridEnd, true, true).toArray(), [gridStart, gridEnd]) ?? []
  const tasks = useLiveQuery(() => db.tasks.where('dueDate').between(gridStart, gridEnd, true, true).toArray(), [gridStart, gridEnd]) ?? []

  const shiftMonth = (n: number) => {
    const d = fromISO(`${month}-01`)
    d.setMonth(d.getMonth() + n)
    setMonth(toISO(d).slice(0, 7))
  }
  const goToday = () => { setMonth(today().slice(0, 7)); setSelected(today()) }

  return (
    <div className="page wide">
      <header className="page-head">
        <h1>{first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h1>
        <div className="btn-group">
          <button onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">‹</button>
          <button onClick={goToday}>Heute</button>
          <button onClick={() => shiftMonth(1)} aria-label="Nächster Monat">›</button>
        </div>
      </header>
      <div className="cal-layout">
        <div className="cal-grid">
          {WEEK_ORDER.map((d) => <div key={d} className="cal-wd">{WEEKDAYS_SHORT[d]}</div>)}
          {days.map((d) => {
            const dayEvents = events.filter((e) => e.date === d).sort(byTime)
            const openTasks = tasks.filter((t) => t.dueDate === d && !t.done).length
            return (
              <button
                key={d}
                className={`cal-day ${d.slice(0, 7) !== month ? 'other' : ''} ${d === today() ? 'is-today' : ''} ${d === selected ? 'sel' : ''}`}
                onClick={() => setSelected(d)}
              >
                <span className="cal-num">{fromISO(d).getDate()}</span>
                {dayEvents.slice(0, 3).map((e) => (
                  <span key={e.id} className="cal-ev" style={{ '--c': areaColor(areas, e.areaId) } as CSSProperties}>
                    {e.start && <b>{e.start}</b>} {e.title}
                  </span>
                ))}
                {dayEvents.length > 3 && <span className="cal-more">+{dayEvents.length - 3}</span>}
                {openTasks > 0 && <span className="cal-tasks">{openTasks} ☐</span>}
              </button>
            )
          })}
        </div>
        <DayPanel date={selected} />
      </div>
    </div>
  )
}

const byTime = (a: CalEvent, b: CalEvent) => (a.start ?? '').localeCompare(b.start ?? '')
const areaColor = (areas: Area[], id?: string) => areas.find((a) => a.id === id)?.color ?? 'var(--muted)'

/** Termine und Aufgaben eines Tages – auch auf der Heute-Seite verwendet. */
export function DayPanel({ date }: { date: string }) {
  const areas = useAreas()
  const events = useLiveQuery(() => db.events.where('date').equals(date).toArray(), [date]) ?? []
  const tasks = useLiveQuery(() => db.tasks.where('dueDate').equals(date).toArray(), [date]) ?? []
  const [editEvent, setEditEvent] = useState<CalEvent | 'new' | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)

  return (
    <aside className="day-panel">
      <h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      <div className="section-head">
        <h3>Termine</h3>
        <button className="small" onClick={() => setEditEvent('new')}>＋ Termin</button>
      </div>
      {events.length === 0 && <Empty>Keine Termine.</Empty>}
      <ul className="list">
        {[...events].sort(byTime).map((e) => <EventItem key={e.id} event={e} areas={areas} onEdit={setEditEvent} />)}
      </ul>
      <h3>Fällige Aufgaben</h3>
      <QuickAdd defaults={{ dueDate: date }} />
      <ul className="list">
        {sortTasks(tasks).map((t) => <TaskItem key={t.id} task={t} areas={areas} onEdit={setEditTask} />)}
      </ul>
      {editEvent && <EventForm event={editEvent === 'new' ? undefined : editEvent} date={date} onClose={() => setEditEvent(null)} />}
      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} />}
    </aside>
  )
}

export function EventItem({ event, areas, onEdit }: { event: CalEvent; areas: Area[]; onEdit: (e: CalEvent) => void }) {
  return (
    <li className="item event-item" style={{ '--c': areaColor(areas, event.areaId) } as CSSProperties}>
      <span className="event-time">{event.start ?? 'ganztägig'}{event.end && <small>bis {event.end}</small>}</span>
      <button className="item-body" onClick={() => onEdit(event)}>
        <span className="item-title">{event.title}</span>
        <span className="item-meta">
          {event.location && <span>📍 {event.location}</span>}
          <AreaTag area={areas.find((a) => a.id === event.areaId)} />
        </span>
      </button>
    </li>
  )
}

export function EventForm({ event, date, onClose }: { event?: CalEvent; date: string; onClose: () => void }) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [d, setD] = useState(event?.date ?? date)
  const [start, setStart] = useState(event?.start ?? '')
  const [end, setEnd] = useState(event?.end ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [areaId, setAreaId] = useState(event?.areaId)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !d) return
    const data = { title: title.trim(), date: d, start: start || undefined, end: end || undefined, location: location || undefined, notes: notes || undefined, areaId }
    if (event) await db.events.update(event.id, data)
    else await db.events.add(data as CalEvent)
    onClose()
  }

  return (
    <Modal title={event ? 'Termin bearbeiten' : 'Neuer Termin'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <input autoFocus placeholder="Titel, z.B. Klausur Analysis" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="row three">
          <label>Datum<input type="date" value={d} onChange={(e) => setD(e.target.value)} required /></label>
          <label>Von<input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Bis<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <div className="row">
          <label>Ort<input placeholder="optional" value={location} onChange={(e) => setLocation(e.target.value)} /></label>
          <label>Bereich<AreaSelect value={areaId} onChange={setAreaId} /></label>
        </div>
        <label>Notizen<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="form-actions">
          {event && <button type="button" className="danger" onClick={async () => { await db.events.delete(event.id); onClose() }}>Löschen</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="primary">Speichern</button>
        </div>
      </form>
    </Modal>
  )
}
