import type { City } from '../../shared/content';
import { WORLD_MAP, type MapShape } from './mapData';

const RAD = Math.PI / 180;

/** Where a latitude and longitude falls on the world map (equirectangular). */
export const onWorld = ([lat, lon]: [number, number]) => ({
  x: WORLD_MAP.tx + WORLD_MAP.k * lon * RAD,
  y: WORLD_MAP.ty - WORLD_MAP.k * lat * RAD,
});

/** Where a latitude and longitude falls on an area map (Mercator). */
export const onArea = (m: MapShape, [lat, lon]: [number, number]) => ({
  x: m.tx + m.k * lon * RAD,
  y: m.ty - m.k * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
});

/** A city's spot on the world map: the middle of its seven stages. */
export const cityAt = (city: City): [number, number] => {
  const pts = city.stages.flatMap((s) =>
    s.landmark.at ? [s.landmark.at] : []
  );
  const n = Math.max(1, pts.length);
  return [
    pts.reduce((a, p) => a + p[0], 0) / n,
    pts.reduce((a, p) => a + p[1], 0) / n,
  ];
};
