# Rjadom · Рядом

Eine private PWA für zwei Menschen in Hamburg und Kaliningrad: ein astronomisch
korrekter Himmel über beiden Städten, die Frage des Tages mit Lock-In, und der
Countdown bis zum Wiedersehen.

Umgesetzt nach dem Design-Handoff „Zwei — Home-Screen (Variante 2d)". Das Design
ist übernommen, die Sprache ist neu: die App spricht **Russisch und Englisch**,
nicht mehr Deutsch.

---

## Schnellstart

```bash
npm install
npm run build                     # baut nach dist/

# Server + App unter einer Adresse:
PAIR_SECRET="$(node -e "console.log(crypto.randomBytes(24).toString('base64url'))")" \
  npm run server                  # http://localhost:8787
```

Beim ersten Öffnen fragt die App **einmal** nach der Passphrase (dem
`PAIR_SECRET`) und danach nie wieder auf diesem Gerät.

Für die Entwicklung:

```bash
npm run server                    # Terminal 1 – API auf :8787
npm run dev                       # Terminal 2 – Vite auf :5173, /api wird geproxyt
```

Weitere Skripte: `npm run typecheck`, `npm run icons` (App-Icons neu zeichnen),
`npm run fonts` (Schriften neu herunterladen und selbst hosten).

---

## Die fünf Anforderungen

### 1 · Die App heißt Rjadom (Рядом)

Der Name steht im Manifest als `Rjadom · Рядом`, in `index.html` und auf dem
Sperrbildschirm. Ein Eigenname wird nicht übersetzt — er wird transliteriert, und
beide Schreibungen stehen nebeneinander.

### 2 · Alles auf Russisch und Englisch

* **Systemsprache entscheidet.** `navigator.languages` wird gelesen; `ru`, `be`,
  `kk` und `uk` bekommen Russisch, alles andere Englisch
  (`src/i18n/index.tsx`, `detectSystemLocale`).
* **Anpassbar.** Unter „Мы / Us" lässt sich die Sprache dauerhaft auf
  *System / English / Русский* stellen. Die Wahl liegt pro Gerät im
  `localStorage`, damit schon der erste Frame in der richtigen Sprache erscheint.
* **Kein Text entkommt.** Alle Strings liegen in `src/i18n/strings.ts`. Die
  russische Tabelle wird gegen die englische typgeprüft — ein fehlender Schlüssel
  ist ein Build-Fehler, kein leeres Label. Russische Pluralformen
  (`день / дня / дней`) laufen über `Intl.PluralRules`.
* **Zwei Ausnahmen, wie besprochen:** `Hamburg` und `Калининград` behalten immer
  ihre eigene Sprache — auch die deutsche Schreibung im russischen Interface und
  umgekehrt (`src/content/cities.ts`). Damit dabei nichts auf eine System-Ersatz-
  schrift zurückfällt, liegen von *beiden* Schriften die lateinischen **und** die
  kyrillischen Subsets lokal vor.
* **Namen** werden ebenfalls nie übersetzt, können aber zwei Schreibungen haben
  (`Tarik` / `Тарик`) — angezeigt wird die, die zur aktiven Sprache passt.
