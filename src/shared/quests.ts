import { hashString, mulberry32 } from './rng';

export type QuestId =
  | 'run'
  | 'snacks'
  | 'highfive'
  | 'clean'
  | 'noCones'
  | 'chat'
  | 'cheer'
  | 'share'
  | 'pet'
  | 'topHalf'
  | 'dash'
  | 'week3'
  | 'week5'
  | 'vote';

export type QuestScope = 'daily' | 'weekly';

export type QuestDef = {
  id: QuestId;
  label: string;
  goal: number;
  reward: number;
  scope: QuestScope;
};

export const DAILY: QuestDef[] = [
  {
    id: 'snacks',
    label: 'Grab 3 snacks on the road',
    goal: 3,
    reward: 40,
    scope: 'daily',
  },
  {
    id: 'highfive',
    label: 'High-five 2 fans',
    goal: 2,
    reward: 40,
    scope: 'daily',
  },
  {
    id: 'clean',
    label: 'Finish without a crash',
    goal: 1,
    reward: 60,
    scope: 'daily',
  },
  {
    id: 'noCones',
    label: 'Finish without hitting a cone',
    goal: 1,
    reward: 50,
    scope: 'daily',
  },
  {
    id: 'chat',
    label: 'Say something in quick chat',
    goal: 1,
    reward: 30,
    scope: 'daily',
  },
  {
    id: 'cheer',
    label: 'Cheer another runner',
    goal: 1,
    reward: 30,
    scope: 'daily',
  },
  {
    id: 'share',
    label: 'Share your result in the comments',
    goal: 1,
    reward: 30,
    scope: 'daily',
  },
  {
    id: 'pet',
    label: 'Give your pet a treat',
    goal: 1,
    reward: 20,
    scope: 'daily',
  },
  {
    id: 'topHalf',
    label: 'Finish in the top half',
    goal: 1,
    reward: 60,
    scope: 'daily',
  },
  {
    id: 'dash',
    label: 'Play a round of Snack Dash',
    goal: 1,
    reward: 30,
    scope: 'daily',
  },
];

/** Always on the list: running today's stage. */
export const RUN_QUEST: QuestDef = {
  id: 'run',
  label: 'Run today’s stage',
  goal: 1,
  reward: 40,
  scope: 'daily',
};

export const WEEKLY: QuestDef[] = [
  {
    id: 'week3',
    label: 'Run 3 stages this week',
    goal: 3,
    reward: 150,
    scope: 'weekly',
  },
  {
    id: 'week5',
    label: 'Run 5 stages this week',
    goal: 5,
    reward: 300,
    scope: 'weekly',
  },
  {
    id: 'vote',
    label: 'Vote for the next city',
    goal: 1,
    reward: 50,
    scope: 'weekly',
  },
];

/** Today's quests, the same for everyone: running the stage plus two picked by the date. */
export const dailyQuests = (
  dateKey: string,
  pool: QuestId[] = DAILY.map((q) => q.id)
): QuestDef[] => {
  const rand = mulberry32(hashString(`quests:${dateKey}`));
  const options = DAILY.filter((q) => pool.includes(q.id));
  const picked: QuestDef[] = [];
  while (picked.length < 2 && options.length > 0) {
    const i = Math.floor(rand() * options.length);
    picked.push(options.splice(i, 1)[0]!);
  }
  return [RUN_QUEST, ...picked];
};

export const questById = (id: string): QuestDef | undefined =>
  [RUN_QUEST, ...DAILY, ...WEEKLY].find((q) => q.id === id);

export type QuestState = QuestDef & {
  progress: number;
  claimed: boolean;
};

/** The claim key: the date for daily quests, the season for weekly ones. */
export const questPeriod = (
  scope: QuestScope,
  dateKey: string,
  season: number
) => (scope === 'daily' ? dateKey : `w${season}`);
