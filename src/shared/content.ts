import { mulberry32, hashString } from './rng';

export type CityId = 'tokyo' | 'paris' | 'hanoi';

export type LandmarkKind =
  | 'tower'
  | 'gate'
  | 'bridge'
  | 'temple'
  | 'arch'
  | 'lake'
  | 'crossing'
  | 'basilica';

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
        name: 'Shinjuku Neon',
        grades: [0, 1, 1, 0, 0, -1],
        waterAfterKm: [3],
        landmark: {
          name: 'Government Towers',
          kind: 'tower',
          km: 4,
          blurb: 'Twin towers with free observation decks on the 45th floor.',
        },
      },
      {
        name: 'Imperial Gardens',
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
        name: 'Bridges Loop',
        grades: [0, -1, 1, -1, 1, 0],
        waterAfterKm: [2, 5],
        landmark: {
          name: 'Golden Bridge',
          kind: 'bridge',
          km: 2.6,
          blurb: 'Golden statues stand on its four corner pillars.',
        },
      },
      {
        name: 'Garden Paths',
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
];

export type WeatherId = 'cool' | 'hot' | 'rain' | 'headwind' | 'tailwind';

export type Weather = {
  id: WeatherId;
  label: string;
  icon: string;
  hint: string;
};

export const WEATHER: Record<WeatherId, Weather> = {
  cool: {
    id: 'cool',
    label: 'Cool morning',
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
  'headwind',
  'tailwind',
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
  return {
    dateKey,
    dayIndex,
    season,
    city,
    stageIndex,
    stage,
    weather: WEATHER[weatherId],
  };
};

export const cityById = (id: string): City | undefined =>
  CITIES.find((c) => c.id === id);
