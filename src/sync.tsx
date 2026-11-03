import { useObservable } from 'dexie-react-hooks'
import { CLOUD_URL, db } from './db'

const PHASES: Record<string, string> = {
  initial: 'Verbinde …',
  'not-in-sync': 'Wartet auf Sync',
  pushing: 'Sende Änderungen …',
  pulling: 'Lade Änderungen …',
  'in-sync': 'Synchronisiert',
  error: 'Sync-Fehler',
  offline: 'Offline – wird später synchronisiert',
}

export function useSync() {
  const user = useObservable(db.cloud.currentUser)
  const state = useObservable(db.cloud.syncState)
  const loggedIn = !!CLOUD_URL && !!user?.isLoggedIn
  return { enabled: !!CLOUD_URL, loggedIn, user, state, label: state ? PHASES[state.phase] ?? state.phase : '' }
}

/** Kleiner Punkt in der Navigation: grün = synchron, gelb = läuft, rot = Fehler, grau = nicht angemeldet. */
export function SyncDot() {
  const { enabled, loggedIn, state, label } = useSync()
  if (!enabled) return null
  const cls = !loggedIn ? 'off' : state?.phase === 'in-sync' ? 'ok' : state?.phase === 'error' ? 'err' : 'busy'
  return <span className={`sync-dot ${cls}`} title={loggedIn ? label : 'Nicht angemeldet – Daten nur auf diesem Gerät'} />
}

export function SyncCard() {
  const { enabled, loggedIn, user, state, label } = useSync()
  if (!enabled) {
    return (
      <section className="card">
        <h2>Synchronisierung</h2>
        <p className="muted-text">In dieser Version ist kein Cloud-Sync eingerichtet.</p>
      </section>
    )
  }
  return (
    <section className="card">
      <h2>Synchronisierung</h2>
      {loggedIn ? (
        <>
          <p className="muted-text">Angemeldet als <b>{user?.email ?? user?.userId}</b> · {label}</p>
          {state?.phase === 'error' && <p className="overdue">{state.error?.message}</p>}
          <div className="btn-row">
            <button onClick={() => db.cloud.sync()}>Jetzt synchronisieren</button>
            <button className="ghost" onClick={() => db.cloud.logout()}>Abmelden</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted-text">
            Melde dich auf jedem Gerät mit derselben E-Mail an – dann sind deine Daten überall gleich.
            Du bekommst einen Code per Mail, kein Passwort nötig. Was du bisher auf diesem Gerät eingetragen hast, wird übernommen.
          </p>
          <div className="btn-row">
            <button className="primary" onClick={() => db.cloud.login()}>Anmelden &amp; synchronisieren</button>
          </div>
        </>
      )}
    </section>
  )
}
