import { useState, type CSSProperties, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREA_COLORS, db, deleteArea, deleteProject, type Area, type Project, type ProjectStatus, type Task } from '../db'
import { AreaTag, Empty, Modal, QuickAdd, TaskForm, TaskItem, sortTasks, useAreas } from '../components'
import { formatDate, relativeDate, today } from '../utils'

const ICONS = ['🎓', '🏠', '💡', '💪', '💼', '🎨', '🎮', '🎵', '📚', '✈️', '💰', '❤️', '🌱', '🧘', '🛠️', '⚽']

export function AreasView({ go }: { go: (path: string) => void }) {
  const areas = useAreas()
  const stats = useLiveQuery(async () => {
    const [tasks, projects] = await Promise.all([db.tasks.where('done').equals(0).toArray(), db.projects.where('status').equals('aktiv').toArray()])
    const m = new Map<string, { open: number; projects: number }>()
    for (const t of tasks) if (t.areaId) m.set(t.areaId, { open: (m.get(t.areaId)?.open ?? 0) + 1, projects: m.get(t.areaId)?.projects ?? 0 })
    for (const p of projects) m.set(p.areaId, { open: m.get(p.areaId)?.open ?? 0, projects: (m.get(p.areaId)?.projects ?? 0) + 1 })
    return m
  }, []) ?? new Map()
  const [editing, setEditing] = useState<Area | 'new' | null>(null)

  return (
    <div className="page">
      <header className="page-head">
        <h1>Lebensbereiche</h1>
        <button className="primary" onClick={() => setEditing('new')}>＋ Bereich</button>
      </header>
      <div className="area-grid">
        {areas.map((a) => (
          <button key={a.id} className="area-card" style={{ '--c': a.color } as CSSProperties} onClick={() => go(`/bereich/${encodeURIComponent(a.id)}`)}>
            <span className="area-icon">{a.icon}</span>
            <span className="area-name">{a.name}</span>
            <span className="area-stats">
              {stats.get(a.id)?.projects ?? 0} Projekte · {stats.get(a.id)?.open ?? 0} offen
            </span>
          </button>
        ))}
      </div>
      {areas.length === 0 && <Empty>Lege deinen ersten Lebensbereich an, z.B. Uni oder Privat.</Empty>}
      {editing && <AreaForm area={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AreaForm({ area, onClose, onDeleted }: { area?: Area; onClose: () => void; onDeleted?: () => void }) {
  const [name, setName] = useState(area?.name ?? '')
  const [icon, setIcon] = useState(area?.icon ?? ICONS[0])
  const [color, setColor] = useState(area?.color ?? AREA_COLORS[0])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (area) await db.areas.update(area.id, { name: name.trim(), icon, color })
    else await db.areas.add({ name: name.trim(), icon, color, order: (await db.areas.count()) } as Area)
    onClose()
  }

  async function remove() {
    if (!area || !confirm(`Bereich „${area.name}“ mit allen Projekten und Aufgaben löschen?`)) return
    await deleteArea(area.id)
    onClose()
    onDeleted?.()
  }

  return (
    <Modal title={area ? 'Bereich bearbeiten' : 'Neuer Bereich'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <input autoFocus placeholder="Name, z.B. Uni" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="picker">
          {ICONS.map((i) => (
            <button type="button" key={i} className={i === icon ? 'sel' : ''} onClick={() => setIcon(i)}>{i}</button>
          ))}
        </div>
        <div className="picker">
          {AREA_COLORS.map((c) => (
            <button type="button" key={c} className={`swatch ${c === color ? 'sel' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
        <div className="form-actions">
          {area && <button type="button" className="danger" onClick={remove}>Löschen</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="primary">Speichern</button>
        </div>
      </form>
    </Modal>
  )
}

export function AreaDetail({ id, go }: { id: string; go: (path: string) => void }) {
  const areas = useAreas()
  const area = areas.find((a) => a.id === id)
  const projects = useLiveQuery(() => db.projects.where('areaId').equals(id).toArray(), [id]) ?? []
  const tasks = useLiveQuery(() => db.tasks.where('areaId').equals(id).toArray(), [id]) ?? []
  const events = useLiveQuery(() => db.events.where('date').aboveOrEqual(today()).filter((e) => e.areaId === id).limit(5).sortBy('date'), [id]) ?? []
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editArea, setEditArea] = useState(false)
  const [editProject, setEditProject] = useState<Project | 'new' | null>(null)
  const [showDone, setShowDone] = useState(false)

  if (!area) return <div className="page"><Empty>Bereich nicht gefunden.</Empty></div>

  const looseTasks = sortTasks(tasks.filter((t) => !t.projectId && (showDone || !t.done)))
  const doneCount = tasks.filter((t) => !t.projectId && t.done).length
  const progress = (pid: string) => {
    const pt = tasks.filter((t) => t.projectId === pid)
    return { done: pt.filter((t) => t.done).length, total: pt.length }
  }
  const order: ProjectStatus[] = ['aktiv', 'pausiert', 'erledigt']
  const sortedProjects = [...projects].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (a.deadline ?? '9').localeCompare(b.deadline ?? '9'))

  return (
    <div className="page" style={{ '--c': area.color } as CSSProperties}>
      <button className="back" onClick={() => go('/bereiche')}>← Bereiche</button>
      <header className="page-head">
        <h1><span className="area-dot">{area.icon}</span> {area.name}</h1>
        <button onClick={() => setEditArea(true)}>Bearbeiten</button>
      </header>

      <section>
        <div className="section-head">
          <h2>Projekte</h2>
          <button className="small" onClick={() => setEditProject('new')}>＋ Projekt</button>
        </div>
        {sortedProjects.length === 0 && <Empty>Noch keine Projekte. Projekte bündeln Aufgaben zu einem Ziel, z.B. „Hausarbeit Statistik“.</Empty>}
        <div className="project-list">
          {sortedProjects.map((p) => {
            const pr = progress(p.id)
            return (
              <button key={p.id} className={`project-card status-${p.status}`} onClick={() => go(`/projekt/${encodeURIComponent(p.id)}`)}>
                <span className="project-name">{p.name}</span>
                <span className="item-meta">
                  {p.status !== 'aktiv' && <span className="tag muted">{p.status}</span>}
                  {p.deadline && <span className={p.deadline < today() && p.status === 'aktiv' ? 'overdue' : ''}>⏳ {formatDate(p.deadline)}</span>}
                  <span>{pr.done}/{pr.total} Aufgaben</span>
                </span>
                <span className="bar"><span style={{ width: pr.total ? `${(pr.done / pr.total) * 100}%` : 0 }} /></span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Aufgaben</h2>
          {doneCount > 0 && <button className="small ghost" onClick={() => setShowDone(!showDone)}>{showDone ? 'Erledigte ausblenden' : `${doneCount} erledigte zeigen`}</button>}
        </div>
        <QuickAdd defaults={{ areaId: id }} />
        <ul className="list">
          {looseTasks.map((t) => <TaskItem key={t.id} task={t} areas={areas} onEdit={setEditTask} showArea={false} />)}
        </ul>
      </section>

      {events.length > 0 && (
        <section>
          <h2>Nächste Termine</h2>
          <ul className="list">
            {events.map((e) => (
              <li key={e.id} className="item event-item">
                <span className="event-time">{relativeDate(e.date)}{e.start && <small>{e.start}</small>}</span>
                <span className="item-title">{e.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} />}
      {editArea && <AreaForm area={area} onClose={() => setEditArea(false)} onDeleted={() => go('/bereiche')} />}
      {editProject && <ProjectForm project={editProject === 'new' ? undefined : editProject} areaId={id} onClose={() => setEditProject(null)} />}
    </div>
  )
}

function ProjectForm({ project, areaId, onClose, onDeleted }: { project?: Project; areaId: string; onClose: () => void; onDeleted?: () => void }) {
  const [name, setName] = useState(project?.name ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'aktiv')
  const [deadline, setDeadline] = useState(project?.deadline ?? '')
  const [notes, setNotes] = useState(project?.notes ?? '')
  const [area, setArea] = useState(project?.areaId ?? areaId)
  const areas = useAreas()

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const data = { name: name.trim(), status, deadline: deadline || undefined, notes: notes || undefined, areaId: area }
    if (project) {
      await db.transaction('rw', [db.projects, db.tasks], async () => {
        await db.projects.update(project.id, data)
        await db.tasks.where('projectId').equals(project.id).modify({ areaId: area })
      })
    } else await db.projects.add({ ...data, createdAt: Date.now() } as Project)
    onClose()
  }

  async function remove() {
    if (!project || !confirm(`Projekt „${project.name}“ mit allen Aufgaben löschen?`)) return
    await deleteProject(project.id)
    onClose()
    onDeleted?.()
  }

  return (
    <Modal title={project ? 'Projekt bearbeiten' : 'Neues Projekt'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <input autoFocus placeholder="Projektname" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row">
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              <option value="aktiv">Aktiv</option>
              <option value="pausiert">Pausiert</option>
              <option value="erledigt">Erledigt</option>
            </select>
          </label>
          <label>Deadline<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        </div>
        {project && (
          <label>Bereich
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          </label>
        )}
        <label>Notizen<textarea rows={4} placeholder="Ziele, Links, Gedanken …" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="form-actions">
          {project && <button type="button" className="danger" onClick={remove}>Löschen</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="primary">Speichern</button>
        </div>
      </form>
    </Modal>
  )
}

export function ProjectDetail({ id, go }: { id: string; go: (path: string) => void }) {
  const areas = useAreas()
  const project = useLiveQuery(() => db.projects.get(id), [id])
  const tasks = useLiveQuery(() => db.tasks.where('projectId').equals(id).toArray(), [id]) ?? []
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editing, setEditing] = useState(false)

  if (!project) return <div className="page"><Empty>Projekt wird geladen …</Empty></div>
  const area = areas.find((a) => a.id === project.areaId)
  const done = tasks.filter((t) => t.done).length

  return (
    <div className="page" style={{ '--c': area?.color } as CSSProperties}>
      <button className="back" onClick={() => go(`/bereich/${encodeURIComponent(project.areaId)}`)}>← {area?.name ?? 'Zurück'}</button>
      <header className="page-head">
        <h1>{project.name}</h1>
        <button onClick={() => setEditing(true)}>Bearbeiten</button>
      </header>
      <div className="item-meta big">
        <AreaTag area={area} />
        <span className="tag muted">{project.status}</span>
        {project.deadline && <span>⏳ Deadline {formatDate(project.deadline, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>}
      </div>
      <div className="bar big"><span style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : 0 }} /></div>
      <p className="muted-text">{done} von {tasks.length} Aufgaben erledigt</p>
      {project.notes && <p className="notes">{project.notes}</p>}

      <section>
        <h2>Aufgaben</h2>
        <QuickAdd defaults={{ areaId: project.areaId, projectId: id }} />
        <ul className="list">
          {sortTasks(tasks).map((t) => <TaskItem key={t.id} task={t} areas={areas} onEdit={setEditTask} showArea={false} />)}
        </ul>
      </section>

      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} />}
      {editing && <ProjectForm project={project} areaId={project.areaId} onClose={() => setEditing(false)} onDeleted={() => go(`/bereich/${encodeURIComponent(project.areaId)}`)} />}
    </div>
  )
}
