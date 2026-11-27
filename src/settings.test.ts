import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalize, summary } from './settings';

describe('Einstellungen speichern und anzeigen', () => {
  it('nimmt Standardwerte, wenn nichts gespeichert ist', () => {
    expect(normalize(null, 169)).toEqual(DEFAULT_SETTINGS);
  });

  it('verwirft ungültige Werte', () => {
    expect(normalize({ length: 'viele', continent: 'Atlantis', difficulty: 'extrem' }, 169)).toEqual(DEFAULT_SETTINGS);
  });

  it('begrenzt eine gespeicherte Zahl auf die verfügbaren Länder', () => {
    expect(normalize({ length: 500 }, 54).length).toBe(54);
  });

  it('fasst die Einstellungen kurz zusammen', () => {
    expect(summary(DEFAULT_SETTINGS, 169)).toBe('10 Länder · Welt · Normal');
    expect(summary({ length: 'endlos', continent: 'Afrika', difficulty: 'schwer' }, 54)).toBe('Endlos · Afrika · Schwer');
    expect(summary({ length: 1, continent: 'Europa', difficulty: 'normal' }, 40)).toBe('1 Land · Europa · Normal');
  });
});
