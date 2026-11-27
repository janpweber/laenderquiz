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

## Daten

- **Umrisse:** [Natural Earth](https://www.naturalearthdata.com/) (Public Domain), bezogen über das Paket [world-atlas](https://github.com/topojson/world-atlas). 50m-Auflösung, für sehr kleine Länder 10m.
- **Deutsche Namen, Regionen, Flächen:** [world-countries](https://github.com/mledoze/countries) (ODbL 1.0)
- **Winzige Staaten** (unter 1000 km², nur im Modus „Schwer“): Andorra, Antigua und Barbuda, Bahrain, Barbados, Dominica, Grenada, Kiribati, Liechtenstein, Malediven, Malta, Marshallinseln, Mikronesien, Monaco, Nauru, Palau, San Marino, São Tomé und Príncipe, Seychellen, Singapur, St. Kitts und Nevis, St. Lucia, St. Vincent und die Grenadinen, Tonga, Tuvalu

Alle Umrisse auf einen Blick: `uebersicht.html` (auf GitHub Pages unter `/laenderquiz/uebersicht.html`).

## Planung

Ziel und Umsetzungsschritte stehen in [docs/prd](docs/prd/laenderquiz.md).
