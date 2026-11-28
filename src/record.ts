import type { Settings } from './settings';

// Persönlicher Rekord je Einstellungs-Kombination, gespeichert im Browser
export interface RecordEntry {
  score: number;
  total: number;
  ms: number;
}

export type Records = Record<string, RecordEntry>;

// Minimaler Speicher, damit Tests ohne Browser auskommen
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'laenderquiz:rekorde';

export const STANDARD: Pick<Settings, 'length' | 'continent' | 'difficulty'> = {
  length: 10,
  continent: 'Welt',
  difficulty: 'normal',
};

// Mit Zeitlimit eigener Rekord; ohne bleibt der Schlüssel wie bisher
export function recordKey(s: Pick<Settings, 'length' | 'continent' | 'difficulty' | 'tempo'>): string {
  return [s.length, s.continent, s.difficulty, ...(s.tempo ? [`${s.tempo}s`] : [])].join('|');
}

export function isStandard(s: Pick<Settings, 'length' | 'continent' | 'difficulty'>): boolean {
  return recordKey(s) === recordKey(STANDARD);
}

// Mehr richtige gewinnt, bei Gleichstand die kürzere Zeit
export function isBetter(candidate: RecordEntry, current: RecordEntry | undefined): boolean {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;
  return candidate.ms < current.ms;
}

function valid(e: unknown): e is RecordEntry {
  const r = e as RecordEntry;
  return (
    !!r &&
    Number.isFinite(r.score) &&
    Number.isFinite(r.total) &&
    Number.isFinite(r.ms) &&
    r.score >= 0 &&
    r.score <= r.total &&
    r.ms >= 0
  );
}

export function loadRecords(store: KeyValueStore | undefined): Records {
  try {
    const raw = JSON.parse(store?.getItem(STORAGE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(Object.entries(raw).filter(([, e]) => valid(e))) as Records;
  } catch {
    return {};
  }
}

export interface RecordUpdate {
  previous?: RecordEntry;
  best: RecordEntry;
  isNew: boolean;
}

// Ergebnis eintragen; speichert nur, wenn es besser ist. Ohne Speicher kein Absturz.
export function submitResult(store: KeyValueStore | undefined, key: string, result: RecordEntry): RecordUpdate {
  const records = loadRecords(store);
  const previous = records[key];
  const isNew = isBetter(result, previous);
  if (isNew) {
    try {
      store?.setItem(STORAGE_KEY, JSON.stringify({ ...records, [key]: result }));
    } catch {
      // Speicher voll oder gesperrt: Rekord gilt nur für diese Anzeige
    }
  }
  return { previous, best: isNew ? result : previous!, isNew };
}

// localStorage kann im privaten Modus fehlen oder beim Zugriff werfen
export function browserStore(): KeyValueStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
