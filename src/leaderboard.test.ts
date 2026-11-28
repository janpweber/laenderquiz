import schema from '../supabase/schema.sql?raw';
import { describe, expect, it } from 'vitest';
import { LeaderboardError, compareEntries, fetchTop, loadBlockedWords, plausible, submitEntry, type Entry } from './leaderboard';
import { BLOCKLIST, checkName, setBlockedWords } from './name';
import { RANKED, rankedFor } from './ranked';

describe('Ranglisten', () => {
  it('Welt mit 10 und jeder Kontinent mit 5 Ländern, nur Normal', () => {
    expect(rankedFor({ length: 10, continent: 'Welt', difficulty: 'normal' })?.modus).toBe('Welt');
    expect(rankedFor({ length: 5, continent: 'Europa', difficulty: 'normal' })?.modus).toBe('Europa');
    expect(rankedFor({ length: 10, continent: 'Europa', difficulty: 'normal' })).toBeUndefined();
    expect(rankedFor({ length: 5, continent: 'Europa', difficulty: 'schwer' })).toBeUndefined();
    expect(rankedFor({ length: 'endlos', continent: 'Welt', difficulty: 'normal' })).toBeUndefined();
  });

  it('die Datenbank kennt dieselben Modi und Längen', () => {
    for (const mode of RANKED) expect(schema, mode.modus).toContain(`'${mode.modus}'`);
    expect(schema).toContain("when 'Welt' then 10 else 5");
  });
});

describe('Namensprüfung', () => {
  it('trimmt und erlaubt normale Namen', () => {
    expect(checkName('  Jan  ')).toEqual({ ok: true, name: 'Jan' });
    expect(checkName('Anna-Lena W.')).toEqual({ ok: true, name: 'Anna-Lena W.' });
    expect(checkName('Jürgen 🌍')).toEqual({ ok: true, name: 'Jürgen 🌍' });
    expect(checkName('Nazira')).toMatchObject({ ok: true });
  });

  it('lehnt leere und zu lange Namen ab', () => {
    expect(checkName('   ')).toMatchObject({ ok: false });
    expect(checkName('a'.repeat(20))).toMatchObject({ ok: true });
    expect(checkName('a'.repeat(21))).toMatchObject({ ok: false, message: expect.stringContaining('20') });
  });

  it('filtert gesperrte Wörter, auch versteckt', () => {
    for (const name of ['Arschloch', 'F.u.c.k', 'h1tler', 'Wi chser', 'Sieg Heil', 'BITCH99'])
      expect(checkName(name), name).toMatchObject({ ok: false });
  });

  it('die Datenbank kennt dieselben Sperrwörter', () => {
    for (const word of BLOCKLIST) expect(schema, word).toContain(`'${word}'`);
  });
});

describe('Bestenliste', () => {
  const e = (name: string, richtige: number, zeit_ms: number, created_at = '2026-01-01'): Entry => ({
    modus: 'Welt',
    name,
    richtige,
    zeit_ms,
    created_at,
  });

  it('sortiert nach richtigen, dann nach kürzerer Zeit, dann nach Eintragszeit', () => {
    const sorted = [
      e('C', 8, 30_000),
      e('A', 10, 50_000),
      e('B', 10, 40_000),
      e('E', 8, 30_000, '2026-01-02'),
      e('D', 9, 10_000),
    ].sort(compareEntries);
    expect(sorted.map((x) => x.name)).toEqual(['B', 'A', 'D', 'C', 'E']);
  });

  it('lässt nur plausible Ergebnisse zu', () => {
    expect(plausible(10, 25_000, 10)).toBe(true);
    expect(plausible(11, 25_000, 10)).toBe(false);
    expect(plausible(6, 25_000, 5)).toBe(false);
    expect(plausible(5, 1_600, 5)).toBe(true);
    expect(plausible(-1, 25_000, 10)).toBe(false);
    expect(plausible(10, 1_000, 10)).toBe(false);
    expect(plausible(10, 2 * 60 * 60 * 1000, 10)).toBe(false);
  });

  it('meldet fehlendes Netz freundlich', async () => {
    const offline = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    await expect(fetchTop('Welt', 20, offline)).rejects.toThrow(LeaderboardError);
    await expect(fetchTop('Welt', 20, offline)).rejects.toThrow(/Verbindung/);
  });

  it('meldet einen abgelehnten Eintrag verständlich', async () => {
    const rejected = (() => Promise.resolve(new Response('{}', { status: 400 }))) as typeof fetch;
    await expect(submitEntry(e('Jan', 7, 30_000), 10, rejected)).rejects.toThrow(/abgelehnt/);
  });

  it('schickt unmögliche Werte gar nicht erst ab', async () => {
    let called = false;
    const spy = (() => {
      called = true;
      return Promise.resolve(new Response(null, { status: 201 }));
    }) as typeof fetch;
    await expect(submitEntry(e('Jan', 12, 30_000), 10, spy)).rejects.toThrow(LeaderboardError);
    expect(called).toBe(false);
  });

  it('trägt ein und berechnet den Platz', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = ((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
      return Promise.resolve(new Response(null, { status: 200, headers: { 'content-range': '*/2' } }));
    }) as typeof fetch;
    expect(await submitEntry({ ...e('Jan', 4, 30_000), modus: 'Südamerika' }, 5, fake)).toBe(3);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ modus: 'Südamerika', name: 'Jan', richtige: 4, zeit_ms: 30_000 });
    expect(calls[1].url).toContain('modus=eq.S%C3%BCdamerika');
    expect(calls[1].url).toContain('or=(richtige.gt.4,and(richtige.eq.4,zeit_ms.lt.30000))');
  });
});

describe('Sperrwörter aus der Datenbank', () => {
  it('prüft geladene Wörter als ganzes Wort, die Grundliste als Teilwort', async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify([
          { wort: 'anal', ganzes_wort: true },
          { wort: 'nackt', ganzes_wort: true },
          { wort: 'kacke', ganzes_wort: false },
          { wort: 'Kaputt!', ganzes_wort: true },
        ]),
        { status: 200 },
      )) as typeof fetch;
    await loadBlockedWords(fetchFn);
    expect(checkName('Analena')).toMatchObject({ ok: true });
    expect(checkName('Anal King')).toMatchObject({ ok: false });
    expect(checkName('A.n.a.l')).toMatchObject({ ok: false });
    expect(checkName('N4ckt')).toMatchObject({ ok: false });
    expect(checkName('Superkacke')).toMatchObject({ ok: false });
    expect(checkName('Superfuck')).toMatchObject({ ok: false });
    expect(checkName('Jan')).toMatchObject({ ok: true });
    setBlockedWords([]);
  });

  it('die Datenbank kennt die Spalten für ganze Wörter und Abschalten', () => {
    expect(schema).toContain('ganzes_wort boolean');
    expect(schema).toContain('aktiv boolean');
  });
});
