import type { CityId, Terrain } from '../../../shared/content';

/**
 * Roadside props from Polyfork (https://polyfork.dev): free low-poly models,
 * CC BY 4.0. `scripts/build-props.ts` downloads them, packs them into
 * `props.bin` and writes the credits; the course places them along the road.
 *
 * Models come in metres. The chibi world is a little bigger than life (a
 * spectator is about 1.4 units tall, a street lamp 4.2), so a prop is drawn at
 * `PROP_SCALE` units per metre unless its own `s` says otherwise.
 */
export const PROP_SCALE = 0.9;

export type PropId = (typeof PROPS)[number]['id'];

export type PropDef = {
  id: string;
  /** Units per metre, when the default does not suit it. */
  s?: number;
  /** Turned to face the road (street furniture) rather than any way (plants, rocks). */
  facing?: boolean;
};

export const PROPS = [
  // Marathon gear, in every city
  { id: 'water-bottle-crate-78c8db', s: 1.3, facing: true },
  // Tokyo streets and shrines
  { id: 'vending-machine-471c29', facing: true },
  { id: 'ramen-yatai-stall-53974b', facing: true },
  { id: 'bicycle-parking-rack-282058', s: 0.9, facing: true },
  { id: 'red-post-box-f12045', facing: true },
  { id: 'sandwich-board-sign-cb5e7c', facing: true },
  { id: 'flower-planter-550bfb', s: 1.1, facing: true },
  { id: 'city-bicycle-5b67d1', facing: true },
  { id: 'stone-lantern-d56d0a', facing: true },
  { id: 'torii-gate-402f30', facing: true },
  { id: 'bamboo-grove-clump-7c747d', s: 0.6 },
  // Paris café terraces and parks
  { id: 'bistro-table-877a6d', facing: true },
  { id: 'bistro-chair-7c354d', facing: true },
  { id: 'cafe-parasol-61a313', s: 0.85, facing: true },
  { id: 'chalkboard-menu-board-a24d9d', facing: true },
  { id: 'potted-olive-tree-7eee05' },
  { id: 'plaza-fountain-5a5f6e', s: 0.7 },
  { id: 'broadleaf-oak-997c22', s: 0.75 },
  { id: 'maple-tree-65fa12', s: 0.75 },
  { id: 'round-bush-cd2ac0', s: 1.2 },
  { id: 'wooden-bench-02e2c8', facing: true },
  { id: 'wildflower-68d3a1', s: 1.6 },
  // Hanoi markets
  { id: 'market-stall-94937d', facing: true },
  { id: 'fruit-stand-4cc7d7', s: 0.6, facing: true },
  { id: 'beverage-crate-c195c9', s: 1.1, facing: true },
  { id: 'potted-shrub-43bd21', s: 0.75 },
  { id: 'banana-plant-978d7f', s: 0.6 },
  // Dubai palms, fountains and beaches
  { id: 'palm-tree-a307da', s: 0.85 },
  { id: 'palm-sapling-ef7ae4' },
  { id: 'flowering-agave-84b67c' },
  { id: 'beach-parasol-fd4530', facing: true },
  { id: 'sun-lounger-2b2603', facing: true },
  { id: 'lifeguard-tower-183c37', s: 0.6, facing: true },
  { id: 'large-boulder-a29b99', s: 0.8 },
  // Manaus and the rainforest
  { id: 'mercado-stall-6e6ba3', facing: true },
  { id: 'tropical-fern-bush-c70147', s: 1.2 },
  { id: 'taro-plant-8c0493', s: 1.2 },
  { id: 'ti-plant-a7ad06', s: 0.8 },
  { id: 'fallen-log-1685fb' },
  { id: 'hammock-on-posts-7d5c47', facing: true },
  { id: 'wooden-canoe-1d00c5', facing: true },
  // Forests and hills
  { id: 'tall-pine-tree-ab4108', s: 0.8 },
  { id: 'young-pine-0d7695' },
  { id: 'fern-plant-1559b8' },
  { id: 'toadstool-257a4a', s: 1.4 },
  { id: 'tree-stump-ec3f48', s: 1.1 },
  { id: 'trail-signpost-bd29a7', facing: true },
] as const satisfies readonly PropDef[];

/**
 * A small scene of props that belong together (a café terrace, a ramen
 * stall), set on the outer edge of the sidewalk. Offsets are in world units:
 * `x` away from the road, `z` along it; `turn` in quarter turns.
 */
export type Vignette = {
  parts: { id: PropId; x: number; z: number; turn?: number }[];
  /** Room it needs along the road. */
  length: number;
};

const v = (length: number, ...parts: Vignette['parts']): Vignette => ({
  length,
  parts,
});

/** Street dressing for city stages: vignettes, then single props between them. */
export const STREET: Record<
  CityId,
  { vignettes: Vignette[]; singles: PropId[] }
