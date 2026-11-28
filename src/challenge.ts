// Challenges: jemand legt Bedingungen fest und lädt per Link ein.
// Gespeichert in Supabase (Tabellen challenges und challenge_ergebnisse, siehe supabase/schema.sql).
import { CONTINENTS, createRound, filterCountries, shuffle, type ContinentFilter, type Country, type Rng, type Round } from './game';
import { LeaderboardError, SUPABASE_URL, compareEntries, request, type Fetch } from './leaderboard';
import { TEMPOS, type Settings, type Tempo } from './settings';

export const CHALLENGE_LENGTHS = [5, 10, 20] as const;
export const CHALLENGE_ATTEMPTS = [1, 3, 5] as const;
export const TITLE_MAX = 40;

// Eine Frage: gesuchtes Land und die vier Antwortmöglichkeiten (Ländercodes)
export interface FixedQuestion {
  c: string;
  o: string[];
}

export interface ChallengeSetup {
  titel: string;
  ersteller: string;
  region: ContinentFilter;
  laender: number;
  tempo: Tempo;
  versuche: number;
  // gleiche Länder für alle: je Versuch die festen Fragen, sonst null (jede Runde zufällig)
  fragen: FixedQuestion[][] | null;
}

export interface Challenge extends ChallengeSetup {
  id: string;
  created_at?: string;
}

export interface ChallengeResult {
  challenge_id: string;
  spieler: string;
  name: string;
  versuch: number;
  richtige: number;
  zeit_ms: number;
  created_at?: string;
}

const CHALLENGES = `${SUPABASE_URL}/rest/v1/challenges`;
const RESULTS = `${SUPABASE_URL}/rest/v1/challenge_ergebnisse`;

// Kurze Kennung für den Link, ohne leicht verwechselbare Zeichen
const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(8)].map((b) => ID_CHARS[b % ID_CHARS.length]).join('');
}
export const ID_PATTERN = /^[a-z0-9]{8}$/;

export function challengeSettings(c: Pick<ChallengeSetup, 'region' | 'laender' | 'tempo'>): Settings {
  return { length: c.laender, continent: c.region, difficulty: 'normal', tempo: c.tempo };
}

// Fragen für alle Versuche vorab festlegen (gleiche Länder für alle)
export function fixQuestions(pool: Country[], laender: number, versuche: number, rng: Rng = Math.random): FixedQuestion[][] {
  return Array.from({ length: versuche }, () =>
    createRound(pool, { length: laender }, rng).questions.map((q) => ({ c: q.country.code, o: q.options.map((o) => o.code) })),
  );
}

// Runde für einen Versuch: feste Fragen in neu gemischter Reihenfolge, sonst zufällig
export function challengeRound(challenge: ChallengeSetup, attempt: number, countries: Country[], rng: Rng = Math.random): Round {
  const fixed = challenge.fragen?.[attempt - 1];
  if (!fixed) return createRound(filterCountries(countries, challengeSettings(challenge)), { length: challenge.laender }, rng);
  const byCode = new Map(countries.map((c) => [c.code, c]));
  const questions = shuffle(fixed, rng).flatMap((q) => {
    const country = byCode.get(q.c);
    const options = q.o.map((code) => byCode.get(code)).filter((c): c is Country => !!c);
    return country && options.length >= 2 ? [{ country, options: shuffle(options, rng) }] : [];
  });
  return { questions, index: 0, score: 0, totalMs: 0, hints: 0, answers: [] };
}

// Gelesene Daten prüfen, damit kaputte Einträge nichts kaputt machen
export function validChallenge(value: unknown): value is Challenge {
  const c = value as Challenge;
  return (
    !!c &&
    typeof c.id === 'string' &&
    typeof c.titel === 'string' &&
    typeof c.ersteller === 'string' &&
    CONTINENTS.includes(c.region) &&
    (CHALLENGE_LENGTHS as readonly number[]).includes(c.laender) &&
    TEMPOS.includes(c.tempo) &&
    (CHALLENGE_ATTEMPTS as readonly number[]).includes(c.versuche) &&
    (c.fragen === null || (Array.isArray(c.fragen) && c.fragen.length === c.versuche))
  );
}

