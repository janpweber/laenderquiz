# 006 – Persönlicher Rekord

PRD: docs/prd/laenderquiz.md
Typ: AFK
Blockiert durch: 004, 005
Status: offen

## Was
Bester Wert je Einstellungs-Kombination im localStorage. Ergebnisbildschirm zeigt Rekord und markiert einen neuen Rekord. Rekord der Standardrunde wird prominent gezeigt.

## Akzeptanzkriterien
- [ ] Rekord bleibt nach Neuladen erhalten
- [ ] Eine kurze Runde überschreibt nicht den 10er-Rekord
- [ ] Vergleich: mehr richtige, bei Gleichstand kürzere Zeit
- [ ] Funktioniert auch, wenn localStorage nicht verfügbar ist (kein Absturz)

## Bezug
User Stories aus dem PRD: #14
