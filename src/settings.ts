import { CONTINENTS, clampLength, type ContinentFilter, type Difficulty, type RoundLength } from './game';

// Sekunden pro Land, 0 = ohne Zeitlimit
export const TEMPOS = [0, 5, 3, 2] as const;
export type Tempo = (typeof TEMPOS)[number];

export interface Settings {
  length: RoundLength;
  continent: ContinentFilter;
  difficulty: Difficulty;
  tempo?: Tempo;
}

export const DEFAULT_SETTINGS: Settings = { length: 10, continent: 'Welt', difficulty: 'normal', tempo: 0 };
const STORAGE_KEY = 'laenderquiz:einstellungen';

// Gespeicherte Einstellungen prüfen, damit kaputte oder alte Werte nicht stören
export function normalize(value: unknown, available: number): Settings {
  const v = (value ?? {}) as Partial<Settings>;
  const continent = CONTINENTS.includes(v.continent as ContinentFilter) ? (v.continent as ContinentFilter) : 'Welt';
  const difficulty: Difficulty = v.difficulty === 'schwer' ? 'schwer' : 'normal';
  const length: RoundLength =
    v.length === 'endlos' ? 'endlos' : typeof v.length === 'number' ? clampLength(v.length, available) : 10;
  const tempo: Tempo = TEMPOS.includes(v.tempo as Tempo) ? (v.tempo as Tempo) : 0;
  return { length, continent, difficulty, tempo };
}

export function summary(settings: Settings, available: number): string {
  const length =
    settings.length === 'endlos' ? 'Endlos' : `${Math.min(settings.length, available)} ${settings.length === 1 ? 'Land' : 'Länder'}`;
  const parts = [length, settings.continent, settings.difficulty === 'schwer' ? 'Schwer' : 'Normal'];
  if (settings.tempo) parts.push(`${settings.tempo} s pro Land`);
  return parts.join(' · ');
}

export function loadSettings(): unknown {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ohne Speicher (z. B. privater Modus) gelten die Einstellungen nur bis zum Neuladen
  }
}
