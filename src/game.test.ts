import { describe, expect, it } from 'vitest';
import {
  answerQuestion,
  clampLength,
  createRound,
  currentQuestion,
  endRound,
  filterCountries,
  isFinished,
  type Country,
} from './game';

const countries: Country[] = ['DEU', 'ITA', 'JPN', 'BRA', 'AUS'].map((code) => ({
  code,
  name: code,
  path: 'M0 0',
}));

// Deterministischer Zufall für reproduzierbare Tests
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('Runde', () => {
  it('stellt so viele Fragen wie gewünscht, ohne Wiederholung', () => {
    const round = createRound(countries, { length: 5 }, seeded(1));
    const codes = round.questions.map((q) => q.country.code);
    expect(codes).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);
  });

  it('bietet pro Frage 4 verschiedene Antworten mit genau einer richtigen', () => {
    const round = createRound(countries, { length: 5 }, seeded(2));
    for (const q of round.questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.code)).size).toBe(4);
      expect(q.options.filter((o) => o.code === q.country.code)).toHaveLength(1);
    }
  });

  it('mischt die Position der richtigen Antwort', () => {
    const round = createRound(countries, { length: 5 }, seeded(3));
    const positions = round.questions.map((q) => q.options.findIndex((o) => o.code === q.country.code));
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it('zählt richtige Antworten und meldet das Ergebnis', () => {
    let round = createRound(countries, { length: 2 }, seeded(4));
    const first = currentQuestion(round)!;
    const r1 = answerQuestion(round, first.country.code);
    expect(r1.correct).toBe(true);
    expect(r1.correctCountry.code).toBe(first.country.code);
    round = r1.round;

    const second = currentQuestion(round)!;
    const wrong = second.options.find((o) => o.code !== second.country.code)!;
    const r2 = answerQuestion(round, wrong.code);
    expect(r2.correct).toBe(false);
    round = r2.round;

    expect(isFinished(round)).toBe(true);
    expect(round.score).toBe(1);
    expect(currentQuestion(round)).toBeUndefined();
  });

  it('begrenzt die Rundenlänge auf die verfügbaren Länder', () => {
    const round = createRound(countries, { length: 50 }, seeded(5));
    expect(round.questions).toHaveLength(5);
  });
});

describe('Ablenker', () => {
  const world: Country[] = [
    // Westeuropa (4)
    { code: 'DEU', name: 'Deutschland', path: '', continent: 'Europa', subregion: 'Western Europe' },
    { code: 'FRA', name: 'Frankreich', path: '', continent: 'Europa', subregion: 'Western Europe' },
    { code: 'BEL', name: 'Belgien', path: '', continent: 'Europa', subregion: 'Western Europe' },
    { code: 'NLD', name: 'Niederlande', path: '', continent: 'Europa', subregion: 'Western Europe' },
    // Südeuropa (2)
    { code: 'ITA', name: 'Italien', path: '', continent: 'Europa', subregion: 'Southern Europe' },
    { code: 'ESP', name: 'Spanien', path: '', continent: 'Europa', subregion: 'Southern Europe' },
    // Asien
    { code: 'JPN', name: 'Japan', path: '', continent: 'Asien', subregion: 'Eastern Asia' },
    { code: 'CHN', name: 'China', path: '', continent: 'Asien', subregion: 'Eastern Asia' },
    { code: 'IND', name: 'Indien', path: '', continent: 'Asien', subregion: 'Southern Asia' },
    // Ozeanien (allein in seiner Teilregion und fast allein im Kontinent)
    { code: 'AUS', name: 'Australien', path: '', continent: 'Ozeanien', subregion: 'Australia and New Zealand' },
  ];

  const optionsFor = (code: string, seed: number) => {
    const round = createRound(world, { length: world.length }, seeded(seed));
    return round.questions.find((q) => q.country.code === code)!.options;
  };

  it('kommen aus derselben Teilregion, wenn es dort genug Länder gibt', () => {
    for (let seed = 1; seed < 20; seed++) {
      const options = optionsFor('DEU', seed);
      expect(options.every((o) => o.subregion === 'Western Europe')).toBe(true);
    }
  });

  it('füllen mit demselben Kontinent auf, wenn die Teilregion zu klein ist', () => {
    for (let seed = 1; seed < 20; seed++) {
      const options = optionsFor('ITA', seed);
      expect(options.every((o) => o.continent === 'Europa')).toBe(true);
      expect(options.map((o) => o.code)).toContain('ESP');
    }
  });

  it('nehmen Länder aus aller Welt, wenn der Kontinent zu klein ist', () => {
    const options = optionsFor('AUS', 1);
    expect(options).toHaveLength(4);
    expect(new Set(options.map((o) => o.code)).size).toBe(4);
  });

  it('enthalten nie die richtige Antwort doppelt und keine Wiederholung', () => {
    for (let seed = 1; seed < 20; seed++) {
      const round = createRound(world, { length: world.length }, seeded(seed));
      for (const q of round.questions) {
        expect(new Set(q.options.map((o) => o.code)).size).toBe(4);
        expect(q.options.filter((o) => o.code === q.country.code)).toHaveLength(1);
      }
    }
  });
});

describe('Einstellungen', () => {
  const pool: Country[] = [
    { code: 'DEU', name: 'Deutschland', path: '', continent: 'Europa', subregion: 'Western Europe' },
    { code: 'FRA', name: 'Frankreich', path: '', continent: 'Europa', subregion: 'Western Europe' },
    { code: 'MCO', name: 'Monaco', path: '', continent: 'Europa', subregion: 'Western Europe', tiny: true },
    { code: 'JPN', name: 'Japan', path: '', continent: 'Asien', subregion: 'Eastern Asia' },
    { code: 'CHN', name: 'China', path: '', continent: 'Asien', subregion: 'Eastern Asia' },
    { code: 'SGP', name: 'Singapur', path: '', continent: 'Asien', subregion: 'South-Eastern Asia', tiny: true },
  ];

  it('„Normal“ lässt winzige Staaten weg, „Schwer“ nimmt alle', () => {
    expect(filterCountries(pool, { continent: 'Welt', difficulty: 'normal' }).map((c) => c.code)).toEqual([
      'DEU', 'FRA', 'JPN', 'CHN',
    ]);
    expect(filterCountries(pool, { continent: 'Welt', difficulty: 'schwer' })).toHaveLength(6);
  });

  it('filtert nach Kontinent', () => {
    expect(filterCountries(pool, { continent: 'Asien', difficulty: 'schwer' }).map((c) => c.code)).toEqual([
      'JPN', 'CHN', 'SGP',
    ]);
  });

  it('begrenzt eine eigene Rundenlänge auf 1 bis Anzahl der Länder', () => {
    expect(clampLength(0, 4)).toBe(1);
    expect(clampLength(7, 4)).toBe(4);
    expect(clampLength(3, 4)).toBe(3);
    expect(clampLength(2.7, 4)).toBe(2);
  });

  it('spielt im Endlosmodus alle Länder und lässt sich jederzeit beenden', () => {
    let round = createRound(pool, { length: 'endlos' }, seeded(1));
    expect(round.questions).toHaveLength(pool.length);
    expect(round.endless).toBe(true);
    round = answerQuestion(round, currentQuestion(round)!.country.code).round;
    round = answerQuestion(round, 'XXX').round;
    round = endRound(round);
    expect(isFinished(round)).toBe(true);
    expect(round.questions).toHaveLength(2);
    expect(round.score).toBe(1);
  });
});
