import {
  WEATHER,
  addDays,
  dayIndexOf,
  type City,
  type CityId,
  type CityPalette,
  type DayInfo,
  type Stage,
  type TimeOfDay,
  type WeatherId,
} from './content';
import { hashString, mulberry32 } from './rng';

/**
 * World Tour: famous places to run any time, outside the daily calendar.
 *
 * Each stop is unlocked once with coins and can then be run as often as you
 * like. Tour runs never touch the daily leaderboard, streaks or the crew goal;
 * each stop has its own board of best times, and the first finish of a stop
 * stamps your passport.
 */
export type TourKind = 'wonder' | 'ancient' | 'icon';

export const TOUR_KIND: Record<TourKind, { label: string; icon: string }> = {
  wonder: { label: 'Natural wonder', icon: '🏞️' },
  ancient: { label: 'Ancient wonder', icon: '🏛️' },
  icon: { label: 'World landmark', icon: '🗽' },
};

export type TourStop = {
  id: string;
  /** Where it is, for the card. */
  place: string;
  country: string;
  flag: string;
  kind: TourKind;
  cost: number;
  /** Street style borrowed from a daily city (only seen on city stretches). */
  look: CityId;
  palette: CityPalette;
  weather: WeatherId;
  time: TimeOfDay;
  stage: Stage;
};

/** Coins for the first finish of a stop, with its passport stamp. */
export const TOUR_STAMP_REWARD = 60;

const pal = (
  sky: string,
  skyLow: string,
  ground: string,
  accent: string,
  buildings: string[]
): CityPalette => ({
  sky,
  skyLow,
  ground,
  road: '#4a4560',
  roadLine: '#fff4e0',
  accent,
  buildings,
});

