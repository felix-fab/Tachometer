#!/bin/bash
# Tachometer Update-Skript für den Raspberry Pi
# Nach einem `git pull` muss der Client neu gebaut und der Server neu gestartet
# werden, damit die neue Webseite angezeigt wird. Dieses Skript erledigt das.
#
# Aufruf:  bash /home/pi/tachometer/pi/update.sh

set -e

APP_DIR="/home/pi/tachometer"
SERVICE="tachometer"

echo "==> Tachometer Update gestartet"

# 1) Ins Projektverzeichnis wechseln
cd "$APP_DIR"
echo "==> Verzeichnis: $(pwd)"

# 2) Aktuelle Änderungen vom Repository holen
echo "==> git pull"
git pull

# 3) Abhängigkeiten installieren/aktualisieren
echo "==> npm install"
npm install

# 4) Frontend neu bauen (erzeugt client/dist mit dem neuen Code)
echo "==> npm run build"
npm run build

# 5) Server-Dienst neu starten, damit der neue Build ausgeliefert wird
echo "==> systemctl restart $SERVICE"
sudo systemctl restart "$SERVICE"

# 6) Warten, bis der Server wieder antwortet
echo "==> Warte auf Server..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:3001/api/health" > /dev/null; then
    echo "==> Server läuft wieder."
    break
  fi
  sleep 1
done

echo "==> Fertig. Seite ggf. im Browser neu laden (Strg+F5), um den Cache zu leeren."
