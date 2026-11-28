import { describe, expect, it } from 'vitest';
import { HISTORY_MAX, loadHistory, mistakes, recentCountries, recordAnswer, type Store } from './practice';
import { createRoundFrom, type Country } from './game';

function memoryStore(): Store {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('Verlauf', () => {
  it('speichert die neuesten Antworten vorn und begrenzt die Länge', () => {
    const store = memoryStore();
    for (let i = 0; i < HISTORY_MAX + 5; i++) recordAnswer(store, `L${i}`, true);
    const history = loadHistory(store);
    expect(history).toHaveLength(HISTORY_MAX);
    expect(history[0].code).toBe(`L${HISTORY_MAX + 4}`);
  });
  it('übersteht kaputte Daten', () => {
    const store = memoryStore();
    store.setItem('laenderquiz:verlauf', '{kaputt');
    expect(loadHistory(store)).toEqual([]);
  });
});

describe('Übungslisten', () => {
  // neueste zuerst
  const h = (...items: [string, boolean][]) => items.map(([code, correct]) => ({ code, correct }));

  it('zuletzt gespielte Länder ohne Doppelte', () => {
    expect(recentCountries(h(['A', true], ['B', false], ['A', true], ['C', true]), 2)).toEqual(['A', 'B']);
  });

  it('Fehler bleiben, bis das Land zweimal hintereinander richtig war', () => {
    expect(mistakes(h(['A', false]))).toEqual(['A']);
    expect(mistakes(h(['A', true], ['A', false]))).toEqual(['A']);
    expect(mistakes(h(['A', true], ['A', true], ['A', false]))).toEqual([]);
    expect(mistakes(h(['A', false], ['A', true], ['A', true]))).toEqual(['A']);
    expect(mistakes(h(['B', false], ['A', true], ['C', true], ['A', false]))).toEqual(['B', 'A']);
  });
});

describe('Übungsrunde', () => {
  it('fragt genau die gewählten Länder ab, mit vier Antworten', () => {
    const pool: Country[] = Array.from({ length: 12 }, (_, i) => ({ code: `L${i}`, name: `Land ${i}`, path: '' }));
    const round = createRoundFrom(pool.slice(0, 3), pool, () => 0.4);
    expect(round.questions.map((q) => q.country.code).sort()).toEqual(['L0', 'L1', 'L2']);
    for (const q of round.questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options.map((o) => o.code)).toContain(q.country.code);
    }
  });
});
