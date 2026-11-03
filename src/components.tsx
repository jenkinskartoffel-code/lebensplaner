import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, toggleTask, type Area, type Task } from './db'
import { relativeDate, today } from './utils'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function useAreas() {
  return useLiveQuery(() => db.areas.orderBy('order').toArray(), []) ?? []
}

export function AreaSelect({ value, onChange, allowNone = true }: { value?: string; onChange: (id?: string) => void; allowNone?: boolean }) {
  const areas = useAreas()
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      {allowNone && <option value="">Kein Bereich</option>}
      {areas.map((a) => (
        <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
      ))}
    </select>
  )
}

export function AreaTag({ area }: { area?: Area }) {
  if (!area) return null
  return (
    <span className="tag" style={{ '--c': area.color } as CSSProperties}>
      {area.icon} {area.name}
    </span>
  )
}

export function TaskItem({ task, areas, onEdit, showArea = true }: { task: Task; areas: Area[]; onEdit: (t: Task) => void; showArea?: boolean }) {
  const overdue = !task.done && task.dueDate && task.dueDate < today()
  const area = areas.find((a) => a.id === task.areaId)
  return (
    <li className={`item ${task.done ? 'done' : ''}`}>
      <button className={`check ${task.done ? 'on' : ''}`} onClick={() => toggleTask(task)} aria-label={task.done ? 'Als offen markieren' : 'Erledigen'}>
        {task.done ? '✓' : ''}
      </button>
      <button className="item-body" onClick={() => onEdit(task)}>
        <span className="item-title">
          {task.important && <span className="star">★</span>}
          {task.title}
        </span>
        <span className="item-meta">
          {task.dueDate && <span className={overdue ? 'overdue' : ''}>📅 {relativeDate(task.dueDate)}</span>}
          {showArea && <AreaTag area={area} />}
        </span>
      </button>
    </li>
  )
}

/** Formular zum Anlegen und Bearbeiten einer Aufgabe. */
export function TaskForm({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const init = task ?? defaults ?? {}
  const [title, setTitle] = useState(init.title ?? '')
  const [areaId, setAreaId] = useState(init.areaId)
  const [projectId, setProjectId] = useState(init.projectId)
  const [dueDate, setDueDate] = useState(init.dueDate ?? '')
  const [important, setImportant] = useState(init.important ?? false)
  const projects = useLiveQuery(
    () => (areaId ? db.projects.where('areaId').equals(areaId).filter((p) => p.status !== 'erledigt').toArray() : []),
    [areaId],
  ) ?? []

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const data = { title: title.trim(), areaId, projectId: areaId ? projectId : undefined, dueDate: dueDate || undefined, important }
    if (task) await db.tasks.update(task.id, data)
    else await db.tasks.add({ ...data, done: 0, createdAt: Date.now() } as Task)
    onClose()
  }

  return (
    <Modal title={task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <input autoFocus placeholder="Was ist zu tun?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="row">
          <label>Bereich<AreaSelect value={areaId} onChange={(id) => { setAreaId(id); setProjectId(undefined) }} /></label>
          <label>Projekt
            <select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value || undefined)} disabled={!areaId}>
              <option value="">Kein Projekt</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <div className="row">
          <label>Fällig am<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          <label className="inline"><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /> Wichtig</label>
        </div>
        <div className="form-actions">
          {task && <button type="button" className="danger" onClick={async () => { await db.tasks.delete(task.id); onClose() }}>Löschen</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="primary">Speichern</button>
        </div>
      </form>
    </Modal>
  )
}

/** Einzeiliges Feld, um schnell eine Aufgabe hinzuzufügen. */
export function QuickAdd({ defaults, placeholder = 'Aufgabe hinzufügen …' }: { defaults?: Partial<Task>; placeholder?: string }) {
  const [title, setTitle] = useState('')
  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await db.tasks.add({ important: false, ...defaults, title: title.trim(), done: 0, createdAt: Date.now() } as Task)
    setTitle('')
  }
  return (
    <form onSubmit={add} className="quick-add">
      <span>＋</span>
      <input placeholder={placeholder} value={title} onChange={(e) => setTitle(e.target.value)} />
    </form>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) =>
      a.done - b.done ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      Number(b.important) - Number(a.important) ||
      a.createdAt - b.createdAt,
  )
}
