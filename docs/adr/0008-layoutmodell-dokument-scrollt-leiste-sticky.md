# ADR-0008 · Layoutmodell: Dokument scrollt, Tab-Leiste sticky, volle Breite auf dem Telefon

**Status:** Gültig
**Datum:** 2026-09-05 · Commits `15b5cc4`, `390f559`, `455e497`

## Kontext

Die Tab-Leiste sah in der installierten PWA seit Tagen „zu hoch" aus, mit
einem Rahmen um die App. Ein auf dem Gerät eingeblendetes Mess-Overlay zeigte
am Abend die Zahlen: `screen 402×874`, `innerWidth 473`,
`visualViewport.scale 0.85`, `safe-area-inset-top 62px`. 402 / 0,85 = 473 —
die Seite lief mit **85 % Safari-Seitenzoom**, den die Home-Screen-App
übernommen hatte. `.app { max-width: 440px }` erzeugte in einem 473 px breiten
Viewport 16,5 px Rand pro Seite; dazu saßen alle Leisten-Formeln im falschen
Maßstab. Keine der zuvor gebauten Leisten-Änderungen hätte das treffen können.

Vorher galt ein eingefrorener Shell: `html, body { overflow: hidden }`,
`#root { position: fixed; inset: 0 }`, Screens als eigene Scroller, Leiste
absolut am Boden mit `--tabbar-height` aus `max(38px, calc(24px + safe-bottom))`.
Die Schwester-App *Trainer* nutzt das Gegenteil (Dokument scrollt, Leiste
`fixed`) und hat auf demselben Telefon keines dieser Probleme.

## Entscheidung

Das Standardmuster, wie in Trainer:

```
html/body   scrollt; kein overflow:hidden; kein overscroll-behavior (siehe ADR-0010)
#root       normaler Block (Desktop-Hintergrund)
.app        Flex-Spalte, min-height: 100dvh, width: 100%, margin: 0 auto
screens     normaler Inhalt (flex: 1), keine eigenen Scroller
.tabs       position: sticky; bottom: 0; letztes Kind der Spalte;
            padding-bottom: 12px + env(safe-area-inset-bottom)
```

`max-width: 440px` gilt **nur ab 600 px Fensterbreite**. Auf dem Telefon ist
die App immer so breit wie der Viewport — egal, was der Viewport ist.

## Verworfene Alternativen

Alle vier waren an diesem Tag im Repo; die Reihenfolge ist die, in der sie
gefallen sind.

1. **`--tabbar-height: max(38px, calc(24px + var(--safe-bottom)))`.** Wählte
   im Standalone (safe-bottom 34) 58 px, im Browser (safe-bottom 0) 38 px — das
   Gegenteil des eigenen Kommentars.
2. **`--tabbar-content` + `@media (display-mode: standalone)`.** Trennte
   Inhalt und Inset sauber, blieb aber eine Höhenrechnung, die im gezoomten
   Viewport falsch war. Symptom, nicht Ursache.
3. **Leiste als Flex-Kind des eingefrorenen Shells** (`position: fixed; inset: 0`).
   Korrekt im Desktop-Browser, aber der Shell ist das Layout, das iOS nach der
   Tastatur nicht neu misst (ADR-0010) — und `overflow: hidden` auf `.app` ließ
   iOS die Box zum fokussierten Feld scrollen und verschoben stehen.
4. **`max-width: 440px` auch auf dem Telefon.** Zeichnet bei jedem Zoom < 100 %
   einen Rahmen. Der Viewport ist nicht unser Maß.

Ebenfalls geprüft und verworfen: `contain` auf dem Zeitstreifen als Ursache
der 85 % (der Streifen ist 1555 px breit, `overflow: hidden` clippt ihn;
`scrollWidth` des Dokuments war 473, also kein Überlauf). Die Regel bleibt als
Vorsorge stehen ([TD-03](../tech-debt.md)).

## Konsequenzen

- Keine Höhenvariable, kein reserviertes Padding, kein Standalone-Sonderfall.
  Wer die Leiste ändert, ändert `.tabs` und sonst nichts.
- Bei Safari-Seitenzoom ≠ 100 % ist die App gleichmäßig kleiner oder größer —
  aber niemals eingerahmt.
- Verifiziert im Desktop-Browser bei 402×874, 402×600 (Scrollen), Map-Screen
  und 1200×800; auf dem Gerät initial korrekt. Was auf dem Gerät **nicht**
  gelöst ist, steht in ADR-0010.
