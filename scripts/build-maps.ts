/**
 * Builds the map shapes the game draws (src/client/lib/mapData.ts) from Natural Earth
 * land outlines (public domain, via the world-atlas package).
 *
 *   npx tsx scripts/build-maps.ts
 *
 * The world map is equirectangular; each area map (a daily city with its seven
 * stages, or a World Tour stop and its region) is Mercator, fitted to the real
 * places in it. Both are written with the numbers the client needs to place a
 * latitude and longitude on them, so pins land exactly on the real spot.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoArea, geoEquirectangular, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { CITIES } from '../src/shared/content';
import { TOUR } from '../src/shared/tour';

const land = (res: '110m' | '10m') => {
  const topo = JSON.parse(
    readFileSync(`node_modules/world-atlas/land-${res}.json`, 'utf8')
  ) as Topology;
  return feature(topo, topo.objects.land!);
};

const round = (n: number) => Math.round(n * 1000) / 1000;

// World: longitude -180..180, latitude 84..-58 (no Antarctica).
const WORLD_W = 720;
const WORLD_H = Math.round((WORLD_W * 142) / 360);
const world = geoEquirectangular()
  .scale(WORLD_W / (2 * Math.PI))
  .translate([WORLD_W / 2, (84 / 142) * WORLD_H])
  .clipExtent([
    [0, 0],
    [WORLD_W, WORLD_H],
  ]);
const worldLand = geoPath(world).digits(1)(land('110m')) ?? '';

type Area = {
  w: number;
  h: number;
  k: number;
  tx: number;
  ty: number;
  land: string;
  water: { d: string; w: number }[];
};

/**
 * Rivers and lakes that matter for a map but are not in the land outlines:
 * a line of [lat, lon] points and its width in km (lakes are closed lines).
 */
