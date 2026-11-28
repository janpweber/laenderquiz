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
  // Maßstab und Verschiebung des Umriss-Bildes (scale, tx, ty), siehe build-countries
  frame?: number[];
}

export type ViewBox = [number, number, number, number];

const W = 1000;
// gleiches Seitenverhältnis wie die Umriss-Karte im Spiel (1.45), damit keine Ränder bleiben
const H = 690;
const SVG_NS = 'http://www.w3.org/2000/svg';

let world: Promise<Feature[]> | undefined;
// Schon beim Anzeigen der Frage laden, damit die Karte nach der Antwort sofort da ist
export function preloadWorld(): void {
  loadWorld().catch(() => {
    world = undefined; // beim nächsten Mal neu versuchen
  });
}
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
  // Ausschnitt, der genau dem Umriss-Bild (viewBox 0 0 1000 1000) entspricht: gleiche Projektion,
  // nur anderer Maßstab. Von hier aus zoomt die Karte heraus.
  if (country.frame) svg.dataset.from = outlineViewBox(country.frame, projection.scale(), projection.translate()).join(' ');
  svg.setAttribute('class', 'context-map');
  // Karte füllt die Karte im Spiel ganz aus (oben/unten notfalls leicht beschnitten)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
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

// Umriss-Koordinaten in Karten-Koordinaten umrechnen: p_karte = (p_umriss - t1) * s2 / s1 + t2
export function outlineViewBox(frame: number[], scale: number, translate: [number, number]): ViewBox {
  const [s1, tx, ty] = frame;
  const k = scale / s1;
  return [(0 - tx) * k + translate[0], (0 - ty) * k + translate[1], 1000 * k, 1000 * k];
}

// Ausschnitt-Zwischenstand: Mittelpunkt linear, Größe logarithmisch, damit der Zoom gleichmäßig wirkt
export function interpolateViewBox(from: ViewBox, to: ViewBox, t: number): ViewBox {
  const w = from[2] * Math.pow(to[2] / from[2], t);
  const h = from[3] * Math.pow(to[3] / from[3], t);
  const cx = from[0] + from[2] / 2 + (to[0] + to[2] / 2 - (from[0] + from[2] / 2)) * t;
  const cy = from[1] + from[3] / 2 + (to[1] + to[3] / 2 - (from[1] + from[3] / 2)) * t;
  return [cx - w / 2, cy - h / 2, w, h];
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Vom Umriss-Ausschnitt auf die ganze Karte herauszoomen
export function zoomOut(svg: SVGSVGElement, ms = 500, delay = 0): void {
  const start0 = svg.dataset.from?.split(' ').map(Number) as ViewBox | undefined;
  const to: ViewBox = [0, 0, W, H];
  if (!start0 || start0.length !== 4 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Der Umriss wird eingepasst („meet“), die Karte füllt („slice“): Start-Ausschnitt auf das
  // Seitenverhältnis der Fläche erweitern, dann sieht der erste Frame genau wie der Umriss aus
  const box = svg.getBoundingClientRect();
  const from = fitAspect(start0, box.width / box.height || W / H);
  svg.setAttribute('viewBox', from.join(' '));
  let start: number | undefined;
  const step = (now: number) => {
    start ??= now + delay;
    const t = Math.min(1, Math.max(0, (now - start) / ms));
    svg.setAttribute('viewBox', interpolateViewBox(from, to, ease(t)).join(' '));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function fitAspect([x, y, w, h]: ViewBox, aspect: number): ViewBox {
  if (w / h < aspect) {
    const nw = h * aspect;
    return [x - (nw - w) / 2, y, nw, h];
  }
  const nh = w / aspect;
  return [x, y - (nh - h) / 2, w, nh];
}
