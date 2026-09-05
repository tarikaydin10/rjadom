# Technische Schulden

Was bekannt und offen ist. Jeder Eintrag sagt, **woher** die Schuld kommt,
**was** sie riskiert und **wann** sie abgebaut werden sollte — damit niemand sie
zufällig entdeckt und für einen Fehler hält, und damit niemand sie „mal eben"
mit mehr Code zudeckt. Erledigte Einträge streichen, nicht löschen.

Stand: 2026-09-05.

---

## TD-01 · iOS: Layout-Viewport bleibt nach der Tastatur zu kurz — **offen**

**Woher:** WebKit-Verhalten in installierten Web-Apps mit `viewport-fit=cover`;
Details, Messwerte und Quellen in [ADR-0010](adr/0010-ios-tastatur-viewport-bug.md).
**Was es riskiert:** Nach der ersten Texteingabe steht die Tab-Leiste 62 pt zu
hoch, bis die App beendet wird. Sichtbar auf jedem Screen.
**Stand:** Zwei unbestätigte Maßnahmen im Repo (kein `overscroll-behavior:
none`; `healViewport()`). Testplan in ADR-0010.
**Abbau:** Sobald ein Test hält, die *andere* Maßnahme entfernen und erneut
testen. Wenn beide nicht helfen: Trainer vergleichen, iOS-Version notieren.

## TD-02 · PWA übernimmt Safaris Seitenzoom

**Woher:** iOS. Die Home-Screen-App lief mit 85 %, während Safari für die
Domain auf 100 % stand — auch nach Neuinstallation. Vermutlich gilt der
Standardwert „Andere Websites" (Einstellungen → Apps → Safari → Seitenzoom);
nicht belegt.
**Was es riskiert:** Nur noch Schriftgröße; das Layout ist seit ADR-0008 immun.
**Abbau:** Nicht im Code lösbar. Auf dem Gerät prüfen, welcher Wert gilt, und
das Ergebnis in ADR-0008/0010 eintragen.

## TD-03 · Rückstände der Fehlersuche vom 2026-09-05

Drei Dinge, die auf Grund einer falschen oder unbestätigten Hypothese ins Repo
kamen und dort harmlos, aber unbegründet stehen:

| Was | Wo | Warum es noch da ist |
|---|---|---|
| `shrink-to-fit=no` | `index.html` | Seit iOS 13 wirkungslos; kam gegen einen vermuteten Shrink-to-fit, der keiner war. |
| `contain: layout paint` | `.rail__track`, `styles.css` | Kam gegen dieselbe Vermutung. Sachlich sinnvoll (ein 1555-px-Kind soll nie zählen), aber nie als nötig belegt. |
| `healViewport()` | `src/main.tsx` | Sicherung für TD-01; unbestätigt. ~35 Zeilen. |

**Abbau:** Mit TD-01. `healViewport()` fliegt, sobald der Fehler ohne sie
nicht auftritt. Die beiden anderen können bleiben, wenn der Kommentar ehrlich
ist — er ist es.

## TD-04 · Keine automatisierten Tests

**Woher:** Projektgröße. Es gibt `tsc`, den Build und den Deploy-Health-Check
(200/401). Die CSP ist „gegen die laufende App getestet" — von Hand.
**Was es riskiert:** Regressionen in Sync-Logik (`applyDay`, Outbox-Retry,
`last write wins`), Tagesgrenzen (`dateKey` um Mitternacht, Zeitzonenwechsel)
und Server-Auth fallen erst auf dem Telefon auf.
**Abbau:** Sinnvoll wären wenige reine Unit-Tests ohne DOM: `src/lib/day.ts`,
`server/index.mjs` (`authenticate`, `dayResponse`, Rate-Limit). Layout und
iOS-Verhalten sind damit nicht testbar — das bleibt Gerätearbeit.

## TD-05 · Keine eingebaute Gerätediagnose

**Woher:** Heute wurde ein Wegwerf-Overlay (`ViewportDebug`) eingebaut,
deployt, abgelesen, entfernt. Ohne ein solches Werkzeug sind iOS-Fehler von
außen nur zu raten — und geraten wurde tagelang.
**Was es riskiert:** Beim nächsten Gerätefehler beginnt das Raten von vorn.
**Abbau (Option, keine Pflicht):** Ein versteckter Schalter unter „Us", der die
Messwerte aus ADR-0010 anzeigt. ~40 Zeilen, ohne Nebenwirkung. Nur bauen, wenn
TD-01 nicht in einem Zyklus zu lösen ist.

## TD-06 · Sync kennt kein Löschen

