import { mulberry32, hashString } from './rng';

export type CityId = 'tokyo' | 'paris' | 'hanoi' | 'dubai' | 'amazon';

/** What the course runs through. Each terrain has its own scenery. */
export type Terrain =
  'city' | 'park' | 'forest' | 'zoo' | 'hills' | 'beach' | 'desert' | 'jungle';

export const TERRAIN: Record<Terrain, { label: string; icon: string }> = {
  city: { label: 'City streets', icon: '🏙️' },
  park: { label: 'Park', icon: '🌳' },
  forest: { label: 'Forest', icon: '🌲' },
  zoo: { label: 'Zoo', icon: '🦒' },
  hills: { label: 'Hills', icon: '⛰️' },
  beach: { label: 'Beach', icon: '🏖️' },
  desert: { label: 'Desert', icon: '🏜️' },
  jungle: { label: 'Rainforest', icon: '🌿' },
};

export type LandmarkKind =
  | 'tower'
  | 'gate'
  | 'bridge'
  | 'temple'
  | 'arch'
  | 'lake'
  | 'crossing'
  | 'basilica'
  | 'sail'
  | 'wheel'
  | 'fort'
  | 'opera'
  | 'kapok'
  | 'canopy'
  | 'stilt'
  | 'meeting'
  | 'river'
  | 'lilies';

export type Landmark = {
  name: string;
  kind: LandmarkKind;
  /** Kilometre (0-6) where the landmark sits beside the road. */
  km: number;
  blurb: string;
};

export type Stage = {
  name: string;
  /** Average grade in percent for each of the 6 kilometres. */
  grades: [number, number, number, number, number, number];
  /** Water stations sit at the end of these kilometres (1-based km marks). */
  waterAfterKm: number[];
  landmark: Landmark;
  terrain: Terrain;
};

export type CityPalette = {
  sky: string;
  skyLow: string;
  ground: string;
  road: string;
  roadLine: string;
  accent: string;
  buildings: string[];
};

export type City = {
  id: CityId;
  name: string;
  country: string;
  flag: string;
  palette: CityPalette;
  stages: Stage[];
};

export const KM_PER_STAGE = 6;
export const STAGES_PER_CITY = 7;
export const MARATHON_METERS = 42195;
/** The crew goal for each city: ten marathons run together. */
export const CREW_MARATHONS = 10;
export const CREW_TARGET_METERS = MARATHON_METERS * CREW_MARATHONS;
export const FINISHER_STAGES = 5;

