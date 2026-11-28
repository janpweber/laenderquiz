// Ergänzt die Sperrwörter in Supabase aus der offenen Liste LDNOOBW
// (github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words, CC BY 4.0).
// Neue Wörter werden als „ganzes Wort“ eingetragen; vorhandene (auch deaktivierte) bleiben unverändert.
// Läuft monatlich als GitHub-Action. Lokal ohne Schlüssel nur Probelauf:
//   node scripts/sync-sperrwoerter.mjs
// Mit Schlüssel (nie ins Repository!):
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/sync-sperrwoerter.mjs
const SOURCE = 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master';
const LISTS = ['de', 'en'];

// wie normalizeForFilter in src/name.ts und name_normalisiert in supabase/schema.sql
export function normalize(word) {
  return word
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[0134578@$!|]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' })[c])
    .replace(/[^a-z]/g, '');
}

const rows = new Map();
for (const list of LISTS) {
  const response = await fetch(`${SOURCE}/${list}`);
  if (!response.ok) throw new Error(`Liste ${list}: HTTP ${response.status}`);
  for (const line of (await response.text()).split('\n')) {
    const wort = normalize(line.trim());
    if (wort.length >= 2 && wort.length <= 40 && !rows.has(wort)) rows.set(wort, { wort, ganzes_wort: true, quelle: `ldnoobw-${list}` });
  }
}
console.log(`${rows.size} Wörter aus ${LISTS.join(', ')}`);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('Kein SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY gesetzt: Probelauf, nichts eingetragen.');
  process.exit(0);
}
const response = await fetch(`${url}/rest/v1/sperrwoerter?on_conflict=wort`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    // vorhandene Wörter nicht anfassen, damit deaktivierte deaktiviert bleiben
    Prefer: 'resolution=ignore-duplicates,return=representation',
  },
  body: JSON.stringify([...rows.values()]),
});
if (!response.ok) throw new Error(`Supabase: HTTP ${response.status} ${await response.text()}`);
const added = await response.json();
console.log(`${added.length} neue Wörter eingetragen${added.length ? `: ${added.map((r) => r.wort).join(', ')}` : ''}`);
