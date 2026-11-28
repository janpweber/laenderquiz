// Üben: Das Gerät merkt sich die letzten Antworten (nur lokal im Browser).
// Daraus entstehen Übungsrunden: eigene Fehler oder die zuletzt gespielten Länder.
export interface HistoryEntry {
  code: string;
  correct: boolean;
}

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'laenderquiz:verlauf';
export const HISTORY_MAX = 200;
// so oft hintereinander richtig, dann gilt ein Fehler als gelernt
export const LEARNED_AFTER = 2;

export function loadHistory(store: Store | undefined): HistoryEntry[] {
  try {
    const raw = JSON.parse(store?.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((e): e is HistoryEntry => typeof e?.code === 'string' && typeof e?.correct === 'boolean')
      : [];
  } catch {
    return [];
  }
}

// Neueste Antwort steht vorn
export function recordAnswer(store: Store | undefined, code: string, correct: boolean): void {
  const history = [{ code, correct }, ...loadHistory(store)].slice(0, HISTORY_MAX);
  try {
    store?.setItem(KEY, JSON.stringify(history));
  } catch {
    // ohne Speicher gibt es eben keinen Verlauf
  }
}

// Zuletzt gespielte Länder, jedes nur einmal, neueste zuerst
export function recentCountries(history: HistoryEntry[], limit: number): string[] {
  const seen = new Set<string>();
  for (const e of history) {
    if (seen.size >= limit) break;
    seen.add(e.code);
  }
  return [...seen];
}

// Länder mit Fehler, die seitdem noch nicht zweimal hintereinander richtig waren; zuletzt falsche zuerst
export function mistakes(history: HistoryEntry[]): string[] {
  const streak = new Map<string, number>();
  const open: string[] = [];
  const done = new Set<string>();
  for (const e of history) {
    if (done.has(e.code)) continue;
    if (e.correct) {
      const n = (streak.get(e.code) ?? 0) + 1;
      streak.set(e.code, n);
      if (n >= LEARNED_AFTER) done.add(e.code);
    } else {
      open.push(e.code);
      done.add(e.code);
    }
  }
  return open;
}
