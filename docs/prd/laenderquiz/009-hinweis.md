# 009 – Hinweis: Flagge

PRD: docs/prd/laenderquiz.md
Typ: HITL (Aussehen der Flaggen am Handy reviewen)
Blockiert durch: 008
Status: umgesetzt, wartet auf Jans Review

## Was (entschieden am 28.11.2026 mit Jan)
- Gezeigt wird die **echte Flagge des gesuchten Landes**, unverzerrt, klein oben rechts in der Umriss-Karte (mit weißem Rand, fliegt kurz herein). Verworfen: Flaggen an allen 4 Antworten, Umriss mit der Flagge füllen (Beispiele in Varianten A–E), Dreiecksstil.
- An derselben Stelle steht vorher „Flagge zeigen“. Ein Tipp ersetzt den Text durch die Flagge. Nach der Antwort verschwindet der Knopf, eine aufgedeckte Flagge bleibt sichtbar.
- **Freies Spiel:** kostet keine Punkte, im Ergebnis steht „n mit Hinweis“.
- **Ranglisten-Runde:** ebenfalls erlaubt, ohne Rückfrage. Danach verschwindet das Ranglisten-Abzeichen, unter dem Umriss steht dauerhaft „Mit Hinweis, zählt nicht für die Bestenliste“, am Ende kein Eintragsfeld.
- Runden mit Hinweis verbessern den persönlichen Rekord nicht.
- Nach der Antwort erscheint beim Wechsel auf die Karte („Auf der Karte zeigen“) auch die Flagge. Das zählt nicht als Hinweis.
- Flaggen: flag-icons (MIT), als einzelne SVG-Dateien, die erst beim Aufdecken geladen werden.

Der **Größenvergleich mit Deutschland** wird getrennt umgesetzt (eigene Aufgabe, noch zu klären: Zahl oder Grafik, Platz, Wertung).

## Akzeptanzkriterien
- [x] „Flagge zeigen“ ist pro Frage einmal nutzbar
- [x] Für alle 193 Länder gibt es eine Flagge (Datentest)
- [x] In Ranglisten-Runden führt der Hinweis zu „ohne Wertung“ und keinem Eintrag (Browser-Test)
- [x] Flaggen laden erst beim Aufdecken
- [x] Quelle und Lizenz der Flaggen sind im Repository vermerkt
- [ ] Jan hat das Aussehen am Handy abgenommen

## Bezug
User Stories aus dem PRD: #22
