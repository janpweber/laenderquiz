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

import { geoAzimuthalEqualArea, geoCircle } from 'd3-geo';
import { interpolateViewBox, outlineViewBox } from './context-map';

describe('Zoom aus dem Umriss', () => {
  // ein Viereck um Deutschland, wie im Datenskript projiziert
  const land = { type: 'Polygon' as const, coordinates: [[[6, 47], [15, 47], [15, 55], [6, 55], [6, 47]]] };
  const outline = geoAzimuthalEqualArea().rotate([-10.5, -51]).fitExtent([[40, 40], [960, 960]], land);
  const map = geoAzimuthalEqualArea()
    .rotate([-10.5, -51])
    .fitExtent([[0, 0], [1000, 750]], geoCircle().center([10.5, 51]).radius(12)());

  it('der Start-Ausschnitt der Karte zeigt das Land genau wie der Umriss', () => {
    const [x, y, w, h] = outlineViewBox([outline.scale(), ...outline.translate()], map.scale(), map.translate());
    for (const point of [[6, 47], [15, 55], [10, 50]] as [number, number][]) {
      const [ox, oy] = outline(point)!;
      const [mx, my] = map(point)!;
      // relative Lage im Bild muss übereinstimmen
      expect((mx - x) / w).toBeCloseTo(ox / 1000, 6);
      expect((my - y) / h).toBeCloseTo(oy / 1000, 6);
    }
  });

  it('der Zoom beginnt beim Umriss und endet bei der ganzen Karte', () => {
    const from: [number, number, number, number] = [400, 300, 100, 100];
    const to: [number, number, number, number] = [0, 0, 1000, 750];
    expect(interpolateViewBox(from, to, 0)).toEqual(from);
    interpolateViewBox(from, to, 1).forEach((v, i) => expect(v).toBeCloseTo(to[i], 6));
  });
});