> = {
  tokyo: {
    vignettes: [
      v(
        3,
        { id: 'ramen-yatai-stall-53974b', x: 0.2, z: 0 },
        { id: 'sandwich-board-sign-cb5e7c', x: -0.4, z: 1.4 }
      ),
      v(
        2.4,
        { id: 'vending-machine-471c29', x: 0.4, z: -0.6 },
        { id: 'vending-machine-471c29', x: 0.4, z: 0.6 }
      ),
      v(
        2.6,
        { id: 'bicycle-parking-rack-282058', x: 0, z: 0 },
        { id: 'city-bicycle-5b67d1', x: -0.1, z: -0.5, turn: 1 },
        { id: 'city-bicycle-5b67d1', x: -0.1, z: 0.5, turn: 1 }
      ),
    ],
    singles: [
      'vending-machine-471c29',
      'red-post-box-f12045',
      'sandwich-board-sign-cb5e7c',
      'flower-planter-550bfb',
      'stone-lantern-d56d0a',
    ],
  },
  paris: {
    vignettes: [
      v(
        3,
        { id: 'cafe-parasol-61a313', x: 0, z: 0 },
        { id: 'bistro-table-877a6d', x: 0, z: 0 },
        { id: 'bistro-chair-7c354d', x: 0, z: 0.75, turn: 2 },
        { id: 'bistro-chair-7c354d', x: 0, z: -0.75 }
      ),
      v(
        2.6,
        { id: 'potted-olive-tree-7eee05', x: 0.2, z: -0.8 },
        { id: 'chalkboard-menu-board-a24d9d', x: -0.2, z: 0.6 }
      ),
    ],
    singles: [
      'potted-olive-tree-7eee05',
      'chalkboard-menu-board-a24d9d',
      'wooden-bench-02e2c8',
      'flower-planter-550bfb',
    ],
  },
  hanoi: {
    vignettes: [
      v(
        3,
        { id: 'market-stall-94937d', x: 0.3, z: 0 },
        { id: 'beverage-crate-c195c9', x: -0.6, z: 1.3 },
        { id: 'beverage-crate-c195c9', x: -0.6, z: 1.3, turn: 1 }
      ),
      v(
        3,
        { id: 'fruit-stand-4cc7d7', x: 0.1, z: 0 },
        { id: 'beverage-crate-c195c9', x: -0.5, z: -1.4 }
      ),
    ],
    singles: [
      'potted-shrub-43bd21',
      'beverage-crate-c195c9',
      'banana-plant-978d7f',
    ],
  },
  dubai: {
    vignettes: [
      v(4, { id: 'plaza-fountain-5a5f6e', x: 0.3, z: 0 }),
      v(
        3,
        { id: 'palm-sapling-ef7ae4', x: 0, z: -0.9 },
        { id: 'flowering-agave-84b67c', x: 0, z: 0.9 }
      ),
    ],
    singles: [
      'palm-tree-a307da',
      'flowering-agave-84b67c',
      'potted-shrub-43bd21',
    ],
  },
  amazon: {
    vignettes: [
      v(
        3,
        { id: 'mercado-stall-6e6ba3', x: 0.3, z: 0 },
        { id: 'fruit-stand-4cc7d7', x: -0.4, z: 1.6 }
      ),
      v(
        3,
        { id: 'banana-plant-978d7f', x: 0.3, z: -0.8 },
        { id: 'ti-plant-a7ad06', x: -0.3, z: 0.8 }
      ),
    ],
    singles: [
      'banana-plant-978d7f',
      'palm-tree-a307da',
      'potted-shrub-43bd21',
      'taro-plant-8c0493',
    ],
  },
};

/** Props scattered beside the path on the stages outside the city streets. */
export const WILD: Partial<Record<Terrain, PropId[]>> = {
  park: [
    'broadleaf-oak-997c22',
    'maple-tree-65fa12',
    'round-bush-cd2ac0',
    'wooden-bench-02e2c8',
    'wildflower-68d3a1',
    'trail-signpost-bd29a7',
  ],
  forest: [
    'tall-pine-tree-ab4108',
    'young-pine-0d7695',
    'fern-plant-1559b8',
    'fallen-log-1685fb',
    'toadstool-257a4a',
    'tree-stump-ec3f48',
    'large-boulder-a29b99',
  ],
  hills: [
    'young-pine-0d7695',
    'broadleaf-oak-997c22',
    'large-boulder-a29b99',
    'round-bush-cd2ac0',
    'trail-signpost-bd29a7',
  ],
  zoo: ['round-bush-cd2ac0', 'wooden-bench-02e2c8', 'potted-shrub-43bd21'],
  beach: [
    'beach-parasol-fd4530',
    'sun-lounger-2b2603',
    'palm-tree-a307da',
    'lifeguard-tower-183c37',
  ],
  desert: [
    'large-boulder-a29b99',
    'flowering-agave-84b67c',
    'palm-sapling-ef7ae4',
  ],
  jungle: [
    'banana-plant-978d7f',
    'tropical-fern-bush-c70147',
    'taro-plant-8c0493',
    'ti-plant-a7ad06',
    'fallen-log-1685fb',
    'hammock-on-posts-7d5c47',
  ],
};

/** City touches added to the wild props of a stage (a torii in Tokyo's parks). */
export const WILD_ACCENT: Partial<Record<CityId, PropId[]>> = {
  tokyo: [
    'torii-gate-402f30',
    'stone-lantern-d56d0a',
    'bamboo-grove-clump-7c747d',
  ],
  paris: ['plaza-fountain-5a5f6e'],
  hanoi: ['bamboo-grove-clump-7c747d', 'banana-plant-978d7f'],
  amazon: ['wooden-canoe-1d00c5'],
};
