# Der ursprüngliche Design-Handoff

Diese Dateien sind die Vorlage, nach der der Home-Screen gebaut wurde —
unverändert, so wie sie geliefert wurden, als Referenz aufbewahrt.

Zwei Dinge weichen in der Umsetzung bewusst ab:

1. **Sprache.** Der Handoff ist deutsch/russisch; die App spricht englisch/
   russisch nach Systemsprache. Deutsch kommt im Produkt nicht mehr vor.
2. **Astronomie.** Der Prototyp rechnet Sonne und Mond selbst. Die App nutzt
   SunCalc, weil Auf- und Untergangszeiten damit exakt statt auf ±5 Minuten
   genau sind. Achtung beim Vergleichen: SunCalc 2.x liefert **Grad**, nicht
   Bogenmaß, und misst Azimut im Uhrzeigersinn ab Nord — der Prototyp rechnet
   mit Stundenwinkel im Bogenmaß.

Alles andere — Farben, Abstände, Typografie, Schichtaufbau des Himmelsbands —
ist übernommen.
