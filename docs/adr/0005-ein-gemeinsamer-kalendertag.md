# ADR-0005 · Ein gemeinsamer Kalendertag, lokale Uhren

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `src/lib/day.ts`, README §4)

## Kontext

Hamburg und Kaliningrad liegen im Winter eine Stunde auseinander. Mit einem
naiven lokalen Datum säßen die beiden abends auf verschiedenen Fragen — und
der Lock-In (ADR-0003) hinge an zwei verschiedenen Tagesschlüsseln.

## Entscheidung

Das Paar hat **eine** kanonische Zeitzone für Tagesgrenzen: `PAIR_TIMEZONE`
(`Europe/Berlin`). `dateKey()` leitet daraus den Schlüssel `JJJJ-MM-TT` ab, den
Fragenkatalog, Antworten, Server-Routen und Countdown gemeinsam verwenden.
Uhren, Sonnenstände und Wetter bleiben strikt lokal je Stadt — nur der Kalender
ist gemeinsam.

## Verworfene Alternativen

- **Lokales Datum je Gerät.** Verschiedene Fragen, kaputter Lock-In an der
  Tagesgrenze.
- **UTC.** Die Tagesgrenze läge für beide mitten im Abend; „heute" fühlte sich
  falsch an.

## Konsequenzen

- Zwischen 23:00 und 24:00 Kaliningrader Zeit (Winter) ist „heute" noch der
  Berliner Tag. Das ist gewollt und in den Statuszeilen nicht sichtbar.
- Änderungen an `PAIR_TIMEZONE` ändern rückwirkend die Schlüssel — nicht ohne
  Migration anfassen.
