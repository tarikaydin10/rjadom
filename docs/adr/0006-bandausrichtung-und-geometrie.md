# ADR-0006 · Bandausrichtung fest, Geometrie hat einen Besitzer

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `src/content/cities.ts`, `src/sky/engine.ts`, `src/styles.css`)

## Kontext

Das Himmelsband liest sich wie eine Landschaft: unten Geografie, oben Himmel.
Die beiden reden über diesen Screen — „links" muss für beide dasselbe heißen.
Und die Zeichnung (Sonne, Mond, Horizont) und das Stylesheet müssen dieselben
Maße haben, sonst steht die Sonne neben ihrer Bahn.

## Entscheidung

**Ausrichtung:** `BAND_ORDER = { left: 'hamburg', right: 'kaliningrad' }` auf
beiden Geräten. Westen links, Osten rechts; die Sonne geht rechts über
Kaliningrad auf und links über Hamburg unter — wie draußen. Persönlich bleibt
nur die Statuszeile (liest aus der Stadt, in der man steht) und die
Antwortspalten (du / sie).

**Geometrie:** `BAND_HEIGHT` und `HORIZON` stehen einmal in `sky/engine.ts`.
`SkyBand` veröffentlicht sie als `--band-height` und `--horizon` auf dem
Band-Element; das Stylesheet liest nur die Variablen. Der Maßstab ist bewusst
unehrlich (Städte 10,5° auseinander, ein Tag 360° — Faktor ~30): Boden
überzeichnet, Himmel ein Himmel. Nur die Himmelsrichtung stimmt in beiden Ebenen.

## Verworfene Alternativen

- **„Deine Stadt zuerst".** Persönlich, aber unkommunizierbar: „das Licht ist
  schon bei dir links" hieße auf dem anderen Telefon das Gegenteil.
- **Maße auch in `:root` des Stylesheets.** Gab es. Die zwei Kopien drifteten;
  die Drift war eine Sonne neben der Bahn und eine Schattenkante über dem
  Horizont. Deshalb steht die Regel im Stylesheet als Kommentar, warum die
  Variablen dort *fehlen*.

## Konsequenzen

- Wer die Bandhöhe ändert, ändert `engine.ts`, sonst nichts.
- Der Zeitstreifen (`.rail__strip`) ist sechs Tage breit und wird per
  `transform` verschoben; Breite in Zeit, nicht in Pixeln. Er darf nie zur
  Dokumentbreite beitragen (`contain` auf `.rail__track`).
