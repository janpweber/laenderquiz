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

Die Umrisse stammen aus [Natural Earth](https://www.naturalearthdata.com/) (Public Domain), bezogen über das Paket [world-atlas](https://github.com/topojson/world-atlas).

## Planung

Ziel und Umsetzungsschritte stehen in [docs/prd](docs/prd/laenderquiz.md).

Der Berliner Stadtumriss im Logo stammt aus [@svg-maps/germany](https://github.com/VictorCazanave/svg-maps) (CC BY 4.0, © Victor Cazanave) und wird mit `node scripts/build-berlin.mjs` zu Dreiecken umgebaut.
