import type { CityId, WeatherId } from './content';

export type Slot = 'top' | 'hat' | 'shoes' | 'accessory' | 'trail' | 'petGear';

/** Slots the runner wears; pet gear is chosen in the pet section. */
export const SLOTS: Slot[] = ['top', 'hat', 'shoes', 'accessory', 'trail'];

export const SLOT_LABEL: Record<Slot, string> = {
  top: 'Shirt',
  hat: 'Head',
  shoes: 'Shoes',
  accessory: 'Extra',
  trail: 'Trail',
  petGear: 'Pet gear',
};

/** The game's one currency. Stored as `badges` in profiles for compatibility. */
export const COIN = '🪙';

export type Unlock =
  | { kind: 'free' }
  | { kind: 'badges'; cost: number }
  | { kind: 'streak'; days: number }
  | { kind: 'cityFinish'; city: CityId }
  | { kind: 'finisher' }
  | { kind: 'weather'; weather: WeatherId }
  | { kind: 'top10' }
  | { kind: 'holiday' };

export type ItemShape =
  | 'tee'
  | 'tank'
  | 'raincoat'
  | 'finisherTee'
  | 'none'
  | 'cap'
  | 'hachimaki'
  | 'beret'
  | 'conical'
  | 'visor'
  | 'tophat'
  | 'runners'
  | 'glowRunners'
  | 'headband'
  | 'shades'
  | 'scarf'
  | 'sakura'
  | 'leaves'
  | 'sparkle'
  | 'crown'
  | 'ears'
  | 'explorer'
  | 'santa'
  | 'antlers'
  | 'snow'
  | 'petSanta'
  | 'petBandana'
  | 'petBow'
  | 'petCap'
  | 'petShades'
  | 'petCrown'
  | 'petCollar';

export type Item = {
  id: string;
  name: string;
  slot: Slot;
  shape: ItemShape;
  color: string;
  unlock: Unlock;
};

