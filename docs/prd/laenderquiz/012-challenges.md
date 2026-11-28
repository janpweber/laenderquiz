# 012 – Challenges per Link

PRD: docs/prd/laenderquiz.md
Typ: HITL (Jan muss das SQL-Schema in Supabase ausführen)
Blockiert durch: 011
Status: in Review

## Was (Entscheidungen von Jan, 28.11.2026)
- Jeder kann eine Challenge erstellen: Startbildschirm „Challenge erstellen“ oder auf dem Ergebnis „Freunde herausfordern“ (mit den gerade gespielten Einstellungen).
- Einstellungen: Name der Challenge, eigener Name, Region (Welt oder Kontinent), 5/10/20 Länder, Tempo (ohne, 5, 3, 2 s), gleiche Länder für alle (ja/nein), Versuche (1, 3, 5).
- Gleiche Länder: Länder und Antwortmöglichkeiten sind für alle gleich, die Reihenfolge wird pro Person gemischt. Bei mehreren Versuchen ist jeder Versuch vorab festgelegt, alle haben dieselben Versuche.
- Teilen per Link (WhatsApp usw., Web Share API, sonst Link kopieren). Der Link öffnet direkt „<Name> fordert dich heraus …“.
- Spielen: Name eingeben, spielen, danach Rangliste der Challenge. Es zählt der beste Versuch. Sortierung: mehr richtige, dann kürzere Zeit.
- Versuche pro Gerät (im Browser gespeichert, kein harter Schutz).
- Challenges laufen unbegrenzt.
- Danach „Frei weiterspielen“ mit denselben Einstellungen im freien Spiel; „Antworten durchgehen“ wie in 011.
- Kein eigener Trainingsmodus.

## Akzeptanzkriterien
- [ ] Challenge anlegen erzeugt einen kurzen Link
- [ ] Link öffnet die Einladung mit allen Bedingungen
- [ ] Gleiche Länder: alle bekommen dieselben Fragen und Antwortmöglichkeiten, Reihenfolge gemischt
- [ ] Versuche werden pro Gerät gezählt, danach nur noch Rangliste
- [ ] Rangliste der Challenge zeigt pro Person den besten Versuch
- [ ] Datenbank prüft Werte (Constraints), öffentlich nur lesen und eintragen
