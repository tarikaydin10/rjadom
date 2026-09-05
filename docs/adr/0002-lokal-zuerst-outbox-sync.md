# ADR-0002 · Lokal zuerst: IndexedDB ist die Wahrheit, Sync per Outbox

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `src/data/db.ts`, `src/data/sync.ts`, README §4)

## Kontext

Verbindungen sind unzuverlässig — im Zug, im Flugzeug, in Kaliningrad. Eine
App, die ohne Server nicht öffnet oder eine Antwort verliert, weil der Request
gerade nicht durchging, wäre für diesen Zweck unbrauchbar.

## Entscheidung

Die lokale Datenbank (IndexedDB über `idb`) ist die Quelle der Wahrheit, nicht
ein Cache des Servers. Jede Antwort landet sofort dort und ist sofort sichtbar.
Parallel geht sie in eine **Outbox**; `sync.ts` leert sie beim Start, bei
`online`, beim Zurückwechseln in die App und alle fünf Minuten. Danach zieht
der Sync heute und gestern vom Server (`activeDates`) und die gemeinsamen
Einstellungen. Konflikte: *last write wins* über `updatedAt` — und da jede
Seite nur ihren eigenen Eintrag schreibt, entscheidet das nur zwischen zwei
Geräten derselben Person.

Wetter wird für sieben Tage stündlich vorgeladen; ein fehlgeschlagener Abruf
löscht nie vorhandene Daten. Sonne und Mond werden lokal berechnet (SunCalc),
da gibt es nichts vorzuladen — nur `prefetchDays` baut die Tagestabellen im
Leerlauf vor, damit kein Frame stockt.

## Verworfene Alternativen

- **Server als Wahrheit, Client als Cache.** Offline nicht bedienbar; jede
  Antwort hinge am Request.
- **Optimistic UI ohne persistente Outbox.** Ein Reload oder ein Absturz
  während einer Funkloch-Fahrt verlöre die Antwort.

## Konsequenzen

- Das Protokoll kennt **kein Löschen**: der Sync übernimmt nur, was der
  Server *hat*. Wird serverseitig etwas entfernt, bleibt die lokale Kopie
  stehen ([TD-06](../tech-debt.md)).
- Eine Antwort ist erst dann „bei ihr angekommen", wenn `syncedAt` gesetzt ist.
  Die Statuszeile sagt, wenn etwas wartet.
- `db.ts` ist die einzige Stelle mit Schema; Schemaänderungen brauchen eine
  Versionsmigration in `openDB`.
