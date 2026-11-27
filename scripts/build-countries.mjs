// Erzeugt die Länderdaten für das Spiel: alle 193 UN-Mitgliedsstaaten mit
// deutschem Namen, Kontinent, Teilregion, Kennzeichen „winzig“ und Umriss.
//
// Quellen:
// - Umrisse: Natural Earth (Paket world-atlas, Public Domain), 50m, für
//   Länder, die dort fehlen, 10m
// - Namen, Regionen, Fläche: world-countries (ODbL)
//
// Ausführen mit: npm run build:data
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoDistance, geoPath } from 'd3-geo';

const require = createRequire(import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(require.resolve(name), 'utf8'));

// Der Vatikan ist in den Quelldaten als UN-Mitglied markiert, hat aber nur Beobachterstatus
const NOT_UN = new Set(['VAT']);

// Gebräuchlichere deutsche Namen
const NAME_OVERRIDES = {
  CIV: 'Elfenbeinküste',
  SWZ: 'Eswatini',
  COG: 'Republik Kongo',
  COD: 'Demokratische Republik Kongo',
};

// Staaten unter 1000 km² sind als Umriss kaum zu erkennen und kommen nur im
// Modus „Schwer“ vor
const TINY_AREA_KM2 = 1000;

function continentOf({ region, subregion }) {
  if (region === 'Americas') return subregion === 'South America' ? 'Südamerika' : 'Nordamerika';
  return { Africa: 'Afrika', Asia: 'Asien', Europe: 'Europa', Oceania: 'Ozeanien' }[region];
}

// Pro Code das flächengrößte Gebiet (z. B. teilen sich Australien und die
// Ashmore- und Cartierinseln den Code 036)
function featuresById(topology) {
  const byId = new Map();
  for (const f of feature(topology, topology.objects.countries).features) {
    if (f.id === undefined) continue;
    const existing = byId.get(f.id);
    if (!existing || geoArea(f) > geoArea(existing)) byId.set(f.id, f);
  }
  return byId;
}
const features50 = featuresById(readJson('world-atlas/countries-50m.json'));
const features10 = featuresById(readJson('world-atlas/countries-10m.json'));

// Kerngebiet: vom größten Teil aus werden alle Teile aufgenommen, die höchstens
// 400 km von einem bereits aufgenommenen Teil entfernt liegen (Inselketten wie
// Indonesien bleiben so vollständig) oder mindestens ein Viertel so groß sind
// wie der größte Teil. Weit entfernte Überseegebiete (z. B. Französisch-
// Guayana, Alaska, Hawaii) fallen weg, damit das Land groß und erkennbar bleibt.
const MAX_HOP = 400 / 6371;
function coreArea(f) {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const parts = f.geometry.coordinates.map((coordinates) => {
    const polygon = { type: 'Polygon', coordinates };
    return { coordinates, area: geoArea(polygon), centroid: geoCentroid(polygon) };
  });
  parts.sort((a, b) => b.area - a.area);
  const main = parts[0];
  const kept = [main];
  let rest = parts.slice(1);
  let added = true;
  while (added) {
    added = false;
    rest = rest.filter((p) => {
      const near = kept.some((k) => geoDistance(p.centroid, k.centroid) <= MAX_HOP);
      if (near || p.area >= main.area * 0.25) {
        kept.push(p);
        added = true;
        return false;
      }
      return true;
    });
  }
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: kept.map((p) => p.coordinates) } };
}

// Manche Inseln sind in den Quelldaten falsch herum orientiert. d3 deutet sie
// dann als „ganze Erde ohne diese Insel“ (z. B. Malediven als Vollkreis).
function fixWinding(f) {
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const fixed = polygons.map((rings) =>
    geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings,
  );
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: fixed } };
}

const SIZE = 1000;
const PADDING = 40;
function outlinePath(f) {
  // Flächentreue Projektion, auf das Land zentriert: so wird nichts verzerrt
  const [lon, lat] = geoCentroid(f);
  const projection = geoAzimuthalEqualArea()
    .rotate([-lon, -lat])
    .fitExtent([[PADDING, PADDING], [SIZE - PADDING, SIZE - PADDING]], f);
  return geoPath(projection).digits(1)(f);
}

const MIN_POINTS = 60;
const pointCount = (path) => path.split(/[MLZ]/).filter(Boolean).length;

const countries = readJson('world-countries/countries.json')
  .filter((c) => c.unMember && !NOT_UN.has(c.cca3))
  .map((c) => {
    // Kleine Länder sind in der 50m-Auflösung nur grobe Vielecke, dann 10m nehmen
    let raw = features50.get(c.ccn3);
    if (!raw || pointCount(outlinePath(coreArea(fixWinding(raw)))) < MIN_POINTS) raw = features10.get(c.ccn3) ?? raw;
    if (!raw) throw new Error(`Kein Umriss für ${c.cca3}`);
    return {
      code: c.cca3,
      name: NAME_OVERRIDES[c.cca3] ?? c.translations.deu.common,
      continent: continentOf(c),
      subregion: c.subregion,
      tiny: c.area < TINY_AREA_KM2,
      path: outlinePath(coreArea(fixWinding(raw))),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));

writeFileSync(new URL('../src/countries.generated.json', import.meta.url), JSON.stringify(countries));
console.log(`${countries.length} Länder geschrieben, davon ${countries.filter((c) => c.tiny).length} winzig`);
