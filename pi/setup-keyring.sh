#!/bin/bash
# Tachometer Keyring-Setup für den Raspberry Pi
#
# Erstellt den GNOME-Standard-Keyring mit einem LEEREN Passwort, damit beim
# Kiosk-Start kein "Choose password for new keyring"-Popup mehr erscheint.
#
# Einmalig als Benutzer "pi" auf dem Desktop ausführen:
#   bash /home/pi/tachometer/pi/setup-keyring.sh
#
# Voraussetzung: python3-secretstorage (unter Raspberry Pi OS standardmäßig
# installiert:  sudo apt install python3-secretstorage)

set -e

export DISPLAY=:0

echo "==> Keyring-Setup gestartet"

# Alte Keyrings entfernen, damit ein frischer mit leerem Passwort erzeugt wird.
rm -rf "$HOME/.local/share/keyrings"
mkdir -p "$HOME/.local/share/keyrings"

# Standard-Keyring mit leerem Passwort erzeugen und persistieren.
python3 - <<'PY'
import secretstorage

bus = secretstorage.dbus_init()
coll = secretstorage.get_default_collection(bus)
coll.unlock_with_password('')
# Ein Eintrag erzwingt, dass der Keyring tatsächlich auf der Platte angelegt wird.
coll.store('tachometer', 'init', 'x')
PY

echo "==> Keyring mit leerem Passwort erstellt. Kein Popup mehr beim Start."
