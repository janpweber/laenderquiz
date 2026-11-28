// Prüfung des Namens für die Bestenliste. Dieselbe Sperrliste steht in
// supabase/schema.sql, damit sie auch bei direkten API-Aufrufen greift.
export const NAME_MAX = 20;

// Kleine Sperrliste (deutsch und englisch). Geprüft wird als Teilwort im
// normalisierten Namen, deshalb nur Wörter, die kaum in harmlosen Namen stecken.
export const BLOCKLIST = [
  'arschloch',
  'wichser',
  'hurensohn',
  'fotze',
  'schlampe',
  'missgeburt',
  'spast',
  'hitler',
  'heilhitler',
  'siegheil',
  'judensau',
  'kanake',
  'neger',
  'nigger',
  'nigga',
  'schwuchtel',
  'fick',
  'fuck',
  'cunt',
  'bitch',
  'whore',
  'faggot',
  'retard',
  'penis',
  'vagina',
  'pimmel',
  'muschi',
  'titten',
  'porn',
] as const;

// Kleinbuchstaben, Umlaute und typische Ersatzzeichen vereinheitlichen,
// alles außer Buchstaben entfernen („F.u_c-k“, „N4zi“ fallen so auch auf)
export function normalizeForFilter(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[0134578@$!|]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' })[c]!)
    .replace(/[^a-z]/g, '');
}

// Wie oben, aber Trennzeichen bleiben als Leerzeichen, damit ganze Wörter erkennbar sind
export function wordsForFilter(name: string): string[] {
  return name
    .split(/[^\p{L}\p{N}@$!|]+/u)
    .map(normalizeForFilter)
    .filter(Boolean);
}

// Zusätzliche Sperrwörter aus der Datenbank (Tabelle sperrwoerter), siehe loadBlockedWords
export interface BlockedWord {
  wort: string;
  ganzes_wort: boolean;
}
let blocked: BlockedWord[] = [];
export function setBlockedWords(words: BlockedWord[]): void {
  blocked = words.filter((w) => typeof w?.wort === 'string' && /^[a-z]{2,40}$/.test(w.wort));
}

function isBlocked(name: string): boolean {
  const joined = normalizeForFilter(name);
  if (BLOCKLIST.some((word) => joined.includes(word))) return true;
  const words = wordsForFilter(name);
  return blocked.some((w) => (w.ganzes_wort ? w.wort === joined || words.includes(w.wort) : joined.includes(w.wort)));
}

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

// max und Bezeichnung anpassbar, z. B. für den Titel einer Challenge
export function checkName(input: string, max = NAME_MAX, what = 'Name'): NameCheck {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return { ok: false, message: `Bitte gib einen ${what} ein.` };
  if ([...name].length > max) return { ok: false, message: `Der ${what} darf höchstens ${max} Zeichen haben.` };
  if (isBlocked(name))
    return { ok: false, message: 'Dieser Name geht leider nicht. Bitte wähle einen anderen.' };
  return { ok: true, name };
}
