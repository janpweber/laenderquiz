# Länderquiz: Länder am Umriss erkennen

## Problem
Jans Chefin hat sich ein Spiel gewünscht, bei dem man Länder an ihrem Umriss erkennt. Jan will sie damit überraschen. Sie bekommt einen Link per WhatsApp und öffnet ihn am Handy. Das Spiel muss deshalb ohne Installation, Login oder Erklärung sofort im mobilen Browser laufen und Spaß machen. Eine Online-Bestenliste soll dafür sorgen, dass man sich mit anderen messen kann.

Es gibt noch kein Repository und keinen Code. Dieses Dokument ist der Ausgangspunkt für die Umsetzung.

## Lösung
Eine statische Web-App auf Deutsch, gebaut fürs Handy und auch am Laptop gut spielbar. Auf dem Startbildschirm stellt man die Runde ein: Länge, Kontinent und Schwierigkeit. Im Spiel sieht man den Umriss eines Landes und wählt aus vier Antworten. Die falschen Antworten stammen bevorzugt aus derselben Region, damit es nicht zu leicht wird. Nach jedem Tipp gibt es sofort eine Rückmeldung, ob die Antwort richtig war, und welches Land es war.

Am Ende sieht man die Punktzahl, den persönlichen Rekord und einen Button für eine neue Runde. Wer eine Ranglisten-Runde gespielt hat (Welt mit 10 Ländern oder ein Kontinent mit 5, jeweils normal), kann sich freiwillig mit einem Namen in die Online-Bestenliste eintragen. Die Bestenliste liegt in Supabase. Das Spiel selbst liegt auf GitHub Pages.

## User Stories

### Spielen
1. Als Spielerin will ich den Link aus WhatsApp öffnen und sofort einen Startbildschirm sehen, damit ich ohne Anmeldung loslegen kann.
2. Als Spielerin will ich die Rundenlänge wählen (10 als Standard, 20, endlos oder eine eigene Zahl), damit ich so lange spiele, wie ich Zeit habe.
3. Als Spielerin will ich bei einer eigenen Zahl nur Werte von 1 bis zur Zahl der aktuell verfügbaren Länder eingeben können, damit die Runde nicht ins Leere läuft.
4. Als Spielerin will ich nach Kontinent filtern, damit ich gezielt eine Region üben kann.
5. Als Spielerin will ich zwischen „Normal“ und „Schwer“ wählen, wobei winzige Inselstaaten nur in „Schwer“ vorkommen, damit normale Runden fair bleiben.
6. ~~Zeitlimit~~ (gestrichen am 27.11.2026: Jan braucht kein Zeitlimit. Die Antwortzeit wird nur gemessen.)
7. Als Spielerin will ich einen gut erkennbaren Umriss sehen, der den Bildschirm sinnvoll füllt, damit auch kleine Länder erkennbar sind.
8. Als Spielerin will ich aus vier großen, gut tippbaren Antwortknöpfen wählen, damit es mit dem Daumen bequem geht.
9. Als Spielerin will ich nach jedem Tipp sofort sehen, ob ich richtig lag, und bei Fehlern die richtige Antwort, damit ich dazulerne.
10. Als Spielerin will ich am Ende meine Gesamtzeit sehen, damit bei gleicher Punktzahl die schnellere Runde vorne liegt. (Countdown gestrichen am 27.11.2026.)
11. Als Spielerin will ich am Ende meine Punktzahl (richtig von gesamt) sehen und mit einem Tipp eine neue Runde mit denselben Einstellungen starten.
12. Als Spielerin will ich im Endlosmodus jederzeit aufhören können und dann meine Auswertung sehen.
13. Als Spielerin will ich, dass sich innerhalb einer Runde kein Land wiederholt, solange noch ungespielte Länder übrig sind.

22. Als Spielerin will ich bei einer schwierigen Frage einen Hinweis anfordern, der mir eine Flagge zeigt (Variante nach dem MVP festlegen), damit ich auch dann eine Chance habe, wenn ich den Umriss nicht erkenne.

