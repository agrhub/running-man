/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CITIES, dayInfo } from '../../../shared/content';
import { PROPS, STREET, WILD, WILD_ACCENT } from './catalog';
import { layoutProps, type LayoutInput } from './layout';
import { decodeProps } from './library';
import { PACKED, PROP_CREDITS } from './packed';

const bin = () => {
  const buf = readFileSync(join(import.meta.dirname, 'props.bin'));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

const street = (over: Partial<LayoutInput> = {}): LayoutInput => {
  const treeZs: number[] = [];
  for (let z = 34; z > -300; z -= 9.5) treeZs.push(z);
  const crossZs: number[] = [];
  for (let z = 22; z > -300; z -= 34) crossZs.push(z);
  return {
    cityId: 'paris',
    stageName: 'Champs-Élysées',
    terrain: 'city',
    roadHalf: 4.2,
    frontX: 7.4,
    zStart: 40,
    zEnd: -300,
    treeZs,
    inCross: (z0, z1) => crossZs.some((c) => z1 > c - 4 && z0 < c + 4),
    inPlaza: () => false,
    crowded: (z) => Math.abs(z) < 30 || Math.abs(z + 240) < 40,
    waterZs: [-77, -157],
    ...over,
  };
};

describe('roadside props', () => {
  it('pack every model with its CC BY credit', () => {
    for (const p of PROPS) {
      expect(PACKED[p.id], p.id).toBeDefined();
      const credit = PROP_CREDITS.find((c) => c.id === p.id);
      expect(credit?.credit).toMatch(/by Polyfork .*CC BY 4\.0/);
    }
  });

  it('unpack into standing, flat-shaded geometry', () => {
    const lib = decodeProps(bin());
    expect(lib.size).toBe(PROPS.length);
    for (const p of PROPS) {
      const geo = lib.get(p.id)!;
      expect(geo.getAttribute('position').count).toBe(PACKED[p.id]!.t * 3);
      expect(geo.getAttribute('normal')).toBeDefined();
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(box.max.y).toBeGreaterThan(0.1);
      // Centred on its footprint.
      expect(Math.abs(box.min.x + box.max.x)).toBeLessThan(0.01);
    }
  });

  it('only name props that exist', () => {
    const ids = new Set<string>(PROPS.map((p) => p.id));
    const named = [
      ...Object.values(STREET).flatMap((s) => [
        ...s.singles,
        ...s.vignettes.flatMap((v) => v.parts.map((p) => p.id)),
      ]),
      ...Object.values(WILD).flat(),
      ...Object.values(WILD_ACCENT).flat(),
    ];
    for (const id of named) expect(ids.has(id), id).toBe(true);
  });

  it('dress a street the same way for everyone, off the road and the crossings', () => {
    const input = street();
    const a = layoutProps(input);
    expect(layoutProps(street())).toEqual(a);
    expect(a.length).toBeGreaterThan(20);
    for (const p of a) {
      expect(Math.abs(p.x)).toBeGreaterThan(input.roadHalf + 1.5);
      expect(Math.abs(p.x)).toBeLessThan(input.frontX + 0.5);
      if (p.id !== 'water-bottle-crate-78c8db') {
        expect(input.inCross(p.z - 0.4, p.z + 0.4), `${p.id} at ${p.z}`).toBe(
          false
        );
        expect(input.crowded(p.z)).toBe(false);
      }
    }
    // Crates of bottles at both water stations.
    expect(a.filter((p) => p.id === 'water-bottle-crate-78c8db')).toHaveLength(
      6
    );
  });

  it('gives each city its own street dressing', () => {
    const sets = CITIES.map(
      (c) =>
        new Set(
          layoutProps(street({ cityId: c.id, stageName: 'x' }))
            .map((p) => p.id)
            .filter((id) => id !== 'water-bottle-crate-78c8db')
        )
    );
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++) {
        const same = [...sets[i]!].filter((id) => sets[j]!.has(id));
        expect(same.length).toBeLessThan(sets[i]!.size);
      }
  });

  it('scatter props beside the path on every kind of open stage', () => {
    for (let d = 0; d < 35; d++) {
      const day = dayInfo(`2026-11-${String(9 + (d % 22)).padStart(2, '0')}`);
      const terrain = day.stage.terrain;
      if (terrain === 'city') continue;
      const placed = layoutProps(
        street({
          cityId: day.city.id,
          stageName: day.stage.name,
          terrain,
          treeZs: [],
        })
      );
      expect(placed.length, `${day.stage.name} (${terrain})`).toBeGreaterThan(
        10
      );
      for (const p of placed)
        if (p.id !== 'water-bottle-crate-78c8db')
          expect(Math.abs(p.x)).toBeGreaterThan(7.4);
    }
  });
});
