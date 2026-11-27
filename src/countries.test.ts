import { describe, expect, it } from 'vitest';
import countries from './countries.generated.json';

const CONTINENTS = ['Afrika', 'Asien', 'Europa', 'Nordamerika', 'Südamerika', 'Ozeanien'];
const pointCount = (path: string) => path.split(/[MLZ]/).filter(Boolean).length;

describe('Länderdaten', () => {
  it('enthält genau die 193 UN-Mitgliedsstaaten', () => {
    expect(countries).toHaveLength(193);
    expect(new Set(countries.map((c) => c.code)).size).toBe(193);
  });

  it('hat eindeutige deutsche Namen', () => {
    expect(new Set(countries.map((c) => c.name)).size).toBe(193);
  });

  it('kennt Kontinent und Teilregion jedes Landes', () => {
    for (const c of countries) {
      expect(CONTINENTS, c.name).toContain(c.continent);
      expect(c.subregion, c.name).toBeTruthy();
    }
  });

  it('ordnet Stichproben dem richtigen Kontinent zu', () => {
    const continent = Object.fromEntries(countries.map((c) => [c.name, c.continent]));
    expect(continent['Deutschland']).toBe('Europa');
    expect(continent['Brasilien']).toBe('Südamerika');
    expect(continent['Mexiko']).toBe('Nordamerika');
    expect(continent['Japan']).toBe('Asien');
    expect(continent['Kenia']).toBe('Afrika');
    expect(continent['Australien']).toBe('Ozeanien');
  });

  it('markiert nur kleine Staaten als winzig', () => {
    const tiny = countries.filter((c) => c.tiny).map((c) => c.name);
    expect(tiny).toContain('Nauru');
    expect(tiny).toContain('Monaco');
    expect(tiny).not.toContain('Deutschland');
    expect(tiny.length).toBeLessThan(30);
  });

  it.each(countries.filter((c) => !c.tiny).map((c) => [c.name, c.path] as const))(
    '%s hat einen echten Umriss',
    (_name, path) => {
      // Ein kaputter Umriss (z. B. ein Viereck statt Australien) hat nur wenige Punkte
      expect(pointCount(path)).toBeGreaterThan(50);
    },
  );

  it.each(countries.map((c) => [c.name, c.path] as const))('%s liegt im Bildausschnitt', (_name, path) => {
    const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(1000);
  });
});