export const CITIES: City[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    palette: {
      sky: '#ffd7e2',
      skyLow: '#fff1e6',
      ground: '#e8d9f0',
      road: '#4a4560',
      roadLine: '#ffe7f0',
      accent: '#ff5d8f',
      buildings: ['#f6a6c1', '#b9a7e8', '#8fd3e8', '#fff3b0', '#ffc3a0'],
    },
    stages: [
      {
        name: 'Asakusa Lanterns',
        terrain: 'city',
        grades: [0, 1, 0, -1, 0, 1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Thunder Gate',
          kind: 'gate',
          km: 1.2,
          blurb:
            'A giant red lantern, almost 4 m tall, hangs at the heart of this temple gate.',
        },
      },
      {
        name: 'Sumida Riverside',
        terrain: 'city',
        grades: [0, -1, -1, 0, 2, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Sky Tower',
          kind: 'tower',
          km: 3.5,
          blurb: 'At 634 m it is the tallest tower in Japan.',
        },
      },
      {
        name: 'Shibuya Scramble',
        terrain: 'city',
        grades: [1, 0, 0, 0, -1, 0],
        waterAfterKm: [2, 5],
        landmark: {
          name: 'The Scramble',
          kind: 'crossing',
          km: 2.5,
          blurb: 'Up to 3,000 people cross here at once when the lights turn.',
        },
      },
      {
        name: 'Meiji Forest',
        terrain: 'forest',
        grades: [2, 3, 1, -2, -2, 0],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Forest Shrine',
          kind: 'temple',
          km: 2.2,
          blurb:
            'Over 100,000 trees were donated from across Japan to plant this forest.',
        },
      },
      {
        name: 'Rainbow Bridge',
        terrain: 'city',
        grades: [0, 3, 2, -3, -2, 0],
        waterAfterKm: [1, 4],
        landmark: {
          name: 'Bay Bridge',
          kind: 'bridge',
          km: 2.5,
          blurb: 'Its lights glow in rainbow colours on special nights.',
        },
      },
      {
        name: 'Ueno Zoo Loop',
        terrain: 'zoo',
        grades: [0, 1, 1, 0, 0, -1],
        waterAfterKm: [3],
        landmark: {
          name: 'Five-Storey Pagoda',
          kind: 'temple',
          km: 3.2,
          blurb:
            'This pagoda stands inside the zoo grounds. It was rebuilt in 1639.',
        },
      },
      {
        name: 'Imperial Gardens',
        terrain: 'park',
        grades: [0, 0, 1, 2, -1, -2],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Stone Bridge',
          kind: 'bridge',
          km: 5,
          blurb: 'A double-arched bridge reflected in the palace moat.',
        },
      },
    ],
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    flag: '🇫🇷',
    palette: {
      sky: '#dfe8ff',
      skyLow: '#fff6e8',
      ground: '#efe6d2',
      road: '#5a5a6e',
      roadLine: '#fff8ea',
      accent: '#2f4bdb',
      buildings: ['#f3e3c3', '#e8d2a6', '#d9c6e8', '#c8d8f0', '#f5d0c5'],
    },
    stages: [
      {
        name: 'Seine Embankment',
        terrain: 'city',
        grades: [0, 0, -1, 0, 0, 1],
        waterAfterKm: [3],
        landmark: {
          name: 'Iron Lady',
          kind: 'tower',
          km: 3.2,
          blurb: 'It was meant to stand for only 20 years after 1889.',
        },
      },
      {
        name: 'Champs Sprint',
        terrain: 'city',
        grades: [1, 1, 2, 1, 0, -2],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Triumph Arch',
          kind: 'arch',
          km: 3,
          blurb: 'Twelve avenues meet in a star around this arch.',
        },
      },
      {
        name: 'Montmartre Climb',
        terrain: 'hills',
        grades: [2, 4, 6, 3, -5, -4],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'White Basilica',
          kind: 'basilica',
          km: 3,
          blurb: 'Its stone whitens in the rain, so it never needs cleaning.',
        },
      },
      {
        name: 'Latin Quarter',
        terrain: 'city',
        grades: [0, 2, 1, -1, -1, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Island Cathedral',
          kind: 'temple',
          km: 1.5,
          blurb:
            'All road distances in France are measured from a star in front of it.',
        },
      },
      {
        name: 'Vincennes Woods',
        terrain: 'forest',
        grades: [0, -1, 1, -1, 1, 0],
        waterAfterKm: [2, 5],
        landmark: {
          name: 'Vincennes Castle',
          kind: 'fort',
          km: 2.6,
          blurb:
            'Its 52 m keep is the tallest medieval fortified tower in Europe.',
        },
      },
      {
        name: 'Garden Paths',
        terrain: 'park',
        grades: [0, 0, 0, 1, 0, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Palace Pond',
          kind: 'lake',
          km: 2,
          blurb:
            'Kids have rented little wooden sailboats on this pond for generations.',
        },
      },
      {
        name: 'Grand Finale',
        terrain: 'city',
        grades: [-1, 0, 1, 1, 0, 0],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Glass Pyramid',
          kind: 'tower',
          km: 4.5,
          blurb: 'It is made of 673 glass panes.',
        },
      },
    ],
  },
  {
    id: 'hanoi',
    name: 'Hanoi',
    country: 'Vietnam',
    flag: '🇻🇳',
    palette: {
      sky: '#fff0c2',
      skyLow: '#fffaf0',
      ground: '#dcebd0',
      road: '#55504a',
      roadLine: '#fff7d6',
      accent: '#e8792b',
      buildings: ['#ffd36e', '#f6b28b', '#a8d8b9', '#f2e2a6', '#e7c1d8'],
    },
    stages: [
      {
        name: 'Sword Lake Loop',
        terrain: 'park',
        grades: [0, 0, 0, 0, 0, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Turtle Tower',
          kind: 'lake',
          km: 2,
          blurb: 'A small tower stands on an islet in the middle of the lake.',
        },
      },
      {
        name: 'Old Quarter Alleys',
        terrain: 'city',
        grades: [0, 1, -1, 1, 0, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Old East Gate',
          kind: 'gate',
          km: 3,
          blurb: 'The last surviving gate of the old city walls.',
        },
      },
      {
        name: 'Long Bridge',
        terrain: 'city',
        grades: [0, 2, 1, 0, -2, -1],
        waterAfterKm: [1, 4],
        landmark: {
          name: 'Iron River Bridge',
          kind: 'bridge',
          km: 2.5,
          blurb:
            'Trains, scooters and walkers share this bridge across the Red River.',
        },
      },
      {
        name: 'West Lake Breeze',
        terrain: 'park',
        grades: [0, 0, 1, 0, -1, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Lakeside Pagoda',
          kind: 'temple',
          km: 4,
          blurb:
            'One of the oldest pagodas in the city sits on a lake peninsula.',
        },
      },
      {
        name: 'Literature Temple',
        terrain: 'city',
        grades: [1, 0, 0, 1, 0, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Temple of Scholars',
          kind: 'temple',
          km: 2,
          blurb: 'Home of the first national university, founded in 1076.',
        },
      },
      {
        name: 'Train Street',
        terrain: 'city',
        grades: [0, 0, -1, 0, 1, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Rail Alley',
          kind: 'crossing',
          km: 3,
          blurb:
            'Trains squeeze past cafes with only an arm’s length to spare.',
        },
      },
      {
        name: 'Ba Dinh Finale',
        terrain: 'city',
        grades: [0, 1, 2, 0, -1, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Flag Tower',
          kind: 'tower',
          km: 4.5,
          blurb: 'Built in 1812, it survived when most of the citadel did not.',
        },
      },
    ],
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    palette: {
      sky: '#ffe3c2',
      skyLow: '#fff6ea',
      ground: '#ecd9b4',
      road: '#5a5862',
      roadLine: '#fff4dc',
      accent: '#d99a1e',
      buildings: ['#e9d8b8', '#cfe3ec', '#f1e4cf', '#b9d3df', '#e6cfa8'],
    },
    stages: [
      {
        name: 'Downtown Boulevard',
        terrain: 'city',
        grades: [0, 1, 0, 0, -1, 0],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Needle Tower',
          kind: 'tower',
          km: 3,
          blurb:
            'At 828 m, the tallest building in the world rises over this boulevard.',
        },
      },
      {
        name: 'Jumeirah Beach',
        terrain: 'beach',
        grades: [0, 0, -1, 0, 1, 0],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Sail Hotel',
          kind: 'sail',
          km: 3.4,
          blurb:
            'Built on its own island, the sail-shaped hotel rises 321 m over the sea.',
        },
      },
      {
        name: 'Bluewaters Boardwalk',
        terrain: 'beach',
        grades: [0, 1, 0, -1, 0, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Giant Wheel',
          kind: 'wheel',
          km: 2.5,
          blurb:
            'At 250 m, this is the tallest observation wheel in the world.',
        },
      },
      {
        name: 'Desert Dunes',
        terrain: 'desert',
        grades: [2, 3, -2, 3, -3, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Desert Fort',
          kind: 'fort',
          km: 3,
          blurb:
            'Mud-brick forts once guarded the oases on the old caravan routes.',
        },
      },
      {
        name: 'Safari Park',
        terrain: 'zoo',
        grades: [0, 1, 0, 1, -1, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Safari Gate',
          kind: 'gate',
          km: 1.5,
          blurb:
            'Giraffes, rhinos and lions roam the park on the edge of the desert.',
        },
      },
      {
        name: 'Creek Old Town',
        terrain: 'city',
        grades: [0, -1, 0, 0, 1, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Old Fort',
          kind: 'fort',
          km: 2.2,
          blurb: 'Built around 1787, it is the oldest building in the city.',
        },
      },
      {
        name: 'Marina Finale',
        terrain: 'city',
        grades: [0, 0, 1, 0, 0, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Twisted Tower',
          kind: 'tower',
          km: 4,
          blurb: 'This tower turns a full 90 degrees from its base to its top.',
        },
      },
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    country: 'Brazil',
    flag: '🇧🇷',
    palette: {
      sky: '#c9f0d8',
      skyLow: '#f1fff4',
      ground: '#7bb661',
      road: '#5b5048',
      roadLine: '#fff1d6',
      accent: '#1f9e5c',
      buildings: ['#ffd36e', '#f6a6c1', '#8fd3e8', '#b6e3a1', '#ffb38a'],
    },
    stages: [
      {
        name: 'Manaus Riverfront',
        terrain: 'city',
        grades: [0, 1, 0, -1, 0, 0],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Amazon Theatre',
          kind: 'opera',
          km: 2.6,
          blurb:
            'An opera house in the rainforest, crowned with 36,000 coloured tiles.',
        },
      },
      {
        name: 'Rainforest Trail',
        terrain: 'jungle',
        grades: [0, 1, 1, 0, -1, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Giant Kapok',
          kind: 'kapok',
          km: 3,
          blurb:
            'Kapok trees grow up to 60 m tall, with buttress roots wider than a car.',
        },
      },
      {
        name: 'Canopy Climb',
        terrain: 'jungle',
        grades: [1, 3, 2, -1, -2, -2],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Canopy Walkway',
          kind: 'canopy',
          km: 2.4,
          blurb:
            'Rope bridges 40 m up let you walk where the monkeys and macaws live.',
        },
      },
      {
        name: 'Stilt Village',
        terrain: 'jungle',
        grades: [0, 0, -1, 0, 1, 0],
        waterAfterKm: [3],
        landmark: {
          name: 'Stilt Houses',
          kind: 'stilt',
          km: 3.2,
          blurb:
            'The river rises up to 10 m in the wet season, so houses stand on stilts.',
        },
      },
      {
        name: 'Ponta Negra Beach',
        terrain: 'beach',
        grades: [0, 0, 1, 0, -1, 0],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Black River',
          kind: 'river',
          km: 2.8,
          blurb:
            'The Rio Negro is dark as tea from the leaves, with white sand beaches.',
        },
      },
      {
        name: 'Lily Lagoon',
        terrain: 'jungle',
        grades: [0, -1, 0, 1, 0, 0],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Giant Water Lilies',
          kind: 'lilies',
          km: 2.2,
          blurb:
            'Their floating leaves grow up to 3 m across, strong enough to hold a child.',
        },
      },
      {
        name: 'Amazon Finale',
        terrain: 'jungle',
        grades: [0, 0, 1, 0, 0, -1],
        waterAfterKm: [2, 4],
        landmark: {
          name: 'Meeting of the Waters',
          kind: 'meeting',
          km: 4.6,
          blurb:
            'The dark Rio Negro and the sandy Solimões run side by side for 6 km without mixing.',
        },
      },
    ],
  },
];

