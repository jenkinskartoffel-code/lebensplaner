import { useState } from 'react'
import { exportData, importData } from '../db'
import { today } from '../utils'
import { SyncCard } from '../sync'

export function SettingsView() {
  const [msg, setMsg] = useState('')

  async function doExport() {
    const blob = new Blob([JSON.stringify(await exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lebensplaner-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Sicherung heruntergeladen.')
  }

  async function doImport(file?: File) {
    if (!file) return
    if (!confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) return
    try {
      await importData(JSON.parse(await file.text()))
      setMsg('Sicherung wiederhergestellt.')
    } catch (e) {
      setMsg(`Fehler: ${(e as Error).message}`)
    }
  }

  return (
    <div className="page">
      <header className="page-head"><h1>Einstellungen</h1></header>
      <SyncCard />
      <section className="card">
        <h2>Daten sichern</h2>
        <p className="muted-text">
          Exportiere ab und zu eine Sicherung als Datei – zusätzlich zum Cloud-Sync.
        </p>
        <div className="btn-row">
          <button className="primary" onClick={doExport}>Sicherung exportieren</button>
          <label className="button">
            Sicherung importieren
            <input type="file" accept="application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p className="muted-text">{msg}</p>}
      </section>
      <section className="card">
        <h2>Als App installieren</h2>
        <p className="muted-text">
          Am PC: im Browser auf das Installieren-Symbol in der Adressleiste klicken.
          Am Handy: im Browser-Menü „Zum Startbildschirm hinzufügen“ wählen.
        </p>
      </section>
    </div>
  )
}
