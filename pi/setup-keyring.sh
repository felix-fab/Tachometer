#!/bin/bash
# Tachometer Keyring-Setup für den Raspberry Pi
#
# Erstellt den GNOME-Standard-Keyring mit einem LEEREN Passwort, damit beim
# Kiosk-Start kein "Choose password for new keyring"-Popup mehr erscheint.
#
# Einmalig als Benutzer "pi" auf dem Desktop ausführen:
#   bash /home/pi/tachometer/pi/setup-keyring.sh
#
# Benötigt python3-secretstorage (wird bei Bedarf automatisch installiert).

set -e

echo "==> Keyring-Setup gestartet"

# 1) Sicherstellen, dass python3-secretstorage vorhanden ist.
if ! python3 -c "import secretstorage" 2>/dev/null; then
  echo "==> Installiere python3-secretstorage ..."
  sudo apt-get update
  sudo apt-get install -y python3-secretstorage
fi

# 2) Alte Keyrings entfernen, damit ein frischer mit leerem Passwort erzeugt wird.
rm -rf "$HOME/.local/share/keyrings"
mkdir -p "$HOME/.local/share/keyrings"

# 3) Python-Helfer für die Keyring-Erzeugung schreiben.
cat > /tmp/setup_keyring.py <<'PY'
import secretstorage

bus = secretstorage.dbus_init()
coll = secretstorage.get_default_collection(bus)
coll.unlock_with_password('')
# Ein Eintrag erzwingt, dass der Keyring tatsächlich auf der Platte angelegt wird.
coll.store('tachometer', 'init', 'x')
print('Keyring erfolgreich mit leerem Passwort erstellt.')
PY

# 4) Im Kontext einer eigenen DBus-Sitzung ausführen, damit der
#    gnome-keyring-daemon gestartet und erreichbar ist (funktioniert auch,
#    wenn das Skript nicht direkt auf dem Desktop, sondern z. B. per SSH
#    ausgeführt wird).
dbus-run-session -- python3 /tmp/setup_keyring.py

echo "==> Fertig. Kein Popup mehr beim Start."