export const ITEMS: Item[] = [
  {
    id: 'tee-coral',
    name: 'Coral Tee',
    slot: 'top',
    shape: 'tee',
    color: '#ff7a6b',
    unlock: { kind: 'free' },
  },
  {
    id: 'tee-mint',
    name: 'Mint Tee',
    slot: 'top',
    shape: 'tee',
    color: '#5fd3b0',
    unlock: { kind: 'free' },
  },
  {
    id: 'tee-sky',
    name: 'Sky Tee',
    slot: 'top',
    shape: 'tee',
    color: '#6bb6ff',
    unlock: { kind: 'free' },
  },
  {
    id: 'tee-sun',
    name: 'Sun Tee',
    slot: 'top',
    shape: 'tee',
    color: '#ffc83d',
    unlock: { kind: 'free' },
  },
  {
    id: 'tee-grape',
    name: 'Grape Tee',
    slot: 'top',
    shape: 'tee',
    color: '#a78bfa',
    unlock: { kind: 'free' },
  },
  {
    id: 'raincoat',
    name: 'Clear Raincoat',
    slot: 'top',
    shape: 'raincoat',
    color: '#bfe9ff',
    unlock: { kind: 'weather', weather: 'rain' },
  },
  {
    id: 'finisher-tee',
    name: 'Finisher Tee',
    slot: 'top',
    shape: 'finisherTee',
    color: '#1f2a44',
    unlock: { kind: 'finisher' },
  },
  {
    id: 'no-hat',
    name: 'Bare Head',
    slot: 'hat',
    shape: 'none',
    color: '#000000',
    unlock: { kind: 'free' },
  },
  {
    id: 'cap',
    name: 'Running Cap',
    slot: 'hat',
    shape: 'cap',
    color: '#ff5d5d',
    unlock: { kind: 'badges', cost: 400 },
  },
  {
    id: 'hachimaki',
    name: 'Tokyo Hachimaki',
    slot: 'hat',
    shape: 'hachimaki',
    color: '#ffffff',
    unlock: { kind: 'cityFinish', city: 'tokyo' },
  },
  {
    id: 'beret',
    name: 'Paris Beret',
    slot: 'hat',
    shape: 'beret',
    color: '#2b2d42',
    unlock: { kind: 'cityFinish', city: 'paris' },
  },
  {
    id: 'conical',
    name: 'Hanoi Leaf Hat',
    slot: 'hat',
    shape: 'conical',
    color: '#f2d38c',
    unlock: { kind: 'cityFinish', city: 'hanoi' },
  },
  {
    id: 'visor',
    name: 'Dubai Sun Visor',
    slot: 'hat',
    shape: 'visor',
    color: '#1fb5a8',
    unlock: { kind: 'cityFinish', city: 'dubai' },
  },
  {
    id: 'explorer-hat',
    name: 'Amazon Explorer Hat',
    slot: 'hat',
    shape: 'explorer',
    color: '#c9a66b',
    unlock: { kind: 'cityFinish', city: 'amazon' },
  },
  {
    id: 'tophat',
    name: 'Finish-Line Top Hat',
    slot: 'hat',
    shape: 'tophat',
    color: '#22223b',
    unlock: { kind: 'streak', days: 14 },
  },
  {
    id: 'runners-basic',
    name: 'Daily Runners',
    slot: 'shoes',
    shape: 'runners',
    color: '#ffffff',
    unlock: { kind: 'free' },
  },
  {
    id: 'kumo',
    name: 'Kumo Glow Runners',
    slot: 'shoes',
    shape: 'glowRunners',
    color: '#7cf7d4',
    unlock: { kind: 'badges', cost: 600 },
  },
  {
    id: 'no-extra',
    name: 'Nothing',
    slot: 'accessory',
    shape: 'none',
    color: '#000000',
    unlock: { kind: 'free' },
  },
  {
    id: 'headband',
    name: 'Striped Headband',
    slot: 'accessory',
    shape: 'headband',
    color: '#ff4f81',
    unlock: { kind: 'streak', days: 3 },
  },
  {
    id: 'shades',
    name: 'Sport Shades',
    slot: 'accessory',
    shape: 'shades',
    color: '#1b1b2f',
    unlock: { kind: 'badges', cost: 300 },
  },
  {
    id: 'scarf',
    name: 'Wool Scarf',
    slot: 'accessory',
    shape: 'scarf',
    color: '#e63946',
    unlock: { kind: 'badges', cost: 500 },
  },
  {
    id: 'no-trail',
    name: 'No Trail',
    slot: 'trail',
    shape: 'none',
    color: '#000000',
    unlock: { kind: 'free' },
  },
  {
    id: 'trail-sakura',
    name: 'Sakura Trail',
    slot: 'trail',
    shape: 'sakura',
    color: '#ffb7c5',
    unlock: { kind: 'top10' },
  },
  {
    id: 'trail-leaves',
    name: 'Golden Leaves',
    slot: 'trail',
    shape: 'leaves',
    color: '#f4b942',
    unlock: { kind: 'streak', days: 7 },
  },
  {
    id: 'trail-sparkle',
    name: 'Sparkle Trail',
    slot: 'trail',
    shape: 'sparkle',
    color: '#fff3a3',
    unlock: { kind: 'badges', cost: 900 },
  },

  // ---- more to buy with coins
  {
    id: 'tee-lime',
    name: 'Lime Racing Tee',
    slot: 'top',
    shape: 'tee',
    color: '#b8f04a',
    unlock: { kind: 'badges', cost: 150 },
  },
  {
    id: 'tee-night',
    name: 'Midnight Tee',
    slot: 'top',
    shape: 'tee',
    color: '#2f3b6b',
    unlock: { kind: 'badges', cost: 200 },
  },
  {
    id: 'tee-flamingo',
    name: 'Flamingo Tee',
    slot: 'top',
    shape: 'tee',
    color: '#ff8fb8',
    unlock: { kind: 'badges', cost: 250 },
  },
  {
    id: 'cap-navy',
    name: 'Navy Cap',
    slot: 'hat',
    shape: 'cap',
    color: '#26355d',
    unlock: { kind: 'badges', cost: 300 },
  },
  {
    id: 'bunny-ears',
    name: 'Bunny Ears',
    slot: 'hat',
    shape: 'ears',
    color: '#fff4f8',
    unlock: { kind: 'badges', cost: 550 },
  },
  {
    id: 'crown',
    name: 'Party Crown',
    slot: 'hat',
    shape: 'crown',
    color: '#ffc83d',
    unlock: { kind: 'badges', cost: 1200 },
  },
  {
    id: 'santa-hat',
    name: 'Santa Hat',
    slot: 'hat',
    shape: 'santa',
    color: '#e0313b',
    unlock: { kind: 'holiday' },
  },
  {
    id: 'antlers',
    name: 'Reindeer Antlers',
    slot: 'hat',
    shape: 'antlers',
    color: '#9a6a3c',
    unlock: { kind: 'badges', cost: 350 },
  },
  {
    id: 'trail-snow',
    name: 'Snowflakes',
    slot: 'trail',
    shape: 'snow',
    color: '#eaf6ff',
    unlock: { kind: 'badges', cost: 250 },
  },
  {
    id: 'runners-coral',
    name: 'Coral Runners',
    slot: 'shoes',
    shape: 'runners',
    color: '#ff7a6b',
    unlock: { kind: 'badges', cost: 250 },
  },
  {
    id: 'runners-night',
    name: 'Night Runners',
    slot: 'shoes',
    shape: 'runners',
    color: '#26355d',
    unlock: { kind: 'badges', cost: 250 },
  },
  {
    id: 'shades-rose',
    name: 'Rose Shades',
    slot: 'accessory',
    shape: 'shades',
    color: '#ff4f81',
    unlock: { kind: 'badges', cost: 350 },
  },
  {
    id: 'scarf-mint',
    name: 'Mint Scarf',
    slot: 'accessory',
    shape: 'scarf',
    color: '#5fd3b0',
    unlock: { kind: 'badges', cost: 450 },
  },
  {
    id: 'trail-mint',
    name: 'Mint Bubbles',
    slot: 'trail',
    shape: 'sparkle',
    color: '#9ff5dc',
    unlock: { kind: 'badges', cost: 700 },
  },
  {
    id: 'trail-hearts',
    name: 'Pink Puffs',
    slot: 'trail',
    shape: 'sakura',
    color: '#ff9fc6',
    unlock: { kind: 'badges', cost: 800 },
  },
  // ---- pet gear: worn by whichever pet runs with you
  {
    id: 'pet-none',
    name: 'Nothing',
    slot: 'petGear',
    shape: 'none',
    color: '#000000',
    unlock: { kind: 'free' },
  },
  {
    id: 'pet-collar',
    name: 'Bell Collar',
    slot: 'petGear',
    shape: 'petCollar',
    color: '#e63946',
    unlock: { kind: 'badges', cost: 100 },
  },
  {
    id: 'pet-bandana',
    name: 'Bandana',
    slot: 'petGear',
    shape: 'petBandana',
    color: '#ff4f81',
    unlock: { kind: 'badges', cost: 150 },
  },
  {
    id: 'pet-bow',
    name: 'Big Bow',
    slot: 'petGear',
    shape: 'petBow',
    color: '#a78bfa',
    unlock: { kind: 'badges', cost: 200 },
  },
  {
    id: 'pet-cap',
    name: 'Tiny Cap',
    slot: 'petGear',
    shape: 'petCap',
    color: '#ffc83d',
    unlock: { kind: 'badges', cost: 300 },
  },
  {
    id: 'pet-shades',
    name: 'Pet Shades',
    slot: 'petGear',
    shape: 'petShades',
    color: '#1b1b2f',
    unlock: { kind: 'badges', cost: 350 },
  },
  {
    id: 'pet-crown',
    name: 'Tiny Crown',
    slot: 'petGear',
    shape: 'petCrown',
    color: '#ffc83d',
    unlock: { kind: 'badges', cost: 900 },
  },
  {
    id: 'pet-santa',
    name: 'Pet Santa Hat',
    slot: 'petGear',
    shape: 'petSanta',
    color: '#e0313b',
    unlock: { kind: 'holiday' },
  },
];