### Rekord und Bestenliste
14. Als Spielerin will ich meinen persönlichen Rekord sehen, der auf meinem Gerät gespeichert bleibt, damit ich mich selbst übertreffen kann.
15. Als Spielerin will ich nach einer Ranglisten-Runde freiwillig einen Namen eingeben und mich in die Bestenliste eintragen, damit ich mich mit anderen vergleichen kann.
16. Als Spielerin will ich die Bestenliste ansehen, sortiert nach richtigen Antworten und bei Gleichstand nach der schnelleren Zeit.
17. Als Spielerin will ich nach anderen Runden einen Hinweis sehen, dass nur Ranglisten-Runden in die Bestenliste kommen, damit ich nicht verwirrt bin.
18. Als Spielerin will ich eine verständliche Meldung, wenn mein Name zu lang ist oder abgelehnt wird, damit ich einen anderen wählen kann.
19. Als Spielerin will ich weiterspielen können, wenn die Bestenliste nicht erreichbar ist (kein Netz, Supabase down). Das Spiel bleibt nutzbar, nur der Eintrag schlägt mit einer freundlichen Meldung fehl.

### Betrieb
20. Als Jan will ich unpassende Einträge selbst im Supabase-Dashboard löschen können, damit die Liste sauber bleibt.
21. Als Jan will ich, dass offensichtlich unmögliche Ergebnisse (mehr als 10 richtige, unrealistisch kurze oder zu lange Zeit) gar nicht erst gespeichert werden.

## Implementierungsentscheidungen

### Architektur
- **Statische Single-Page-App** ohne eigenes Backend, gehostet auf **GitHub Pages** in einem eigenen Repository. Begründung: kostenlos, ein einfacher Link, keine Server zu pflegen.
- **Supabase** nur für die Bestenliste. Das Frontend spricht Supabase mit dem öffentlichen Anon-Key an. Schreibrechte werden über Row Level Security und Datenbank-Constraints abgesichert, nicht über das Frontend.
- Kein Login, keine Werbung, kein Tracking, keine Cookies außer lokalem Speicher für den Rekord.
- Nur Deutsch. Texte trotzdem zentral halten, damit sie leicht zu ändern sind.

### Module (logische Bausteine)
- **Länderdaten:** Liste der 193 UN-Mitgliedsstaaten mit ISO-Code, deutschem Namen, Kontinent, Teilregion (für Ablenker), einem Kennzeichen „winziger Inselstaat“ und der Umrissgeometrie. Die Daten werden einmalig aus einer frei lizenzierten Quelle aufbereitet (z. B. Natural Earth, Public Domain) und als statische Datei mit ausgeliefert. Geometrien werden vereinfacht, damit die Datei fürs Handy klein bleibt.
- **Umriss-Darstellung:** Zeichnet ein einzelnes Land als SVG, auf den verfügbaren Platz skaliert und zentriert. Länder mit verstreuten Teilen (z. B. Inselgruppen, Überseegebiete) werden auf das Kerngebiet beschränkt, damit der Umriss nicht winzig wird.
- **Rundenlogik (reine Funktionen, ohne UI):** Erzeugt aus den Einstellungen (Länge, Kontinent, Schwierigkeit) die Länderfolge ohne Wiederholung, wählt pro Frage drei Ablenker bevorzugt aus derselben Teilregion, dann Kontinent, dann weltweit, mischt die vier Antworten, wertet Antworten aus und führt Punktzahl und Gesamtzeit. Der Zufall ist injizierbar, damit Tests reproduzierbar sind.
- **Timer:** 10 Sekunden pro Frage, wenn eingeschaltet. Ablauf zählt als falsche Antwort. Die Antwortzeit wird pro Frage gemessen und für die Bestenliste aufsummiert.
- **Lokaler Rekord:** Gespeichert im Browser (localStorage), getrennt nach Einstellungs-Kombination, damit eine 1-Länder-Runde nicht den 10er-Rekord schlägt. Mindestens der Rekord der Welt-Rangliste wird prominent gezeigt.
- **Bestenliste-Client:** Lesen der Top-Einträge und Eintragen eines Ergebnisses. Fehler werden abgefangen und freundlich angezeigt.
- **Hinweis:** Nach dem MVP: pro Frage ein Hinweis, der eine Flagge einblendet (gesuchtes Land oder alle 4 Antworten, noch offen). Flaggen als SVG aus einer frei lizenzierten Quelle (z. B. flag-icons, MIT). In Ranglisten-Runden ausgeblendet.
- **Bildschirme:** Start (Einstellungen), Spiel, Ergebnis (mit optionalem Eintrag), Bestenliste.

