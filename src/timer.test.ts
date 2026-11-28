import { describe, expect, it } from 'vitest';
import { answerQuestion, createRound, currentQuestion, isFinished, type Country } from './game';
import { formatTime, startQuestionClock } from './timer';

const countries: Country[] = ['DEU', 'ITA', 'JPN', 'BRA', 'AUS'].map((code) => ({ code, name: code, path: 'M0 0' }));

// Gefakte Uhr: Zeit läuft nur, wenn der Test sie weiterdreht
function fakeClock() {
  let t = 1000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('Zeitmessung', () => {
  it('zählt angehaltene Zeit nicht mit', () => {
    const clock = fakeClock();
    const q = startQuestionClock(clock.now);
    clock.advance(2000);
    q.pause();
    clock.advance(10_000);
    expect(q.elapsed()).toBe(2000);
    q.pause();
    q.resume();
    clock.advance(500);
    expect(q.elapsed()).toBe(2500);
    q.resume();
    expect(q.elapsed()).toBe(2500);
  });

  it('summiert die Antwortzeiten, die Rückmeldungs-Pause zählt nicht', () => {
    const clock = fakeClock();
    let round = createRound(countries, { length: 3 }, () => 0.3);
    const thinking = [2500, 4000, 1200];
    for (const ms of thinking) {
      const q = startQuestionClock(clock.now);
      clock.advance(ms);
      round = answerQuestion(round, currentQuestion(round)!.country.code, q.elapsed()).round;
      clock.advance(5000); // Spieler liest die Rückmeldung, bevor er „Weiter“ drückt
    }
    expect(isFinished(round)).toBe(true);
    expect(round.totalMs).toBe(7700);
  });

  it('startet bei null', () => {
    expect(createRound(countries, { length: 2 }).totalMs).toBe(0);
  });
});

describe('Anzeige der Gesamtzeit', () => {
  it('formatiert Sekunden und Minuten deutsch', () => {
    expect(formatTime(0)).toBe('0,0 s');
    expect(formatTime(42_340)).toBe('42,3 s');
    expect(formatTime(65_000)).toBe('1:05,0 min');
    expect(formatTime(59_960)).toBe('1:00,0 min');
  });
});
