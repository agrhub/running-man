import type { Challenge, ChallengeResult } from './challenge';
import type { AchievementState } from './achievements';
import type { ArcadeId } from './arcade';
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
import type { Look, PetChoice, PetId, RewardBreakdown } from './economy';
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
  /** Rest days held: each covers one missed day so the streak carries on. */
  restDays: number;
  owned: string[];
  ownedPets: PetId[];
  /** World Tour stops unlocked with coins, and the ones finished (stamped). */
  tourUnlocked: string[];
  tourStamps: string[];
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
  /** Lifetime counters for achievements. */
  stats: RunnerStats;
  /** Achievement ids already earned (and paid). */
  achievements: string[];
  /** Today's rounds and best score in each of the other mini games. */
  arcade: Partial<
    Record<ArcadeId, { date: string | null; plays: number; best: number }>
  >;
};

export type RunnerStats = {
  fives: number;
  snacks: number;
  crashes: number;
  chats: number;
  bestRank: number | null;
  dashBest: number;
  /** Guesses within 3 seconds. */
  calledIt?: number;
};

/** One run in a runner's history. */
export type HistoryRow = {
  dateKey: string;
  seconds: number;
  /** Place at the time of the run, and how many had run by then. */
  rank: number;
  runners: number;
};

export type MeResponse = {
  type: 'me';
  profile: Profile;
  history: HistoryRow[];
  achievements: AchievementState[];
  /** Achievements earned just now (their coins are already in the profile). */
  earned: string[];
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
  /** Runners you called out after this run (they were mentioned in a comment). */
  challenged?: string[];
  /** The challenges waiting for you when you ran, and whether you beat them. */
  challenges?: ChallengeResult[];
  /** Rest days this run used up to keep the streak going. */
  restUsed?: number;
  /** Item and pet ids whose unlock condition became true with this run. */
  unlocked: string[];
  crewFinishedNow: boolean;
  finisherNow: boolean;
  shared: boolean;
  /** This run's leg in the club relay (and whether it completed the relay). */
  relay?: { leg: number; done: boolean; coins: number } | null;
  /** Achievements this run completed. */
  achieved?: string[];
  /** The finish-time guess and how far off it was. */
  guess?: { seconds: number; off: number } | null;
};

/** What moderators can switch off for their subreddit (all on by default). */
export type GameSettings = {
  quickChat: boolean;
  roadLife: boolean;
  pinPosts: boolean;
  dailyRecap: boolean;
  appPosts: boolean;
  runnerFlair: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  quickChat: true,
  roadLife: true,
  pinPosts: true,
  dailyRecap: true,
  appPosts: true,
  runnerFlair: true,
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
  /** On the day a free World Tour week ends: that week's podium. */
  tourWeek?: TourWeekResult | null;
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
  /** Runners who challenged you today, while you have not run yet. */
  challenges: Challenge[];
  club: ClubView | null;
  /** The day before this post's stage, when anyone ran it. */
  yesterday: DayRecap | null;
  /** The race options this subreddit's moderators chose. */
  settings: Pick<GameSettings, 'quickChat' | 'roadLife'>;
  journeyId: string | null;
};

export type SplashResponse = {
  type: 'splash';
  dateKey: string;
  today: string;
  /** This subreddit's day count for the post's date (1 on its first stage). */
  dayNumber: number;
  crew: CrewProgress;
  totalRunners: number;
  ran: boolean;
  streak: number;
  username: string;
  /** Runners who challenged you on today's stage, while you have not run it. */
  challenges: Challenge[];
};

export type RunRequest = {
  plan: Plan;
  moves: Move[];
  /** Usernames of the runners on the road, in the order the client raced them. */
  rivals: string[];
  chat?: Chat[];
  /** The runner's guess of their finish time, in whole seconds. */
  guess?: number | null;
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
export type PetRequest = { petId: PetChoice; journeyId?: string | null };
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
  /** Today's relay: the first three clubmates to run are its legs. */
  relay: ClubRelay;
};

export type RelayLeg = { username: string; seconds: number };

export type ClubRelay = {
  legs: RelayLeg[];
  /** Total of the three legs, once all three have run. */
  total: number | null;
  /** Place among today's finished relays. */
  rank: number | null;
};

export type RelayRow = {
  rank: number;
  code: string;
  name: string;
  total: number;
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
  /** Today's fastest finished club relays. */
  relays: RelayRow[];
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

export type ArcadeRequest = {
  game: ArcadeId;
  round: number;
  taps: unknown;
  journeyId?: string | null;
};

export type ArcadeResponse = {
  type: 'arcade';
  game: ArcadeId;
  score: number;
  reward: number;
  profile: Profile;
  board: DashBoard;
};

export type ArcadeBoardResponse = {
  type: 'arcadeBoard';
  game: ArcadeId;
  board: DashBoard;
};

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

export type ChallengeResponse = {
  type: 'challenge';
  record: RunRecord;
  target: string;
};

export type ShareResponse = {
  type: 'share';
  commentPosted: boolean;
  text: string;
};

export type ErrorResponse = { status: 'error'; message: string };

/** One World Tour stop as the tour list shows it. */
export type TourRow = {
  id: string;
  unlocked: boolean;
  stamped: boolean;
  /** Your best time here, in seconds. */
  best: number | null;
  rank: number | null;
  runners: number;
  top: { username: string; seconds: number } | null;
};

export type TourResponse = {
  type: 'tour';
  stops: TourRow[];
  profile: Profile;
  /** The free stop of the week: anyone can run it without unlocking. */
  featured: string;
  /** The fastest runners at the free stop this week. */
  week: { username: string; seconds: number }[];
};

/** The free stop's week, closed: its podium and the coins each runner won. */
export type TourWeekResult = {
  stop: string;
  podium: { username: string; seconds: number; prize: number }[];
};

/** Everything needed to race a stop: the best runs there become your ghosts. */
export type TourStopResponse = {
  type: 'tourStop';
  id: string;
  runners: RunnerTrack[];
  best: number | null;
};

export type TourRunResponse = {
  type: 'tourRun';
  id: string;
  profile: Profile;
  seconds: number;
  best: number;
  improved: boolean;
  rank: number;
  total: number;
  /** First finish here: passport stamp and coins. */
  stamped: boolean;
  reward: number;
};