export type WeatherId =
  'cool' | 'hot' | 'rain' | 'storm' | 'headwind' | 'tailwind';

export type Weather = {
  id: WeatherId;
  label: string;
  icon: string;
  hint: string;
};

export const WEATHER: Record<WeatherId, Weather> = {
  cool: {
    id: 'cool',
    label: 'Sunny and cool',
    icon: '🌤️',
    hint: 'Legs stay fresh. A good day to push.',
  },
  hot: {
    id: 'hot',
    label: 'Heatwave',
    icon: '🥵',
    hint: 'Stamina drains faster. Water helps more.',
  },
  rain: {
    id: 'rain',
    label: 'Rain',
    icon: '🌧️',
    hint: 'Pushing downhill on wet roads costs time.',
  },
  storm: {
    id: 'storm',
    label: 'Thunderstorm',
    icon: '⛈️',
    hint: 'Wind and rain: slower everywhere, puddles all over, and wet downhills punish a push.',
  },
  headwind: {
    id: 'headwind',
    label: 'Headwind',
    icon: '🌬️',
    hint: 'Every km is slower. Climbs hurt most.',
  },
  tailwind: {
    id: 'tailwind',
    label: 'Tailwind',
    icon: '🍃',
    hint: 'Free speed on every km.',
  },
};

