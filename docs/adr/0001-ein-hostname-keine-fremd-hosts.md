# ADR-0001 · Ein Hostname, keine Fremd-Hosts zur Laufzeit

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus README §5, `src/data/api.ts`, `server/index.mjs` CSP)

## Kontext

Eine der beiden Personen ist in Kaliningrad. Von dort sind westliche CDNs,
Google-Dienste, Cloudflare-Fronten und manche TLDs unzuverlässig oder gar nicht
erreichbar. Jede Runtime-Abhängigkeit von einem dritten Host ist ein weiterer
Name, der ausfallen kann — und beim wichtigsten Element des Screens, der
Frage des Tages, wäre das nicht hinnehmbar.

## Entscheidung

Zur Laufzeit spricht die App mit genau **einer** Origin: der, die sie selbst
ausliefert. App und API liegen hinter demselben Hostname (kein CORS). Schriften
sind selbst gehostet (lateinische und kyrillische Subsets beider Schriften,
`unicode-range`). Alle JS-Bibliotheken sind gebündelt. Fragen sind eingebaut,
nicht abgerufen. Die einzige erlaubte Auslandsverbindung ist der
Wetter-Endpunkt (Open-Meteo, selbst hostbar über `VITE_WEATHER_BASE_URL` /
`WEATHER_ORIGIN`); die Content-Security-Policy des Servers erzwingt das.

Kein Analytics, kein Fehler-Tracking, kein Web Push (läuft in der Praxis über
Google-Infrastruktur), kein Auth-Anbieter.

## Verworfene Alternativen

- **Firebase / Supabase Cloud als Backend.** Fremde Hosts, teils aus Russland
  nicht erreichbar, und ein Anbieter mehr, der die Daten hält.
- **Google Fonts, unpkg, esm.sh.** Ein Ausfall des CDN wäre ein Ausfall der App.
- **Web Push für „sie hat geantwortet".** Bewusst nicht gebaut; die Statuszeile
  und der Sync beim Öffnen übernehmen das.

## Konsequenzen

- Neue Abhängigkeiten sind ein Architekturthema, keine `npm install`-Frage.
  Vor dem Hinzufügen: Läuft es gebündelt? Ruft es zur Laufzeit etwas auf?
- Die CSP im Server muss mitgezogen werden, wenn ein neuer Endpunkt dazukommt.
- Hoster und Domain bleiben eine Betriebsentscheidung außerhalb des Codes
  (README §5: EU-VPS, eigene Domain, eigenes TLS).