export function conditions(c: Pick<ChallengeSetup, 'region' | 'laender' | 'tempo' | 'versuche' | 'fragen'>): string[] {
  return [
    `${c.laender} Länder · ${c.region === 'Welt' ? 'ganze Welt' : c.region}`,
    c.tempo ? `${c.tempo} Sekunden pro Land` : 'ohne Zeitlimit',
    c.versuche === 1 ? '1 Versuch' : `${c.versuche} Versuche, der beste zählt`,
    c.fragen ? 'gleiche Länder für alle' : 'Länder für jeden zufällig',
  ];
}

// Pro Person (Gerät) zählt der beste Versuch
export function bestPerPlayer(results: ChallengeResult[]): ChallengeResult[] {
  const best = new Map<string, ChallengeResult>();
  for (const r of results) {
    const current = best.get(r.spieler);
    if (!current || compareEntries(asEntry(r), asEntry(current)) < 0) best.set(r.spieler, r);
  }
  return [...best.values()].sort((a, b) => compareEntries(asEntry(a), asEntry(b)));
}
const asEntry = (r: ChallengeResult) => ({ modus: '', name: r.name, richtige: r.richtige, zeit_ms: r.zeit_ms, created_at: r.created_at });

export async function createChallenge(setup: ChallengeSetup, fetchFn: Fetch = fetch): Promise<Challenge> {
  const challenge: Challenge = { ...setup, id: newId() };
  await request(fetchFn, CHALLENGES, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(challenge),
  });
  return challenge;
}

export async function fetchChallenge(id: string, fetchFn: Fetch = fetch): Promise<Challenge | undefined> {
  if (!ID_PATTERN.test(id)) return undefined;
  const rows = (await (
    await request(fetchFn, `${CHALLENGES}?select=id,titel,ersteller,region,laender,tempo,versuche,fragen,created_at&id=eq.${id}`)
  ).json()) as unknown[];
  const found = rows[0];
  return validChallenge(found) ? found : undefined;
}

export async function submitChallengeResult(result: ChallengeResult, fetchFn: Fetch = fetch): Promise<void> {
  await request(fetchFn, RESULTS, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...result, zeit_ms: Math.round(result.zeit_ms) }),
  });
}

export async function fetchChallengeResults(id: string, fetchFn: Fetch = fetch): Promise<ChallengeResult[]> {
  const url = `${RESULTS}?select=challenge_id,spieler,name,versuch,richtige,zeit_ms,created_at&challenge_id=eq.${id}&limit=1000`;
  return bestPerPlayer((await (await request(fetchFn, url)).json()) as ChallengeResult[]);
}

// Versuche und Spieler-Kennung je Gerät (kein harter Schutz, reicht für Freunde und Kollegen)
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const PLAYER_KEY = 'laenderquiz:spieler';
const attemptsKey = (id: string) => `laenderquiz:challenge:${id}`;

export function playerId(store: Store | undefined, make: () => string = () => crypto.randomUUID()): string {
  try {
    const known = store?.getItem(PLAYER_KEY);
    if (known) return known;
    const id = make();
    store?.setItem(PLAYER_KEY, id);
    return id;
  } catch {
    return make();
  }
}

