# Architecture Decision Records

Eine Datei pro Entscheidung, nummeriert, nie umgeschrieben — eine Entscheidung,
die nicht mehr gilt, bekommt den Status *Ersetzt durch ADR-XXXX* und bleibt
stehen. So bleibt nachvollziehbar, was schon einmal versucht wurde und warum es
verworfen ist. Das ist der eigentliche Wert: die verworfenen Alternativen.

ADR-0001 bis 0007 und 0011 sind am 2026-09-05 aus Code-Kommentaren und README
rekonstruiert; die Entscheidungen selbst sind älter. 0008 bis 0010 sind an
diesem Tag gefallen.

| Nr. | Titel | Status |
|---|---|---|
| [0001](0001-ein-hostname-keine-fremd-hosts.md) | Ein Hostname, keine Fremd-Hosts zur Laufzeit | Gültig |
| [0002](0002-lokal-zuerst-outbox-sync.md) | Lokal zuerst: IndexedDB ist die Wahrheit, Sync per Outbox | Gültig |
| [0003](0003-passphrase-pro-seite-lock-in-serverseitig.md) | Passphrase pro Seite, nicht im Bundle; Lock-In serverseitig | Gültig |
| [0004](0004-server-ohne-abhaengigkeiten-deploy-per-rsync.md) | Server ohne Abhängigkeiten, Deploy per CI-Build und rsync | Gültig |
| [0005](0005-ein-gemeinsamer-kalendertag.md) | Ein gemeinsamer Kalendertag, lokale Uhren | Gültig |
| [0006](0006-bandausrichtung-und-geometrie.md) | Bandausrichtung fest, Geometrie hat einen Besitzer | Gültig |
| [0007](0007-pwa-aktualisierung.md) | PWA-Aktualisierung: prüfen bei jeder Gelegenheit, neu laden nur im Leerlauf | Gültig |
| [0008](0008-layoutmodell-dokument-scrollt-leiste-sticky.md) | Layoutmodell: Dokument scrollt, Tab-Leiste sticky, volle Breite auf dem Telefon | Gültig |
| [0009](0009-viewport-meta.md) | Viewport-Meta: cover, kein Zoom, kein resizes-content | Gültig |
| [0010](0010-ios-tastatur-viewport-bug.md) | Umgang mit dem iOS-Tastatur-Viewport-Bug | **Vorläufig — auf dem Gerät nicht bestätigt** |
| [0011](0011-sprache-russisch-englisch.md) | Sprache: Russisch und Englisch, Systemsprache entscheidet | Gültig |

## Vorlage

```markdown
# ADR-XXXX · Titel

**Status:** Vorgeschlagen | Gültig | Vorläufig | Ersetzt durch ADR-YYYY
**Datum:** JJJJ-MM-TT

## Kontext
Was war das Problem, welche Zwänge galten, was wurde gemessen.

## Entscheidung
Ein Absatz. Was gilt.

## Verworfene Alternativen
Je Alternative: was, und warum nicht — mit dem beobachteten Ergebnis, wenn es
ausprobiert wurde.

## Konsequenzen
Was dadurch einfacher ist, was dadurch nicht mehr geht, was zu beachten bleibt.
```
