// Natural Earth (world-atlas) zeichnet die Krim als Teil Russlands (De-facto-Ansicht).
// Wir folgen der völkerrechtlichen Lage (UN-Resolution 68/262): Die Krim gehört zur Ukraine.
// Diese Funktion verschiebt das Krim-Polygon in einer world-atlas-Topologie von Russland
// zur Ukraine und verschmilzt es dort, damit keine Grenzlinie am Isthmus bleibt.
// Als reines JavaScript, damit es auch die Build-Skripte (Node) nutzen können.
import { feature, mergeArcs } from 'topojson-client';
import { geoCentroid } from 'd3-geo';

const RUSSIA = '643';
const UKRAINE = '804';
const isCrimea = ([lon, lat]) => lon > 32 && lon < 37 && lat > 44 && lat < 46.3;

export function ukrainianCrimea(topology) {
  const geometries = topology.objects.countries.geometries;
  const russia = geometries.find((g) => g.id === RUSSIA);
  const ukraine = geometries.find((g) => g.id === UKRAINE);
  if (!russia || !ukraine || russia.type !== 'MultiPolygon') return topology;
  const crimea = russia.arcs.filter((poly) => isCrimea(geoCentroid(feature(topology, { type: 'Polygon', arcs: poly }))));
  if (!crimea.length) return topology;
  const newRussia = { ...russia, arcs: russia.arcs.filter((poly) => !crimea.includes(poly)) };
  const merged = mergeArcs(topology, [ukraine, ...crimea.map((arcs) => ({ type: 'Polygon', arcs }))]);
  const newUkraine = { ...merged, id: ukraine.id, properties: ukraine.properties };
  return {
    ...topology,
    objects: {
      ...topology.objects,
      countries: {
        ...topology.objects.countries,
        geometries: geometries.map((g) => (g === russia ? newRussia : g === ukraine ? newUkraine : g)),
      },
    },
  };
}