export const TOUR: TourStop[] = [
  {
    id: 'great-wall',
    place: 'Mutianyu',
    country: 'China',
    flag: '🇨🇳',
    kind: 'ancient',
    cost: 200,
    look: 'hanoi',
    palette: pal('#cfe6ff', '#fff2dc', '#cfe0b0', '#c0392b', [
      '#d9c7a1',
      '#b7a57f',
      '#e3d4b2',
    ]),
    weather: 'cool',
    time: 'morning',
    stage: {
      name: 'Great Wall Ridge',
      grades: [3, 4, -2, 5, -3, -1],
      waterAfterKm: [2, 4],
      terrain: 'hills',
      wild: true,
      landmark: {
        name: 'Great Wall of China',
        kind: 'wall',
        at: [40.4319, 116.5704],
        km: 3,
        blurb:
          'Stone ramparts and watchtowers riding the ridgeline for thousands of kilometres.',
      },
    },
  },
  {
    id: 'giza',
    place: 'Giza',
    country: 'Egypt',
    flag: '🇪🇬',
    kind: 'ancient',
    cost: 250,
    look: 'dubai',
    palette: pal('#ffe0a8', '#fff3d6', '#f0d29a', '#d4a017', [
      '#e8c98e',
      '#d9b273',
      '#f2dcae',
    ]),
    weather: 'hot',
    time: 'morning',
    stage: {
      name: 'Pyramid Plateau',
      grades: [0, 1, 2, 0, -1, -2],
      waterAfterKm: [1, 3, 5],
      terrain: 'desert',
      wild: true,
      landmark: {
        name: 'Pyramids of Giza',
        kind: 'pyramid',
        at: [29.9792, 31.1342],
        km: 2.5,
        blurb:
          'The last standing wonder of the ancient world, watched over by the Sphinx.',
      },
    },
  },
  {
    id: 'machu-picchu',
    place: 'Cusco Region',
    country: 'Peru',
    flag: '🇵🇪',
    kind: 'ancient',
    cost: 300,
    look: 'amazon',
    palette: pal('#d6ecff', '#f3f8ec', '#a9d18e', '#2e8b57', [
      '#c9c3b4',
      '#b5ae9c',
      '#ddd8ca',
    ]),
    weather: 'rain',
    time: 'morning',
    stage: {
      name: 'Inca Trail Finish',
      grades: [4, 5, 3, -2, -4, 1],
      waterAfterKm: [2, 4],
      terrain: 'hills',
      wild: true,
      landmark: {
        name: 'Machu Picchu',
        kind: 'terraces',
        at: [-13.1631, -72.545],
        km: 4,
        blurb:
          'An Inca citadel of stone terraces high in the Andes, above the clouds.',
      },
    },
  },
  {
    id: 'colosseum',
    place: 'Rome',
    country: 'Italy',
    flag: '🇮🇹',
    kind: 'ancient',
    cost: 250,
    look: 'paris',
    palette: pal('#d7ecff', '#fff3e2', '#e6dcc8', '#b5523b', [
      '#e8b77d',
      '#d98c5f',
      '#f1d3a2',
      '#c96f4a',
    ]),
    weather: 'cool',
    time: 'afternoon',
    stage: {
      name: 'Via dei Fori Imperiali',
      grades: [0, -1, 1, 0, 2, -1],
      waterAfterKm: [2, 4],
      terrain: 'city',
      landmark: {
        name: 'Colosseum',
        kind: 'colosseum',
        at: [41.8902, 12.4922],
        km: 3.5,
        blurb:
          'Rome’s great stone amphitheatre, nearly two thousand years old.',
      },
    },
  },
  {
    id: 'taj-mahal',
    place: 'Agra',
    country: 'India',
    flag: '🇮🇳',
    kind: 'icon',
    cost: 300,
    look: 'dubai',
    palette: pal('#ffe6d1', '#fff6ea', '#bfdc9c', '#e07a5f', [
      '#f2c9a0',
      '#e8a87c',
      '#f6dcc0',
    ]),
    weather: 'hot',
    time: 'evening',
    stage: {
      name: 'Yamuna Riverside',
      grades: [0, 0, 1, -1, 0, 0],
      waterAfterKm: [2, 4],
      terrain: 'park',
      landmark: {
        name: 'Taj Mahal',
        kind: 'mausoleum',
        at: [27.1751, 78.0421],
        km: 3,
        blurb:
          'A white marble mausoleum with four minarets, mirrored in its long pool.',
      },
    },
  },
  {
    id: 'angkor-wat',
    place: 'Siem Reap',
    country: 'Cambodia',
    flag: '🇰🇭',
    kind: 'ancient',
    cost: 300,
    look: 'hanoi',
    palette: pal('#ffd9b8', '#fff1e0', '#9ccf7a', '#c8862e', [
      '#b9a27a',
      '#a58d66',
      '#cdb994',
    ]),
    weather: 'hot',
    time: 'morning',
    stage: {
      name: 'Temple Causeway',
      grades: [0, 1, 0, -1, 1, 0],
      waterAfterKm: [1, 3, 5],
      terrain: 'jungle',
      wild: true,
      landmark: {
        name: 'Angkor Wat',
        kind: 'angkor',
        at: [13.4125, 103.867],
        km: 3,
        blurb:
          'The largest temple on Earth, five lotus towers rising over the moat.',
      },
    },
  },
  {
    id: 'stonehenge',
    place: 'Salisbury Plain',
    country: 'United Kingdom',
    flag: '🇬🇧',
    kind: 'ancient',
    cost: 200,
    look: 'paris',
    palette: pal('#d3e2ef', '#eef3f2', '#a8cf86', '#4f7a5a', [
      '#c9c4b8',
      '#b3ad9f',
    ]),
    weather: 'headwind',
    time: 'morning',
    stage: {
      name: 'Salisbury Plain',
      grades: [1, 0, 2, -1, 0, -2],
      waterAfterKm: [2, 4],
      terrain: 'park',
      wild: true,
      landmark: {
        name: 'Stonehenge',
        kind: 'stones',
        at: [51.1789, -1.8262],
        km: 3,
        blurb:
          'A ring of standing stones raised about five thousand years ago.',
      },
    },
  },
  {
    id: 'petra',
    place: 'Ma’an',
    country: 'Jordan',
    flag: '🇯🇴',
    kind: 'ancient',
    cost: 300,
    look: 'dubai',
    palette: pal('#ffd2b0', '#fff0e2', '#e3a77f', '#b84a39', [
      '#d98b6a',
      '#c97456',
      '#e8a888',
    ]),
    weather: 'hot',
    time: 'afternoon',
    stage: {
      name: 'The Siq',
      grades: [-1, 0, 2, 1, 0, -2],
      waterAfterKm: [2, 4],
      terrain: 'desert',
      wild: true,
      landmark: {
        name: 'Petra Treasury',
        kind: 'treasury',
        at: [30.3221, 35.4513],
        km: 4,
        blurb:
          'A temple facade carved straight into rose-red sandstone cliffs.',
      },
    },
  },
  {
    id: 'ha-long',
    place: 'Quảng Ninh',
    country: 'Vietnam',
    flag: '🇻🇳',
    kind: 'wonder',
    cost: 250,
    look: 'hanoi',
    palette: pal('#cdeefa', '#f1fbf7', '#a7dcc0', '#1e9e8a', [
      '#f2e3c6',
      '#e5cfa7',
    ]),
    weather: 'cool',
    time: 'morning',
    stage: {
      name: 'Bai Chay Seafront',
      grades: [0, 0, -1, 1, 0, 0],
      waterAfterKm: [2, 4],
      terrain: 'beach',
      wild: true,
      landmark: {
        name: 'Ha Long Bay',
        kind: 'karst',
        at: [20.9101, 107.1839],
        km: 3,
        blurb:
          'Nearly two thousand limestone islands rising out of emerald water.',
      },
    },
  },
  {
    id: 'grand-canyon',
    place: 'Arizona',
    country: 'United States',
    flag: '🇺🇸',
    kind: 'wonder',
    cost: 350,
    look: 'dubai',
    palette: pal('#bfe0ff', '#fff0dc', '#d9905f', '#c1440e', [
      '#d9824f',
      '#c76b3b',
      '#e9a070',
    ]),
    weather: 'hot',
    time: 'evening',
    stage: {
      name: 'South Rim Trail',
      grades: [1, 2, -1, 0, 3, -2],
      waterAfterKm: [1, 3, 5],
      terrain: 'desert',
      wild: true,
      landmark: {
        name: 'Grand Canyon',
        kind: 'canyon',
        at: [36.0619, -112.1077],
        km: 3,
        blurb:
          'A mile-deep canyon carved by the Colorado River, banded red and gold.',
      },
    },
  },
  {
    id: 'niagara',
    place: 'Ontario and New York',
    country: 'Canada and United States',
    flag: '🇨🇦',
    kind: 'wonder',
    cost: 300,
    look: 'paris',
    palette: pal('#cfe8ff', '#f2f9ff', '#9fd08a', '#2a7fd4', [
      '#c6d4e0',
      '#b2c1cf',
    ]),
    weather: 'rain',
    time: 'noon',
    stage: {
      name: 'Niagara Parkway',
      grades: [0, 1, 0, -1, 0, 1],
      waterAfterKm: [2, 4],
      terrain: 'forest',
      wild: true,
      landmark: {
        name: 'Niagara Falls',
        kind: 'falls',
        at: [43.0828, -79.0742],
        km: 3,
        blurb:
          'Three waterfalls pouring over a curved cliff, misty with rainbows.',
      },
    },
  },
  {
    id: 'rapa-nui',
    place: 'Rapa Nui',
    country: 'Chile',
    flag: '🇨🇱',
    kind: 'ancient',
    cost: 350,
    look: 'amazon',
    palette: pal('#c6e9ff', '#f0fbff', '#9fd18a', '#3d6e8f', [
      '#d6cfb8',
      '#c2b99c',
    ]),
    weather: 'tailwind',
    time: 'evening',
    stage: {
      name: 'Ahu Tongariki Coast',
      grades: [0, -1, 1, 0, 2, -1],
      waterAfterKm: [2, 4],
      terrain: 'beach',
      wild: true,
      landmark: {
        name: 'Moai of Easter Island',
        kind: 'moai',
        at: [-27.1258, -109.2769],
        km: 3.5,
        blurb:
          'Fifteen giant stone heads standing in a row, their backs to the Pacific.',
      },
    },
  },
  {
    id: 'fuji',
    place: 'Yamanashi',
    country: 'Japan',
    flag: '🇯🇵',
    kind: 'wonder',
    cost: 300,
    look: 'tokyo',
    palette: pal('#cfe6ff', '#f6f1ff', '#b9d99a', '#e0457b', [
      '#e9e3f2',
      '#d8d0e8',
    ]),
    weather: 'cool',
    time: 'morning',
    stage: {
      name: 'Lake Kawaguchi Loop',
      grades: [0, 1, 2, 0, -1, -1],
      waterAfterKm: [2, 4],
      terrain: 'park',
      wild: true,
      landmark: {
        name: 'Mount Fuji',
        kind: 'volcano',
        at: [35.3606, 138.7274],
        km: 3,
        blurb:
          'Japan’s snow-capped volcano, a near-perfect cone above the five lakes.',
      },
    },
  },
  {
    id: 'liberty',
    place: 'New York',
    country: 'United States',
    flag: '🇺🇸',
    kind: 'icon',
    cost: 300,
    look: 'paris',
    palette: pal('#cfe5ff', '#f3f7ff', '#cfe0c0', '#2f8f7a', [
      '#c9ced8',
      '#b7bdc9',
      '#dfe3ea',
    ]),
    weather: 'headwind',
    time: 'morning',
    stage: {
      name: 'Battery Park Waterfront',
      grades: [0, 0, 1, -1, 0, 0],
      waterAfterKm: [2, 4],
      terrain: 'beach',
      wild: true,
      landmark: {
        name: 'Statue of Liberty',
        kind: 'liberty',
        at: [40.6892, -74.0445],
        km: 3,
        blurb:
          'A copper giant raising her torch over New York Harbor since 1886.',
      },
    },
  },
  {
    id: 'sydney-opera',
    place: 'Sydney',
    country: 'Australia',
    flag: '🇦🇺',
    kind: 'icon',
    cost: 300,
    look: 'dubai',
    palette: pal('#c9e7ff', '#f1f9ff', '#bfe0a8', '#1f78c1', [
      '#e6e9ee',
      '#d3d8df',
    ]),
    weather: 'tailwind',
    time: 'evening',
    stage: {
      name: 'Circular Quay',
      grades: [0, -1, 1, 0, 0, 1],
      waterAfterKm: [2, 4],
      terrain: 'beach',
      wild: true,
      landmark: {
        name: 'Sydney Opera House',
        kind: 'shells',
        at: [-33.8568, 151.2153],
        km: 3,
        blurb: 'White shell roofs like sails, on a point in the harbour.',
      },
    },
  },
  {
    id: 'christ-redeemer',
    place: 'Rio de Janeiro',
    country: 'Brazil',
    flag: '🇧🇷',
    kind: 'icon',
    cost: 350,
    look: 'amazon',
    palette: pal('#cdeaff', '#fff6e8', '#8fcf7a', '#2e9e5b', [
      '#f0e2c8',
      '#e5d0aa',
    ]),
    weather: 'hot',
    time: 'afternoon',
    stage: {
      name: 'Corcovado Climb',
      grades: [3, 4, 5, 2, -3, -4],
      waterAfterKm: [2, 4],
      terrain: 'hills',
      wild: true,
      landmark: {
        name: 'Christ the Redeemer',
        kind: 'redeemer',
        at: [-22.9519, -43.2105],
        km: 3.5,
        blurb: 'Arms wide open over Rio, on top of the Corcovado mountain.',
      },
    },
  },
  {
    id: 'chichen-itza',
    place: 'Yucatán',
    country: 'Mexico',
    flag: '🇲🇽',
    kind: 'ancient',
    cost: 300,
    look: 'amazon',
    palette: pal('#d6ecff', '#fff4e0', '#9fd07f', '#c0602a', [
      '#d9c9a5',
      '#c7b48c',
    ]),
    weather: 'hot',
    time: 'noon',
    stage: {
      name: 'Sacred Way',
      grades: [0, 1, 0, 0, -1, 0],
      waterAfterKm: [1, 3, 5],
      terrain: 'jungle',
      wild: true,
      landmark: {
        name: 'Chichén Itzá',
        kind: 'stepped',
        at: [20.6843, -88.5678],
        km: 3,
        blurb:
          'El Castillo, the Maya step pyramid where a serpent of shadow climbs the stairs.',
      },
    },
  },
  {
    id: 'parthenon',
    place: 'Athens',
    country: 'Greece',
    flag: '🇬🇷',
    kind: 'ancient',
    cost: 300,
    look: 'paris',
    palette: pal('#cfe7ff', '#fbf6ea', '#d8d0b0', '#2a6fb5', [
      '#f2ede0',
      '#e6dfcc',
      '#fbf8f0',
    ]),
    weather: 'hot',
    time: 'morning',
    stage: {
      name: 'Acropolis Ring',
      grades: [1, 2, 3, 0, -2, -2],
      waterAfterKm: [2, 4],
      terrain: 'city',
      landmark: {
        name: 'Parthenon',
        kind: 'parthenon',
        at: [37.9715, 23.7267],
        km: 3,
        blurb:
          'The marble temple of Athena on the Acropolis, built 2,400 years ago.',
      },
    },
  },
  {
    id: 'uluru',
    place: 'Northern Territory',
    country: 'Australia',
    flag: '🇦🇺',
    kind: 'wonder',
    cost: 350,
    look: 'dubai',
    palette: pal('#bfe0ff', '#fff0dc', '#e2a274', '#c2421f', [
      '#d98a5a',
      '#c76b3b',
    ]),
    weather: 'hot',
    time: 'evening',
    stage: {
      name: 'Red Centre Track',
      grades: [0, 0, 1, 0, -1, 0],
      waterAfterKm: [1, 3, 5],
      terrain: 'desert',
      wild: true,
      landmark: {
        name: 'Uluru',
        kind: 'monolith',
        at: [-25.3444, 131.0369],
        km: 3,
        blurb:
          'A great red sandstone rock rising alone from the desert, glowing at sunset.',
      },
    },
  },
  {
    id: 'matterhorn',
    place: 'Zermatt',
    country: 'Switzerland',
    flag: '🇨🇭',
    kind: 'wonder',
    cost: 350,
    look: 'paris',
    palette: pal('#cde6ff', '#f4f9ff', '#a9d48e', '#d03030', [
      '#efe8dc',
      '#e2d8c6',
    ]),
    weather: 'cool',
    time: 'morning',
    stage: {
      name: 'Zermatt Valley',
      grades: [2, 3, 1, 4, -2, -3],
      waterAfterKm: [2, 4],
      terrain: 'forest',
      wild: true,
      landmark: {
        name: 'Matterhorn',
        kind: 'peak',
        at: [45.9763, 7.6586],
        km: 3,
        blurb: 'The sharpest peak of the Alps, a stone pyramid above Zermatt.',
      },
    },
  },
  {
    id: 'pisa',
    place: 'Pisa',
    country: 'Italy',
    flag: '🇮🇹',
    kind: 'icon',
    cost: 250,
    look: 'paris',
    palette: pal('#d3eaff', '#fff4e6', '#bfe0a0', '#c0392b', [
      '#f0dcc0',
      '#e8c9a0',
      '#f6e8d2',
    ]),
    weather: 'cool',
    time: 'afternoon',
    stage: {
      name: 'Field of Miracles',
      grades: [0, 0, 0, 1, -1, 0],
      waterAfterKm: [2, 4],
      terrain: 'park',
      landmark: {
        name: 'Leaning Tower of Pisa',
        kind: 'leaning',
        at: [43.723, 10.3966],
        km: 3,
        blurb:
          'A marble bell tower that started leaning before it was finished.',
      },
    },
  },
  {
    id: 'golden-gate',
    place: 'San Francisco',
    country: 'United States',
    flag: '🇺🇸',
    kind: 'icon',
    cost: 300,
    look: 'dubai',
    palette: pal('#d9e8f5', '#f3f6f8', '#bcd8a8', '#d0432b', [
      '#e8e2d6',
      '#d6cfc0',
    ]),
    weather: 'headwind',
    time: 'morning',
    stage: {
      name: 'Presidio Shore',
      grades: [0, 1, 2, -1, 0, -1],
      waterAfterKm: [2, 4],
      terrain: 'beach',
      wild: true,
      landmark: {
        name: 'Golden Gate Bridge',
        kind: 'suspension',
        at: [37.8199, -122.4783],
        km: 3,
        blurb:
          'The red suspension bridge across the Golden Gate, often wrapped in fog.',
      },
    },
  },
  {
    id: 'borobudur',
    place: 'Central Java',
    country: 'Indonesia',
    flag: '🇮🇩',
    kind: 'ancient',
    cost: 300,
    look: 'hanoi',
    palette: pal('#ffdcc2', '#fff3e6', '#95cf7a', '#8a6d3b', [
      '#a89a85',
      '#958772',
    ]),
    weather: 'hot',
    time: 'morning',
    stage: {
      name: 'Kedu Plain',
      grades: [0, 1, 1, 0, -1, -1],
      waterAfterKm: [1, 3, 5],
      terrain: 'jungle',
      wild: true,
      landmark: {
        name: 'Borobudur',
        kind: 'stupa',
        at: [-7.6079, 110.2038],
        km: 3,
        blurb:
          'The largest Buddhist temple: nine stone terraces crowned with bell stupas.',
      },
    },
  },
  {
    id: 'cappadocia',
    place: 'Göreme',
    country: 'Türkiye',
    flag: '🇹🇷',
    kind: 'wonder',
    cost: 300,
    look: 'dubai',
    palette: pal('#ffd8b8', '#fff2e2', '#e3c79c', '#d9533b', [
      '#e8cfa6',
      '#d9b98a',
    ]),
    weather: 'cool',
    time: 'morning',
    stage: {
      name: 'Göreme Valley',
      grades: [1, 2, -1, 0, 1, -2],
      waterAfterKm: [2, 4],
      terrain: 'desert',
      wild: true,
      landmark: {
        name: 'Cappadocia',
        kind: 'chimneys',
        at: [38.6431, 34.8289],
        km: 3,
        blurb:
          'Fairy chimneys of soft rock, with hot-air balloons rising at dawn.',
      },
    },
  },
];

