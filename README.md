# Lebensplaner

Persönliche PWA, um Lebensbereiche (Uni, Privat, …), Projekte, Aufgaben, Termine und tägliche Routinen an einem Ort zu organisieren.

- React + Vite + TypeScript, Daten in IndexedDB über [Dexie](https://dexie.org)
- Sync zwischen Geräten über Dexie Cloud (Login per E-Mail-Code), funktioniert auch offline
- Veröffentlichen auf GitHub Pages: `npm run deploy`

## Entwickeln

```bash
npm install
npm run dev
```

Die Cloud-Datenbank-URL steht in `.env` (`VITE_DEXIE_CLOUD_URL`). Ohne sie läuft die App rein lokal.
