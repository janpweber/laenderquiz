import { describe, expect, it } from 'vitest';
import allCountries from './countries.generated.json';
import { answerQuestion, createRound, currentQuestion, endRound, type Country } from './game';
import { flagUrl, hasFlag } from './flags';

const countries: Country[] = ['DEU', 'ITA', 'JPN', 'BRA', 'AUS'].map((code) => ({ code, name: code, path: 'M0 0' }));

describe('Hinweis', () => {
  it('zählt die Fragen mit Hinweis, Punkte bleiben unberührt', () => {
    let round = createRound(countries, { length: 3 }, () => 0.3);
    expect(round.hints).toBe(0);
    round = answerQuestion(round, currentQuestion(round)!.country.code, 1000, true).round;
    round = answerQuestion(round, currentQuestion(round)!.country.code, 1000).round;
    expect(round.hints).toBe(1);
    expect(round.score).toBe(2);
    expect(endRound(round).hints).toBe(1);
  });

  it('jedes Land hat eine Flagge', () => {
    const missing = allCountries.filter((c) => !hasFlag(c.code)).map((c) => c.code);
    expect(missing).toEqual([]);
    expect(flagUrl('DEU')).toBeTruthy();
  });
});
