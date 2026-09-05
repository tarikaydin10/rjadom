# CLAUDE.md — Ryadom · Рядом

Arbeitsanweisung für Claude Code und andere LLM-Werkzeuge. Das **Warum** des
Projekts steht im [README](README.md) — hier steht, wie man daran arbeitet.

## Was das ist

Eine private PWA für zwei Menschen (Hamburg ↔ Kaliningrad): Himmelsband über
beiden Städten, Frage des Tages mit serverseitigem Lock-In, Countdown zum
Wiedersehen. Sprache der App: Russisch und Englisch. Sprache des Repos:
Deutsch in README, Commits und Docs; Englisch in Code und Code-Kommentaren.

Zwei harte Rahmenbedingungen, die jede Änderung einhalten muss:

1. **Ein Hostname, sonst nichts.** Kein CDN, keine Fremd-Schriften, kein
   Analytics, kein Push, keine neue Runtime-Abhängigkeit. Die App muss aus
   Russland erreichbar bleiben ([ADR-0001](docs/adr/0001-ein-hostname-keine-fremd-hosts.md)).
2. **Privat für zwei.** Kein Text verlässt den Server, den die Gegenseite nicht
   freigeschaltet hat ([ADR-0003](docs/adr/0003-passphrase-pro-seite-lock-in-serverseitig.md)).
   `noindex` bleibt.

## Kommandos

```bash
npm run typecheck          # tsc --noEmit
npm run build              # tsc -b && vite build → dist/
npm run dev                # Vite auf :5173, /api → :8787
PAIR_SECRET_A=… PAIR_SECRET_B=… npm run server   # Referenz-Server, :8787
```

Vor jedem Commit: `typecheck` **und** `build` müssen grün sein. Es gibt keine
Testsuite ([TD-04](docs/tech-debt.md)).

## Im Browser prüfen

Der Lock-Screen hat keine Tab-Leiste; Layout-Änderungen sind erst nach dem
Entsperren sichtbar. Rezept:

1. API lokal starten mit Test-Secrets und einem Wegwerf-`DATA_DIR`
   (`DATA_DIR=<scratch> PAIR_SECRET_A=hamburg-test PAIR_SECRET_B=kaliningrad-test node server/index.mjs`).
2. `.claude/launch.json` → Konfiguration `ryadom` startet Vite.
3. Viewport auf **402×874** (iPhone 16 Pro) setzen, mit `hamburg-test`
   entsperren, Today prüfen; zusätzlich 402×600 (Scrollen) und 1200×800.

Was der Desktop-Browser **nicht** zeigt: Safe-Area-Insets, Safari-Seitenzoom,
den Tastatur-Viewport-Bug. Alles, was iOS-spezifisch ist, gilt erst als
verifiziert, wenn Aydin es auf dem Gerät gesehen hat. Sag das ausdrücklich.

## Arbeitsregeln (aus Erfahrung, nicht aus Prinzip)

- **Erst messen, dann ändern.** Bei Layout-Problemen auf dem Telefon zuerst
  Zahlen holen (`innerWidth/Height`, `visualViewport.scale`, `screen`,
  Safe-Area-Werte, `.getBoundingClientRect()` der Leiste), dann die Ursache
  benennen, dann ändern. Am 2026-09-05 wurden tagelang Leistenhöhen justiert,
  während die Ursachen Safaris Seitenzoom und ein WebKit-Bug waren
  ([ADR-0010](docs/adr/0010-ios-tastatur-viewport-bug.md)).
- **Weniger Code ist die Lösung, nicht mehr.** Keine Variablen, Media-Queries
  oder Sonderfälle auf ein Symptom stapeln. Standardmuster bevorzugen. Die
  Schwester-App *Trainer* (`../Trainer`) ist die Referenz für „funktioniert auf
  dem iPhone" — bei Zweifeln dort nachsehen, was sie *nicht* tut.
- **Eine Hypothese pro Deploy.** Jeder Test kostet Aydin einen Zyklus auf dem
  Telefon. Nicht mehrere unbestätigte Fixes gleichzeitig einbauen; wenn doch,
  klar sagen, welcher Teil unbestätigt ist.
- **Push auf `main` deployt sofort** (GitHub Actions → VPS). Nur pushen, wenn
  Aydin es sagt; committen ist in Ordnung.
- **Kommentare erklären das Warum**, in ganzen Sätzen, oft mit der Geschichte,
  warum es anders nicht ging. Diesen Stil beibehalten; keine Kommentare, die
  den Code nachbuchstabieren. Falsch gewordene Kommentare sind Bugs — beim
  Ändern mitziehen.
- **Kein Text im Code.** Alle Strings in `src/i18n/strings.ts`; die russische
  Tabelle wird gegen die englische typgeprüft. Eigennamen (Städte, Personen)
  werden nie übersetzt.
- **Geometrie hat einen Besitzer.** Bandhöhe und Horizont kommen aus
  `src/sky/engine.ts` und werden von `SkyBand` als CSS-Variablen veröffentlicht.
  Nicht im Stylesheet wiederholen ([ADR-0006](docs/adr/0006-bandausrichtung-und-geometrie.md)).

## Wo was liegt

```
src/screens/      Today, Us (Einstellungen), Lock, Placeholder (Map, Chronicle)
src/components/   SkyBand, TimeRail, QuestionBlock, AnswerPair, CountdownCard, TabBar
src/sky/          Tagestabelle, Farben, Sonne/Mond (SunCalc) — rechnet lokal
src/weather/      Open-Meteo, 7 Tage stündlich, ein Request für beide Städte
src/data/         IndexedDB (Wahrheit), Outbox, Sync, Passphrase, Settings
src/i18n/         Wörterbücher en/ru, Spracherkennung
src/styles.css    Eine Datei. Layout-Modell: siehe Kopf der Datei und ADR-0008
server/index.mjs  Referenz-Server, keine Abhängigkeiten, JSON-Store
deploy/           Caddy, systemd bzw. Docker; Anleitung in deploy/README.md
docs/adr/         Entscheidungen, mit verworfenen Alternativen
docs/tech-debt.md Was bekannt und offen ist
docs/design-handoff/  Vorlage „Zwei — Home-Screen (Variante 2d)"
```

Produktionsdaten liegen auf dem VPS in `/var/lib/ryadom/answers.json`
(`days` + `settings`), außerhalb des Deploy-Pfads. Der Server hält sie im
Speicher und schreibt bei jeder Änderung — für Eingriffe an der Datei den
Dienst stoppen. Kein SSH-Zugang von hier; Skripte für Aydin schreiben.

## iOS-Wissen, das nirgends sonst steht

- Safari-**Seitenzoom** (ᴀA-Menü; Stufen 75/85/100/115 %) wird von der
  Home-Screen-App übernommen. Bei 85 % ist der Layout-Viewport 473 px statt
  402 px. Das Layout ist dagegen immun (volle Breite), die Schrift nicht.
- Nach der ersten **Tastatur** kann der Layout-Viewport um `safe-area-inset-top`
  (62 pt) zu kurz bleiben, bis die App beendet wird. Stand und Hypothesen:
  [ADR-0010](docs/adr/0010-ios-tastatur-viewport-bug.md), [TD-01](docs/tech-debt.md).
- Ein fokussiertes Feld, das entfernt wird, feuert kein `focusout`; die
  Einklapp-Taste der Tastatur lässt das Feld fokussiert. `visualViewport.resize`
  ist der verlässliche Trigger.
- `screen.width/height` sind auf iOS geräteecht (402×874 auf dem 16 Pro) und
  eignen sich als Referenz für „wie groß sollte der Viewport sein".
