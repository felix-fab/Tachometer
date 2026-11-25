# Tachometer Dashboard – Raspberry Pi

Touch-optimiertes Dashboard für den Raspberry Pi: Uhr, Vikunja-Aufgaben und ein
zusammengeführter Terminkalender (Google Kalender). Öffnet sich
beim Boot automatisch im Browser (Chromium Kiosk-Modus).

## Struktur

- `client/` – React (Vite + TypeScript) Frontend
- `server/` – Node/Express Backend (OAuth-Token-Verwaltung, API)
- `pi/` – Raspberry-Pi-Deployment-Skripte (Kiosk, Autostart, systemd)

## Lokale Entwicklung

Voraussetzungen: Node.js 18+ und npm.

```bash
# Abhängigkeiten aller Workspaces installieren
npm install

# Server (Backend) auf Port 3001 starten
npm run dev:server

# Client (Frontend) auf Port 5173 starten (Proxy zu :3001)
npm run dev:client
```

Öffne `http://localhost:5173/` für das Dashboard und `http://localhost:5173/#/settings`
für die Einstellungen.

### Produktions-Build

```bash
npm run build        # baut das Frontend nach client/dist
npm start            # Server liefert Frontend + API auf Port 3001
```

Der Express-Server liefert dann das gebaute Frontend selbst aus – ideal für den Pi.

## Konfiguration

Alle Secrets liegen **nur im Backend** (`server/.env`, siehe `server/.env.example`).
Tokens werden in einer lokalen SQLite-Datenbank gespeichert, nie im Browser.

### 1. Google Kalender

1. Öffne [Google Cloud Console](https://console.cloud.google.com/) und erstelle ein Projekt.
2. Aktiviere die **Google Calendar API**.
3. Erstelle unter **APIs & Dienste → Anmeldedaten** eine **OAuth-Client-ID** (Web-App).
4. Trage als autorisierte Weiterleitungs-URI ein:
   `http://localhost:3001/api/auth/google/callback`
5. Kopiere Client-ID und Secret in `server/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
   ```
6. In der Einstellungsseite im Dashboard unter **Kalender → "Mit Google verbinden"**.

### 2. Vikunja-Aufgaben

1. In deiner Vikunja-Instanz einen **API-Token** erstellen (Profil → API-Tokens).
2. Basis-URL und Token in `server/.env` eintragen:
   ```
   VIKUNJA_URL=https://vikunja.example.com
   VIKUNJA_TOKEN=...
   ```
3. Das Vikunja-Widget zeigt die 5 Tasks, die am frühesten fällig werden (mit dem
   jeweiligen Bereich). Sind weniger als 5 mit Fälligkeit vorhanden, werden Tasks
   ohne Fälligkeit ergänzt.

## Raspberry Pi Deployment (Kiosk-Modus)

1. Projekt auf den Pi kopieren, z. B. nach `/home/felixfab/Documents/Tachometer`.
   > **Hinweis:** Die Pfade in `pi/tachometer.service`, `pi/autostart.desktop` und
   > `pi/kiosk.sh` müssen zum tatsächlichen Projektpfad und Benutzernamen passen.
   > Bei anderem Speicherort alle Vorkommen von `/home/felixfab/Documents/Tachometer`
   > und `User=felixfab` ersetzen.
2. `server/.env` mit den OAuth-Credentials befüllen.
3. Backend als systemd-Service einrichten:
   ```bash
   sudo cp pi/tachometer.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now tachometer
   ```
4. Kiosk-Autostart:
   ```bash
   # Chromium + unclutter installieren
   sudo apt update && sudo apt install -y chromium unclutter
   # Desktop-Datei in den Autostart-Ordner kopieren
   mkdir -p ~/.config/autostart
   cp pi/autostart.desktop ~/.config/autostart/
   chmod +x pi/kiosk.sh
   ```
5. Neu starten: `sudo reboot`

Nach dem Boot öffnet sich Chromium automatisch im Vollbild auf dem Dashboard.

## API-Übersicht

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/health` | Health-Check |
| GET | `/api/calendar` | Kommende Google-Termine |
| GET | `/api/vikunja/tasks` | Die 5 am frühesten fälligen Vikunja-Tasks |
| GET | `/api/vikunja/configured` | Prüft, ob Vikunja konfiguriert ist |
| GET/PUT | `/api/widgets` / `/api/widgets/:id` | Widgets lesen/aktualisieren |
| GET/PUT | `/api/settings` | Einstellungen lesen/aktualisieren |
| GET | `/api/auth/status` | OAuth-Status des Google-Providers |
| GET | `/api/auth/google/start` | Google-OAuth starten |
| POST | `/api/auth/:provider/disconnect` | Provider trennen |