export type PetId =
  'corgi' | 'cat' | 'shiba' | 'penguin' | 'bunny' | 'fox' | 'panda';

/** The pet that runs with you, or none: pets are bought in the shop. */
export type PetChoice = PetId | 'none';

export type Pet = {
  id: PetId;
  name: string;
  quirk: string;
  unlock: Unlock;
};

/** Pets are bought with coins in the shop. Nobody starts with one. */
export const PETS: Pet[] = [
  {
    id: 'corgi',
    name: 'Corgi',
    quirk: 'Bounces along and barks at every km marker.',
    unlock: { kind: 'badges', cost: 300 },
  },
  {
    id: 'bunny',
    name: 'Bunny',
    quirk: 'Hops instead of running. Ears flop on every bounce.',
    unlock: { kind: 'badges', cost: 450 },
  },
  {
    id: 'cat',
    name: 'Tabby Cat',
    quirk: 'Sprints, stops, stares at you, sprints again.',
    unlock: { kind: 'badges', cost: 600 },
  },
  {
    id: 'shiba',
    name: 'Shiba',
    quirk: 'Very serious about pacing. Curly tail.',
    unlock: { kind: 'badges', cost: 750 },
  },
  {
    id: 'fox',
    name: 'Fox',
    quirk: 'Sly sprinter with a big fluffy tail.',
    unlock: { kind: 'badges', cost: 1000 },
  },
  {
    id: 'penguin',
    name: 'Penguin',
    quirk: 'Waddles uphill, belly-slides downhill.',
    unlock: { kind: 'badges', cost: 1200 },
  },
  {
    id: 'panda',
    name: 'Panda',
    quirk: 'Rolls along, in no hurry at all.',
    unlock: { kind: 'badges', cost: 1500 },
  },
];

