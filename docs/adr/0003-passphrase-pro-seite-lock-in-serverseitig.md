# ADR-0003 · Passphrase pro Seite, nicht im Bundle; Lock-In serverseitig

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `src/data/pair.ts`, `server/index.mjs`, README „Absicherung")

## Kontext

Die Seite ist privat, liegt aber unter einer öffentlichen URL. Der wichtigste
Produkt-Mechanismus — *ihre Antwort erscheint erst, wenn du geschrieben hast* —
darf nicht mit den Entwicklerwerkzeugen zu umgehen sein.

## Entscheidung

**Zugang:** Eine Passphrase **pro Seite** (`PAIR_SECRET_A` Hamburg,
`PAIR_SECRET_B` Kaliningrad). Sie ist nicht ins Bundle kompiliert, sondern wird
einmal pro Gerät auf dem Sperrbildschirm eingegeben und im `localStorage`
gehalten. Welche Passphrase passt, *ist* die Seite — der Server leitet das
Mitglied aus dem Treffer ab, nicht aus einem Header. Konstante Vergleichszeit,
Rate-Limit pro IP plus eine globale, wachsende Verzögerung (kein Lockout, damit
niemand die beiden aussperren kann).

**Lock-In:** `dayResponse` gibt den Text der Gegenseite nur zurück, wenn die
eigene Antwort für diesen Tag existiert. Bis dahin enthält die Antwort nur
`answered` und `answeredAt`. Der Klartext verlässt den Prozess nicht.

Header-Werte sind ISO-8859-1; eine russische Passphrase reist deshalb
base64-kodiert mit `b64:`-Präfix.

## Verworfene Alternativen

- **Secret im Bundle.** Jeder mit der URL hätte es.
- **Eine geteilte Passphrase mit `x-pair-member`-Header.** War der erste
  Stand. Wer die Passphrase hat, könnte „ich bin die andere" behaupten und
  lesen, ohne zu schreiben. Existiert noch als Fallback (`PAIR_SECRET` für
  beide), mit Warnung beim Start — [TD-07](../tech-debt.md).
- **Lock-In im Client (Weichzeichner über echtem Text).** Der Text wäre auf dem
  Gerät; „verstecken" ist kein Schutz.
- **Harter Lockout nach N Fehlversuchen.** Ein Fremder könnte die beiden durch
  absichtliches Falschraten aussperren.

## Konsequenzen

- Das ist ein **Schloss, keine Verschlüsselung**: Antworten liegen im Klartext
  auf Gerät und Server ([TD-08](../tech-debt.md)). Wer das entsperrte Telefon
  hält, liest mit.
- Die Seite eines Geräts ist nicht änderbar — sie ist keine Einstellung,
  sondern die Folge des Schlüssels, der die Tür geöffnet hat.
- Der Deploy-Health-Check prüft `GET /api/session → 401` ohne Secret: Schloss
  zu, ohne dass das Secret in die CI muss.
