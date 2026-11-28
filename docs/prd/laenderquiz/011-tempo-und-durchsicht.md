# 011 – Tempo (Speed) und Durchsicht der Antworten

PRD: docs/prd/laenderquiz.md
Typ: AFK
Blockiert durch: 010
Status: in Arbeit

## Was
Grundlage für die Speed-Challenges (012), aber auch im freien Spiel nutzbar.

- Neue Einstellung „Tempo“: ohne Zeitlimit (Standard), 5 s, 3 s oder 2 s pro Land.
- Mit Zeitlimit läuft unter dem Umriss ein Balken ab. Ist die Zeit um, zählt die Frage als falsch („Zeit abgelaufen. Das war …“), die Antwortzeit zählt mit dem vollen Limit.
- Mit Zeitlimit geht es nach jeder Antwort nach 1,5 s automatisch weiter (Karte und Flagge kurz sichtbar). „Weiter“ springt sofort.
- Nach jeder Runde: „Antworten durchgehen“. Man blättert durch alle Fragen, sieht Karte, Flagge, Größenvergleich, die eigene Antwort und die richtige, und kann in Ruhe zoomen und verschieben.
- Der persönliche Rekord wird je Tempo getrennt geführt. Ranglisten-Runden bleiben ohne Zeitlimit.

## Akzeptanzkriterien
- [ ] Tempo ist im freien Spiel einstellbar und wird gespeichert
- [ ] Zeit abgelaufen: Frage falsch, richtige Antwort markiert, nächste Frage kommt automatisch
- [ ] Nach einer Antwort im Tempo-Modus geht es nach 1,5 s weiter
- [ ] Durchsicht zeigt jede Frage mit eigener und richtiger Antwort, vor und zurück blätterbar
- [ ] Ohne Zeitlimit verhält sich das Spiel wie bisher
