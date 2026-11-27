// Erzeugt aus Natural-Earth-Daten (Paket world-atlas, Public Domain) die Umrisse
// als fertige SVG-Pfade. Ausführen mit: npm run build:data
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoDistance, geoPath } from 'd3-geo';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-50m.json');
const list = JSON.parse(readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8'));

const SIZE = 1000;
const PADDING = 40;
// Manche Codes kommen mehrfach vor (z. B. 036 für Australien und die winzigen
// Ashmore- und Cartierinseln). Pro Code zählt das flächengrößte Gebiet.
const features = new Map();
for (const f of feature(topology, topology.objects.countries).features) {
  if (f.id === undefined) continue;
  const id = String(f.id).padStart(3, '0');
  const existing = features.get(id);
  if (!existing || geoArea(f) > geoArea(existing)) features.set(id, f);
}

// Kleine, weit entfernte Inseln (z. B. Macquarie bei Australien) würden das Land
// winzig und aus der Mitte rutschen lassen. Sie werden weggelassen, wenn sie
// weniger als 1 % der Fläche ausmachen und mehr als 1500 km vom Kerngebiet liegen.
const MAX_DISTANCE = 1500 / 6371;
function coreArea(f) {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const parts = f.geometry.coordinates.map((coordinates) => {
    const polygon = { type: 'Polygon', coordinates };
    return { coordinates, area: geoArea(polygon), centroid: geoCentroid(polygon) };
  });
  const total = parts.reduce((sum, p) => sum + p.area, 0);
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a));
  const kept = parts.filter(
    (p) => p.area >= total * 0.01 || geoDistance(p.centroid, main.centroid) <= MAX_DISTANCE,
  );
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: kept.map((p) => p.coordinates) } };
}

const out = list.map(({ code, id, name }) => {
  const raw = features.get(id);
  if (!raw) throw new Error(`Kein Umriss für ${name} (${id})`);
  const f = coreArea(raw);
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