### Spielregeln im Detail
- **Rundenlänge:** 10 (Standard), 20, endlos oder freie Zahl von 1 bis N, wobei N die Zahl der Länder nach Kontinent- und Schwierigkeitsfilter ist. Endlos läuft, bis die Spielerin beendet oder alle Länder des Filters gespielt sind.
- **Schwierigkeit:** „Normal“ schließt winzige Inselstaaten aus, „Schwer“ nimmt alle Länder des Filters. Welche Staaten als winzig gelten, wird in den Länderdaten fest markiert (Richtwert: kleine Fläche und reine Inselstaaten, etwa Nauru, Tuvalu, Malediven, Seychellen, Karibik-Kleinstaaten). Die Liste wird bei der Datenaufbereitung einmal festgelegt und im Repository dokumentiert.
- **Ablenker** kommen immer aus der Menge der erlaubten Länder der aktuellen Runde, damit in „Normal“ keine Inselstaaten als Antworten auftauchen.
- **Ranglisten-Runden (geändert am 27.11.2026):** Welt mit 10 Ländern und jeder Kontinent mit 5 Ländern, immer Normal. Jede hat eine eigene Bestenliste. Nur nach einer solchen Runde wird der Eintrag angeboten. Auf dem Start stehen die Wege „Rangliste“ (hervorgehoben) und „Freies Spiel“. Für die Bestenliste zählt nur, was über „Rangliste“ gestartet wurde, freies Spiel nie, auch nicht mit denselben Einstellungen.
- **Wertung:** zuerst Anzahl richtiger Antworten (absteigend), dann Gesamtzeit (aufsteigend).

### Datenmodell (Supabase)
Tabelle für Bestenlisten-Einträge mit:
- ID, Zeitpunkt (vom Server gesetzt)
- Name (Text, getrimmt, 1 bis 20 Zeichen)
- Modus (Welt oder ein Kontinent)
- Richtige Antworten (Ganzzahl, 0 bis 10 für Welt, 0 bis 5 für Kontinente)
- Gesamtzeit in Millisekunden (Ganzzahl, mit Unter- und Obergrenze: Obergrenze 30 Minuten, Untergrenze 300 ms pro Frage)

Absicherung:
- Row Level Security: öffentlich nur Lesen und Einfügen, kein Ändern oder Löschen. Löschen macht Jan im Dashboard.
- Plausibilitätsprüfung als Datenbank-Constraints, damit sie auch bei direkten API-Aufrufen greift.
- Wortfilter für Namen: im Frontend für sofortige Rückmeldung und zusätzlich serverseitig (z. B. Check-Funktion oder Trigger mit Sperrliste), damit er nicht umgangen werden kann.
- Bekannte Grenze: Ohne Backend lässt sich ein plausibles, aber gefälschtes Ergebnis nicht verhindern. Das ist für ein Spiel unter Kolleginnen und Kollegen akzeptiert. Jan löscht Ausreißer von Hand.

Das Datenbank-Schema (Tabelle, Constraints, Policies) wird als SQL-Datei im Repository versioniert, damit Jan es im Supabase-SQL-Editor ausführen kann.

### Konfiguration
Supabase-URL und Anon-Key werden zur Build-Zeit eingesetzt. Der Anon-Key ist öffentlich und darf im Frontend stehen. Der Service-Role-Key kommt nie ins Repository.

## Testentscheidungen
- **Unit-Tests für die Rundenlogik** (Schwerpunkt): keine Wiederholungen, richtige Länge je Modus, Grenzen der freien Zahl, Filter nach Kontinent und Schwierigkeit, Ablenker sind verschieden, enthalten nie die richtige Antwort und kommen bevorzugt aus der Region, Auswertung bei Zeitablauf, Sortierung der Bestenliste. Getestet wird beobachtbares Verhalten über die öffentliche Schnittstelle mit festem Zufalls-Seed, nicht interne Hilfsfunktionen.
- **Datentests:** genau 193 Länder, jedes mit deutschem Namen, Kontinent, Teilregion und gültiger Geometrie; deutsche Namen sind eindeutig.
- **Namensprüfung:** Länge, Trimmen, Wortfilter mit ein paar Positiv- und Negativbeispielen.
- **Datenbank-Regeln:** einmal manuell gegen Supabase prüfen, dass unmögliche Werte und Änderungen/Löschungen über den Anon-Key abgelehnt werden.
- **Ende-zu-Ende (leichtgewichtig):** ein Browser-Test mit Handy-Viewport, der eine Ranglisten-Runde durchspielt und den Ergebnisbildschirm erreicht. Supabase wird dabei gemockt.
- **Manueller Abnahmetest:** Link per WhatsApp an sich selbst schicken und auf einem echten iPhone und Android-Handy im In-App-Browser und im normalen Browser spielen.

