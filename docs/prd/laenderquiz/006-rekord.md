# 006 – Persönlicher Rekord

PRD: docs/prd/laenderquiz.md
Typ: AFK
Blockiert durch: 004, 005
Status: erledigt

## Was
Bester Wert je Einstellungs-Kombination im localStorage. Ergebnisbildschirm zeigt Rekord und markiert einen neuen Rekord. Rekord der Standardrunde wird prominent gezeigt.

## Akzeptanzkriterien
- [x] Rekord bleibt nach Neuladen erhalten
- [x] Eine kurze Runde überschreibt nicht den 10er-Rekord
- [x] Vergleich: mehr richtige, bei Gleichstand kürzere Zeit
- [x] Funktioniert auch, wenn localStorage nicht verfügbar ist (kein Absturz)

## Bezug
User Stories aus dem PRD: #14
