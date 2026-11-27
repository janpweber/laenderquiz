// Erzeugt das Vorschaubild für WhatsApp & Co. (public/og.png) sowie die Icons.
// Einmalig lokal ausführen: node scripts/build-og.mjs (braucht Playwright mit Chromium)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const germany = readFileSync(new URL('../src/germany.svg', import.meta.url), 'utf8');
const out = new URL('../public/', import.meta.url);
mkdirSync(out, { recursive: true });

// Ohne Animation: alle Dreiecke in Endlage
const still = '<style>*{animation:none !important}</style>';

const og = `<!doctype html><html><head><meta charset="utf-8">${still}<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: #e9e9e9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .diag { position: absolute; inset: 0; background: #e60000; clip-path: polygon(0 100%, 100% 84%, 100% 100%); }
  .map { position: absolute; left: 70px; top: 40px; height: 550px; }
  .map svg { height: 100%; width: auto; }
  .text { position: absolute; left: 520px; top: 85px; width: 620px; }
  .kicker { color: #e60000; font-weight: 800; letter-spacing: .2em; font-size: 30px; margin: 0 0 18px; }
  h1 { margin: 0; font-size: 92px; line-height: .95; font-weight: 900; text-transform: uppercase; letter-spacing: -.01em; }
  p.lead { margin: 26px 0 0; font-size: 34px; }
</style></head><body><div class="diag"></div><div class="map">${germany}</div>
<div class="text"><p class="kicker">LÄNDERQUIZ</p><h1>Welches Land ist das?</h1>
<p class="lead">Erkennst du die Länder an ihrem Umriss?</p></div></body></html>`;

// Icon: Deutschland-Dreiecke auf Weiß, quadratisch
const icon = (size) => `<!doctype html><html><head><meta charset="utf-8">${still}<style>
  body { margin: 0; width: ${size}px; height: ${size}px; background: #fff; display: grid; place-items: center; }
  svg { height: ${Math.round(size * 0.86)}px; width: auto; }
</style></head><body>${germany}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og);
writeFileSync(new URL('og.png', out), await page.screenshot({ type: 'png' }));
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(icon(size));
  writeFileSync(new URL(name, out), await page.screenshot({ type: 'png' }));
}
await browser.close();
console.log('public/og.png, apple-touch-icon.png, icon-192.png geschrieben');
