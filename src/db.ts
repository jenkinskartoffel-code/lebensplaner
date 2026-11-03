import Dexie, { type EntityTable } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'

export interface Area {
  id: string
  name: string
  icon: string
  color: string
  order: number
}

export type ProjectStatus = 'aktiv' | 'pausiert' | 'erledigt'

export interface Project {
  id: string
  areaId: string
  name: string
  status: ProjectStatus
  deadline?: string // YYYY-MM-DD
  notes?: string
  createdAt: number
}

export interface Task {
  id: string
  title: string
  areaId?: string
  projectId?: string
  dueDate?: string // YYYY-MM-DD
  important: boolean
  done: 0 | 1 // number so it can be indexed
  doneAt?: number
  createdAt: number
}

export interface Routine {
  id: string
  title: string
  areaId?: string
  days: number[] // 0 = Sonntag … 6 = Samstag; leer = jeden Tag
  archived: 0 | 1
  createdAt: number
}

export interface RoutineLog {
  id: string
  routineId: string
  date: string // YYYY-MM-DD
}

export interface CalEvent {
  id: string
  title: string
  areaId?: string
  date: string // YYYY-MM-DD
  start?: string // HH:MM
  end?: string // HH:MM
  location?: string
  notes?: string
}

export const db = new Dexie('lebensplaner-sync', { addons: [dexieCloud] }) as Dexie & {
  areas: EntityTable<Area, 'id'>
  projects: EntityTable<Project, 'id'>
  tasks: EntityTable<Task, 'id'>
  routines: EntityTable<Routine, 'id'>
  routineLogs: EntityTable<RoutineLog, 'id'>
  events: EntityTable<CalEvent, 'id'>
}

// "@id" = weltweit eindeutige IDs, die Dexie Cloud generiert und synchronisiert
db.version(1).stores({
  areas: '@id, order',
  projects: '@id, areaId, status',
  tasks: '@id, areaId, projectId, dueDate, done',
  routines: '@id, areaId, archived',
  routineLogs: 'id, routineId, date', // id = routineLogId(routineId, date)
  events: '@id, areaId, date',
})

export const CLOUD_URL = import.meta.env.VITE_DEXIE_CLOUD_URL as string | undefined
if (CLOUD_URL) db.cloud.configure({ databaseUrl: CLOUD_URL, requireAuth: false })

const DEFAULT_AREAS: Area[] = [
  // "#"-IDs sind pro Nutzer eindeutig – so entstehen auf mehreren Geräten keine Duplikate
  { id: '#uni', name: 'Uni', icon: '🎓', color: '#4f7cff', order: 0 },
  { id: '#privat', name: 'Privat', icon: '🏠', color: '#2fb380', order: 1 },
  { id: '#projekte', name: 'Projekte', icon: '💡', color: '#f0a020', order: 2 },
  { id: '#gesundheit', name: 'Gesundheit', icon: '💪', color: '#e5536b', order: 3 },
]

// Nur beim allerersten Öffnen auf diesem Gerät: Standardbereiche anlegen und alte Daten übernehmen
db.on('populate', () => {
  db.on('ready', async () => {
    await db.areas.bulkPut(DEFAULT_AREAS)
    await migrateLegacy()
  })
})

