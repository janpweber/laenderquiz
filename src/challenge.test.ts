import { describe, expect, it } from 'vitest';
import countries from './countries.generated.json';
import {
  attemptsUsed,
  bestPerPlayer,
  challengeRound,
  conditions,
  fixQuestions,
  idsFromAttemptKeys,
  knownChallenges,
  overview,
  rememberChallenge,
  KNOWN_MAX,
  type Challenge,
  type ChallengeResult,
  newId,
  ID_PATTERN,
  playerId,
  useAttempt,
  validChallenge,
  type ChallengeSetup,
  type Store,
} from './challenge';
import { filterCountries } from './game';

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function memoryStore(): Store {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const base: ChallengeSetup = {
  titel: 'Büro',
  ersteller: 'Jan',
  region: 'Europa',
  laender: 10,
  tempo: 3,
  versuche: 3,
  fragen: null,
};

describe('Challenge mit gleichen Ländern', () => {
  const pool = filterCountries(countries, { continent: 'Europa', difficulty: 'normal' });
  const fragen = fixQuestions(pool, 10, 3, seeded(7));

  it('legt jeden Versuch vorab fest', () => {
    expect(fragen).toHaveLength(3);
    for (const versuch of fragen) {
      expect(versuch).toHaveLength(10);
      for (const q of versuch) {
        expect(q.o).toContain(q.c);
        expect(new Set(q.o).size).toBe(4);
      }
    }
  });

  it('alle bekommen dieselben Fragen und Antworten, nur gemischt', () => {
    const setup = { ...base, fragen };
    const a = challengeRound(setup, 2, countries, seeded(1));
    const b = challengeRound(setup, 2, countries, seeded(99));
    const key = (r: typeof a) =>
      r.questions.map((q) => `${q.country.code}:${q.options.map((o) => o.code).sort().join(',')}`).sort();
    expect(key(a)).toEqual(key(b));
    expect(key(a)).toEqual(fragen[1].map((q) => `${q.c}:${[...q.o].sort().join(',')}`).sort());
    expect(a.questions.map((q) => q.country.code)).not.toEqual(b.questions.map((q) => q.country.code));
  });
});

describe('Challenge mit zufälligen Ländern', () => {
  it('zieht aus der Region', () => {
    const round = challengeRound(base, 1, countries, seeded(3));
    expect(round.questions).toHaveLength(10);
    expect(round.questions.every((q) => q.country.continent === 'Europa' && !q.country.tiny)).toBe(true);
  });
});

describe('Rangliste der Challenge', () => {
  it('zählt pro Person den besten Versuch', () => {
    const r = (spieler: string, richtige: number, zeit_ms: number, versuch = 1) => ({
      challenge_id: 'abcdefgh',
      spieler,
      name: spieler,
      versuch,
      richtige,
      zeit_ms,
    });
    const list = bestPerPlayer([r('a', 5, 20000), r('a', 7, 30000, 2), r('b', 7, 25000), r('a', 7, 28000, 3)]);
    expect(list.map((e) => [e.spieler, e.richtige, e.zeit_ms])).toEqual([
      ['b', 7, 25000],
      ['a', 7, 28000],
    ]);
  });
});

describe('Versuche und Kennungen', () => {
  it('zählt Versuche je Challenge im Speicher', () => {
    const store = memoryStore();
    expect(attemptsUsed(store, 'abcdefgh')).toBe(0);
    expect(useAttempt(store, 'abcdefgh')).toBe(1);
    expect(useAttempt(store, 'abcdefgh')).toBe(2);
    expect(attemptsUsed(store, 'zzzzzzzz')).toBe(0);
  });
  it('merkt sich die Spieler-Kennung', () => {
    const store = memoryStore();
    const id = playerId(store, () => 'eins');
    expect(playerId(store, () => 'zwei')).toBe(id);
  });
  it('erzeugt kurze Link-Kennungen', () => {
    expect(newId()).toMatch(ID_PATTERN);
  });
  it('prüft geladene Challenges', () => {
    expect(validChallenge({ ...base, id: 'abcdefgh' })).toBe(true);
    expect(validChallenge({ ...base, id: 'abcdefgh', laender: 7 })).toBe(false);
    expect(validChallenge({ ...base, id: 'abcdefgh', fragen: [[]] })).toBe(false);
  });
  it('beschreibt die Bedingungen', () => {
    expect(conditions(base)).toEqual(['10 Länder · Europa', '3 Sekunden pro Land', '3 Versuche, der beste zählt', 'Länder für jeden zufällig']);
  });
});

describe('Meine Challenges', () => {
  it('merkt sich geöffnete und erstellte Challenges, neueste zuerst', () => {
    const store = memoryStore();
    rememberChallenge(store, 'aaaaaaaa', true, 1);
    rememberChallenge(store, 'bbbbbbbb', false, 2);
    rememberChallenge(store, 'aaaaaaaa', false, 3);
    expect(knownChallenges(store)).toEqual([
      { id: 'aaaaaaaa', eigene: true, at: 3 },
      { id: 'bbbbbbbb', eigene: false, at: 2 },
    ]);
  });
  it('ignoriert ungültige Kennungen und begrenzt die Liste', () => {
    const store = memoryStore();
    rememberChallenge(store, 'kaputt', false, 1);
    expect(knownChallenges(store)).toEqual([]);
    for (let i = 0; i < KNOWN_MAX + 5; i++) rememberChallenge(store, `a${String(i).padStart(7, '0')}`, false, i);
    expect(knownChallenges(store)).toHaveLength(KNOWN_MAX);
    store.setItem('laenderquiz:challenges', '{kaputt');
    expect(knownChallenges(store)).toEqual([]);
  });
  it('findet früher gespielte Challenges in den Versuchs-Einträgen', () => {
    expect(idsFromAttemptKeys(['laenderquiz:challenge:abcdefgh', 'laenderquiz:spieler', 'laenderquiz:challenge:x', 'laenderquiz:challenges'])).toEqual([
      'abcdefgh',
    ]);
  });
  it('teilt in offen und gespielt, mit Platz und bestem Ergebnis', () => {
    const one: Challenge = { ...base, id: 'aaaaaaaa', versuche: 1 };
    const three: Challenge = { ...base, id: 'bbbbbbbb', versuche: 3 };
    const fresh: Challenge = { ...base, id: 'cccccccc', versuche: 1 };
    const r = (challenge_id: string, spieler: string, versuch: number, richtige: number): ChallengeResult => ({
      challenge_id, spieler, name: spieler, versuch, richtige, zeit_ms: 10000,
    });
    const results = [r('aaaaaaaa', 'ich', 1, 6), r('aaaaaaaa', 'anna', 1, 9), r('bbbbbbbb', 'ich', 1, 8), r('bbbbbbbb', 'ich', 2, 4)];
    const known = [
      { id: 'cccccccc', eigene: true, at: 3 },
      { id: 'bbbbbbbb', eigene: false, at: 2 },
      { id: 'aaaaaaaa', eigene: false, at: 1 },
      { id: 'gelöscht', eigene: false, at: 0 },
    ];
    const used = (id: string) => (id === 'bbbbbbbb' ? 1 : 0); // Ergebnisse zählen mit, auch wenn der Speicher weniger weiß
    const { offen, gespielt } = overview(known, [one, three, fresh], results, 'ich', used);
    expect(offen.map((s) => [s.challenge.id, s.left, s.rank, s.best?.richtige, s.eigene])).toEqual([
      ['cccccccc', 1, undefined, undefined, true],
      ['bbbbbbbb', 1, 1, 8, false],
    ]);
    expect(gespielt.map((s) => [s.challenge.id, s.left, s.rank, s.players])).toEqual([['aaaaaaaa', 0, 2, 2]]);
  });
});
