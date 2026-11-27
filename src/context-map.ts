// Kontextkarte: das gesuchte Land rot in seiner Region, Nachbarn grau.
// Die Weltkarte (Natural Earth 50m, ca. 240 KB) wird erst beim ersten Öffnen geladen.
import { geoAzimuthalEqualArea, geoCircle, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection } from 'geojson';

export interface MapCountry {
  id: string;
  center: number[];
  radius: number;
  tiny?: boolean;
}

const W = 1000;
const H = 750;
const SVG_NS = 'http://www.w3.org/2000/svg';

let world: Promise<Feature[]> | undefined;
function loadWorld(): Promise<Feature[]> {
  world ??= import('world-atlas/countries-50m.json').then((m) => {
    const topology = (m.default ?? m) as any;
    return (feature(topology, topology.objects.countries) as unknown as FeatureCollection).features;
  });
  return world;
}

// Ausschnitt: etwa das Dreifache der Landesgröße, mindestens 6°, höchstens 70°,
// damit auch kleine Länder Nachbarn zeigen und große Länder ganz zu sehen sind
export function viewRadius(radius: number): number {
  return Math.min(70, Math.max(6, radius * 2.6));
}

export async function contextMap(country: MapCountry): Promise<SVGSVGElement> {
  const features = await loadWorld();
  const [lon, lat] = country.center;
  const view = geoCircle().center([lon, lat]).radius(viewRadius(country.radius))();
  const projection = geoAzimuthalEqualArea()
    .rotate([-lon, -lat])
    .fitExtent([[0, 0], [W, H]], view as GeoPermissibleObjects)
    .clipExtent([[0, 0], [W, H]]);
  const path = geoPath(projection);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'context-map');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Karte mit dem Land in seiner Region');

  const add = (d: string | null, className: string) => {
    if (!d) return;
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', className);
    svg.append(p);
  };

  add(path(view as GeoPermissibleObjects), 'sea');
  for (const f of features) if (String(f.id) !== country.id) add(path(f), 'land');
  for (const f of features) if (String(f.id) === country.id) add(path(f), 'target');

  // Winzige Länder sind auf der Karte kaum zu sehen: roter Ring als Markierung
  const [x, y] = projection([lon, lat]) ?? [W / 2, H / 2];
  if (country.tiny || !features.some((f) => String(f.id) === country.id)) {
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', String(x));
    ring.setAttribute('cy', String(y));
    ring.setAttribute('r', '28');
    ring.setAttribute('class', 'marker');
    svg.append(ring);
  }
  return svg;
}
