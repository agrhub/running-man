import type { CityId, WeatherId } from './content';
import type { Look, PetId, RewardBreakdown } from './economy';
import type { KmSplit, Plan } from './sim';

export type Profile = {
  username: string;
  badges: number;
  streak: number;
  bestStreak: number;
  lastRunDate: string | null;
  owned: string[];
  ownedPets: PetId[];
  look: Look;
  petAffinity: number;
  petCaredOn: string | null;
  finishedCities: CityId[];
  finisher: boolean;
  /** Stages run per season number, used for the Finisher award. */
  stagesBySeason: Record<string, number>;
  /** Seasons whose crew-finish reward this runner has already collected. */
  claimedSeasons: number[];
  weathersRun: WeatherId[];
  top10: boolean;
  cheeredOn: string | null;
  totalRuns: number;
};

export type GhostRun = {
  username: string;
  look: Look;
  /** Cumulative seconds at km 0..6. */
  marks: number[];
  seconds: number;
};

export type LeaderRow = {
  rank: number;
  username: string;
  seconds: number;
};

export type CrewProgress = {
  season: number;
  cityId: CityId;
  meters: number;
  target: number;
  finished: boolean;
};

export type RunRecord = {
  dateKey: string;
  seconds: number;
  plan: Plan;
  splits: KmSplit[];
  rank: number;
  totalRunners: number;
  reward: RewardBreakdown;
  streak: number;
  /** Item and pet ids whose unlock condition became true with this run. */
  unlocked: string[];
  crewFinishedNow: boolean;
  finisherNow: boolean;
  shared: boolean;
};

export type InitResponse = {
  type: 'init';
  /** The date the current post belongs to. */
  dateKey: string;
  /** Today in UTC. */
  today: string;
  /** Today's post, when this post is from an earlier day. */
  todayPostId: string | null;
  profile: Profile;
  myRun: RunRecord | null;
  leaderboard: LeaderRow[];
  myRank: number | null;
  totalRunners: number;
  ghosts: GhostRun[];
  crew: CrewProgress;
  cheersReceived: number;
  journeyId: string | null;
};

export type SplashResponse = {
  type: 'splash';
  dateKey: string;
  today: string;
  crew: CrewProgress;
  totalRunners: number;
  ran: boolean;
  streak: number;
  username: string;
};

export type RunRequest = { plan: Plan; journeyId?: string | null };

export type RunResponse = {
  type: 'run';
  run: RunRecord;
  profile: Profile;
  leaderboard: LeaderRow[];
  crew: CrewProgress;
};

export type ItemRequest = { itemId: string; journeyId?: string | null };
export type PetRequest = { petId: PetId; journeyId?: string | null };
export type CheerRequest = { username: string; journeyId?: string | null };
export type JourneyRequest = { journeyId?: string | null };

export type ProfileResponse = {
  type: 'profile';
  profile: Profile;
  message?: string;
};

export type ShareResponse = {
  type: 'share';
  commentPosted: boolean;
  text: string;
};

export type ErrorResponse = { status: 'error'; message: string };