## Akzeptanzkriterien
- [ ] Die App ist unter einer GitHub-Pages-URL erreichbar und lädt am Handy über mobiles Netz in wenigen Sekunden.
- [ ] Startbildschirm, Spiel, Ergebnis und Bestenliste sind vollständig auf Deutsch.
- [ ] Rundenlänge 10 (vorausgewählt), 20, endlos und freie Zahl (1 bis N) funktionieren; ungültige Eingaben sind nicht möglich.
- [ ] Kontinent-Filter und Schwierigkeit „Normal/Schwer“ funktionieren; winzige Inselstaaten erscheinen nur in „Schwer“, auch nicht als Ablenker.
- [ ] Alle 193 UN-Staaten sind mit erkennbarem Umriss und korrektem deutschem Namen enthalten.
- [ ] Jede Frage zeigt vier verschiedene Antworten, eine davon richtig; Ablenker kommen bevorzugt aus derselben Region.
- [ ] Nach jedem Tipp erscheint sofort eine Rückmeldung mit der richtigen Antwort.
- [x] Kein Zeitlimit; die Antwortzeit wird gemessen und am Ende als Gesamtzeit angezeigt.
- [ ] Am Ende werden Punktzahl und persönlicher Rekord angezeigt; „Neue Runde“ startet mit denselben Einstellungen.
- [ ] Der persönliche Rekord bleibt nach Neuladen der Seite erhalten.
- [ ] Nur nach einer Ranglisten-Runde wird der Bestenlisten-Eintrag angeboten.
- [ ] Die Bestenliste sortiert nach richtigen Antworten, dann nach kürzerer Zeit.
- [ ] Zu lange oder gefilterte Namen und unmögliche Ergebnisse werden abgelehnt, auch bei direktem API-Aufruf.
- [ ] Über den öffentlichen Key können Einträge weder geändert noch gelöscht werden; Jan kann sie im Dashboard löschen.
- [ ] Ohne Netz oder bei Supabase-Fehlern bleibt das Spiel spielbar und zeigt eine freundliche Meldung.
- [ ] Keine Werbung, kein Tracking, kein Login.
- [ ] Bedienung mit dem Daumen auf einem kleinen Handy (ca. 360 px Breite) ist bequem, ohne horizontales Scrollen; am Laptop ist das Layout ebenfalls sauber.
- [ ] Unit-Tests für Rundenlogik, Daten und Namensprüfung laufen grün.

## Nicht im Scope
- Andere Sprachen als Deutsch
- Benutzerkonten, Login, Profile
- Werbung, Analytics, Tracking
- Andere Spielmodi (Hauptstädte, Flaggen als eigener Quiz-Modus, Karte anklicken, Freitext-Eingabe)
- Nicht-UN-Gebiete (z. B. Kosovo, Taiwan, Westsahara, Überseegebiete)
- Bestenlisten für andere Einstellungen als die Ranglisten-Runden (z. B. Schwer)
- Moderations-Oberfläche in der App (Löschen nur im Supabase-Dashboard)
- Vollständiger Schutz vor plausibel gefälschten Ergebnissen
- Installation als App (PWA) und Offline-Modus

## Offene Punkte (von Jan zu erledigen)
- **Supabase einrichten:** Account und Projekt anlegen, das versionierte SQL-Schema ausführen und Projekt-URL sowie Anon-Key bereitstellen.
- **GitHub-Zugriff geben:** GitHub verbinden (https://claude.ai/connect-github) und die Claude-GitHub-App installieren, damit das Repository angelegt bzw. angebunden und GitHub Pages aktiviert werden kann. Das Repository muss Jan selbst auf GitHub anlegen; danach kann es angebunden werden.

## Annahmen (bei Bedarf korrigieren)
- Endlosmodus endet, wenn die Spielerin aufhört oder alle Länder des Filters gespielt sind.
- Namenslänge maximal 20 Zeichen.
- Der lokale Rekord wird je Einstellungs-Kombination geführt.
- Der Hinweis ist in Ranglisten-Runden ausgeblendet.
