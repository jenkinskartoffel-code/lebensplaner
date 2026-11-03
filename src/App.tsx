import { useEffect, useState } from 'react'
import { TodayView } from './views/Today'
import { AreaDetail, AreasView, ProjectDetail } from './views/Areas'
import { RoutinesView } from './views/Routines'
import { CalendarView } from './views/Calendar'
import { SettingsView } from './views/Settings'
import { SyncDot } from './sync'

const NAV = [
  { path: '/heute', label: 'Heute', icon: '☀️' },
  { path: '/bereiche', label: 'Bereiche', icon: '🗂️' },
  { path: '/kalender', label: 'Kalender', icon: '📅' },
  { path: '/routinen', label: 'Routinen', icon: '🔁' },
  { path: '/einstellungen', label: 'Mehr', icon: '⚙️' },
]

function useHashPath() {
  const read = () => window.location.hash.slice(1) || '/heute'
  const [path, setPath] = useState(read)
  useEffect(() => {
    const onChange = () => setPath(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

export default function App() {
  const path = useHashPath()
  const go = (p: string) => { window.location.hash = p; window.scrollTo(0, 0) }
  const [, section, param] = path.split('/')
  const id = param ? decodeURIComponent(param) : ''

  let view
  if (section === 'bereich' && id) view = <AreaDetail id={id} go={go} />
  else if (section === 'projekt' && id) view = <ProjectDetail id={id} go={go} />
  else if (section === 'bereiche') view = <AreasView go={go} />
  else if (section === 'kalender') view = <CalendarView />
  else if (section === 'routinen') view = <RoutinesView />
  else if (section === 'einstellungen') view = <SettingsView />
  else view = <TodayView />

  const activeNav = section === 'bereich' || section === 'projekt' ? '/bereiche' : `/${section}`

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">Lebensplaner <SyncDot /></div>
        {NAV.map((n) => (
          <a key={n.path} href={`#${n.path}`} className={activeNav === n.path ? 'active' : ''}>
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
            {n.path === '/einstellungen' && <span className="nav-sync"><SyncDot /></span>}
          </a>
        ))}
      </nav>
      <main key={path}>{view}</main>
    </div>
  )
}
