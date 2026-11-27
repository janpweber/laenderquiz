import { describe, expect, it } from 'vitest';
import { viewRadius } from './context-map';

describe('Kartenausschnitt', () => {
  it('zeigt bei kleinen Ländern trotzdem die Nachbarschaft', () => {
    expect(viewRadius(0.2)).toBe(6);
  });
  it('wächst mit der Landesgröße', () => {
    expect(viewRadius(4)).toBeCloseTo(10.4);
  });
  it('bleibt bei sehr großen Ländern begrenzt', () => {
    expect(viewRadius(37)).toBe(70);
  });
});