const WEATHER_BAG: WeatherId[] = [
  'cool',
  'cool',
  'hot',
  'rain',
  'storm',
  'headwind',
  'tailwind',
];

/** When the stage starts. Everyone runs at the same time of day. */
export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'evening';

export const TIMES: Record<
  TimeOfDay,
  { label: string; icon: string; clock: string; hint: string }
> = {
  morning: {
    label: 'Morning run',
    icon: '🌅',
    clock: '6:30 am',
    hint: 'Fresh air and quiet streets.',
  },
  noon: {
    label: 'Noon run',
    icon: '☀️',
    clock: '12:00 pm',
    hint: 'The sun is high: stamina drains a little faster.',
  },
  afternoon: {
    label: 'Afternoon run',
    icon: '🌇',
    clock: '4:00 pm',
    hint: 'Warm, with more people and traffic about.',
  },
  evening: {
    label: 'Evening run',
    icon: '🌙',
    clock: '7:30 pm',
    hint: 'Cool air under the street lights: easier on the legs.',
  },
};

const TIME_BAG: TimeOfDay[] = [
  'morning',
  'morning',
  'noon',
  'afternoon',
  'evening',
  'evening',
];

/** Monday the first season starts. Every season is one city, 7 days. */
export const EPOCH = '2026-11-09';
const DAY_MS = 86_400_000;

