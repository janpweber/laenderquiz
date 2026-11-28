# 010 – Land auf der Karte zeigen

PRD: docs/prd/laenderquiz.md
Typ: AFK
Blockiert durch: 002
Status: in Review

## Was
Idee von Jan: Nach jeder Antwort, ob richtig oder falsch, gibt es den Textlink „Auf der Karte zeigen“. Er ersetzt den Umriss durch eine Karte der Region, in der das Land rot hervorgehoben ist, Nachbarländer grau. So lernt man, wo ein unbekanntes Land liegt. „Umriss zeigen“ schaltet zurück.

Die Weltkarte (Natural Earth 50m) wird erst beim ersten Öffnen nachgeladen, damit der Start schnell bleibt. Winzige Staaten bekommen einen roten Ring.

## Akzeptanzkriterien
- [ ] Link erscheint erst nach der Antwort
- [ ] Ausschnitt zeigt Land und Nachbarn, auch bei sehr großen und sehr kleinen Ländern
- [ ] Länder über die Datumsgrenze (Fidschi, Russland) werden nicht zerschnitten
- [ ] Ohne Netz gibt es eine verständliche Meldung statt eines Fehlers

## Bezug
Neue User Story: Als Spielerin will ich nach der Antwort sehen, wo das Land liegt, damit ich dazulerne.

## Änderung 28.11.2026 (Jan)
Nach jeder Antwort erscheint die Karte automatisch, zusammen mit der Flagge. Der Knopf „Auf der Karte zeigen“ entfällt. Animation: Die Umgebung blendet um den großen Umriss herum ein (0,15 s), dann zoomt das Bild in 0,5 s auf den Kartenausschnitt heraus. Damit das nahtlos ist, speichert das Datenskript pro Land Maßstab und Verschiebung des Umrisses (`frame`). Ohne Netz bleibt der Umriss stehen. Bei „Bewegung reduzieren“ entfällt die Animation.
