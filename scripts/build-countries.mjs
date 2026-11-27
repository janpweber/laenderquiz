// Erzeugt aus Natural-Earth-Daten (Paket world-atlas, Public Domain) die Umrisse
// als fertige SVG-Pfade. Ausführen mit: npm run build:data
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-50m.json');
const list = JSON.parse(readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8'));

const SIZE = 1000;
const PADDING = 40;
const features = new Map(
  feature(topology, topology.objects.countries).features.map((f) => [String(f.id).padStart(3, '0'), f]),
);

const out = list.map(({ code, id, name }) => {
  const f = features.get(id);
  if (!f) throw new Error(`Kein Umriss für ${name} (${id})`);
  // Flächentreue Projektion, auf das Land zentriert: so wird nichts verzerrt
  const [lon, lat] = geoCentroid(f);
  const projection = geoAzimuthalEqualArea()
    .rotate([-lon, -lat])
    .fitExtent([[PADDING, PADDING], [SIZE - PADDING, SIZE - PADDING]], f);
  const path = geoPath(projection).digits(1)(f);
  return { code, name, path };
});

writeFileSync(new URL('../src/countries.generated.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length} Länder geschrieben`);
