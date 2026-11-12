import type { CityId, WeatherId } from './content';
import type { Chat } from './chat';
import type { ItemKind } from './course';
import type { Move } from './race';

export type Incident = {
  /** The other runner. */
  with: string;
  km: number;
  /** Seconds this runner lost. */
  seconds: number;
  /** True when this runner ran into the other from behind. */
  atFault: boolean;
};
import type { Look, PetId, RewardBreakdown } from './economy';
import type { CityVote } from './vote';
import type { KmSplit, Plan } from './sim';

export type Profile = {
  username: string;
  /** True once the player has created their runner. */
  registered: boolean;
  /** Race bib number, handed out in registration order. */
  bib: number | null;
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

export type RunnerTrack = {
  username: string;
  look: Look;
  bib?: number | null;
  /** Cumulative seconds at km 0..6. */
  marks: number[];
  seconds: number;
  /** Lane changes, so other players see this runner where they really ran. */
  moves?: Move[];
  /** Quick-chat lines said during the run. */
  chat?: Chat[];
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
  /** Lane changes during the run, replayed by the server against the day's course. */
  moves: Move[];
  /** The other runners on the road during this run, in order. */
  rivals: string[];
  chat?: Chat[];
  /** Net seconds from cones, puddles and high fives. */
  course: number;
  met: ItemKind[];
  /** Collisions with other runners, including ones that happened after this run (they ran into you). */
  incidents: Incident[];
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
  runners: RunnerTrack[];
  crew: CrewProgress;
  cheersReceived: number;
  /** This week's vote on the next city to build. */
  vote: CityVote;
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

export type RunRequest = {
  plan: Plan;
  moves: Move[];
  /** Usernames of the runners on the road, in the order the client raced them. */
  rivals: string[];
  chat?: Chat[];
  journeyId?: string | null;
};

export type RunResponse = {
  type: 'run';
  run: RunRecord;
  profile: Profile;
  leaderboard: LeaderRow[];
  crew: CrewProgress;
};

export type RegisterRequest = {
  skin: number;
  hair: number;
  hairStyle: number;
  top: string;
  journeyId?: string | null;
};

export type ItemRequest = { itemId: string; journeyId?: string | null };
export type PetRequest = { petId: PetId; journeyId?: string | null };
export type CheerRequest = { username: string; journeyId?: string | null };
export type VoteRequest = { cityId: string; journeyId?: string | null };

export type VoteResponse = { type: 'vote'; vote: CityVote; message: string };
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
