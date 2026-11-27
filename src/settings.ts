import { CONTINENTS, clampLength, type ContinentFilter, type Difficulty, type RoundLength } from './game';

export interface Settings {
  length: RoundLength;
  continent: ContinentFilter;
  difficulty: Difficulty;
}

export const DEFAULT_SETTINGS: Settings = { length: 10, continent: 'Welt', difficulty: 'normal' };
const STORAGE_KEY = 'laenderquiz:einstellungen';

// Gespeicherte Einstellungen prüfen, damit kaputte oder alte Werte nicht stören
export function normalize(value: unknown, available: number): Settings {
  const v = (value ?? {}) as Partial<Settings>;
  const continent = CONTINENTS.includes(v.continent as ContinentFilter) ? (v.continent as ContinentFilter) : 'Welt';
  const difficulty: Difficulty = v.difficulty === 'schwer' ? 'schwer' : 'normal';
  const length: RoundLength =
    v.length === 'endlos' ? 'endlos' : typeof v.length === 'number' ? clampLength(v.length, available) : 10;
  return { length, continent, difficulty };
}

export function summary(settings: Settings, available: number): string {
  const length =
    settings.length === 'endlos' ? 'Endlos' : `${Math.min(settings.length, available)} ${settings.length === 1 ? 'Land' : 'Länder'}`;
  return [length, settings.continent, settings.difficulty === 'schwer' ? 'Schwer' : 'Normal'].join(' · ');
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
