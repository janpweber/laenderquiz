import { describe, expect, it } from 'vitest';
import { createRound, answerQuestion, currentQuestion, isFinished, type Country } from './game';

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