type Water = { pts: [number, number][]; km: number; lake?: boolean };
const WATER: Record<string, Water[]> = {
  fuji: [
    {
      km: 0,
      lake: true,
      pts: [
        [35.52, 138.72],
        [35.525, 138.76],
        [35.51, 138.8],
        [35.498, 138.79],
        [35.505, 138.745],
      ],
    },
  ],
  pisa: [
    {
      km: 0.15,
      pts: [
        [43.68, 10.6],
        [43.705, 10.47],
        [43.715, 10.415],
        [43.712, 10.39],
        [43.7, 10.33],
        [43.68, 10.28],
      ],
    },
  ],
  paris: [
    {
      km: 0.15,
      pts: [
        [48.818, 2.413],
        [48.829, 2.39],
        [48.838, 2.375],
        [48.845, 2.364],
        [48.851, 2.354],
        [48.855, 2.344],
        [48.859, 2.332],
        [48.864, 2.32],
        [48.863, 2.304],
        [48.858, 2.292],
        [48.851, 2.282],
        [48.845, 2.274],
        [48.836, 2.262],
      ],
    },
  ],
  hanoi: [
    {
      km: 0.8,
      pts: [
        [21.095, 105.81],
        [21.083, 105.825],
        [21.064, 105.846],
        [21.043, 105.86],
        [21.03, 105.864],
        [21.01, 105.872],
        [20.995, 105.882],
      ],
    },
    {
      km: 0,
      lake: true,
      pts: [
        [21.068, 105.81],
        [21.067, 105.824],
        [21.058, 105.833],
        [21.046, 105.829],
        [21.044, 105.816],
        [21.052, 105.808],
      ],
    },
    {
      km: 0,
      lake: true,
      pts: [
        [21.0325, 105.8518],
        [21.0322, 105.8538],
        [21.0262, 105.8536],
        [21.0262, 105.8515],
      ],
    },
  ],
  tokyo: [
    {
      km: 0.2,
      pts: [
        [35.738, 139.802],
        [35.722, 139.802],
        [35.708, 139.798],
        [35.695, 139.791],
        [35.68, 139.785],
        [35.665, 139.777],
        [35.655, 139.772],
      ],
    },
  ],
  dubai: [
    {
      km: 0.3,
      pts: [
        [25.27, 55.295],
        [25.258, 55.305],
        [25.24, 55.322],
        [25.215, 55.335],
        [25.2, 55.345],
      ],
    },
  ],
  amazon: [
    {
      km: 2.5,
      pts: [
        [-3.03, -60.2],
        [-3.065, -60.12],
        [-3.1, -60.06],
        [-3.137, -60.02],
        [-3.14, -59.96],
        [-3.135, -59.9],
      ],
    },
    {
      km: 3,
      pts: [
        [-3.26, -60.05],
        [-3.2, -59.97],
        [-3.15, -59.91],
        [-3.135, -59.9],
        [-3.12, -59.83],
        [-3.1, -59.75],
      ],
    },
  ],
  'taj-mahal': [
    {
      km: 2,
      pts: [
        [28.6, 77.25],
        [28.0, 77.55],
        [27.6, 77.75],
        [27.2, 78.0],
        [27.175, 78.045],
        [27.0, 78.4],
        [26.75, 78.9],
      ],
    },
  ],
  'angkor-wat': [
    {
      km: 0,
      lake: true,
      pts: [
        [13.25, 103.65],
        [13.05, 104.0],
        [12.75, 104.3],
        [12.45, 104.5],
        [12.4, 104.35],
        [12.7, 104.05],
        [13.0, 103.75],
        [13.18, 103.55],
      ],
    },
  ],
  giza: [
    {
      km: 4,
      pts: [
        [28.5, 30.85],
        [29.2, 31.1],
        [29.7, 31.25],
        [30.05, 31.23],
        [30.2, 31.2],
      ],
    },
    {
      km: 3,
      pts: [
        [30.2, 31.2],
        [30.7, 31.0],
        [31.2, 30.6],
        [31.45, 30.37],
      ],
    },
    {
      km: 3,
      pts: [
        [30.2, 31.2],
        [30.6, 31.4],
        [31.0, 31.6],
        [31.5, 31.85],
      ],
    },
  ],
  niagara: [
    {
      km: 1,
      pts: [
        [42.88, -78.9],
        [42.95, -78.95],
        [43.03, -79.02],
        [43.08, -79.07],
        [43.15, -79.05],
        [43.26, -79.07],
      ],
    },
    {
      km: 0,
      lake: true,
      pts: [
        [42.87, -79.6],
        [42.88, -78.9],
        [42.75, -78.85],
        [42.5, -79.3],
        [42.4, -79.6],
      ],
    },
    {
      km: 0,
      lake: true,
      pts: [
        [43.26, -79.8],
        [43.26, -79.05],
        [43.37, -78.6],
        [43.6, -78.6],
        [43.65, -79.4],
        [43.3, -79.8],
      ],
    },
  ],
  'grand-canyon': [
    {
      km: 3,
      pts: [
        [36.86, -111.6],
        [36.4, -111.85],
        [36.2, -111.8],
        [36.1, -112.0],
        [36.15, -112.25],
        [36.25, -112.55],
        [36.05, -112.9],
        [35.95, -113.4],
      ],
    },
  ],
  'machu-picchu': [
    {
      km: 2,
      pts: [
        [-13.45, -71.9],
        [-13.3, -72.2],
        [-13.2, -72.45],
        [-13.155, -72.535],
        [-13.0, -72.7],
        [-12.6, -72.8],
      ],
    },
  ],
  'great-wall': [
    {
      km: 1.5,
      pts: [
        [40.6, 116.0],
        [40.45, 116.3],
        [40.433, 116.565],
        [40.45, 116.8],
        [40.38, 117.1],
      ],
    },
  ],
};

/**
 * The land polygons near a box, one by one. Drawing the whole world through a
 * clipped Mercator lets Antarctica wrap round the pole and cover the whole map.
 */
const fine = land('10m');
const polygons = (() => {
  const f = fine as unknown as GeoJSON.FeatureCollection | GeoJSON.Feature;
  const feats = 'features' in f ? f.features : [f];
  return feats.flatMap((ft) => {
    const g = ft.geometry;
    if (g.type === 'Polygon') return [g.coordinates];
    if (g.type === 'MultiPolygon') return g.coordinates;
    return [];
  });
})();
const nearby = (box: GeoJSON.Feature<GeoJSON.MultiPoint>) => {
  const [[w, s], [e, n]] = box.geometry.coordinates as [
    [number, number],
    [number, number],
  ];
  const keep = polygons.filter((rings) => {
    const outer = rings[0]!;
    const lons = outer.map((c) => c[0]!);
    const lats = outer.map((c) => c[1]!);
    if (Math.min(...lats) < -60) return false;
    return (
      Math.min(...lons) <= e &&
      Math.max(...lons) >= w &&
      Math.min(...lats) <= n &&
      Math.max(...lats) >= s
    );
  });
  return { type: 'MultiPolygon' as const, coordinates: keep };
};

const AREA_W = 320;
const AREA_H = 200;

