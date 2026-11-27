# 003 – Schlaue Ablenker, keine Wiederholungen

PRD: docs/prd/laenderquiz.md
Typ: AFK
Blockiert durch: 002
Status: in Review

## Was
Rundenlogik als reine Funktionen mit injizierbarem Zufall: Länderfolge ohne Wiederholung, drei Ablenker bevorzugt aus derselben Teilregion, dann Kontinent, dann weltweit, immer nur aus den erlaubten Ländern der Runde. Antworten werden gemischt.

## Akzeptanzkriterien
- [ ] Tests mit festem Seed: 4 verschiedene Antworten, genau eine richtig
- [ ] Ablenker kommen bevorzugt aus der Teilregion (Fallback getestet für kleine Regionen)
- [ ] Kein Land doppelt, solange ungespielte übrig sind
- [ ] Ablenker nie außerhalb der erlaubten Länder

## Bezug
User Stories aus dem PRD: #8, #13
