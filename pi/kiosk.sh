#!/bin/bash
# Tachometer Kiosk-Skript für den Raspberry Pi
# Startet Chromium im Vollbild-/Kiosk-Modus und blendet den Cursor aus.
# Aufruf: dieser Pfad wird in der Autostart-Desktop-Datei oder als systemd-Service referenziert.

export DISPLAY=:0

DASHBOARD_URL="${1:-http://localhost:3001/}"

# Cursor nach 0.5s Inaktivität ausblenden
unclutter -idle 0.5 -root &

# Kurz warten, bis der Desktop/Display bereit ist
sleep 8

# Chromium im Kiosk-Modus starten; bei Absturz automatisch neu starten
while true; do
  /usr/bin/chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --check-for-update-interval=31536000 \
    --touch-events=enabled \
    --enable-pinch \
    --overscroll-history-navigation=0 \
    "$DASHBOARD_URL"
  echo "Chromium beendet, Neustart in 5s..."
  sleep 5
done
