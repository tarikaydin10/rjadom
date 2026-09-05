# ADR-0010 · Umgang mit dem iOS-Tastatur-Viewport-Bug

**Status:** Vorläufig — **auf dem Gerät nicht bestätigt**
**Datum:** 2026-09-05 · Commits `987c922`, `455e497`

## Kontext

Beobachtet auf iPhone 16 Pro (iOS-Version nicht notiert — nachtragen), nur in
der installierten PWA, nie in Safari:

- Beim Start ist alles richtig (Leiste am unteren Rand, `innerHeight` = volle
  Höhe).
- Nach der **ersten Tastatur** — Passwortfeld auf dem Lock-Screen oder das
  Antwortfeld — ist der Layout-Viewport dauerhaft um **62 pt** zu kurz. Das ist
  exakt `safe-area-inset-top` dieses Geräts. Overlay-Messung: `innerHeight`
  1028 → 955 (bei Zoom 0,85), `visualViewport.height` ebenso; `screen.height`
  bleibt 874.
- Alles, was am Layout-Viewport hängt (`100dvh`, `sticky`/`fixed bottom: 0`),
  endet 62 pt über dem Bildschirmrand; darunter steht der `body`-Hintergrund.
- Der Zustand hält, bis die App beendet wird (App-Switcher). Ein Reload hilft
  nicht.

Passende Berichte:

- [dev.to/cederhook](https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d)
  — dasselbe Bild (932 → 873 auf dem Pro Max = dessen safe-top). Getestete
  Fehlschläge: Meta-Tags, `position: fixed`-Shell, Input-Verschieben,
  Scroll/Blur-Handler, `height: 100%`. Funktionierend: ein volles Element für
  einen Frame `display: none` setzen, nach `blur` + 140 ms.
- [WebKit 254868](https://bugs.webkit.org/show_bug.cgi?id=254868) — falsche
  Höhen bei `viewport-fit=cover` in installierten Web-Apps; offen (P2).
- [WebKit 192564](https://bugs.webkit.org/show_bug.cgi?id=192564) — „keyboard
  dismissal leaves viewport-fit=cover content offscreen"; der Relayout-Workaround
  „didn't work if rubberband scrolling was disabled".
- [WebKit 301857](https://bugs.webkit.org/show_bug.cgi?id=301857) /
  [cordova-ios 1575](https://github.com/apache/cordova-ios/issues/1575) — iOS 26.0:
  Viewport schrumpft nach Tastatur dauerhaft; Auslöser „disableOverscroll";
  laut Reporter in iOS 26.1 behoben.

Die Schwester-App *Trainer* zeigt den Fehler auf demselben Telefon nicht. Ihre
Unterschiede: kein `overscroll-behavior: none`, kein `maximum-scale=1` /
`user-scalable=no` im Viewport-Meta, kein Manifest (Standalone nur über die
Apple-Meta-Tags), Leiste `position: fixed` statt `sticky`.

## Entscheidung (vorläufig)

Zwei Maßnahmen, beide im Repo, beide unbestätigt:

1. **`overscroll-behavior: none` von `html/body` entfernt** (`455e497`). Zwei
   der Berichte nennen abgeschalteten Overscroll als Bedingung; Trainer setzt
   ihn nie. Preis: die Seite federt am oberen Rand kurz, wie jede Seite.
2. **`healViewport()` in `main.tsx`** (`987c922`, Trigger korrigiert in
   `455e497`): nur im Standalone; bei `visualViewport.resize` und `focusout`,
   300 ms nach der letzten Bewegung; nie bei stehender Tastatur
   (`visualViewport.height < innerHeight − 80`); nur wenn
   `max(innerWidth, innerHeight) × scale < max(screen.width, screen.height) − 2`;
   dann `#root` für einen Frame `display: none`, Scrollposition erhalten.

Der erste Test nach `987c922` (Trigger noch `focusout`) schlug fehl — mit
einer plausiblen Erklärung: das Passwortfeld wird beim Entsperren *entfernt*
(kein `focusout`), und die Einklapp-Taste der Tastatur lässt das Antwortfeld
fokussiert. Der Test nach `455e497` steht aus.

## Verworfene Alternativen

- **`interactive-widget=resizes-content`.** Siehe ADR-0009; machte es schlimmer.
- **Eingefrorener Shell** (`position: fixed; inset: 0`). Zeigte denselben Fehler
  (Screenshot 19:40) und dazu die in ADR-0008 genannten Nachteile.
- **`.app` an `visualViewport.height` koppeln.** Im festgefahrenen Zustand
  meldet auch `visualViewport` die zu kurze Höhe — es gibt aus JS keine
  Messung der echten Höhe außer `screen.height`.
- **Heal ohne Bedingung bei jedem Blur.** Würde bei jedem Tastaturwechsel
  blinken und ein fokussiertes Feld entfokussieren.

## Was als Nächstes zu tun ist

Genau eine Variable pro Test, jeweils: PWA beenden, öffnen, ins Antwortfeld
tippen, Tastatur schließen, Leiste anschauen.

1. Stand `455e497` testen. Hält es → `healViewport()` entfernen und **erneut**
   testen, damit klar ist, ob der Overscroll allein reicht.
2. Hält es nicht → in Trainer dieselbe Geste machen. Zeigt Trainer den Fehler
   auch, ist es ein iOS-Bug ohne Layout-Ursache (dann iOS-Version prüfen,
   301857). Zeigt Trainer ihn nicht, die verbleibenden Unterschiede einzeln
   angleichen: `maximum-scale=1, user-scalable=no` aus dem Meta; dann
   Manifest-`display` weglassen.
3. Ergebnis hier eintragen und den Status auf *Gültig* oder *Ersetzt* setzen.