export const tourById = (id: string): TourStop | undefined =>
  TOUR.find((s) => s.id === id);

/** The key that seeds a stop's course and stores its runs. */
export const tourKey = (stop: TourStop) => `tour-${stop.id}`;

/** A stop as a race day: the same shape the race, the plan and the 3D world use. */
export const tourDay = (stop: TourStop): DayInfo => {
  const city: City = {
    id: stop.look,
    name: stop.stage.landmark.name,
    country: stop.country,
    flag: stop.flag,
    palette: stop.palette,
    stages: [stop.stage],
  };
  return {
    dateKey: tourKey(stop),
    dayIndex: 0,
    season: 0,
    city,
    // Never the triathlon slot (6).
    stageIndex: 0,
    stage: stop.stage,
    weather: WEATHER[stop.weather],
    time: stop.time,
  };
};

/** The order the free stop of the week goes round in: shuffled once, the same everywhere. */
const ROTATION: TourStop[] = (() => {
  const order = [...TOUR];
  const rand = mulberry32(hashString('tour-rotation'));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
})();

/**
 * The free stop of the week: open to every runner without coins from Monday to
 * Sunday (UTC), so newcomers get a taste of the tour and the whole crew races
 * on one shared board.
 */
export const featuredStop = (dateKey: string): TourStop => {
  const week = Math.floor(dayIndexOf(dateKey) / 7);
  const n = ROTATION.length;
  return ROTATION[((week % n) + n) % n]!;
};

/** The last day (Sunday) the stop featured on `dateKey` stays free. */
export const featuredUntil = (dateKey: string): string => {
  const index = dayIndexOf(dateKey);
  return addDays(dateKey, 6 - (((index % 7) + 7) % 7));
};

/** Days left in the free week, counting today. */
export const featuredDaysLeft = (dateKey: string): number =>
  dayIndexOf(featuredUntil(dateKey)) - dayIndexOf(dateKey) + 1;

/** The Monday that starts the free week `dateKey` is in. */
export const featuredWeek = (dateKey: string): string =>
  addDays(featuredUntil(dateKey), -6);

/** Coins for the three fastest runners at the free stop, paid when its week ends. */
export const TOUR_WEEK_PRIZES = [100, 60, 40];