export function attemptsUsed(store: Store | undefined, id: string): number {
  try {
    const n = Number(store?.getItem(attemptsKey(id)) ?? 0);
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// Versuch beim Start verbrauchen, damit Neuladen keinen weiteren Versuch bringt
export function useAttempt(store: Store | undefined, id: string): number {
  const next = attemptsUsed(store, id) + 1;
  try {
    store?.setItem(attemptsKey(id), String(next));
  } catch {
    // ohne Speicher gilt der Versuch nur für diese Sitzung
  }
  return next;
}

// Meine Challenges: welche Challenges dieses Gerät erstellt oder geöffnet hat
export interface KnownChallenge {
  id: string;
  eigene: boolean;
  at: number;
}
const KNOWN_KEY = 'laenderquiz:challenges';
export const KNOWN_MAX = 50;

export function knownChallenges(store: Store | undefined): KnownChallenge[] {
  try {
    const list = JSON.parse(store?.getItem(KNOWN_KEY) ?? '[]') as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (k): k is KnownChallenge =>
        !!k && typeof k.id === 'string' && ID_PATTERN.test(k.id) && typeof k.eigene === 'boolean' && typeof k.at === 'number',
    );
  } catch {
    return [];
  }
}

// Neu Gemerktes kommt nach vorne; einmal selbst erstellt bleibt selbst erstellt
export function rememberChallenge(store: Store | undefined, id: string, eigene = false, now = Date.now()): KnownChallenge[] {
  if (!ID_PATTERN.test(id)) return knownChallenges(store);
  const known = knownChallenges(store);
  const before = known.find((k) => k.id === id);
  const next = [{ id, eigene: eigene || !!before?.eigene, at: now }, ...known.filter((k) => k.id !== id)].slice(0, KNOWN_MAX);
  try {
    store?.setItem(KNOWN_KEY, JSON.stringify(next));
  } catch {
    // ohne Speicher bleibt die Liste leer
  }
  return next;
}

// Challenges, die vor „Meine Challenges“ gespielt wurden, stecken in den Versuchs-Einträgen
export function idsFromAttemptKeys(keys: string[]): string[] {
  const prefix = attemptsKey('');
  return keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).filter((id) => ID_PATTERN.test(id));
}

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

// Challenge-IDs, für die dieses Gerät schon Ergebnisse eingetragen hat (auch von früher)
export async function playedChallengeIds(spieler: string, fetchFn: Fetch = fetch): Promise<string[]> {
  if (!UUID_PATTERN.test(spieler)) return [];
  const rows = (await (await request(fetchFn, `${RESULTS}?select=challenge_id&spieler=eq.${spieler}&limit=1000`)).json()) as {
    challenge_id: string;
  }[];
  return [...new Set(rows.map((r) => r.challenge_id))].filter((id) => ID_PATTERN.test(id));
}

export async function fetchChallenges(ids: string[], fetchFn: Fetch = fetch): Promise<Challenge[]> {
  const valid = ids.filter((id) => ID_PATTERN.test(id));
  if (valid.length === 0) return [];
  const url = `${CHALLENGES}?select=id,titel,ersteller,region,laender,tempo,versuche,fragen,created_at&id=in.(${valid.join(',')})`;
  return ((await (await request(fetchFn, url)).json()) as unknown[]).filter(validChallenge);
}

export async function fetchAllResults(ids: string[], fetchFn: Fetch = fetch): Promise<ChallengeResult[]> {
  const valid = ids.filter((id) => ID_PATTERN.test(id));
  if (valid.length === 0) return [];
  const url = `${RESULTS}?select=challenge_id,spieler,name,versuch,richtige,zeit_ms,created_at&challenge_id=in.(${valid.join(',')})&limit=10000`;
  return (await (await request(fetchFn, url)).json()) as ChallengeResult[];
}

export interface ChallengeStatus {
  challenge: Challenge;
  eigene: boolean;
  left: number;
  best?: ChallengeResult;
  rank?: number;
  players: number;
}

// Offen: noch Versuche übrig. Gespielt: alle Versuche verbraucht. Reihenfolge wie gemerkt, neueste zuerst.
export function overview(
  known: KnownChallenge[],
  challenges: Challenge[],
  results: ChallengeResult[],
  me: string,
  used: (id: string) => number,
): { offen: ChallengeStatus[]; gespielt: ChallengeStatus[] } {
  const byId = new Map(challenges.map((c) => [c.id, c]));
  const offen: ChallengeStatus[] = [];
  const gespielt: ChallengeStatus[] = [];
  for (const k of known) {
    const challenge = byId.get(k.id);
    if (!challenge) continue;
    const board = bestPerPlayer(results.filter((r) => r.challenge_id === k.id));
    const i = board.findIndex((r) => r.spieler === me);
    const playedAttempts = new Set(results.filter((r) => r.challenge_id === k.id && r.spieler === me).map((r) => r.versuch)).size;
    const left = Math.max(0, challenge.versuche - Math.max(used(k.id), playedAttempts));
    const status: ChallengeStatus = {
      challenge,
      eigene: k.eigene,
      left,
      players: board.length,
      ...(i >= 0 ? { best: board[i], rank: i + 1 } : {}),
    };
    (left > 0 ? offen : gespielt).push(status);
  }
  return { offen, gespielt };
}

export { LeaderboardError };