export type Look = {
  top: string;
  hat: string;
  shoes: string;
  accessory: string;
  trail: string;
  /** What the pet wears. Older profiles have none. */
  petGear: string;
  pet: PetChoice;
  /** Indexes into SKIN_TONES and HAIR_TONES, chosen at registration. */
  skin: number;
  hair: number;
  /** Index into HAIR_STYLES. Older profiles have none: short hair. */
  hairStyle?: number;
};

export const HAIR_STYLES = ['Short', 'Spiky', 'Bob', 'Bun'] as const;

export const SKIN_TONES = [
  '#ffe0c7',
  '#f6cfa8',
  '#e0a97c',
  '#c58a5e',
  '#8d5b3e',
];
export const HAIR_TONES = [
  '#2b2118',
  '#5a3b22',
  '#a8642a',
  '#e2b45c',
  '#1f2a44',
  '#d9536f',
];

export const itemById = (id: string): Item | undefined =>
  ITEMS.find((i) => i.id === id);
export const petById = (id: string): Pet | undefined =>
  PETS.find((p) => p.id === id);

export const defaultLook = (seed: number): Look => {
  const tees = ITEMS.filter(
    (i) => i.slot === 'top' && i.unlock.kind === 'free'
  );
  return {
    top: tees[seed % tees.length]?.id ?? 'tee-coral',
    hat: 'no-hat',
    shoes: 'runners-basic',
    accessory: 'no-extra',
    trail: 'no-trail',
    petGear: 'pet-none',
    pet: 'none',
    skin: seed % SKIN_TONES.length,
    hair: Math.floor(seed / 7) % HAIR_TONES.length,
    hairStyle: Math.floor(seed / 3) % HAIR_STYLES.length,
  };
};

