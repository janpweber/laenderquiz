// Erzeugt den stilisierten Low-Poly-Baum (eigene Zeichnung, angelehnt an den
// roten Havas-Baum) als SVG. Ausführen mit: node scripts/build-tree.mjs
import { writeFileSync } from 'node:fs';

let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const W = 400;
const H = 400;
// Krone als Vereinigung mehrerer Kreise
const blobs = [
  [200, 130, 105], [120, 160, 70], [285, 165, 75], [165, 85, 65], [250, 80, 60], [90, 205, 45], [320, 215, 45],
];
const inCrown = (x, y) => blobs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);

const palette = [
  '#e60000', '#e60000', '#c40000', '#ff3b3b', '#ff6b6b', '#f59a9a', '#a80000', '#ffb3b3', '#d4142a', '#ff5a36',
  '#ffd2d2', '#f7c948', '#b5c94a',
];
const weights = [6, 6, 5, 5, 4, 3, 3, 2, 3, 2, 1, 0.6, 0.6];
const pick = () => {
  let r = rng() * weights.reduce((a, b) => a + b);
  for (let i = 0; i < palette.length; i++) if ((r -= weights[i]) < 0) return palette[i];
  return palette[0];
};

// Leicht verrücktes Dreiecksgitter
const step = 22;
const rows = [];
for (let j = 0; j * step * 0.87 < 300; j++) {
  const row = [];
  for (let i = -1; i * step < W + step; i++) {
    const x = i * step + (j % 2 ? step / 2 : 0) + (rng() - 0.5) * step * 0.6;
    const y = 5 + j * step * 0.87 + (rng() - 0.5) * step * 0.6;
    row.push([x, y]);
  }
  rows.push(row);
}
const tris = [];
for (let j = 0; j < rows.length - 1; j++) {
  const a = rows[j];
  const b = rows[j + 1];
  for (let i = 0; i < a.length - 1; i++) {
    const cand = j % 2 ? [[a[i], b[i + 1], b[i]], [a[i], a[i + 1], b[i + 1]]] : [[a[i], a[i + 1], b[i]], [a[i + 1], b[i + 1], b[i]]];
    for (const t of cand) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
      const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      if (inCrown(cx, cy)) tris.push(t);
    }
  }
}

const f = (n) => n.toFixed(1);
const poly = (pts, fill) => `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${fill}"/>`;

// Stamm und Äste als kantige Flächen
const trunk = [
  [[180, 395], [220, 395], [208, 300], [196, 230], [190, 300]],
  [[196, 260], [204, 250], [150, 190], [140, 196]],
  [[203, 255], [208, 266], [270, 200], [262, 192]],
  [[198, 235], [206, 232], [222, 150], [214, 148]],
  [[160, 205], [166, 210], [110, 175], [106, 180]],
  [[245, 215], [250, 222], [305, 190], [300, 184]],
];
const trunkColors = ['#9e0000', '#b00000', '#c40000', '#a80000', '#b30000', '#9e0000'];

// Kleine Berliner Silhouette am Fuß des Baums: Fernsehturm und Brandenburger Tor,
// ebenfalls aus Dreiecken bzw. kantigen Flächen
const skyline = [];
// Fernsehturm links
skyline.push(poly([[96, 395], [104, 395], [102, 300], [98, 300]], '#c40000'));
skyline.push(poly([[90, 300], [100, 288], [110, 300], [100, 312]], '#e60000'));
skyline.push(poly([[90, 300], [110, 300], [100, 312]], '#a80000'));
skyline.push(poly([[99, 288], [101, 288], [100.6, 262], [99.4, 262]], '#c40000'));
// Brandenburger Tor rechts
const gx = 268;
skyline.push(poly([[gx - 4, 352], [gx + 74, 352], [gx + 70, 344], [gx, 344]], '#c40000'));
skyline.push(poly([[gx + 22, 344], [gx + 35, 334], [gx + 48, 344]], '#e60000'));
skyline.push(poly([[gx - 2, 360], [gx + 72, 360], [gx + 72, 352], [gx - 2, 352]], '#a80000'));
for (let i = 0; i < 6; i++) {
  const x = gx + i * 13.4;
  skyline.push(poly([[x, 395], [x + 6, 395], [x + 6, 360], [x, 360]], i % 2 ? '#d4142a' : '#b00000'));
}
// Boden aus flachen Dreiecken
for (let x = 40; x < 360; x += 20) {
  skyline.push(poly([[x, 395], [x + 20, 395], [x + 10, 389 - rng() * 5]], pick()));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stilisierter roter Baum">
${tris.map((t) => poly(t, pick())).join('\n')}
${skyline.join('\n')}
${trunk.map((t, i) => poly(t, trunkColors[i])).join('\n')}
</svg>
`;
writeFileSync(new URL('../src/tree.svg', import.meta.url), svg);
console.log(`${tris.length} Dreiecke`);
