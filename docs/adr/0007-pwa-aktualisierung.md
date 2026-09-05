# ADR-0007 · PWA-Aktualisierung: prüfen bei jeder Gelegenheit, neu laden nur im Leerlauf

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `src/main.tsx` `keepFresh`, `vite.config.ts`)

## Kontext

Ein Telefon mit der App auf dem Home-Screen macht tagelang keinen echten
Seitenaufruf. Die generierte Service-Worker-Registrierung prüft nur beim Laden
auf Updates — ein deployter Fix konnte also unbemerkt auf dem Server liegen,
während die App letzte Woche lief. Genau so sah eine funktionierende Passphrase
einmal kaputt aus.

## Entscheidung

`vite-plugin-pwa` mit `registerType: 'autoUpdate'`, Precache der ganzen Shell
samt Schriften, `NetworkFirst` für Wetter. Dazu `keepFresh()`:

- `registration.update()` bei `visibilitychange → visible`, bei `online` und
  alle fünf Minuten (eine bedingte Anfrage für eine 7-KB-Datei).
- Beim `controllerchange` nach dem *ersten* Claim wird neu geladen — aber
  **nie, während ein Editor Text enthält**; dann wartet der Reload in
  5-Sekunden-Schritten auf den nächsten leeren Moment.

Manifest kommt aus `vite.config.ts` (`display: standalone`, `id`/`scope` `/`),
nicht aus `public/`.

## Verworfene Alternativen

- **Nur die Standard-Registrierung.** Updates kommen erst beim nächsten echten
  Laden, was auf dem Home-Screen selten ist.
- **Sofortiger Reload bei jedem neuen Worker.** Hätte eine halbgeschriebene
  Antwort verworfen.
- **`skipWaiting` ohne Reload.** `clientsClaim` tauscht nur den Worker; das
  laufende JavaScript bleibt alt. Nur ein Reload ersetzt es.

## Konsequenzen

- Nach einem Deploy sieht ein offenes Telefon die neue Version spätestens beim
  nächsten Wechsel in die App.
- Was **nicht** aktualisiert wird: vom Gerät übernommene Fenstergrößen, Zoom
  oder ein festgefahrener Viewport (ADR-0010). Das braucht Beenden oder
  Neuinstallation der PWA.
