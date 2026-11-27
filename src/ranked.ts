import type { ContinentFilter } from './game';
import type { Settings } from './settings';

// Ranglisten-Runden: feste Einstellungen, damit Ergebnisse vergleichbar sind.
// Dieselben Modi und Längen stehen in supabase/schema.sql.
export interface RankedMode {
  modus: ContinentFilter;
  length: number;
}

export const RANKED: readonly RankedMode[] = [
  { modus: 'Welt', length: 10 },
  { modus: 'Afrika', length: 5 },
  { modus: 'Asien', length: 5 },
  { modus: 'Europa', length: 5 },
  { modus: 'Nordamerika', length: 5 },
  { modus: 'Südamerika', length: 5 },
  { modus: 'Ozeanien', length: 5 },
];

export function rankedSettings(mode: RankedMode): Settings {
  return { length: mode.length, continent: mode.modus, difficulty: 'normal' };
}

// Zählt diese Einstellung für eine Rangliste? Auch im freien Spiel möglich.
export function rankedFor(s: Pick<Settings, 'length' | 'continent' | 'difficulty'>): RankedMode | undefined {
  if (s.difficulty !== 'normal') return undefined;
  return RANKED.find((m) => m.modus === s.continent && m.length === s.length);
}

export function rankedLabel(mode: RankedMode): string {
  return mode.modus === 'Welt' ? 'Ganze Welt' : mode.modus;
}
