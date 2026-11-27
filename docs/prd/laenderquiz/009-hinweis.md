# 009 – Hinweise: Flagge und Größenvergleich

PRD: docs/prd/laenderquiz.md
Typ: HITL (Aussehen der Flaggen am Handy reviewen)
Blockiert durch: 008 (erst nach dem MVP)
Status: zurückgestellt, Variante nach dem MVP entscheiden

## Was
Während einer Frage gibt es einen Button „Hinweis“. Tippt man darauf, erscheint eine Flagge als Hinweis. Offen ist, ob es die Flagge des gesuchten Landes ist (Empfehlung, echter Hinweis) oder die Flaggen an allen 4 Antworten. Pro Frage gibt es einen Hinweis.

Zweiter Hinweis (Idee von Jan): **Größenvergleich mit Deutschland.** Der Umriss allein verrät nichts über die Größe. Ein Knopf blendet Deutschland im selben Maßstab ein, als schwarze Kontur neben oder über dem gesuchten Land. Ist das Land viel größer als Deutschland, wird Deutschland klein eingeblendet, ist es viel kleiner, wird das Land neben einem großen Deutschland gezeigt. Dafür braucht jedes Land seinen Maßstab (Fläche bzw. Projektionsfaktor) in den Länderdaten. Die Flaggen kommen als SVG aus einer frei lizenzierten Quelle (z. B. flag-icons, MIT) und werden mit ausgeliefert, nur für die 193 UN-Staaten.

Annahme (bei Bedarf ändern): In der Standardrunde für die Bestenliste ist der Hinweis ausgeblendet, damit die Liste fair bleibt. In allen anderen Runden zählt eine Antwort mit Hinweis normal.

## Akzeptanzkriterien
- [ ] Größenvergleich: Deutschland und das gesuchte Land im gleichen Maßstab, für sehr große und sehr kleine Länder gut erkennbar
- [ ] Button „Hinweis“ ist pro Frage einmal nutzbar und danach deaktiviert
- [ ] Nach dem Hinweis ist die Flagge gut erkennbar bei 360 px Breite
- [ ] Für alle 193 Länder gibt es eine Flagge (Datentest)
- [ ] In der Standardrunde gibt es keinen Hinweis
- [ ] Flaggen laden schnell, auch über mobiles Netz
- [ ] Quelle und Lizenz der Flaggen sind im Repository vermerkt

## Bezug
User Stories aus dem PRD: #22