* **Statuszeilen sind geschlechtsneutral** formuliert („Там уже светло, у тебя
  ещё нет"). Dieselbe App läuft auf beiden Telefonen; ein festes „она" wäre auf
  einem davon immer falsch. Sie unterscheiden außerdem Morgen von Abend: fehlt
  Licht, dann „noch nicht" beim Aufgehen und „nicht mehr" beim Untergehen.

### 3 · Sonne und Mond aus einer Open-Source-Quelle

`suncalc` (BSD-2-Clause) ersetzt die selbstgeschriebene Astronomie des
Prototyps. Zwei Dinge werden dadurch besser: Auf- und Untergang sind **exakte
Zeitpunkte** statt der ±5 Minuten des Prototyps, und der Mond folgt einer
richtig gestörten Bahn.

**Zur Frage „ergibt Vorausziehen Sinn?" — teils.** SunCalc rechnet lokal aus dem
Zeitstempel; es gibt keinen Netzaufruf, also auch nichts vorzuladen. Was das
Vorbauen bringt, ist nicht Verbindung, sondern Ruhe im Render: die Tagestabelle
(288 Fünf-Minuten-Slots) wird **einmal pro Datum** gebaut, und `prefetchDays()`
legt beim Start in der Leerlaufzeit sechs weitere Tage an. Mitternacht, ein Wisch
in den nächsten Tag oder ein Kaltstart im Flugzeug finden die Tabelle fertig vor.

Wirklich vorgezogen wird das **Wetter** — das ist der Teil, der ohne Netz nicht
entsteht (siehe 4).

### 4 · Offline zuerst, Sync später

Die lokale Datenbank ist die Wahrheit, nicht ein Cache des Servers.

* Eine Antwort landet sofort in IndexedDB und ist sofort sichtbar
  (`src/data/answers.ts`).
* Parallel geht sie in eine **Outbox**. Der Sync-Dienst leert sie beim Start,
  bei `online`, beim Zurückwechseln in die App und alle fünf Minuten
  (`src/data/sync.ts`). Schlägt das fehl, bleibt der Eintrag liegen; die
  Statuszeile sagt, dass etwas wartet.
* **Wetter für sieben Tage stündlich**, für beide Städte in *einem* Request, mit
  Zeitstempel gespeichert. Danach zeigt der Screen jeden Moment der kommenden
  Woche ohne Verbindung. Ein fehlgeschlagener Abruf löscht nie gute Daten — ein
  alter Wert mit Zeitstempel ist besser als eine leere Zeile.
* **Fragen sind eingebaut**, nicht abgerufen. Sonst wäre ausgerechnet das
  wichtigste Element des Screens das einzige, das ohne Netz fehlt. Beide Geräte
  leiten dieselbe Frage aus demselben Datum ab.
* Der Service Worker cacht die gesamte App-Shell samt Schriften, also startet sie
  auch offline.

**Eine gemeinsame Ausrichtung.** Das Band liest sich wie eine Landschaft: unten
Geografie, oben Himmel. Westen links, also Hamburg links und Kaliningrad rechts
— auf beiden Telefonen gleich (`BAND_ORDER` in `src/content/cities.ts`). Nicht
„deine Stadt zuerst": ihr redet über diesen Screen, also muss „links" für euch
beide dasselbe heißen. Persönlich bleibt nur die Sprache — die Statuszeile liest
weiter aus, in welcher Stadt du stehst.

Damit steht auch fest, wohin die Sonne läuft: Osten ist rechts, also geht sie
**rechts über Kaliningrad auf** und **links über Hamburg unter**. Genau so ist es
auch draußen — Kaliningrad wird 42 Minuten früher hell, Hamburg behält das Licht
am längsten. Das Licht wandert von ihr zu dir.

Die beiden Maßstäbe können nicht beide ehrlich sein, und das Band tut auch nicht
so: eure Städte liegen 10,5° auseinander (42 Minuten Sonne), ein Tag hat 360° und
24 Stunden — Faktor ~30. Maßstabstreu wären eure Städte elf Pixel auseinander,
oder die Sonne stünde 23 Stunden am Tag außerhalb des Bildes. Also ist der Boden
bewusst überzeichnet und der Himmel ein Himmel, wie in einem Landschaftsbild.
Das Einzige, was nicht falsch sein darf — wo Osten ist — stimmt in beiden Ebenen.

**Ein gemeinsamer Tag.** Hamburg und Kaliningrad liegen im Winter eine Stunde
auseinander. Ein naives lokales Datum hätte die beiden abends auf verschiedene
Fragen gesetzt. Deshalb hat das Paar **eine** kanonische Zone für Tagesgrenzen
(`PAIR_TIMEZONE`, Standard `Europe/Berlin`). Uhren und Sonnenstände bleiben
strikt lokal — nur der Kalender ist gemeinsam.

### 5 · Muss auch in Russland funktionieren

Der Grundsatz: **eine einzige Adresse muss erreichbar sein**, sonst nichts.

| Was | Entscheidung |
|---|---|
| Schriften | Selbst gehostet, latein + kyrillisch getrennt nach `unicode-range`. Kein Google-Fonts-Aufruf zur Laufzeit. |
| JS-Bibliotheken | Alle gebündelt. Kein CDN, kein `unpkg`, kein `esm.sh`. |
| Sync-Backend | Eigener, abhängigkeitsfreier Node-Server. Kein Firebase, kein Supabase-Cloud, kein Auth-Anbieter. |
| API-Adresse | Standard ist **dieselbe Origin** wie die App — ein Hostname, kein CORS. |
| Wetter | Open-Meteo: Open Source, EU-gehostet, kein API-Key, **und selbst hostbar** (`VITE_WEATHER_BASE_URL`). |
| Analytics, Fehler-Tracking, Fonts-CDN | Nicht vorhanden. |
| Push | Bewusst nicht gebaut — Web Push läuft in der Praxis über Google-Infrastruktur. |
| Suchmaschinen | `noindex, nofollow` in der Seite und als Header. |

**Was ihr noch prüfen müsst:** den Hoster und die Domain. Der Code hängt an
keinem Anbieter, aber eine `.dev`-Domain hinter Cloudflare kann aus Russland
zäh sein. Ein einfacher VPS in der EU mit eigener Domain und eigenem TLS ist die
robusteste Variante — und weil die App offline vollständig funktioniert,
übersteht sie auch eine Störung von ein paar Stunden, ohne dass jemand etwas
verliert.

---

## Absicherung

Die App liegt hinter **einer einmaligen Passphrase**. Wichtig ist, wie herum:
Das Secret ist *nicht* ins Bundle kompiliert, sondern wird beim ersten Öffnen
eingegeben und auf dem Gerät gespeichert (`src/data/pair.ts`). Ein
einkompiliertes Secret bekäme jeder, der die URL kennt; so sieht ein Fremder nur
den Sperrbildschirm, und der Server weist ihn ab (401, mit Rate-Limit gegen
Durchprobieren).

**Was das nicht ist:** Verschlüsselung. Die Antworten liegen unverschlüsselt in
der lokalen Datenbank — wer das entsperrte Telefon in der Hand hält, liest mit.
Der Schutz gilt gegen Fremde im Netz, nicht gegen jemanden mit eurem Gerät.
Nehmt eine lange, zufällige Passphrase; der Sperrbildschirm schlägt eine vor.

### Lock-In: ihre Antwort erscheint erst, wenn du geschrieben hast

Das ist **serverseitig** durchgesetzt, nicht im Client. Solange die eigene
Antwort nicht angekommen ist, verlässt der Klartext der anderen Seite den Server
nicht — die Antwort enthält nur, *dass* geschrieben wurde und wann:

```
GET /api/days/2026-09-04     (eigene Antwort fehlt noch)
→ {"you":null,"partner":{"answered":true,"answeredAt":1788535431421}}
```

Die Balken im Screen sind leere Elemente, kein Weichzeichner über echtem Text.
Es gibt nichts, was man mit den Entwicklerwerkzeugen aufdecken könnte.

---

## Deployment

Vollständige Anleitung für einen Hetzner-VPS: **[`deploy/README.md`](deploy/README.md)**.
Einmal einrichten, danach deployt jeder Push auf `main` automatisch über
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Der Zuschnitt in einem Satz: gebaut wird in der CI, auf den Server gehen nur
`dist/` und **eine einzige Server-Datei ohne Abhängigkeiten** — zusammen rund
1 MB, 40 Dateien, kein `node_modules`, kein npm auf dem VPS. Ein Deploy ist
damit zwei `rsync` und ein `systemctl restart`, und eine kaputte
Paket-Registry kann die laufende App nie umwerfen, nur eine neue Version
verhindern.

```
Caddy (TLS)  →  127.0.0.1:8787  →  node server/index.mjs  →  dist/  +  /api
```

Der Node-Prozess bindet ausschließlich auf Loopback; nach außen spricht nur
Caddy. `DATA_DIR` liegt bewusst außerhalb des Deploy-Verzeichnisses
(`/var/lib/rjadom`), damit ein Deploy eure Antworten nicht anfassen kann. Die
Passphrase steht nur in `/etc/rjadom.env` auf dem Server — nie im Repository,
nie im Build, nie in der CI.

Der Health-Check nach jedem Deploy prüft genau zwei Dinge: `GET /` muss **200**
liefern und `GET /api/session` ohne Zugangsdaten **401**. Damit ist bestätigt,
dass die App läuft *und* das Schloss zu ist — ohne dass das Geheimnis dafür in
die CI muss.

Sollen App und API doch auf verschiedenen Hosts liegen, setzt
`VITE_SYNC_BASE_URL` auf die API-Origin und `ALLOWED_ORIGIN` auf die der App.
Mit `VITE_SYNC_BASE_URL=off` läuft die App ganz ohne Server, rein lokal.

### Sicherheits-Header

Der Server schickt eine enge Content-Security-Policy mit: alles von der eigenen
Origin, als einzige erlaubte Auslandsverbindung der Wetter-Endpunkt. Sie ist
gegen die laufende App getestet, nicht nur aufgeschrieben. Hostest du Open-Meteo
selbst, setze `WEATHER_ORIGIN` auf dem Server passend zu `VITE_WEATHER_BASE_URL`.

---

## Aufbau

```
src/
  i18n/           Wörterbücher (en/ru) und Sprachlogik
  content/        Städte, Fragenkatalog
  sky/            Himmelsband: Tagestabelle, Farben, Positionen (SunCalc)
  weather/        Open-Meteo: Abruf, Cache, WMO-Codes
  data/           IndexedDB, Einstellungen, Outbox, Sync, Passphrase
  components/     Himmelsband, Frage, Antwortpaar, Countdown, Tabs
  screens/        Heute, Mы (Einstellungen), Sperrbildschirm, Platzhalter
server/           Referenz-Sync-Server, ohne Abhängigkeiten
scripts/          Icons zeichnen, Schriften holen
```

### Das Sync-Protokoll

| Route | Zweck |
|---|---|
| `GET /api/session` | Prüft die Passphrase (für den Sperrbildschirm) |
| `GET /api/days/:date` | Eigene Antwort; die der anderen Seite nur, wenn die eigene existiert |
| `PUT /api/days/:date/answer` | Antwort schreiben, gibt denselben Tag zurück |

Auth über `x-pair-member: a|b` und `x-pair-secret`. Konflikte lösen sich per
*last write wins* über `updatedAt` — und da jede Seite nur ihren eigenen Eintrag
schreibt, entscheidet das nur zwischen Handy und Tablet derselben Person.

---

## Was bewusst offen ist

* **Karte und Chronik** haben noch keine Design-Vorlage. Sie sind ehrliche
  Platzhalter statt geratener Screens.
* Der **Zeit-Regler** aus dem Prototyp ist, wie im Handoff vorgesehen, kein
  Bedienelement mehr: über das Himmelsband wischen fährt durch den Tag, „назад к
  сейчас / back to now" springt zurück. Die Geste behält die Regler-Konvention —
  nach rechts ist später, auch wenn die Sonne von rechts nach links wandert. Sie
  ist eine Zeitsteuerung, keine Fläche, die man verschiebt.
* Der **Countdown** zeigt „не выбрано", bis unter „Мы" ein Datum gesetzt ist.
  Ebenso der Tageszähler über der Frage.
* Ein **Ende-zu-Ende-verschlüsselter** Modus wäre der nächste sinnvolle Schritt,
  wenn der Server selbst nicht mehr vertrauenswürdig sein soll.

---

## Fremde Bestandteile

* [SunCalc](https://github.com/mourner/suncalc) — BSD-2-Clause
* [Open-Meteo](https://open-meteo.com) — offene Daten (CC-BY 4.0), Software AGPL
* Cormorant Garamond, Spectral — SIL Open Font License 1.1
* React, Vite, idb, vite-plugin-pwa — MIT
