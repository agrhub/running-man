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
import type { QuestState } from './quests';
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
  /** Ran a stage in a December holiday season (Santa hats). */
  holidayRun: boolean;
  top10: boolean;
  cheeredOn: string | null;
  totalRuns: number;
  /** Last daily check-in (UTC date) and its place in the 7-day calendar (1..7). */
  checkInDate: string | null;
  checkInDay: number;
  /** Claimed quests per period (a date for daily, `w<season>` for weekly). */
  questClaims: Record<string, string[]>;
  /** Snack Dash today: rounds played and best score. */
  dash: { date: string | null; plays: number; best: number };
  /** Runners this player follows as friends (usernames). */
  friends: string[];
  /** Join code of this runner's club, if any. */
  club: string | null;
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

export type WeeklyRow = {
  rank: number;
  username: string;
  /** Stages run this week (one city). */
  stages: number;
  /** Total official time over those stages. */
  seconds: number;
};

export type WeeklyBoard = {
  season: number;
  rows: WeeklyRow[];
  /** Your row, when you ran this week. */
  mine: WeeklyRow | null;
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

/** What happened on a closed stage: posted as a recap comment and shown in the game the next day. */
export type DayRecap = {
  dateKey: string;
  runners: number;
  podium: { username: string; seconds: number }[];
  bumps: number;
  snacks: number;
  fives: number;
  crashKing: { username: string; crashes: number } | null;
  topLine: { line: string; times: number } | null;
  crew: CrewProgress;
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
  /** This week's standings across every stage of the city. */
  weekly: WeeklyBoard;
  quests: QuestState[];
  /** Your friends and how their day went. */
  friends: FriendRow[];
  club: ClubView | null;
  /** The day before this post's stage, when anyone ran it. */
  yesterday: DayRecap | null;
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
  weekly: WeeklyBoard;
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
export type FriendRow = {
  username: string;
  bib: number | null;
  streak: number;
  /** Today's official time and rank, when they have run. */
  seconds: number | null;
  rank: number | null;
};

export type FriendRequest = { username: string; journeyId?: string | null };

export type FriendsResponse = {
  type: 'friends';
  friends: FriendRow[];
  /** Today's runners you might add. */
  suggestions: string[];
  profile: Profile;
  message?: string;
};

export type ClubMember = FriendRow & {
  /** Stages this member ran this week. */
  weekStages: number;
};

export type ClubView = {
  code: string;
  name: string;
  owner: string;
  members: ClubMember[];
  /** Stages the club ran this week (6 km each). */
  weekStages: number;
};

export type ClubRow = {
  rank: number;
  code: string;
  name: string;
  weekStages: number;
};

export type ClubRequest = {
  code?: string;
  adjective?: number;
  noun?: number;
  journeyId?: string | null;
};

export type ClubResponse = {
  type: 'club';
  club: ClubView | null;
  top: ClubRow[];
  profile: Profile;
  message?: string;
};

/** Avatar image URL per username; null when the player has none. */
export type AvatarsResponse = {
  type: 'avatars';
  avatars: Record<string, string | null>;
};

export type DashRow = { rank: number; username: string; score: number };

export type DashBoard = { rows: DashRow[]; mine: DashRow | null };

export type DashRequest = {
  round: number;
  moves: unknown;
  journeyId?: string | null;
};

export type DashResponse = {
  type: 'dash';
  score: number;
  reward: number;
  profile: Profile;
  board: DashBoard;
  quests: QuestState[];
};

export type DashBoardResponse = { type: 'dashBoard'; board: DashBoard };

export type QuestClaimRequest = { questId: string; journeyId?: string | null };

export type QuestsResponse = {
  type: 'quests';
  quests: QuestState[];
  profile: Profile;
  message?: string;
};

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
