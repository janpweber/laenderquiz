// Kopiert die Flaggen (flag-icons, MIT, https://github.com/lipis/flag-icons) für die 193 Länder
// nach src/flags/<ISO3>.svg. Aufruf: node scripts/copy-flags.mjs <Pfad zu flag-icons/flags/4x3>
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const countries = require('../src/countries.generated.json');
const wc = require('world-countries');
const source = process.argv[2];
if (!source) throw new Error('Pfad zu flag-icons/flags/4x3 angeben');
const alpha2 = Object.fromEntries(wc.map((c) => [c.cca3, c.cca2.toLowerCase()]));
mkdirSync(new URL('../src/flags/', import.meta.url), { recursive: true });
for (const c of countries) copyFileSync(`${source}/${alpha2[c.code]}.svg`, new URL(`../src/flags/${c.code}.svg`, import.meta.url));
console.log(`${countries.length} Flaggen kopiert`);
