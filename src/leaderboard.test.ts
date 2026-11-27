import schema from '../supabase/schema.sql?raw';
import { describe, expect, it } from 'vitest';
import { LeaderboardError, compareEntries, fetchTop, plausible, submitEntry, type Entry } from './leaderboard';
import { BLOCKLIST, checkName } from './name';

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
    expect(plausible(10, 25_000)).toBe(true);
    expect(plausible(11, 25_000)).toBe(false);
    expect(plausible(-1, 25_000)).toBe(false);
    expect(plausible(10, 1_000)).toBe(false);
    expect(plausible(10, 2 * 60 * 60 * 1000)).toBe(false);
  });

  it('meldet fehlendes Netz freundlich', async () => {
    const offline = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    await expect(fetchTop(20, offline)).rejects.toThrow(LeaderboardError);
    await expect(fetchTop(20, offline)).rejects.toThrow(/Verbindung/);
  });

  it('meldet einen abgelehnten Eintrag verständlich', async () => {
    const rejected = (() => Promise.resolve(new Response('{}', { status: 400 }))) as typeof fetch;
    await expect(submitEntry(e('Jan', 7, 30_000), rejected)).rejects.toThrow(/abgelehnt/);
  });

  it('schickt unmögliche Werte gar nicht erst ab', async () => {
    let called = false;
    const spy = (() => {
      called = true;
      return Promise.resolve(new Response(null, { status: 201 }));
    }) as typeof fetch;
    await expect(submitEntry(e('Jan', 12, 30_000), spy)).rejects.toThrow(LeaderboardError);
    expect(called).toBe(false);
  });

  it('trägt ein und berechnet den Platz', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = ((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
      return Promise.resolve(new Response(null, { status: 200, headers: { 'content-range': '*/2' } }));
    }) as typeof fetch;
    expect(await submitEntry(e('Jan', 7, 30_000), fake)).toBe(3);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ name: 'Jan', richtige: 7, zeit_ms: 30_000 });
    expect(calls[1].url).toContain('or=(richtige.gt.7,and(richtige.eq.7,zeit_ms.lt.30000))');
  });
});
