import { describe, expect, it } from 'vitest';
import { isBetter, isStandard, loadRecords, recordKey, submitResult, type KeyValueStore } from './record';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const ten = recordKey({ length: 10, continent: 'Welt', difficulty: 'normal' });
const five = recordKey({ length: 5, continent: 'Welt', difficulty: 'normal' });

describe('Persönlicher Rekord', () => {
  it('erster Versuch ist immer ein Rekord und bleibt gespeichert', () => {
    const store = memoryStore();
    const first = submitResult(store, ten, { score: 6, total: 10, ms: 40_000 });
    expect(first.isNew).toBe(true);
    expect(first.previous).toBeUndefined();
    // „Neuladen“: neu aus dem Speicher lesen
    expect(loadRecords(store)[ten]).toEqual({ score: 6, total: 10, ms: 40_000 });
  });

  it('mehr richtige gewinnt, bei Gleichstand die kürzere Zeit', () => {
    expect(isBetter({ score: 7, total: 10, ms: 90_000 }, { score: 6, total: 10, ms: 10_000 })).toBe(true);
    expect(isBetter({ score: 6, total: 10, ms: 30_000 }, { score: 6, total: 10, ms: 40_000 })).toBe(true);
    expect(isBetter({ score: 6, total: 10, ms: 40_000 }, { score: 6, total: 10, ms: 40_000 })).toBe(false);
    expect(isBetter({ score: 5, total: 10, ms: 1_000 }, { score: 6, total: 10, ms: 40_000 })).toBe(false);
  });

  it('ein schlechteres Ergebnis überschreibt den Rekord nicht', () => {
    const store = memoryStore();
    submitResult(store, ten, { score: 8, total: 10, ms: 30_000 });
    const worse = submitResult(store, ten, { score: 7, total: 10, ms: 20_000 });
    expect(worse.isNew).toBe(false);
    expect(worse.best).toEqual({ score: 8, total: 10, ms: 30_000 });
    expect(loadRecords(store)[ten].score).toBe(8);
  });

  it('eine kurze Runde überschreibt nicht den 10er-Rekord', () => {
    const store = memoryStore();
    submitResult(store, ten, { score: 6, total: 10, ms: 40_000 });
    submitResult(store, five, { score: 5, total: 5, ms: 10_000 });
    expect(loadRecords(store)[ten]).toEqual({ score: 6, total: 10, ms: 40_000 });
    expect(loadRecords(store)[five].score).toBe(5);
  });

  it('trennt Kontinent und Schwierigkeit', () => {
    expect(recordKey({ length: 10, continent: 'Europa', difficulty: 'normal' })).not.toBe(ten);
    expect(recordKey({ length: 10, continent: 'Welt', difficulty: 'schwer' })).not.toBe(ten);
    expect(recordKey({ length: 'endlos', continent: 'Welt', difficulty: 'normal' })).not.toBe(ten);
  });

  it('erkennt die Standardrunde', () => {
    expect(isStandard({ length: 10, continent: 'Welt', difficulty: 'normal' })).toBe(true);
    expect(isStandard({ length: 10, continent: 'Welt', difficulty: 'schwer' })).toBe(false);
    expect(isStandard({ length: 20, continent: 'Welt', difficulty: 'normal' })).toBe(false);
  });
});

describe('Rekord ohne funktionierenden Speicher', () => {
  it('stürzt ohne localStorage nicht ab', () => {
    const update = submitResult(undefined, ten, { score: 6, total: 10, ms: 40_000 });
    expect(update.isNew).toBe(true);
    expect(loadRecords(undefined)).toEqual({});
  });

  it('stürzt nicht ab, wenn der Speicher beim Lesen oder Schreiben wirft', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => submitResult(broken, ten, { score: 6, total: 10, ms: 40_000 })).not.toThrow();
  });

  it('verwirft kaputte gespeicherte Daten', () => {
    const store = memoryStore();
    store.setItem('laenderquiz:rekorde', '{kaputt');
    expect(loadRecords(store)).toEqual({});
    store.setItem('laenderquiz:rekorde', JSON.stringify({ [ten]: { score: 11, total: 10, ms: 5 }, [five]: { score: 3, total: 5, ms: 9 } }));
    expect(Object.keys(loadRecords(store))).toEqual([five]);
  });
});

describe('Rekord mit Tempo', () => {
  it('führt Runden mit Zeitlimit getrennt, ohne Limit bleibt der alte Schlüssel', () => {
    const base = { length: 10, continent: 'Welt', difficulty: 'normal' } as const;
    expect(recordKey({ ...base, tempo: 0 })).toBe(recordKey(base));
    expect(recordKey({ ...base, tempo: 3 })).not.toBe(recordKey(base));
  });
});
