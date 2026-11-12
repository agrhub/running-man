import type { CityId, WeatherId } from './content';

export type Slot = 'top' | 'hat' | 'shoes' | 'accessory' | 'trail';

export const SLOTS: Slot[] = ['top', 'hat', 'shoes', 'accessory', 'trail'];

export const SLOT_LABEL: Record<Slot, string> = {
  top: 'Shirt',
  hat: 'Head',
  shoes: 'Shoes',
  accessory: 'Extra',
  trail: 'Trail',
};

export type Unlock =
  | { kind: 'free' }
  | { kind: 'badges'; cost: number }
  | { kind: 'streak'; days: number }
  | { kind: 'cityFinish'; city: CityId }
  | { kind: 'finisher' }
  | { kind: 'weather'; weather: WeatherId }
  | { kind: 'top10' };

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
  | 'tophat'
  | 'runners'
  | 'glowRunners'
  | 'headband'
  | 'shades'
  | 'scarf'
  | 'sakura'
  | 'leaves'
  | 'sparkle';

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
];

export type PetId = 'corgi' | 'cat' | 'shiba' | 'penguin';

export type Pet = {
  id: PetId;
  name: string;
  quirk: string;
  unlock: Unlock;
};

export const PETS: Pet[] = [
  {
    id: 'corgi',
    name: 'Corgi',
    quirk: 'Bounces along and barks at every km marker.',
    unlock: { kind: 'free' },
  },
  {
    id: 'cat',
    name: 'Tabby Cat',
    quirk: 'Sprints, stops, stares at you, sprints again.',
    unlock: { kind: 'badges', cost: 800 },
  },
  {
    id: 'shiba',
    name: 'Shiba',
    quirk: 'Very serious about pacing. Curly tail.',
    unlock: { kind: 'cityFinish', city: 'tokyo' },
  },
  {
    id: 'penguin',
    name: 'Penguin',
    quirk: 'Waddles uphill, belly-slides downhill.',
    unlock: { kind: 'streak', days: 14 },
  },
];

export type Look = {
  top: string;
  hat: string;
  shoes: string;
  accessory: string;
  trail: string;
  pet: PetId;
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
    pet: 'corgi',
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
  }
};

export const unlockLabel = (unlock: Unlock): string => {
  switch (unlock.kind) {
    case 'free':
      return 'Free';
    case 'badges':
      return `${unlock.cost} badges`;
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
  }
};

export type RewardBreakdown = {
  finish: number;
  rank: number;
  streak: number;
  crew: number;
  total: number;
};

export const FINISH_REWARD = 50;
export const CREW_FINISH_REWARD = 200;
export const CHEER_REWARD = 5;

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
