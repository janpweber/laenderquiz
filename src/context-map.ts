// Kontextkarte: das gesuchte Land rot in seiner Region, Nachbarn grau.
// Die Weltkarte (Natural Earth 50m, ca. 240 KB) wird erst beim ersten Öffnen geladen.
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoCircle, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection } from 'geojson';
import { ukrainianCrimea } from './crimea.js';

export interface MapCountry {
  id: string;
  center: number[];
  radius: number;
  tiny?: boolean;
  // Maßstab und Verschiebung des Umriss-Bildes (scale, tx, ty), siehe build-countries
  frame?: number[];
  // falsch gewähltes Land, wird dunkelgrau markiert
  wrong?: { id?: string; center?: number[]; tiny?: boolean };
}

export type ViewBox = [number, number, number, number];

const W = 1000;
// gleiches Seitenverhältnis wie die Umriss-Karte im Spiel (1.45), damit keine Ränder bleiben
const H = 690;
const SVG_NS = 'http://www.w3.org/2000/svg';
const GERMANY_ID = '276';

let world: Promise<Feature[]> | undefined;
// Schon beim Anzeigen der Frage laden, damit die Karte nach der Antwort sofort da ist
export function preloadWorld(): void {
  loadWorld().catch(() => {
    world = undefined; // beim nächsten Mal neu versuchen
  });
}
function loadWorld(): Promise<Feature[]> {
  world ??= import('world-atlas/countries-50m.json').then((m) => {
    // Krim zur Ukraine, wie im Umriss (siehe crimea.js)
    const topology = ukrainianCrimea((m.default ?? m) as any);
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
    .fitExtent([[0, 0], [W, H]], view as GeoPermissibleObjects);
  // Kein Beschnitt: die ganze Welt wird gezeichnet, damit man per Geste herauszoomen und verschieben kann
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

  add(path({ type: 'Sphere' }), 'sea');
  const wrongId = country.wrong?.id;
  for (const f of features) {
    const id = String(f.id);
    if (id !== country.id && id !== wrongId) add(path(f), 'land');
  }
  for (const f of features) if (wrongId && String(f.id) === wrongId) add(path(f), 'wrong');
  for (const f of features) if (String(f.id) === country.id) add(path(f), 'target');

  // Winzige Länder sind auf der Karte kaum zu sehen: Ring als Markierung
  const ring = (center: number[], className: string) => {
    const point = projection(center as [number, number]);
    if (!point) return;
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(point[0]));
    c.setAttribute('cy', String(point[1]));
    c.setAttribute('r', '28');
    c.setAttribute('class', className);
    svg.append(c);
  };
  const wrong = country.wrong;
  if (wrong?.center && (wrong.tiny || !features.some((f) => String(f.id) === wrong.id))) ring(wrong.center, 'marker wrong-marker');
  if (country.tiny || !features.some((f) => String(f.id) === country.id)) ring([lon, lat], 'marker');

  // Größenvergleich: Deutschland im selben Maßstab über das Land gelegt. Die Projektion ist
  // flächentreu, darum stimmen die Flächen auch optisch.
  const germany = features.find((f) => String(f.id) === GERMANY_ID);
  const target = features.find((f) => String(f.id) === country.id);
  if (germany && target && country.id !== GERMANY_ID) {
    const [glon, glat] = geoCentroid(germany);
    const there = projection([lon, lat]) ?? [W / 2, H / 2];
    const overlay = geoAzimuthalEqualArea().rotate([-glon, -glat]).scale(projection.scale()).translate(there);
    add(geoPath(overlay)(germany), 'germany');
    svg.dataset.ratio = String(geoArea(target) / geoArea(germany));
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
  const to: ViewBox = [0, 0, W, H];
  const from = startView(svg);
  if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Der Umriss wird eingepasst („meet“), die Karte füllt („slice“): Start-Ausschnitt auf das
  // Seitenverhältnis der Fläche erweitern, dann sieht der erste Frame genau wie der Umriss aus
  setView(svg, from);
  let start: number | undefined;
  const step = (now: number) => {
    if (svg.dataset.touched) return; // Nutzer zoomt oder verschiebt selbst: Animation abbrechen
    start ??= now + delay;
    const t = Math.min(1, Math.max(0, (now - start) / ms));
    setView(svg, interpolateViewBox(from, to, ease(t)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Ausschnitt setzen; Ringe um winzige Länder nur zeigen, wenn man weit genug herausgezoomt ist
// (ab dann wäre das Land ohne Ring kaum zu finden, beim Hineinzoomen verschwinden sie wieder)
export const MARKER_MIN_WIDTH = 400;
function setView(svg: SVGSVGElement, v: ViewBox): void {
  svg.setAttribute('viewBox', v.join(' '));
  const show = v[2] >= MARKER_MIN_WIDTH;
  svg.querySelectorAll('.marker').forEach((m) => m.classList.toggle('away', !show));
}

// Startausschnitt (Umriss) auf die Zeichenfläche erweitert: näher kann man nicht heranzoomen
function startView(svg: SVGSVGElement): ViewBox | undefined {
  const start = svg.dataset.from?.split(' ').map(Number) as ViewBox | undefined;
  return start && start.length === 4 ? fitAspect(start, contentAspect(svg)) : undefined;
}

export function fitAspect([x, y, w, h]: ViewBox, aspect: number): ViewBox {
  if (w / h < aspect) {
    const nw = h * aspect;
    return [x - (nw - w) / 2, y, nw, h];
  }
  const nh = w / aspect;
  return [x, y - (nh - h) / 2, w, nh];
}

// Seitenverhältnis der Zeichenfläche ohne Innenabstand (so rechnet auch der Browser die viewBox um)
function contentAspect(svg: SVGSVGElement): number {
  const style = getComputedStyle(svg);
  const w = svg.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const h = svg.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  return w > 0 && h > 0 ? w / h : W / H;
}

// Mit den Fingern zoomen (zwei Finger) und verschieben (ein Finger), am Laptop mit Mausrad und Ziehen.
// Doppeltipp zoomt hinein. Es wird nur der Ausschnitt (viewBox) verändert.
export function enableGestures(svg: SVGSVGElement): void {
  // Am nächsten heran: so wie der Umriss am Anfang zu sehen war
  const MIN_W = startView(svg)?.[2] ?? W / 4;
  const MAX_W = W * 4;
  const pointers = new Map<number, { x: number; y: number }>();
  let lastTap = 0;
  const get = () => svg.getAttribute('viewBox')!.split(' ').map(Number) as ViewBox;
  const set = (v: ViewBox) => setView(svg, v);
  // Bildschirmpunkt in Karten-Koordinaten (berücksichtigt „slice“ und Innenabstand)
  const toMap = (cx: number, cy: number): [number, number] => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };
  const zoomAt = (mx: number, my: number, factor: number) => {
    const [x, y, w, h] = get();
    const nw = Math.min(MAX_W, Math.max(MIN_W, w * factor));
    const f = nw / w;
    set([mx - (mx - x) * f, my - (my - y) * f, w * f, h * f]);
  };

  svg.addEventListener('pointerdown', (e) => {
    svg.dataset.touched = '1';
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch' && pointers.size === 1) {
      const now = performance.now();
      if (now - lastTap < 300) {
        const [mx, my] = toMap(e.clientX, e.clientY);
        zoomAt(mx, my, 0.5);
      }
      lastTap = now;
    }
  });
  svg.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      const [ax, ay] = toMap(prev.x, prev.y);
      const [bx, by] = toMap(next.x, next.y);
      const [x, y, w, h] = get();
      set([x + ax - bx, y + ay - by, w, h]);
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0 && after > 0) {
        const [mx, my] = toMap((next.x + other.x) / 2, (next.y + other.y) / 2);
        const [px, py] = toMap((prev.x + other.x) / 2, (prev.y + other.y) / 2);
        const [x, y, w, h] = get();
        set([x + px - mx, y + py - my, w, h]); // Mittelpunkt mitführen
        zoomAt(mx, my, before / after);
      }
    }
    pointers.set(e.pointerId, next);
  });
  const end = (e: PointerEvent) => pointers.delete(e.pointerId);
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      svg.dataset.touched = '1';
      const [mx, my] = toMap(e.clientX, e.clientY);
      zoomAt(mx, my, Math.exp(e.deltaY * 0.0015));
    },
    { passive: false },
  );
}

// Text für den Größenvergleich, z. B. „2,3 × so groß wie Deutschland“
export function sizeComparison(ratio: number): string {
  const fmt = (x: number) =>
    x >= 10 ? String(Math.round(x)) : x.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  if (ratio >= 0.95 && ratio <= 1.05) return 'etwa so groß wie Deutschland';
  if (ratio > 1) return `${fmt(ratio)} × so groß wie Deutschland`;
  const inverse = 1 / ratio;
  return inverse >= 1000 ? 'Deutschland ist über 1000 × so groß' : `Deutschland ist ${fmt(inverse)} × so groß`;
}
