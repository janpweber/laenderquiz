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

## Planung

Ziel und Umsetzungsschritte stehen in [docs/prd](docs/prd/laenderquiz.md).
