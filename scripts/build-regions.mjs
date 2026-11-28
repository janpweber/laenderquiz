// Erzeugt Bilder für die Regionen (Welt und Kontinente) im Stil des Deutschland-Logos:
// Low-Poly-Dreiecke in Havas-Rottönen. Auf dem „Geschafft“-Bildschirm fliegen die Dreiecke
// erst wie Konfetti und setzen sich dann zur Karte zusammen. Berlin ist in Welt und Europa schwarz.
// Umrisse aus Natural Earth 110m (world-atlas, Public Domain), grob genug für kleine Dateien.
// Ausführen mit: node scripts/build-regions.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature, merge } from 'topojson-client';
import { geoAzimuthalEqualArea, geoConicConformal, geoConicEqualArea, geoEqualEarth, geoPath } from 'd3-geo';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-110m.json');
const countries = JSON.parse(readFileSync(new URL('../src/countries.generated.json', import.meta.url), 'utf8'));
const geometries = topology.objects.countries.geometries;
const continentOf = new Map(countries.map((c) => [c.id, c.continent]));

const BERLIN = [13.405, 52.52];
const W = 400;
const STEP = 34;

// Länder je Region. Für ein stimmiges Bild kommen ein paar Nachbarn dazu
// (Russland zu Asien, Türkei zu Europa, Grönland zu Nordamerika); Europa wird auf einen Ausschnitt begrenzt.
const REGIONS = [
  { name: 'Welt', ids: () => true, projection: () => geoEqualEarth().rotate([-10, 0]), berlin: true, dropAntarctica: true },
  {
    name: 'Europa',
    ids: (id) => continentOf.get(id) === 'Europa' || ['792', '196', '268', '051', '031'].includes(id),
    projection: () => geoConicConformal().parallels([40, 65]).rotate([-15, 0]),
    box: [[-25, 34], [60, 71.5]],
    berlin: true,
  },
  { name: 'Asien', ids: (id) => continentOf.get(id) === 'Asien' || id === '643', projection: () => geoAzimuthalEqualArea().rotate([-95, -40]) },
  { name: 'Afrika', ids: (id) => continentOf.get(id) === 'Afrika' || id === '732', projection: () => geoAzimuthalEqualArea().rotate([-18, -2]) },
  {
    name: 'Nordamerika',
    ids: (id) => continentOf.get(id) === 'Nordamerika' || id === '304',
    projection: () => geoConicEqualArea().parallels([20, 60]).rotate([100, 0]),
    box: [[-169, 7], [-12, 83.5]],
  },
  { name: 'Südamerika', ids: (id) => continentOf.get(id) === 'Südamerika' || id === '238', projection: () => geoAzimuthalEqualArea().rotate([60, 20]) },
  {
    name: 'Ozeanien',
    ids: (id) => continentOf.get(id) === 'Ozeanien',
    projection: () => geoAzimuthalEqualArea().rotate([-160, 18]),
    box: [[110, -48], [-170 + 360, 2]],
  },
];

const random = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const f = (n) => n.toFixed(1);

