# ADR-0011 · Sprache: Russisch und Englisch, Systemsprache entscheidet

**Status:** Gültig
**Datum:** vor 2026-09-05 (rekonstruiert aus `src/i18n/`, README §2)

## Kontext

Die Design-Vorlage war deutsch. Die beiden Menschen, die die App benutzen,
sprechen miteinander Russisch und Englisch. Dieselbe App läuft auf beiden
Telefonen; ein festes grammatisches Geschlecht in den Statuszeilen wäre auf
einem davon immer falsch.

## Entscheidung

- `navigator.languages` entscheidet: `ru`, `be`, `kk`, `uk` → Russisch, sonst
  Englisch. Unter „Us" dauerhaft umstellbar (System / English / Русский), die
  Wahl liegt pro Gerät im `localStorage`, damit schon der erste Frame stimmt.
  Der Lock-Screen öffnet auf Russisch und bietet den Wechsel an.
- Alle Strings in `src/i18n/strings.ts`. Die russische Tabelle ist gegen die
  englische **typgeprüft**: fehlender Schlüssel = Build-Fehler. Plurale über
  `Intl.PluralRules`.
- Eigennamen werden nie übersetzt: `Hamburg` und `Калининград` behalten immer
  ihre Schreibung; Personennamen können zwei Schreibungen haben (`Tarik` /
  `Тарик`). Beide Schriften liegen in lateinischem *und* kyrillischem Subset vor.
- Statuszeilen sind geschlechtsneutral formuliert und unterscheiden Morgen
  („noch nicht") von Abend („nicht mehr").

## Verworfene Alternativen

- **Deutsch beibehalten.** Nicht die Sprache der beiden.
- **Strings inline mit Fallback auf Englisch.** Ein fehlender russischer Text
  wäre ein leeres oder englisches Label zur Laufzeit statt ein Fehler beim Bauen.

## Konsequenzen

- Jeder neue sichtbare Text braucht beide Tabellen — der Compiler erzwingt es.
- `Lock.tsx` hat einen eigenen kleinen `t()`-Helfer, weil der Screen vor dem
  Provider mit seiner eigenen Sprachwahl rendert ([TD-13](../tech-debt.md)).
