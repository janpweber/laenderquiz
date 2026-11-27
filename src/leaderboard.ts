// Online-Bestenliste in Supabase, direkt über die REST-Schnittstelle (PostgREST).
// Der Publishable Key ist öffentlich und darf im Frontend stehen; Schutz geben
// Row Level Security und die Constraints in supabase/schema.sql.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://zjquilqylgrizozzxvsz.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_oLE1gwPrJ_InDroJkpLebQ_wHLSgtgM';

const TABLE = `${SUPABASE_URL}/rest/v1/bestenliste`;
const TIMEOUT_MS = 8000;

// Grenzen wie in der Datenbank: 10 Fragen, mindestens 0,3 s je Frage, höchstens 30 Minuten
export const MIN_MS = 3000;
export const MAX_MS = 30 * 60 * 1000;

export interface Entry {
  name: string;
  richtige: number;
  zeit_ms: number;
  created_at?: string;
}

// Mehr richtige zuerst, dann kürzere Zeit, dann wer zuerst eingetragen hat
export function compareEntries(a: Entry, b: Entry): number {
  return b.richtige - a.richtige || a.zeit_ms - b.zeit_ms || (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

export function plausible(richtige: number, ms: number): boolean {
  return Number.isInteger(richtige) && richtige >= 0 && richtige <= 10 && ms >= MIN_MS && ms <= MAX_MS;
}

export class LeaderboardError extends Error {}

type Fetch = typeof fetch;

async function request(fetchFn: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchFn(url, {
      ...init,
      signal: controller.signal,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...init.headers },
    });
    if (!response.ok) {
      // 400/409/23514: Constraint verletzt (Name gesperrt, Werte unmöglich)
      if (response.status === 400 || response.status === 409)
        throw new LeaderboardError('Der Eintrag wurde abgelehnt. Bitte wähle einen anderen Namen.');
      throw new LeaderboardError('Die Bestenliste ist gerade nicht erreichbar. Versuch es später noch einmal.');
    }
    return response;
  } catch (e) {
    if (e instanceof LeaderboardError) throw e;
    throw new LeaderboardError('Keine Verbindung zur Bestenliste. Bist du online?');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTop(limit = 20, fetchFn: Fetch = fetch): Promise<Entry[]> {
  const url = `${TABLE}?select=name,richtige,zeit_ms,created_at&order=richtige.desc,zeit_ms.asc,created_at.asc&limit=${limit}`;
  const entries = (await (await request(fetchFn, url)).json()) as Entry[];
  return [...entries].sort(compareEntries);
}

// Einträgt das Ergebnis und gibt den Platz zurück (1 = bester)
export async function submitEntry(entry: Entry, fetchFn: Fetch = fetch): Promise<number> {
  if (!plausible(entry.richtige, entry.zeit_ms)) throw new LeaderboardError('Dieses Ergebnis kann nicht eingetragen werden.');
  await request(fetchFn, TABLE, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ name: entry.name, richtige: entry.richtige, zeit_ms: Math.round(entry.zeit_ms) }),
  });
  // Platz = Zahl der besseren Einträge + 1
  const better = `or=(richtige.gt.${entry.richtige},and(richtige.eq.${entry.richtige},zeit_ms.lt.${Math.round(entry.zeit_ms)}))`;
  try {
    const response = await request(fetchFn, `${TABLE}?select=name&${better}`, {
      method: 'HEAD',
      headers: { Prefer: 'count=exact' },
    });
    const total = Number(response.headers.get('content-range')?.split('/')[1]);
    return Number.isFinite(total) ? total + 1 : 0;
  } catch {
    return 0; // Eintrag hat geklappt, nur der Platz ist unbekannt
  }
}