/** Übernimmt Daten aus der ersten Version (lokale DB "lebensplaner" mit Zahlen-IDs). */
async function migrateLegacy() {
  if (!(await Dexie.exists('lebensplaner'))) return
  const old = new Dexie('lebensplaner')
  old.version(1).stores({
    areas: '++id', projects: '++id', tasks: '++id', routines: '++id', routineLogs: '++id', events: '++id',
  })
  const strip = <T extends { id?: unknown }>({ id: _, ...rest }: T) => rest
  const areaMap = new Map<number, string>()
  const projectMap = new Map<number, string>()
  const routineMap = new Map<number, string>()
  const mapped = (m: Map<number, string>, id?: number) => (id == null ? undefined : m.get(id))

  for (const a of await old.table('areas').toArray()) {
    const same = await db.areas.filter((x) => x.name === a.name).first()
    areaMap.set(a.id, same ? same.id : await db.areas.add(strip(a) as Area))
  }
  for (const p of await old.table('projects').toArray()) {
    projectMap.set(p.id, await db.projects.add({ ...strip(p), areaId: mapped(areaMap, p.areaId) } as Project))
  }
  for (const r of await old.table('routines').toArray()) {
    routineMap.set(r.id, await db.routines.add({ ...strip(r), areaId: mapped(areaMap, r.areaId) } as Routine))
  }
  await db.tasks.bulkAdd((await old.table('tasks').toArray()).map((t) => ({
    ...strip(t), areaId: mapped(areaMap, t.areaId), projectId: mapped(projectMap, t.projectId),
  }) as Task))
  await db.events.bulkAdd((await old.table('events').toArray()).map((e) => ({ ...strip(e), areaId: mapped(areaMap, e.areaId) }) as CalEvent))
  await db.routineLogs.bulkPut((await old.table('routineLogs').toArray()).flatMap((l) => {
    const routineId = routineMap.get(l.routineId)
    return routineId ? [{ id: routineLogId(routineId, l.date), routineId, date: l.date }] : []
  }))
  old.close()
  await Dexie.delete('lebensplaner')
}

export const routineLogId = (routineId: string, date: string) => `${routineId}|${date}`

export const AREA_COLORS = ['#4f7cff', '#2fb380', '#f0a020', '#e5536b', '#9b6bff', '#18a8c4', '#d46bc4', '#7a8794']

export async function deleteArea(id: string) {
  await db.transaction('rw', [db.areas, db.projects, db.tasks, db.routines, db.events], async () => {
    const projectIds = await db.projects.where('areaId').equals(id).primaryKeys()
    await db.tasks.where('projectId').anyOf(projectIds).delete()
    await db.projects.where('areaId').equals(id).delete()
    await db.tasks.where('areaId').equals(id).delete()
    // Routinen und Termine bleiben erhalten, verlieren nur die Zuordnung
    await db.routines.where('areaId').equals(id).modify({ areaId: undefined })
    await db.events.where('areaId').equals(id).modify({ areaId: undefined })
    await db.areas.delete(id)
  })
}

export async function deleteProject(id: string) {
  await db.transaction('rw', [db.projects, db.tasks], async () => {
    await db.tasks.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}

export async function deleteRoutine(id: string) {
  await db.transaction('rw', [db.routines, db.routineLogs], async () => {
    await db.routineLogs.where('routineId').equals(id).delete()
    await db.routines.delete(id)
  })
}

export async function toggleTask(task: Task) {
  await db.tasks.update(task.id, task.done ? { done: 0, doneAt: undefined } : { done: 1, doneAt: Date.now() })
}

export async function toggleRoutine(routineId: string, date: string) {
  const id = routineLogId(routineId, date)
  if (await db.routineLogs.get(id)) await db.routineLogs.delete(id)
  else await db.routineLogs.put({ id, routineId, date })
}

const TABLES = ['areas', 'projects', 'tasks', 'routines', 'routineLogs', 'events'] as const

export async function exportData() {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  return { app: 'lebensplaner', version: 2, exportedAt: new Date().toISOString(), data }
}

export async function importData(json: { app?: string; data?: Record<string, unknown[]> }) {
  if (json.app !== 'lebensplaner' || !json.data) throw new Error('Keine gültige Lebensplaner-Sicherung')
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      // Sync-Felder des alten Kontos verwerfen, damit die Daten dem aktuellen Nutzer gehören
      const rows = (json.data![t] ?? []).map((r) => {
        const { realmId: _r, owner: _o, $ts: _t, ...rest } = r as Record<string, unknown>
        return rest
      })
      await db.table(t).bulkPut(rows)
    }
  })
}