export const toDateKey = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const dayIndexOf = (dateKey: string): number =>
  Math.floor(
    (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) /
      DAY_MS
  );

export const addDays = (dateKey: string, days: number): string =>
  toDateKey(new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS));

export type DayInfo = {
  dateKey: string;
  dayIndex: number;
  season: number;
  city: City;
  stageIndex: number;
  stage: Stage;
  weather: Weather;
  time: TimeOfDay;
};

export const dayInfo = (dateKey: string): DayInfo => {
  const raw = dayIndexOf(dateKey);
  const dayIndex = Math.max(0, raw);
  const season = Math.floor(dayIndex / STAGES_PER_CITY);
  const city = CITIES[season % CITIES.length] ?? CITIES[0]!;
  const stageIndex = dayIndex % STAGES_PER_CITY;
  const stage = city.stages[stageIndex] ?? city.stages[0]!;
  const rand = mulberry32(hashString(`weather:${dateKey}`));
  const weatherId =
    WEATHER_BAG[Math.floor(rand() * WEATHER_BAG.length)] ?? 'cool';
  const clock = mulberry32(hashString(`time:${dateKey}`));
  const time = TIME_BAG[Math.floor(clock() * TIME_BAG.length)] ?? 'morning';
  return {
    dateKey,
    dayIndex,
    season,
    city,
    stageIndex,
    stage,
    weather: WEATHER[weatherId],
    time,
  };
};

/**
 * The last stage of every city week is the Triathlon Finale: swim the first
 * km, bike the next three, run the last two.
 */
export type Leg = 'swim' | 'bike' | 'run';

export const isTriathlon = (day: Pick<DayInfo, 'stageIndex'>): boolean =>
  day.stageIndex === STAGES_PER_CITY - 1;

/** The leg for km index 0..5 (the km being run), or for a distance in km. */
export const legAt = (tri: boolean, km: number): Leg =>
  !tri ? 'run' : km < 1 ? 'swim' : km < 4 ? 'bike' : 'run';

export const LEG_LABEL: Record<Leg, { icon: string; label: string }> = {
  swim: { icon: '🏊', label: 'Swim' },
  bike: { icon: '🚴', label: 'Bike' },
  run: { icon: '🏃', label: 'Run' },
};

export const cityById = (id: string): City | undefined =>
  CITIES.find((c) => c.id === id);
