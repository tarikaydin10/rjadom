#!/usr/bin/env bash
# Alle Antworten auf dem Server löschen, die Einstellungen (Namen, Reise-Datum)
# behalten. Für den Livegang nach einer Testphase.
#
#   sudo bash deploy/reset-answers.sh          # fragt einmal nach
#   sudo bash deploy/reset-answers.sh --yes    # fragt nicht
#
# Auf dem Server ausführen, als root: Variante A (systemd) und B (Docker) aus
# deploy/README.md werden erkannt. Der Prozess hält den Store im Speicher und
# schreibt ihn bei jeder Änderung zurück — deshalb wird er für den Eingriff
# gestoppt und danach wieder gestartet. Vorher liegt ein Backup mit Zeitstempel
# neben der Datei.
#
# Was das nicht tut: die lokalen Kopien auf den Telefonen löschen. Der Sync
# kennt kein Löschen (docs/tech-debt.md, TD-06) — nach dem Reset die PWA auf
# beiden Geräten entfernen und neu hinzufügen, sonst zeigen sie die alten
# Antworten weiter an.
set -euo pipefail

FILE="${DATA_FILE:-/var/lib/ryadom/answers.json}"

if systemctl is-active --quiet ryadom 2>/dev/null; then
  STOP="systemctl stop ryadom"; START="systemctl start ryadom"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx ryadom; then
  STOP="docker stop ryadom"; START="docker start ryadom"
else
  echo "Ryadom läuft weder als systemd-Dienst noch als Container." >&2
  exit 1
fi

[ -f "$FILE" ] || { echo "Keine Datei unter $FILE." >&2; exit 1; }

# Node ist in Variante A auf dem Host, in Variante B nur im Container.
if command -v node >/dev/null; then
  list()  { node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(Object.keys(s.days||{}).join(" ")||"(keine)")' "$FILE"; }
  reset() { node -e 'const fs=require("fs"),f=process.argv[1];const s=JSON.parse(fs.readFileSync(f,"utf8"));s.days={};fs.writeFileSync(f,JSON.stringify(s,null,2))' "$FILE"; }
elif command -v python3 >/dev/null; then
  list()  { python3 -c 'import json,sys;s=json.load(open(sys.argv[1]));print(" ".join(s.get("days",{})) or "(keine)")' "$FILE"; }
  reset() { python3 -c 'import json,sys;f=sys.argv[1];s=json.load(open(f));s["days"]={};json.dump(s,open(f,"w"),indent=2,ensure_ascii=False)' "$FILE"; }
else
  echo "Weder node noch python3 auf dem Host — nichts, womit sich JSON bearbeiten ließe." >&2
  exit 1
fi

echo "Tage mit Antworten: $(list)"
if [ "${1:-}" != "--yes" ]; then
  read -r -p "Alle Antworten löschen, Einstellungen behalten? [j/N] " answer
  case "$answer" in j|J) ;; *) echo "Abgebrochen."; exit 0 ;; esac
fi

$STOP
cp "$FILE" "$FILE.backup-$(date +%F-%H%M)"
reset
$START

sleep 2
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/api/session || true)
echo "Antworten gelöscht, Backup liegt daneben. Server antwortet $code (401 = läuft, Schloss zu)."
