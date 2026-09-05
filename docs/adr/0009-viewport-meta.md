# ADR-0009 · Viewport-Meta: cover, kein Zoom, kein resizes-content

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `index.html`); `shrink-to-fit=no` ergänzt 2026-09-05

## Kontext

Die App soll sich wie eine Anwendung anfühlen: bis in die Ecken gezeichnet, der
Himmel unter der Dynamic Island, kein Pinch-Zoom, kein Doppeltipp-Zoom.

## Entscheidung

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1,
      user-scalable=no, viewport-fit=cover, shrink-to-fit=no" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

Dazu `touch-action: manipulation` auf `html/body` (kein Doppeltipp-Zoom) und
die Safe-Area-Insets einmal als `--safe-*`-Variablen in `:root`.

## Verworfene Alternativen

- **`interactive-widget=resizes-content`.** Ließ die Tastatur den
  Layout-Viewport schrumpfen; iOS gab die Höhe nicht zuverlässig zurück, der
  Shell blieb für den Rest der Sitzung zu kurz. Entfernt; die Voreinstellung
  `resizes-visual` lässt das Layout in Ruhe.
- **`viewport-fit=contain`.** Kein Himmel unter der Island, sichtbarer Balken
  oben. Der Look der Vorlage lebt vom Cover.

## Konsequenzen

- `viewport-fit=cover` ist die Bedingung für zwei bekannte WebKit-Fehler
  (254868, 192564) — siehe ADR-0010. Der Look ist die Entscheidung wert, aber
  man muss wissen, was man sich einhandelt.
- `shrink-to-fit=no` ist seit iOS 13 wirkungslos und schadet nicht
  ([TD-03](../tech-debt.md)).
- Safaris **Seitenzoom** (ᴀA-Menü) wird von `maximum-scale=1` nicht verhindert
  — das ist keine Skalierung der Seite, sondern der Rendering-Maßstab. Das
  Layout muss damit leben (ADR-0008).