export type Progress = {
  badges: number;
  bestStreak: number;
  finishedCities: CityId[];
  finisher: boolean;
  weathersRun: WeatherId[];
  top10: boolean;
  /** Ran a stage in a December holiday season. */
  holidayRun: boolean;
};

/** Whether an unlock condition is met by progress alone (badge items still need buying). */
export const conditionMet = (unlock: Unlock, p: Progress): boolean => {
  switch (unlock.kind) {
    case 'free':
    case 'badges':
      return true;
    case 'streak':
      return p.bestStreak >= unlock.days;
    case 'cityFinish':
      return p.finishedCities.includes(unlock.city);
    case 'finisher':
      return p.finisher;
    case 'weather':
      return p.weathersRun.includes(unlock.weather);
    case 'top10':
      return p.top10;
    case 'holiday':
      return p.holidayRun;
  }
};

export const unlockLabel = (unlock: Unlock): string => {
  switch (unlock.kind) {
    case 'free':
      return 'Free';
    case 'badges':
      return `${unlock.cost} ${COIN}`;
    case 'streak':
      return `${unlock.days}-day streak`;
    case 'cityFinish':
      return `Crew finishes ${unlock.city[0]?.toUpperCase()}${unlock.city.slice(1)}`;
    case 'finisher':
      return 'Run 5 of 7 stages in one city';
    case 'weather':
      return `Run a ${unlock.weather} stage`;
    case 'top10':
      return 'Finish in the top 10% of a stage';
    case 'holiday':
      return 'Run a stage in December';
  }
};

export type RewardBreakdown = {
  finish: number;
  rank: number;
  streak: number;
  crew: number;
  /** Extra coins on the Christmas Run. */
  holiday?: number;
  /** Coins for calling your finish time. */
  guess?: number;
  /** Coins for completing today's club relay. */
  relay?: number;
  total: number;
};

export const FINISH_REWARD = 50;

/**
 * Call your time: guess your finish in the corral. Within 10 seconds pays 30
 * coins, within 3 seconds 60. Guesses are whole seconds within 3 minutes of the
 * plan's projection, so nobody can blanket every answer.
 */
export const GUESS_WINDOW = 180;
export const guessReward = (guess: number, actual: number): number => {
  const off = Math.abs(actual - guess);
  return off <= 3 ? 60 : off <= 10 ? 30 : 0;
};
export const isValidGuess = (
  guess: unknown,
  projected: number
): guess is number =>
  typeof guess === 'number' &&
  Number.isInteger(guess) &&
  Math.abs(guess - projected) <= GUESS_WINDOW;
export const CREW_FINISH_REWARD = 200;
export const CHEER_REWARD = 5;

/** Daily check-in: coins for day 1..7 of a streak, then the calendar starts over. */
export const CHECKIN_REWARDS = [20, 30, 40, 50, 60, 80, 150] as const;

/** The calendar day today's check-in would land on (1..7). */
export const nextCheckInDay = (
  lastDate: string | null,
  lastDay: number,
  yesterday: string
): number => (lastDate === yesterday ? (lastDay % 7) + 1 : 1);

/** Percentile is 0 (first) .. 1 (last), computed among runners so far that day. */
export const runReward = (
  percentile: number,
  streak: number,
  crewFinished: boolean
): RewardBreakdown => {
  const finish = FINISH_REWARD;
  const rank = percentile <= 0.1 ? 50 : percentile <= 0.5 ? 20 : 0;
  const streakBonus = Math.min(70, 10 * Math.max(0, streak));
  const crew = crewFinished ? CREW_FINISH_REWARD : 0;
  return {
    finish,
    rank,
    streak: streakBonus,
    crew,
    total: finish + rank + streakBonus + crew,
  };
};
