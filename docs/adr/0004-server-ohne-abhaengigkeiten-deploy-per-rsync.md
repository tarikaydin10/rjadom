# ADR-0004 · Server ohne Abhängigkeiten, Deploy per CI-Build und rsync

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `server/index.mjs`, `deploy/`, `.github/workflows/deploy.yml`)

## Kontext

Auf dem VPS soll nichts laufen, was von einer Paket-Registry abhängt — ein
`npm install`, das um drei Uhr nachts fehlschlägt, darf die laufende App nicht
umwerfen. Und die Antworten der beiden dürfen von keinem Deploy angefasst werden.

## Entscheidung

- `server/index.mjs` ist **eine Datei ohne Abhängigkeiten** (nur Node-Bordmittel),
  hält den Store im Speicher und schreibt ihn atomar (temp + rename) als
  `answers.json` nach `DATA_DIR`.
- Gebaut wird in GitHub Actions. Auf den Server gehen nur `dist/` und diese
  eine Serverdatei — zwei `rsync`, ein Neustart. Kein `node_modules`, kein npm
  auf dem VPS.
- `DATA_DIR` (`/var/lib/ryadom`) liegt außerhalb des Deploy-Pfads
  (`/srv/ryadom/app`); die Passphrasen nur in `/etc/ryadom.env`.
- Caddy terminiert TLS und proxyt auf Loopback `:8787`; der Node-Prozess ist nie
  direkt erreichbar. Zwei Varianten (systemd bzw. Docker hinter einem
  gemeinsamen Caddy) lesen dasselbe Layout.
- Der Health-Check nach dem Deploy ist **absichtlich fatal**: `GET / → 200` und
  `GET /api/session → 401`, sonst rot. Er braucht die Repo-Variable `DOMAIN`.

## Verworfene Alternativen

- **Build auf dem Server.** Registry-Ausfall = Deploy-Ausfall = potenziell
  App-Ausfall.
- **Datenbank (SQLite, Postgres).** Für zwei Personen und ein paar KB pro Tag
  eine Abhängigkeit ohne Gegenwert. Der JSON-Store reicht — mit den in
  [TD-11](../tech-debt.md) genannten Pflichten.
- **Grüner Deploy ohne Prüfung.** „Deployed" auf Grund eines gelungenen rsync
  wäre schlimmer als rot.

## Konsequenzen

- Für Eingriffe an `answers.json` den Dienst stoppen — der Prozess überschreibt
  die Datei sonst aus dem Speicher.
- Ein Domainwechsel braucht: DNS, einen Caddy-Host-Block auf dem Server und die
  Variable `DOMAIN` in GitHub.
- Backups sind nicht Teil des Repos ([TD-11](../tech-debt.md)).
