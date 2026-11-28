# Länderquiz

Erkennst du die Länder an ihrem Umriss? Ein kleines Quiz fürs Handy.

## Entwicklung

```bash
npm install
npm run dev        # lokaler Server
npm test           # Tests
npm run build      # Produktions-Build nach dist/
npm run build:data # Umrisse aus data/countries.json neu erzeugen
```

Jeder Push auf `main` wird getestet und automatisch auf GitHub Pages veröffentlicht.

## Tests

- `npm test`: Unit-Tests (Rundenlogik, Daten, Rekord, Bestenliste)
- `npm run test:e2e`: Browser-Test am Handy-Viewport gegen den Build (`npm run build` vorher). Supabase wird im Test nachgebaut. Läuft auch in GitHub Actions.

Vorschaubild für WhatsApp und Icons neu erzeugen: `npm run build:og` (schreibt nach `public/`).

## Bestenliste (Supabase)

Die Bestenliste liegt in Supabase und wird direkt über die REST-Schnittstelle angesprochen.

1. Im Supabase-Dashboard **SQL Editor → New query** öffnen.
2. Den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und **Run** klicken. Das Skript lässt sich gefahrlos mehrfach ausführen.
3. Fertig. Einträge löschen geht im **Table Editor** (Tabelle `bestenliste`, Zeile markieren, Delete).

Was die Datenbank selbst absichert, auch bei direkten API-Aufrufen:
- Name getrimmt, 1 bis 20 Zeichen, Wortfilter (Sperrliste wie in `src/name.ts`)
- Modus Welt (10 Fragen) oder ein Kontinent (5 Fragen); höchstens so viele richtige wie Fragen, Gesamtzeit zwischen 0,3 s je Frage und 30 Minuten
- Öffentlich nur Lesen und Eintragen, kein Ändern oder Löschen

Im Frontend steht nur der **Publishable Key** (`src/leaderboard.ts`), der öffentlich sein darf. Der Secret- bzw. Service-Role-Key gehört nie ins Repository. Für ein anderes Projekt lassen sich URL und Key zur Build-Zeit über `VITE_SUPABASE_URL` und `VITE_SUPABASE_KEY` setzen.

## Daten

- **Umrisse:** [Natural Earth](https://www.naturalearthdata.com/) (Public Domain), bezogen über das Paket [world-atlas](https://github.com/topojson/world-atlas). 50m-Auflösung, für sehr kleine Länder 10m.
- **Deutsche Namen, Regionen, Flächen:** [world-countries](https://github.com/mledoze/countries) (ODbL 1.0)
- **Winzige Staaten** (unter 1000 km², nur im Modus „Schwer“): Andorra, Antigua und Barbuda, Bahrain, Barbados, Dominica, Grenada, Kiribati, Liechtenstein, Malediven, Malta, Marshallinseln, Mikronesien, Monaco, Nauru, Palau, San Marino, São Tomé und Príncipe, Seychellen, Singapur, St. Kitts und Nevis, St. Lucia, St. Vincent und die Grenadinen, Tonga, Tuvalu

Alle Umrisse auf einen Blick: `uebersicht.html` (auf GitHub Pages unter `/laenderquiz/uebersicht.html`).

## Flaggen

Die Flaggen für den Hinweis stammen aus [flag-icons](https://github.com/lipis/flag-icons) (MIT-Lizenz, siehe `src/flags/LICENSE-flag-icons`), Format 4:3, gespeichert als `src/flags/<ISO3>.svg`. Neu kopieren: `node scripts/copy-flags.mjs <Pfad zu flag-icons/flags/4x3>`.

## Planung

Ziel und Umsetzungsschritte stehen in [docs/prd](docs/prd/laenderquiz.md).

## Challenges

Über „Challenge erstellen“ legt man Bedingungen fest (Region, Anzahl, Tempo, gleiche Länder, Versuche) und teilt einen Link `…/laenderquiz/?c=<id>`. Gespeichert wird in den Supabase-Tabellen `challenges` und `challenge_ergebnisse`. Dafür muss `supabase/schema.sql` einmal (erneut) im SQL Editor ausgeführt werden; das Skript ist idempotent und lässt die Bestenliste unverändert. Löschen geht im Table Editor, beim Löschen einer Challenge verschwinden ihre Ergebnisse mit.

## Sperrwörter

Gesperrte Wörter für Namen und Challenge-Titel stehen in der Supabase-Tabelle `sperrwoerter` (App und Datenbank-Prüfung lesen beide daraus):
- `kern`: kleine Grundliste, geprüft als Teilwort. Dieselben Wörter stehen als Rückfall in `src/name.ts`.
- `ldnoobw-de`, `ldnoobw-en`: offene Liste [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (CC BY 4.0), geprüft nur als ganzes Wort.
- Ein Wort freigeben: im Table Editor `aktiv` auf `false` setzen, nicht löschen (sonst kommt es beim nächsten Abgleich zurück).

Die GitHub-Action „Sperrwörter abgleichen“ ergänzt die Liste am 1. jedes Monats (auch manuell startbar unter Actions). Sie braucht die Repository-Secrets `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys → secret/service_role). Dieser Schlüssel darf nur als Secret hinterlegt werden, nie im Code.
