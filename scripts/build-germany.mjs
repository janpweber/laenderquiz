// Erzeugt das Logo: Deutschland aus Low-Poly-Dreiecken in Havas-Rottönen.
// Die Dreiecke, in denen Berlin und Freiburg liegen, sind schwarz.
// Umriss aus Natural Earth (world-atlas, Public Domain).
// Ausführen mit: node scripts/build-germany.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoConicConformal, geoContains, geoPath } from 'd3-geo';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-50m.json');
const germany = feature(topology, topology.objects.countries).features.find((f) => f.id === '276');

const CITIES = [
  { name: 'Berlin', coords: [13.405, 52.52] },
  { name: 'Freiburg', coords: [7.842, 47.999] },
];

const W = 400;
const H = 520;
const STEP = 42;
const projection = geoConicConformal().parallels([48.67, 53.67]).rotate([-10.5, 0]).fitExtent([[6, 6], [W - 6, H - 6]], germany);
const outlinePath = geoPath(projection).digits(1)(germany);
const cities = CITIES.map((c) => ({ ...c, point: projection(c.coords) }));
const inGermany = (p) => geoContains(germany, projection.invert(p));

const random = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function contains([[x1, y1], [x2, y2], [x3, y3]], [px, py]) {
  const s = (ax, ay, bx, by) => (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d1 = s(x1, y1, x2, y2);
  const d2 = s(x2, y2, x3, y3);
  const d3 = s(x3, y3, x1, y1);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

// Leicht verrücktes Dreiecksgitter über die ganze Fläche
function buildGrid(dx, dy, rng) {
  const rows = [];
  for (let j = -2; j * STEP * 0.87 < H + STEP; j++) {
    const row = [];
    for (let i = -2; i * STEP < W + STEP; i++) {
      row.push([dx + i * STEP + (j % 2 ? STEP / 2 : 0) + (rng() - 0.5) * STEP * 0.6, dy + j * STEP * 0.87 + (rng() - 0.5) * STEP * 0.6]);
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

// Gitter so lange verschieben, bis die Dreiecke beider Städte ganz in
// Deutschland liegen. Freiburg liegt nah an der Grenze und würde sonst abgeschnitten.
let tris;
search: for (let seed = 5; seed < 300; seed++) {
  for (let dx = 0; dx < STEP; dx += 5) {
    for (let dy = 0; dy < STEP; dy += 5) {
      const candidate = buildGrid(dx, dy, random(seed));
      const ok = cities.every((c) => candidate.find((t) => contains(t, c.point))?.every(inGermany));
      if (ok) {
        tris = candidate;
        break search;
      }
    }
  }
}
if (!tris) throw new Error('Kein passendes Gitter gefunden');

const colorRng = random(23);
const palette = ['#e60000', '#c40000', '#ff3b3b', '#ff6b6b', '#f59a9a', '#a80000', '#ffb3b3', '#d4142a', '#ff5a36', '#ffd2d2'];
const weights = [7, 5, 5, 4, 3, 3, 2, 3, 2, 1];
const pick = () => {
  let r = colorRng() * weights.reduce((a, b) => a + b);
  for (let i = 0; i < palette.length; i++) if ((r -= weights[i]) < 0) return palette[i];
  return palette[0];
};

const f = (n) => n.toFixed(1);
// Dreiecke werden geometrisch auf den Umriss zugeschnitten (statt per
// clip-path), damit sie beim Einfliegen auch außerhalb Deutschlands sichtbar sind.
const rings = (germany.geometry.type === 'Polygon' ? [germany.geometry.coordinates] : germany.geometry.coordinates).map(
  (poly) => poly[0].map((c) => projection(c)),
);
// Sutherland-Hodgman: beliebiges Polygon an einem konvexen Dreieck abschneiden
function clipToTriangle(subject, tri) {
  const area = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]);
  const sign = Math.sign(area);
  let out = subject;
  for (let i = 0; i < 3 && out.length; i++) {
    const a = tri[i];
    const b = tri[(i + 1) % 3];
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
const polyArea = (pts) => Math.abs(pts.reduce((sum, p, i) => { const q = pts[(i + 1) % pts.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

// Umgekehrte Explosion: jedes Stück startet weit außerhalb, in Richtung vom
// Kartenmittelpunkt weg, und fliegt mit Drehung an seinen Platz. Die
// Städte-Dreiecke kommen zuletzt und pulsieren danach dauerhaft.
const motion = random(99);
const CENTER = [W / 2, H / 2];
const SPREAD = 0.45;
const pieces = [];
for (const t of tris) {
  const parts = rings.map((ring) => clipToTriangle(ring, t)).filter((p) => p.length >= 3 && polyArea(p) > 0.5);
  if (!parts.length) continue;
  const city = cities.find((c) => contains(t, c.point));
  const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
  const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
  const angle = Math.atan2(cy - CENTER[1], cx - CENTER[0]) + (motion() - 0.5) * 0.8;
  const dist = 900 + motion() * 500;
  const x = Math.cos(angle) * dist;
  const y = Math.sin(angle) * dist;
  const r = Math.round((motion() - 0.5) * 720);
  const delay = city ? SPREAD + 0.25 : motion() * SPREAD;
  const d = parts.map((p) => `M${p.map(([px, py]) => `${f(px)},${f(py)}`).join('L')}Z`).join('');
  pieces.push(
    `<path class="tri${city ? ' city' : ''}" style="--x:${f(x)}px;--y:${f(y)}px;--r:${r}deg;--d:${delay.toFixed(2)}s" d="${d}" fill="${city ? '#000000' : pick()}"${city ? ` data-city="${city.name}"` : ''}/>`,
  );
}

const DURATION = 1.1;
const style = `<style>
.tri { transform-box: fill-box; transform-origin: center; animation: implode ${DURATION}s cubic-bezier(.15,.7,.25,1) var(--d) both; }
.city { animation: implode ${DURATION}s cubic-bezier(.15,.7,.25,1) var(--d) both, pulse 1.6s ease-in-out calc(var(--d) + ${DURATION}s) infinite; }
.de-border { animation: fade 0.5s ease-out ${(SPREAD + 0.25 + DURATION - 0.2).toFixed(2)}s both; }
@keyframes implode { from { transform: translate(var(--x), var(--y)) rotate(var(--r)); } to { transform: none; } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .tri, .city, .de-border { animation: none; } }
</style>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Deutschland aus Dreiecken, Berlin und Freiburg markiert">
${style}
<g stroke="#ffffff" stroke-opacity="0.3" stroke-width="0.6">
${pieces.filter((p) => !p.includes('data-city')).join('\n')}
</g>
<!-- Städte zuletzt, damit sie beim Pulsieren über allen anderen liegen -->
<path class="de-border" d="${outlinePath}" fill="none" stroke="#b00000" stroke-width="1.5" stroke-linejoin="round"/>
${pieces.filter((p) => p.includes('data-city')).join('\n')}
</svg>
`;
writeFileSync(new URL('../src/germany.svg', import.meta.url), svg);
console.log(`Deutschland: ${pieces.length} Stücke, markiert: ${pieces.filter((p) => p.includes('data-city')).length}`);