**Woher:** [ADR-0002](adr/0002-lokal-zuerst-outbox-sync.md). `applyDay`
übernimmt nur, was der Server *hat*; das Protokoll hat keine Tombstones.
**Was es riskiert:** Ein serverseitiger Reset (wie vor dem Livegang) lässt
lokale Kopien auf beiden Telefonen stehen. Eine später gelöschte Antwort käme
aus einer Outbox sogar zurück.
**Abbau:** Erst, wenn Löschen ein Produkt-Feature wird. Bis dahin: Reset =
Server leeren **und** PWA auf beiden Geräten neu installieren (oder Origin
wechseln — der Umzug auf `ryadom.net` erledigt das).

## TD-07 · Geteilte Passphrase als Fallback

**Woher:** [ADR-0003](adr/0003-passphrase-pro-seite-lock-in-serverseitig.md).
`PAIR_SECRET` für beide Seiten funktioniert noch; dann entscheidet der Header
`x-pair-member`, und der Lock-In ist nur behauptet. Der Server warnt beim Start.
**Was es riskiert:** Ein Betrieb im Fallback-Modus, ohne dass es jemand merkt.
**Abbau:** Prüfen, ob `/etc/ryadom.env` auf dem VPS `PAIR_SECRET_A` **und**
`PAIR_SECRET_B` setzt. Wenn ja: Fallback und `MEMBERS`-Header-Pfad aus
`authenticate()` entfernen.

## TD-08 · Klartext auf Gerät und Server

**Woher:** Bewusst (README „Absicherung"). Schloss, keine Verschlüsselung.
**Was es riskiert:** Wer den Server oder ein entsperrtes Telefon hat, liest.
**Abbau:** Ende-zu-Ende-Verschlüsselung wäre der nächste sinnvolle Schritt,
wenn der Server nicht mehr vertrauenswürdig sein soll. Kein aktueller Bedarf.

## TD-09 · `carry-over.ts` — die Umbenennung Rjadom → Ryadom

**Woher:** Migration der `localStorage`-/IndexedDB-Schlüssel beim Rename. Der
eigene Kommentar: „meant to be deleted eventually". Läuft bei jedem Start
synchron vor dem ersten Render.
**Was es riskiert:** Wenig — ein paar Storage-Reads pro Start.
**Abbau:** Nach dem Umzug auf `ryadom.net`. Neuer Origin = leerer Speicher =
nichts mehr zu tragen. Dann Datei und Aufruf in `main.tsx` löschen.

## TD-10 · Karte und Chronik sind Platzhalter

**Woher:** Keine Design-Vorlage (README „Was bewusst offen ist").
**Was es riskiert:** Zwei von vier Tabs führen ins Leere.
**Abbau:** Erst mit Vorlage. Bis dahin ehrliche Platzhalter statt geratener
Screens — das ist die Entscheidung, nicht ein Versäumnis.

## TD-11 · Backup der Serverdaten ist nicht Teil des Repos

**Woher:** [ADR-0004](adr/0004-server-ohne-abhaengigkeiten-deploy-per-rsync.md).
`/var/lib/ryadom/answers.json` ist eine Datei; atomar geschrieben, aber ohne
beschriebene Sicherung. Ob der VPS Snapshots macht, ist hier nicht bekannt.
**Was es riskiert:** Ein kaputtes Dateisystem oder ein `rm` löscht die
gemeinsame Geschichte der beiden.
**Abbau:** Auf dem Server prüfen. Reicht ein täglicher `cp` mit Datum in ein
zweites Verzeichnis plus Hetzner-Snapshot? Ergebnis in `deploy/README.md`
eintragen.

## TD-12 · Querformat ungetestet

**Woher:** Manifest sagt `orientation: portrait`; iOS ignoriert das für
Home-Screen-Apps. `--safe-left/right` sind vorbereitet, wurden aber nie im
Querformat gesehen.
**Was es riskiert:** Ein gedrehtes Telefon zeigt womöglich ein Layout, das
niemand entworfen hat.
**Abbau:** Einmal drehen und schauen. Vermutlich reicht ein `min-width` für
das Band — oder gar nichts.

## TD-13 · `Lock.tsx` hat einen eigenen `t()`-Helfer

**Woher:** Der Sperrbildschirm rendert mit eigener Sprachwahl (öffnet
Russisch), bevor die Wahl im Provider steht.
**Was es riskiert:** Zwei Übersetzungspfade, die auseinanderlaufen können.
**Abbau:** Beim nächsten Umbau des Lock-Screens den Provider eine
`locale`-Überschreibung annehmen lassen; klein, kein Druck.