function contains([[x1, y1], [x2, y2], [x3, y3]], [px, py]) {
  const s = (ax, ay, bx, by) => (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d1 = s(x1, y1, x2, y2);
  const d2 = s(x2, y2, x3, y3);
  const d3 = s(x3, y3, x1, y1);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function buildGrid(H, rng) {
  const rows = [];
  for (let j = -2; j * STEP * 0.87 < H + STEP; j++) {
    const row = [];
    for (let i = -2; i * STEP < W + STEP; i++) {
      row.push([i * STEP + (j % 2 ? STEP / 2 : 0) + (rng() - 0.5) * STEP * 0.6, j * STEP * 0.87 + (rng() - 0.5) * STEP * 0.6]);
    }
    rows.push(row);
  }
  const tris = [];
  for (let j = 0; j < rows.length - 1; j++) {
    const a = rows[j];
    const b = rows[j + 1];
    for (let i = 0; i < a.length - 1; i++) {
      tris.push(...(j % 2 ? [[a[i], b[i + 1], b[i]], [a[i], a[i + 1], b[i + 1]]] : [[a[i], a[i + 1], b[i]], [a[i + 1], b[i + 1], b[i]]]));
    }
  }
  return tris;
}

// Sutherland-Hodgman: Polygon an einem konvexen Polygon (Dreieck, Rechteck) abschneiden
function clipConvex(subject, clip) {
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i];
    const q = clip[(i + 1) % clip.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  const sign = Math.sign(area);
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const cur = input[k];
      const prev = input[(k + input.length - 1) % input.length];
      const sc = side(cur);
      const sp = side(prev);
      if (sc >= 0) {
        if (sp < 0) out.push(intersect(prev, cur, sp, sc));
        out.push(cur);
      } else if (sp >= 0) {
        out.push(intersect(prev, cur, sp, sc));
      }
    }
  }
  return out;
}
const intersect = (p, q, sp, sq) => {
  const t = sp / (sp - sq);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
};
const polyArea = (pts) =>
  Math.abs(pts.reduce((sum, p, i) => { const q = pts[(i + 1) % pts.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

const palette = ['#e60000', '#c40000', '#ff3b3b', '#ff6b6b', '#f59a9a', '#a80000', '#ffb3b3', '#d4142a', '#ff5a36', '#ffd2d2'];
const weights = [7, 5, 5, 4, 3, 3, 2, 3, 2, 1];

function edgePoints([[x0, y0], [x1, y1]]) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const x = x0 + ((x1 - x0) * i) / 40;
    const y = y0 + ((y1 - y0) * i) / 40;
    pts.push([x, y0], [x, y1], [x0, y], [x1, y]);
  }
  return { type: 'MultiPoint', coordinates: pts };
}

function build(region) {
  const selected = geometries.filter((g) => region.ids(g.id) && !(region.dropAntarctica && g.id === '010'));
  const land = merge(topology, selected);
  const fitTo = region.box ? edgePoints(region.box) : land;
  const projection = region.projection().fitWidth(W - 16, fitTo);
  const [[bx0, by0], [, by1]] = geoPath(projection).bounds(fitTo);
  const H = Math.ceil(by1 - by0 + 16);
  projection.translate([projection.translate()[0] - bx0 + 8, projection.translate()[1] - by0 + 8]);
  const view = [[0, 0], [W, 0], [W, H], [0, H]];

  const polys = land.coordinates
    .map((poly) => poly[0].map((c) => projection(c)))
    .map((ring) => clipConvex(ring, view))
    .filter((r) => r.length >= 3 && polyArea(r) > 0.3);

  const berlin = region.berlin ? projection(BERLIN) : undefined;
  const tris = buildGrid(H, random(7));
  const colorRng = random(23);
  const pick = () => {
    let r = colorRng() * weights.reduce((a, b) => a + b);
    for (let i = 0; i < palette.length; i++) if ((r -= weights[i]) < 0) return palette[i];
    return palette[0];
  };
  const motion = random(99);
  const pieces = [];
  for (const t of tris) {
    const parts = polys.map((ring) => clipConvex(ring, t)).filter((p) => p.length >= 3 && polyArea(p) > 0.4);
    if (!parts.length) continue;
    const city = berlin && contains(t, berlin);
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    // Konfetti: aus der Mitte nach oben und zur Seite geschleudert (1), langsam herabtrudeln (2), dann an den Platz
    const burst = (motion() - 0.5) * Math.PI * 1.1 - Math.PI / 2;
    const reach = 160 + motion() * 260;
    const x1 = W / 2 - cx + Math.cos(burst) * reach;
    const y1 = H * 0.4 - cy + Math.sin(burst) * reach;
    const x2 = x1 + (motion() - 0.5) * 120;
    const y2 = y1 + 120 + motion() * 140;
    const r1 = Math.round((motion() - 0.5) * 900);
    const r2 = r1 + Math.round((motion() - 0.5) * 540);
    const d = parts.map((p) => `M${p.map(([px, py]) => `${f(px)},${f(py)}`).join('L')}Z`).join('');
    const delay = city ? 0.3 : motion() * 0.25;
    pieces.push({
      city,
      svg: `<path class="tri${city ? ' city' : ''}" style="--x0:${f(W / 2 - cx)}px;--y0:${f(H * 0.55 - cy)}px;--x1:${f(x1)}px;--y1:${f(y1)}px;--x2:${f(x2)}px;--y2:${f(y2)}px;--r1:${r1}deg;--r2:${r2}deg;--d:${delay.toFixed(2)}s" d="${d}" fill="${city ? '#000000' : pick()}"/>`,
    });
  }

  const DURATION = 2.2;
  const style = `<style>
.tri { transform-box: fill-box; transform-origin: center; animation: confetti ${DURATION}s cubic-bezier(.3,.6,.35,1) var(--d) both; }
.city { animation: confetti ${DURATION}s cubic-bezier(.3,.6,.35,1) var(--d) both, pulse 1.6s ease-in-out calc(var(--d) + ${DURATION}s) infinite; }
@keyframes confetti {
  0% { transform: translate(var(--x0), var(--y0)) scale(0.2); opacity: 0; }
  8% { opacity: 1; }
  30% { transform: translate(var(--x1), var(--y1)) rotate(var(--r1)); }
  62% { transform: translate(var(--x2), var(--y2)) rotate(var(--r2)); }
  100% { transform: none; }
}
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
.still .tri { animation: none; }
.still .city { animation: pulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .tri, .city { animation: none; } }
</style>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" overflow="visible" role="img" aria-label="${region.name} aus Dreiecken">
${style}
<g stroke="#ffffff" stroke-opacity="0.3" stroke-width="0.6">
${pieces.filter((p) => !p.city).map((p) => p.svg).join('\n')}
</g>
${pieces.filter((p) => p.city).map((p) => p.svg).join('\n')}
</svg>
`;
  writeFileSync(new URL(`../src/regions/${region.name}.svg`, import.meta.url), svg);
  console.log(`${region.name}: ${W}×${H}, ${pieces.length} Stücke, ${Math.round(svg.length / 1024)} KB`);
}

mkdirSync(new URL('../src/regions/', import.meta.url), { recursive: true });
for (const region of REGIONS) build(region);
