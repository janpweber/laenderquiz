import { describe, expect, it } from 'vitest';
import countries from './countries.generated.json';

describe('Länderdaten', () => {
  it.each(countries.map((c) => [c.name, c.path] as const))('%s hat einen echten Umriss', (_name, path) => {
    // Ein kaputter Umriss (z. B. die ganze Erdkugel) besteht nur aus wenigen Punkten
    const points = path.split(/[MLZ]/).filter(Boolean).length;
    expect(points).toBeGreaterThan(50);
  });
});
