# Handoff: Zwei — Home-Screen (Variante 2d)

## Overview
„Zwei" ist eine private Zwei-Personen-PWA für eine Fernbeziehung zwischen Hamburg und
Kaliningrad. Dieses Paket beschreibt **einen** Screen: den Home-Screen der Design-Variante
2d. Er trägt drei Dinge gleichzeitig — einen astronomisch korrekten Himmel über beiden
Städten, die Frage des Tages mit Lock-In-Mechanik und den Countdown bis zum Wiedersehen.

Der Screen ist bewusst der Startbildschirm der App: die Frage ist die tägliche Handlung,
nicht ein Unterpunkt hinter einem Tab.

## About the Design Files
Die Dateien in diesem Bündel sind **Design-Referenzen in HTML** — Prototypen, die Aussehen
und Verhalten zeigen, kein Produktionscode zum Übernehmen. Die Aufgabe ist, dieses Design
in der Zielumgebung nachzubauen (React, Vue, SwiftUI, native — was auch immer im Projekt
etabliert ist) und dabei deren Muster und Bibliotheken zu verwenden. Existiert noch keine
Umgebung, wählt der Entwickler das passende Framework und setzt das Design dort um.

Eine Ausnahme: die Himmelsberechnung in `Zwei Home.dc.html` (Abschnitt „Sky engine" unten)
ist **echte, übernehmbare Logik**. Sie ist frameworkfrei und darf 1:1 portiert werden.

## Fidelity
**High-fidelity.** Farben, Typografie, Abstände und Interaktionen sind final. Der Screen
soll pixelgenau nachgebaut werden. Ausnahme: die Wetterwerte (14° / 17°) sind Platzhalter
und brauchen eine echte Datenquelle.

## Screens / Views

### Home („Heute")
**Purpose:** Der Nutzer sieht auf einen Blick, wie spät und wie hell es bei beiden ist,
beantwortet die Frage des Tages und sieht den Countdown.

**Device:** Entworfen für 393 × 852 px (iPhone-Klasse), Portrait. Der Prototyp rendert in
einer Geräteattrappe; nur der Inhalt darin ist relevant.

**Layout:** Vertikaler Flex-Container über die volle Höhe, Hintergrund `#F4EFE6`.
Von oben nach unten:

| # | Block | Höhe | Notiz |
|---|-------|------|-------|
| 1 | Himmelsband | 218 px fix | `overflow: hidden`, `flex-shrink: 0` |
| 2 | Statuszeile + Zeit-Label | auto | `padding: 9px 22px 0`, Space-between |
| 3 | Zeit-Regler | auto | `padding: 2px 22px 0` |
| 4 | Inhaltsbereich | `flex: 1` | `padding: 8px 22px 0`, Spalten-Flex, `gap: 16px` |
| 5 | Tab-Bar | auto | `padding: 14px 0 30px`, 4-Spalten-Grid, Oberlinie `1px #E5DACA` |

---

#### 1 · Himmelsband (die Kernkomponente)

Ein 218 px hohes Band, das den echten Himmel über beiden Städten zeigt. Aufbau in Ebenen,
von hinten nach vorn:

1. **Grundfarbe** `#12111F` (verhindert Aufblitzen vor dem ersten Paint).
2. **Hamburg-Himmel**: absolut über die volle Fläche, `background: <Verlauf(hhAlt)>`.
3. **Kaliningrad-Himmel**: darüber gelegt, `background: <Verlauf(kdAlt)>`, weich
   eingeblendet per
   `mask-image: linear-gradient(90deg, transparent 16%, black 78%)`
   (mit `-webkit-mask-image` doppelt setzen). Das erzeugt die wandernde Terminatorlinie:
   links Hamburgs Licht, rechts Kaliningrads, dazwischen ein weicher Übergang.
4. **Sterne**: fünf absolut positionierte Punkte (2–3 px, `#FFF6E6`, Radius 50 %) in einem
   Wrapper, dessen `opacity` der berechnete `starOpacity` ist.
   Positionen (left/top): 47 %/64, 53 %/86, 50 %/106, 12 %/122, 88 %/116.
5. **Bahn und Horizont** als SVG (`viewBox="0 0 356 218"`, `preserveAspectRatio="none"`,
   absolut über die volle Fläche):
   - Tagbogen: `M-4 170C46 78 310 78 360 170`, Stroke `#F6E0BE` @ 22 % Deckkraft, 1 px,
     `stroke-dasharray="3 5"`
   - Horizont: Linie y = 170, Stroke `#F6E0BE` @ 50 % Deckkraft, 1 px
6. **Textabdunklung**: oben ein 152 px hoher Verlauf
   `linear-gradient(180deg, rgba(20,16,28,.5), rgba(20,16,28,.34) 62%, transparent)`.
7. **Mond**: 14 px Kreis, `#EFEAF0`, `box-shadow: 0 0 14px 4px rgba(239,234,240,.2)`,
   `margin: -7px 0 0 -7px`, Position und `opacity` aus der Berechnung.
8. **Sonne**: 20 px Kreis, `margin: -10px 0 0 -10px`, Farbe und Glow aus der Berechnung.
9. **Stadtpunkte** auf dem Horizont (top 170 px): Hamburg bei `left: 25 %`, Kaliningrad bei
   `left: 75 %`. Je 7 px Kreis, `margin: -3.5px 0 0 -3.5px`.
   Steht die Sonne bei der Stadt über dem Horizont: `#FFE9A8` mit
   `box-shadow: 0 0 9px 2px rgba(255,233,168,.55)`; sonst `#6E6A84`, kein Schatten.
10. **Textebene** ab `top: 52px`, `padding: 6px 22px 0`, Zwei-Spalten-Grid, `gap: 12px`:
    - links Hamburg (linksbündig), rechts Калининград (rechtsbündig)
    - Städtename: 10 px, `letter-spacing: .2em`, Versalien
    - Uhrzeit: Cormorant Garamond 31 px, `line-height: 1.05`
    - Notiz: 11 px, Format `14° bedeckt · Untergang 20:11`
    - Alle drei nehmen Farbe und Textschatten aus der Berechnung (siehe „Adaptive Textfarbe")

**Wichtig:** Sonne, Mond und Sterne sind **HTML-Elemente mit `border-radius`**, keine
SVG-Kreise. Im SVG würden sie durch `preserveAspectRatio="none"` zu Ellipsen verzerrt.
Nur Bahn und Horizont dürfen gestreckt werden.

---

#### 2 · Statuszeile

Flex-Zeile, `align-items: baseline`, Space-between.
- Links: Statustext, 10 px, `letter-spacing: .16em`, Versalien, `#9A5F42`.
  Fünf mögliche Werte, siehe „Status-Logik".
- Rechts: `jetzt` wenn der Regler unberührt ist, sonst `21:14 · zurück zu jetzt`.
  11 px, `#B0563C`, klickbar, setzt den Regler zurück.

#### 3 · Zeit-Regler

`<input type="range" min="0" max="287" step="1">`, `accent-color: #B0563C`, volle Breite.
287 Schritte = ein Tag in Fünf-Minuten-Slots. Kontrolliert über den Zustand.
Der Regler ist ein **Demo-Werkzeug** zum Vorführen der Tageswanderung. In der echten App
entfällt er (oder wird zu einer versteckten Geste), der Himmel folgt dann nur der Echtzeit.

#### 4 · Inhaltsbereich

**Frageblock** (`gap: 5px`):
- Kicker `Heute · Tag 214`: 10 px, `letter-spacing: .2em`, Versalien, `#B0563C`
- Frage deutsch: Cormorant Garamond 31 px, `line-height: 1.15`, `#241F1B`, `text-wrap: pretty`
- Frage russisch: Cormorant Garamond 24 px, kursiv, `line-height: 1.2`, `#8A7A6A`
  Beide Sprachen stehen untereinander — kein Sprachumschalter auf diesem Screen.

**Antwortpaar**: Zwei-Spalten-Grid, `gap: 10px`, `flex: 1`, `min-height: 0`.
- *Deine Spalte*: `#FFFCF6`, Rahmen `1px #E5DACA`, `border-radius: 14px`, `padding: 14px`.
  Label `Du` (10 px, `.16em`, Versalien, `#7A6A5C`), darunter Platzhalter
  „Tippen, um zu schreiben …" 15 px kursiv `#8A7A6A`.
- *Ihre Spalte*: `#EDE4D6`, kein Rahmen, gleicher Radius und Padding.
  Label `Она · 08:12`. Der Antworttext ist als **zwei Balken** gerendert:
  Textfarbe = Hintergrundfarbe `#E0D6C6` auf `#DBD0BE`, `border-radius: 5px`,
  zweiter Balken 70 % Breite. Fußzeile 12 px kursiv `#7A6A5C`:
  „Sichtbar, sobald du geschrieben hast."

  **Sicherheitsanforderung:** Das ist nur die visuelle Darstellung. Der Klartext der
  Partnerantwort darf **nicht** ans Gerät ausgeliefert werden, bevor die eigene Antwort
  abgeschickt ist. Kein CSS-Blur über echtem Text.

**Countdown-Karte**: `#241F1B`, `border-radius: 14px`, `padding: 16px 18px`,
Flex-Zeile Space-between.
- Links: Kicker `Wiedersehen` (10 px, `.18em`, Versalien, `#B79E86`) über
  `12. Oktober · Hamburg` (15 px, `#F4EFE6`)
- Rechts: Zahl in Cormorant Garamond 40 px `#E8A87C`, daneben `Tage` 12 px `#B79E86`

#### 5 · Tab-Bar

Vier gleiche Spalten, zentriert, 11 px, `letter-spacing: .1em`, `#7A6A5C`;
aktiver Tab `#B0563C`. Beschriftung: Heute · Karte · Chronik · Wir.

---

## Sky engine (übernehmbare Logik)

Die vollständige Implementierung steht in `Zwei Home.dc.html` im Skriptblock. Sie ist
frameworkfrei und hat keine Abhängigkeiten.

**Konstanten**
```
HH  = { lat: 53.551, lon:  9.994, tz: "Europe/Berlin" }
KD  = { lat: 54.710, lon: 20.510, tz: "Europe/Kaliningrad" }
MID = { lat: 54.13,  lon: 15.25 }          // Mittelpunkt, für Sonne und Mond
SLOT_MS = 300000, SLOTS = 288              // Tag in 5-Minuten-Schritten
```

**Funktionen**
- `sunAt(ms, city)` → `{ alt, ha }` in Grad. Sonnenlängengrad aus mittlerer Länge und
  mittlerer Anomalie, dann Umrechnung in Horizontkoordinaten über GMST.
- `moonAt(ms, city)` → dasselbe für den Mond (Hauptglied der Bahnstörung).
- `gradientFor(alt)` → CSS-Verlauf. Interpoliert zwischen acht Stützstellen
  (+60°, +25°, +8°, +1°, −4°, −10°, −18°, −60°), je drei Farben für oben/Mitte/unten.
- `place(alt, ha)` → Bildposition. `x = 50 + (ha / 180) * 62` in Prozent, geklemmt auf
  4–96 %. `y`: über dem Horizont von 170 px linear nach 108 px bei 62° Höhe; darunter bis
  10 px unter den Horizont.
- `buildDay(dayStart)` → Array mit 288 fertigen Zeilen. Enthält alles, was der Screen
  braucht: Verläufe, Positionen, Farben, Deckkraft, Uhrzeiten, Notizen, Status.
- `dayRows(ms)` → gecachte Tagestabelle; baut nur beim Datumswechsel neu.
- `slotNow()` → aktueller Index aus der lokalen Uhrzeit.

**Wichtig für die Portierung:** Die Tabelle wird **einmal pro Tag** gebaut, nicht pro
Render. Ein früherer Stand rechnete Sonnenstände im Render-Pfad und legte die
Anwendung lahm. Halte diese Trennung ein: berechnen beim Laden und beim Datumswechsel,
im Render nur nachschlagen.

**Sonnenauf- und -untergang** entstehen als Nebenprodukt: Beim Durchlauf der 288 Slots
wird jeder Vorzeichenwechsel von `alt` vermerkt. Genauigkeit dadurch ±5 Minuten. Reicht
für die Anzeige; braucht es exakte Zeiten, ist eine Bisektion um den Wechsel herum
zu ergänzen.

**Adaptive Textfarbe.** Ist die höchste der beiden Sonnenhöhen > 6°, gilt Tag:
Text `#1E2029`, Sekundärtext `#33323C`, Schatten `0 1px 2px rgba(255,252,244,.65)`.
Sonst Nacht: `#FFF9EF` / `#F2E3D0` / `0 1px 3px rgba(20,16,28,.6)`.

**Sonnenfarbe** nach eigener Höhe: > 8° `#FFE9A8`, > 0° `#FFC978`, sonst `#E8926A`.
Glow entsprechend `rgba(255,233,168,.45)` / `rgba(255,201,120,.4)` / `rgba(232,146,106,.3)`.
Unter −8° wird die Sonne ganz ausgeblendet.

**Sternendeckkraft** `clamp((-4 - bright) / 10, 0, 1)`, mit `bright` = höhere der beiden
Sonnenhöhen. **Monddeckkraft** nur wenn der Mond über dem Horizont steht und `bright < 8`:
`clamp((8 - bright) / 14, 0, .85)`.

**Status-Logik** (Reihenfolge beachten):
```
bright < -6                        → "Bei euch beiden ist es Nacht"
min(hhAlt, kdAlt) > 6              → "Bei euch beiden ist es hell"
bright < 0                         → "Dämmerung bei euch beiden"
hhAlt < kdAlt                      → "Sie hat schon Licht, du noch nicht"
sonst                              → "Du hast noch Licht, sie nicht mehr"
```

## Interactions & Behavior
- **Zeit-Regler**: `onChange` setzt den Slot-Index; die Anzeige springt sofort auf diese
  Uhrzeit. Es gibt keine Übergangsanimation — Sprünge sind gewollt beim Scrubben.
- **„zurück zu jetzt"**: setzt den Slot auf `null`, die Anzeige folgt wieder der Echtzeit.
- **Live-Lauf**: Ein Intervall aktualisiert den aktuellen Slot jede Minute. Beim Verlassen
  der Komponente aufräumen.
- **Antwortfeld**: Tippen öffnet die Eingabe (im Prototyp nicht ausgebaut). Nach dem
  Absenden wird die Partnerantwort nachgeladen und ersetzt die Balken.
- Keine Hover-Zustände — der Screen ist für Touch entworfen.

## State Management
| Variable | Typ | Zweck |
|---|---|---|
| `slot` | `number \| null` | Vom Regler gewählte Uhrzeit; `null` = Echtzeit |
| `nowSlot` | `number` | Aktueller Slot, jede Minute aktualisiert |

Für die echte App zusätzlich: eigene Antwort, Absende-Status, Partnerantwort (erst nach
dem Absenden abrufen), Frage des Tages, Wiedersehenstermin, Wetterdaten beider Städte.

## Design Tokens

**Farben**
```
Papier hell        #F4EFE6    Grundfläche
Karte              #FFFCF6    eigene Antwortspalte
Karte gedämpft     #EDE4D6    ihre Antwortspalte
Balken             #DBD0BE / #E0D6C6   verdeckter Text
Rahmen             #E5DACA
Tinte              #241F1B    Text und Countdown-Karte
Tinte gedämpft     #7A6A5C    Sekundärtext, Tabs
Tinte blass        #8A7A6A    Platzhalter, russische Frage
Terrakotta         #B0563C    Akzent, aktiver Tab, Regler
Terrakotta dunkel  #9A5F42    Statustext
Apricot            #E8A87C    Countdown-Zahl
Sand               #B79E86    Text auf dunkler Karte
Nachtgrund         #12111F
Sonne hoch/tief    #FFE9A8 / #FFC978 / #E8926A
Mond               #EFEAF0
Stadtpunkt aus     #6E6A84
```

**Himmelsverlauf-Stützstellen** (oben / Mitte / unten)
```
+60°  #6FA9DA  #A8CFEA  #DCEAF2
+25°  #7FB4DE  #BBD7EA  #E9E5DA
 +8°  #8AB4D4  #DFCDAE  #F4E4CB
 +1°  #6A6E9C  #DE9A6C  #F6C79A
 −4°  #3E3A63  #9A5C67  #DE8A63
−10°  #2B2A4C  #4A3C55  #8A5A55
−18°  #1A1930  #26233E  #3A3350
−60°  #0F0E1C  #15142A  #1C1A32
```
Der Verlauf setzt die drei Farben bei 0 %, 52 % und 100 %.

**Typografie**
- Display: Cormorant Garamond, Gewicht 400. Uhrzeit 31 px / 1.05, Frage 31 px / 1.15,
  russische Frage 24 px kursiv / 1.2, Countdown-Zahl 40 px / 1.
- Fließtext: Spectral, Gewichte 300/400. Antworten 15 px / 1.5, Notizen 11 px,
  Fußnoten 12 px.
- Kicker durchgehend 10 px, Versalien, `letter-spacing: .16em`–`.2em`.

**Abstände** 5 · 8 · 10 · 12 · 14 · 16 · 22 px. Seitenrand ist immer 22 px.

**Radien** 14 px (Karten), 999 px (Pillen), 50 % (Himmelskörper).

## Assets
Keine Bilddateien. Sonne, Mond, Sterne und Stadtpunkte sind CSS-Kreise, Bahn und Horizont
ein Inline-SVG. Schriften über Google Fonts (Cormorant Garamond, Spectral).
Die Geräteattrappe (`ios-frame.jsx`) ist reines Präsentationsmittel und gehört nicht
in die Umsetzung.

## Offene Punkte
- **Wetter** ist Platzhalter. Braucht eine Quelle, die aus Russland ohne VPN erreichbar
  ist — das ist vor der Anbieterwahl zu prüfen. Aktualisierung mindestens alle 15 Minuten,
  letzter Stand offline sichtbar mit Zeitstempel.
- **Zeitzonen**: Hamburg und Kaliningrad liegen im Sommer gleich, im Winter eine Stunde
  auseinander. Nie eine feste Differenz annehmen — immer über die IANA-Zone rechnen.
- **Auf-/Untergangszeiten** sind auf ±5 Minuten genau (siehe oben).
- Der **Zeit-Regler** ist Demo-Werkzeug, kein Produktfeature.

## Files
```
design_handoff_zwei_home/
  README.md            diese Datei
  Zwei Home.dc.html    der Screen als lauffähiger Prototyp
  ios-frame.jsx        Geräteattrappe (nur Präsentation)
  support.js           Laufzeit des Prototyps
```
`Zwei Home.dc.html` im Browser öffnen — der Screen läuft eigenständig, ohne Server.
Die vollständige Variantensammlung (2a Nachtlicht, 2b Zettelkasten, 2c Emaille, 2d) und
die Acceptance Criteria des MVP liegen im Projekt unter `Zwei - MVP.dc.html`.
