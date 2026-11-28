// Erzeugt Bilder für die Regionen (Welt und Kontinente) im Stil des Deutschland-Logos:
// Low-Poly-Dreiecke in Havas-Rottönen. Auf dem „Geschafft“-Bildschirm fliegen die Dreiecke
// aus der Mitte wie Konfetti auseinander und setzen sich in einer durchgehenden Bewegung zur Karte zusammen.
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

const W = 400;
const STEP = 34;

// Länder je Region. Für ein stimmiges Bild kommen ein paar Nachbarn dazu
// (Russland zu Asien, Türkei zu Europa, Grönland zu Nordamerika); Europa wird auf einen Ausschnitt begrenzt.
const REGIONS = [
  { name: 'Welt', ids: () => true, projection: () => geoEqualEarth().rotate([-10, 0]), dropAntarctica: true },
  {
    name: 'Europa',
    ids: (id) => continentOf.get(id) === 'Europa' || ['792', '196', '268', '051', '031'].includes(id),
    projection: () => geoConicConformal().parallels([40, 65]).rotate([-15, 0]),
    box: [[-25, 34], [60, 71.5]],
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
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    // Bewegung aus zwei Teilen, die sich überlagern, damit nichts stehen bleibt:
    // .tri fliegt gleichmäßig von der Mitte an seinen Platz und dreht sich dabei aus,
    // die Gruppe darum schleudert es zuerst weit nach außen (Explosion) und holt es wieder zurück.
    // in alle Richtungen, leicht nach unten versetzt: das Bild steht oben auf dem Bildschirm
    const angle = motion() * Math.PI * 2;
    const reach = 120 + Math.sqrt(motion()) * 260;
    const bx = Math.cos(angle) * reach * 1.1;
    const by = Math.sin(angle) * reach * 0.9 + 70;
    const r = Math.round((motion() - 0.5) * 1440);
    const d = parts.map((p) => `M${p.map(([px, py]) => `${f(px)},${f(py)}`).join('L')}Z`).join('');
    const delay = motion() * 0.15;
    pieces.push(
      `<g class="burst" style="--bx:${f(bx)}px;--by:${f(by)}px;--d:${delay.toFixed(2)}s"><path class="tri" style="--x0:${f(W / 2 - cx)}px;--y0:${f(H * 0.5 - cy)}px;--r:${r}deg;--d:${delay.toFixed(2)}s" d="${d}" fill="${pick()}"/></g>`,
    );
  }

  const DURATION = 1.9;
  const style = `<style>
.tri { transform-box: fill-box; transform-origin: center; animation: home ${DURATION}s cubic-bezier(.45,0,.2,1) var(--d) both; }
.burst { animation: burst ${DURATION}s linear var(--d) both; }
@keyframes home {
  0% { transform: translate(var(--x0), var(--y0)) rotate(var(--r)) scale(0.3); opacity: 0; }
  6% { opacity: 1; }
  100% { transform: none; opacity: 1; }
}
@keyframes burst {
  0% { transform: translate(0, 0); animation-timing-function: cubic-bezier(.15,.75,.35,1); }
  42% { transform: translate(var(--bx), var(--by)); animation-timing-function: cubic-bezier(.55,0,.45,1); }
  100% { transform: translate(0, 0); }
}
.still .tri, .still .burst { animation: none; }
@media (prefers-reduced-motion: reduce) { .tri, .burst { animation: none; } }
</style>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" overflow="visible" role="img" aria-label="${region.name} aus Dreiecken">
${style}
<g stroke="#ffffff" stroke-opacity="0.3" stroke-width="0.6">
${pieces.join('\n')}
</g>
</svg>
`;
  writeFileSync(new URL(`../src/regions/${region.name}.svg`, import.meta.url), svg);
  console.log(`${region.name}: ${W}×${H}, ${pieces.length} Stücke, ${Math.round(svg.length / 1024)} KB`);
}

mkdirSync(new URL('../src/regions/', import.meta.url), { recursive: true });
for (const region of REGIONS) build(region);
