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
const pts = (list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
// Einflug-Animation: jedes Dreieck bekommt eine zufällige Verzögerung,
// die Städte-Dreiecke kommen zuletzt und pulsieren danach dauerhaft.
const delayRng = random(99);
const FLY_IN = 1.2;
const polygons = tris.map((t) => {
  const city = cities.find((c) => contains(t, c.point));
  if (city) {
    return `<polygon class="tri city" style="--d:${FLY_IN + 0.15}s" points="${pts(t)}" fill="#000000" data-city="${city.name}"/>`;
  }
  return `<polygon class="tri" style="--d:${(delayRng() * FLY_IN).toFixed(2)}s" points="${pts(t)}" fill="${pick()}"/>`;
});

const style = `<style>
.tri { transform-box: fill-box; transform-origin: center; animation: fly 0.5s cubic-bezier(.2,.8,.3,1.2) var(--d) both; }
.city { animation: fly 0.5s cubic-bezier(.2,.8,.3,1.2) var(--d) both, pulse 1.6s ease-in-out calc(var(--d) + 0.5s) infinite; }
.de-border { animation: fade 0.6s ease-out ${FLY_IN}s both; }
@keyframes fly { from { opacity: 0; transform: translateY(-40px) rotate(-25deg) scale(0.4); } to { opacity: 1; transform: none; } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .tri, .city, .de-border { animation: none; } }
</style>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Deutschland aus Dreiecken, Berlin und Freiburg markiert">
${style}
<defs><clipPath id="de"><path d="${outlinePath}"/></clipPath></defs>
<g clip-path="url(#de)" stroke="#ffffff" stroke-opacity="0.3" stroke-width="0.6">
${polygons.join('\n')}
</g>
<path class="de-border" d="${outlinePath}" fill="none" stroke="#b00000" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
`;
writeFileSync(new URL('../src/germany.svg', import.meta.url), svg);
console.log(`Deutschland: ${tris.length} Dreiecke, markiert: ${polygons.filter((p) => p.includes('data-city')).length}`);