/** A Mercator map of the box around these points, padded by `pad` degrees. */
const area = (
  points: [number, number][],
  pad: number,
  waters: Water[] = []
): Area => {
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const box: GeoJSON.Feature<GeoJSON.MultiPoint> = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'MultiPoint' as const,
      coordinates: [
        [Math.min(...lons) - pad, Math.min(...lats) - pad],
        [Math.max(...lons) + pad, Math.max(...lats) + pad],
      ],
    },
  };
  const proj = geoMercator().fitExtent(
    [
      [14, 14],
      [AREA_W - 14, AREA_H - 14],
    ],
    box
  );
  proj.clipExtent([
    [0, 0],
    [AREA_W, AREA_H],
  ]);
  const [tx, ty] = proj.translate();
  const draw = geoPath(proj).digits(1);
  // One km at this latitude, in pixels.
  const lat0 = points[0]![0];
  const kmPx = proj.scale() / 6371 / Math.cos((lat0 * Math.PI) / 180);
  const water = waters.map((wt) => {
    const coords = wt.pts.map(([la, lo]) => [lo, la]);
    // A lake ring must wind so that its inside is the small side of the globe.
    const ring = [...coords, coords[0]!];
    const lake = (r: number[][]) => ({
      type: 'Polygon' as const,
      coordinates: [r],
    });
    const shape = wt.lake
      ? geoArea(lake(ring)) < Math.PI
        ? lake(ring)
        : lake([...ring].reverse())
      : { type: 'LineString' as const, coordinates: coords };
    const d = draw(shape) ?? '';
    return { d, w: wt.lake ? 0 : round(Math.max(2.5, wt.km * kmPx)) };
  });
  return {
    w: AREA_W,
    h: AREA_H,
    k: round(proj.scale()),
    tx: round(tx),
    ty: round(ty),
    land: draw(nearby(box)) ?? '',
    water,
  };
};

/** How much country to show around each World Tour stop, in degrees. */
const TOUR_PAD: Record<string, number> = {
  'rapa-nui': 0.08,
  'ha-long': 0.35,
  niagara: 0.6,
  'machu-picchu': 1.2,
  'angkor-wat': 1.2,
  'grand-canyon': 1.5,
  stonehenge: 1.5,
  colosseum: 1.5,
  giza: 1.5,
  petra: 1.5,
  'taj-mahal': 2,
  'great-wall': 1.5,
  fuji: 0.4,
  liberty: 0.12,
  'sydney-opera': 0.08,
  'christ-redeemer': 0.15,
  'chichen-itza': 1.5,
  parthenon: 0.3,
  uluru: 2,
  matterhorn: 0.5,
  pisa: 0.4,
  'golden-gate': 0.15,
  borobudur: 0.8,
  cappadocia: 1.2,
};

const areas: Record<string, Area> = {};
for (const city of CITIES) {
  const pts = city.stages.flatMap((s) =>
    s.landmark.at ? [s.landmark.at] : []
  );
  areas[city.id] = area(pts, 0.012, WATER[city.id]);
}
for (const stop of TOUR) {
  if (stop.stage.landmark.at)
    areas[stop.id] = area(
      [stop.stage.landmark.at],
      TOUR_PAD[stop.id] ?? 1,
      WATER[stop.id]
    );
}

const out = `// Generated by scripts/build-maps.ts from Natural Earth (public domain). Do not edit.

/** A map and the numbers that place a latitude and longitude on it. */
export type MapShape = {
  w: number;
  h: number;
  /** Projection scale and offset (equirectangular for the world, Mercator for areas). */
  k: number;
  tx: number;
  ty: number;
  /** SVG path of the land. */
  land: string;
  /** Rivers (stroked, width in px) and lakes (filled, width 0). */
  water?: { d: string; w: number }[];
};

export const WORLD_MAP: MapShape = ${JSON.stringify({
  w: WORLD_W,
  h: WORLD_H,
  k: round(world.scale()),
  tx: round(world.translate()[0]),
  ty: round(world.translate()[1]),
  land: worldLand,
})};

/** Area maps: one per daily city (all its stages) and one per World Tour stop. */
export const AREA_MAPS: Record<string, MapShape> = ${JSON.stringify(areas)};
`;
writeFileSync('src/client/lib/mapData.ts', out);
console.log(
  'world',
  worldLand.length,
  'areas',
  Object.entries(areas)
    .map(([k, a]) => `${k}:${a.land.length}`)
    .join(' ')
);
