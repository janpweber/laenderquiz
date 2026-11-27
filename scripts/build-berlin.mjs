// Erzeugt das Logo: den Umriss von Berlin, gefüllt mit Low-Poly-Dreiecken in
// Havas-Rottönen. Umriss aus @svg-maps/germany (CC BY 4.0, siehe README).
// Ausführen mit: node scripts/build-berlin.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const svgFile = require.resolve('@svg-maps/germany/germany.svg');
const source = readFileSync(svgFile, 'utf8');
const d = source.match(/id="be"[\s\S]*?\sd="([^"]+)"/)[1];

// Pfad parsen: nur relative/absolute Linienzüge (m, l, M, L, z) kommen vor
function parse(path) {
  const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const points = [];
  let cmd = 'M';
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === 'z' || cmd === 'Z') break;
      continue;
    }
    const a = Number(tokens[i]);
    const b = Number(tokens[i + 1]);
    i += 2;
    if (cmd === 'm' || cmd === 'l') { x += a; y += b; } else { x = a; y = b; }
    if (cmd === 'm') cmd = 'l';
    if (cmd === 'M') cmd = 'L';
    points.push([x, y]);
  }
  return points;
}

const raw = parse(d);
const minX = Math.min(...raw.map((p) => p[0]));
const maxX = Math.max(...raw.map((p) => p[0]));
const minY = Math.min(...raw.map((p) => p[1]));
const maxY = Math.max(...raw.map((p) => p[1]));
const SIZE = 400;
const PAD = 10;
const scale = (SIZE - 2 * PAD) / Math.max(maxX - minX, maxY - minY);
const W = Math.round((maxX - minX) * scale + 2 * PAD);
const H = Math.round((maxY - minY) * scale + 2 * PAD);
const outline = raw.map(([x, y]) => [(x - minX) * scale + PAD, (y - minY) * scale + PAD]);

function inside([x, y]) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i];
    const [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

let seed = 11;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const palette = ['#e60000', '#c40000', '#ff3b3b', '#ff6b6b', '#f59a9a', '#a80000', '#ffb3b3', '#d4142a', '#ff5a36', '#ffd2d2', '#f7c948'];
const weights = [7, 5, 5, 4, 3, 3, 2, 3, 2, 1, 0.5];
const pick = () => {
  let r = rng() * weights.reduce((a, b) => a + b);
  for (let i = 0; i < palette.length; i++) if ((r -= weights[i]) < 0) return palette[i];
  return palette[0];
};

const step = 24;
const rows = [];
for (let j = -1; j * step * 0.87 < H + step; j++) {
  const row = [];
  for (let i = -1; i * step < W + step; i++) {
    row.push([i * step + (j % 2 ? step / 2 : 0) + (rng() - 0.5) * step * 0.6, j * step * 0.87 + (rng() - 0.5) * step * 0.6]);
  }
  rows.push(row);
}
const tris = [];
for (let j = 0; j < rows.length - 1; j++) {
  const a = rows[j];
  const b = rows[j + 1];
  for (let i = 0; i < a.length - 1; i++) {
    const odd = (j - 1) % 2 !== 0;
    const cand = odd ? [[a[i], b[i + 1], b[i]], [a[i], a[i + 1], b[i + 1]]] : [[a[i], a[i + 1], b[i]], [a[i + 1], b[i + 1], b[i]]];
    tris.push(...cand);
  }
}

const f = (n) => n.toFixed(1);
const pts = (list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Berlin aus Dreiecken">
<defs><clipPath id="berlin"><polygon points="${pts(outline)}"/></clipPath></defs>
<g clip-path="url(#berlin)">
${tris.map((t) => `<polygon points="${pts(t)}" fill="${pick()}" stroke="${'#ffffff'}" stroke-opacity="0.25" stroke-width="0.6"/>`).join('\n')}
</g>
<polygon points="${pts(outline)}" fill="none" stroke="#b00000" stroke-width="2" stroke-linejoin="round"/>
</svg>
`;
writeFileSync(new URL('../src/berlin.svg', import.meta.url), svg);
console.log(`Berlin: ${outline.length} Punkte, ${tris.length} Dreiecke, ${W}x${H}`);
