import './index.css';

import {
  StrictMode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { navigateToPost, showLoginPrompt, showToast } from '@devvit/web/client';
import type {
  InitResponse,
  ProfileResponse,
  RunRecord,
  RunResponse,
  ShareResponse,
  VoteResponse,
  QuestsResponse,
  DashBoard,
  DashBoardResponse,
  DashResponse,
  FriendsResponse,
  ClubResponse,
  ClubRow,
  RelayRow,
  MeResponse,
  ArcadeResponse,
  ArcadeBoardResponse,
  RunnerTrack,
  TourResponse,
  TourRow,
  TourRunResponse,
  TourStopResponse,
} from '../shared/api';
import { dayInfo, isTriathlon } from '../shared/content';
import { simulate } from '../shared/sim';
import type { PetChoice } from '../shared/economy';
import type { NextCityId } from '../shared/vote';
import type { Plan } from '../shared/sim';
import { ApiError, request } from './lib/api';
import { TourScreen } from './screens/TourScreen';
import { tourById, tourDay } from '../shared/tour';
import { applyCityTheme } from './lib/theme';
import { Leaderboard } from './components/Leaderboard';
import { LockerScreen } from './screens/LockerScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ResultScreen } from './screens/ResultScreen';
import type { RaceOutcome } from './screens/RunScreen';
import { preloadWorld } from './three/load';
import { RegisterScreen } from './screens/RegisterScreen';
import { CorralScreen } from './screens/CorralScreen';
import { sfx } from './lib/sound';
import { TabBar, type Tab } from './components/TabBar';
import { QuestList, QuestsScreen } from './screens/QuestsScreen';
import {
  PlayScreen,
  type DashResult,
  type PlayGame,
} from './screens/PlayScreen';
import { DashGame } from './screens/DashGame';
import { ArcadeGame } from './screens/ArcadeGame';
import type { ArcadeId } from '../shared/arcade';
import { FriendsScreen } from './screens/FriendsScreen';
import { MeScreen } from './screens/MeScreen';
import { achievementById } from '../shared/achievements';
import { ClubSection } from './components/ClubSection';
import type { DashMove } from '../shared/dash';

type Screen =
  | 'register'
  | 'plan'
  | 'corral'
  | 'run'
  | 'result'
  | 'locker'
  | 'quests'
  | 'play'
  | 'dash'
  | 'arcade'
  | 'friends'
  | 'me'
  | 'tour'
  | 'tourPlan'
  | 'tourRun'
  | 'closed';

// The race screen carries three.js: it loads on demand, and is fetched early in idle time.
const loadRunScreen = () =>
  import('./screens/RunScreen').then((m) => ({ default: m.RunScreen }));
const RunScreen = lazy(loadRunScreen);
const preloadRace = () => {
  preloadWorld();
  void loadRunScreen().catch(() => undefined);
};

const Warming = () => (
  <div className="grid h-full place-items-center">
    <p className="font-display text-[22px] font-extrabold text-ink-soft">
      Warming up…
    </p>
  </div>
);

/** Screens shown with the tab bar; the race itself and registration stay full screen. */
const HUB: Screen[] = [
  'plan',
  'result',
  'locker',
  'quests',
  'play',
  'friends',
  'me',
  'tour',
  'tourPlan',
];
const SHIPPED_TABS: Tab[] = ['race', 'quests', 'play', 'friends', 'shop', 'me'];
const tabOf = (s: Screen): Tab =>
  s === 'locker'
    ? 'shop'
    : s === 'quests'
      ? 'quests'
      : s === 'play' || s === 'tour' || s === 'tourPlan'
        ? 'play'
        : s === 'friends'
          ? 'friends'
          : s === 'me'
            ? 'me'
            : 'race';

const isPostId = (id: string | null): id is `t3_${string}` =>
  id !== null && id.startsWith('t3_');

const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';

export const App = () => {
  const [data, setData] = useState<InitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('plan');
  const [back, setBack] = useState<Screen>('plan');
  const [busy, setBusy] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [dashBoard, setDashBoard] = useState<DashBoard | null>(null);
  const [dashLast, setDashLast] = useState<DashResult | null>(null);
  const [playGame, setPlayGame] = useState<PlayGame>('dash');
  const [guess, setGuess] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [topClubs, setTopClubs] = useState<ClubRow[]>([]);
  const [topRelays, setTopRelays] = useState<RelayRow[]>([]);
  const [meData, setMeData] = useState<MeResponse | null>(null);

  const load = useCallback(
    () =>
      request<InitResponse>('/init')
        .then((init) => {
          setError(null);
          setData(init);
          setScreen(
            init.dateKey !== init.today
              ? 'closed'
              : init.myRun
                ? 'result'
                : !init.profile.registered && init.profile.username !== 'guest'
                  ? 'register'
                  : 'plan'
          );
        })
        .catch((e: unknown) => setError(message(e))),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);
  // Fetch the 3D race in idle time once the first screen is up.
  useEffect(() => {
    if (!data) return;
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 600));
    idle(() => preloadRace());
  }, [data]);

  const day = useMemo(() => (data ? dayInfo(data.dateKey) : null), [data]);
  useEffect(() => {
    if (day) applyCityTheme(day.city);
  }, [day]);

  // The runners who were on the road during the player's own run, for the replay.
  const replayRivals = useMemo(() => {
    if (!data?.myRun) return [];
    const byName = new Map(data.runners.map((g) => [g.username, g]));
    return (data.myRun.rivals ?? []).flatMap((n) => {
      const g = byName.get(n);
      return g ? [g] : [];
    });
  }, [data]);

  const patch = (next: Partial<InitResponse>) =>
    setData((d) => (d ? { ...d, ...next } : d));

  const [livePlan, setLivePlan] = useState<Plan | null>(null);

  const startRun = (plan: Plan) => {
    if (!data) return;
    if (data.profile.username === 'guest') {
      showLoginPrompt();
      showToast('Log in to Reddit to run.');
      return;
    }
    setLivePlan(plan);
    setScreen('corral');
  };

  const registerRunner = async (choice: {
    skin: number;
    hair: number;
    hairStyle: number;
    top: string;
    pet: PetChoice;
  }) => {
    if (!data) return;
    setBusy(true);
    try {
      const { pet, ...look } = choice;
      const res = await request<ProfileResponse>('/register', {
        ...look,
        journeyId: data.journeyId,
      });
      let profile = res.profile;
      if (pet !== profile.look.pet) {
        const petRes = await request<ProfileResponse>('/pet/choose', {
          petId: pet,
          journeyId: data.journeyId,
        });
        profile = petRes.profile;
      }
      patch({ profile });
      if (res.message) showToast(res.message);
      setScreen('plan');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  // The race was run on the client; the server replays it and records the official time.
  const submitRun = async (plan: Plan, outcome: RaceOutcome) => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await request<RunResponse>('/run', {
        plan,
        moves: outcome.moves,
        rivals: outcome.rivals,
        chat: outcome.chat,
        guess,
        journeyId: data.journeyId,
      });
      patch({
        myRun: res.run,
        profile: res.profile,
        leaderboard: res.leaderboard,
        weekly: res.weekly,
        crew: res.crew,
        myRank: res.run.rank,
        totalRunners: res.run.totalRunners,
      });
      setJustFinished(true);
      setLivePlan(null);
      // Running finishes quests: pick up the new progress for the tab dot.
      request<QuestsResponse>('/quests')
        .then((r) => patch({ quests: r.quests }))
        .catch(() => undefined);
      setScreen('result');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
      setLivePlan(null);
      if (e instanceof ApiError && e.status === 409) void load();
      else setScreen('plan');
    } finally {
      setBusy(false);
    }
  };

  // ---- World Tour
  const [tourStops, setTourStops] = useState<TourRow[] | null>(null);
  const [tourId, setTourId] = useState<string | null>(null);
  const [tourGhosts, setTourGhosts] = useState<RunnerTrack[]>([]);
  const [tourPlan, setTourPlan] = useState<Plan | null>(null);
  const [tourResult, setTourResult] = useState<TourRunResponse | null>(null);
  const tourStopNow = tourId ? tourById(tourId) : undefined;
  const tourDayNow = useMemo(
    () => (tourStopNow ? tourDay(tourStopNow) : null),
    [tourStopNow]
  );

  const openTour = () => {
    setTourResult(null);
    setScreen('tour');
    request<TourResponse>('/tour')
      .then((r) => {
        setTourStops(r.stops);
        patch({ profile: r.profile });
      })
      .catch((e: unknown) => showToast(message(e)));
  };

  const unlockTour = async (id: string) => {
    setBusy(true);
    try {
      const r = await request<TourResponse>('/tour/unlock', { id });
      setTourStops(r.stops);
      patch({ profile: r.profile });
      showToast('Unlocked! Run it any time.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  const pickTour = async (id: string) => {
    setBusy(true);
    try {
      const r = await request<TourStopResponse>(
        `/tour/stop?id=${encodeURIComponent(id)}`
      );
      setTourGhosts(r.runners);
      setTourId(id);
      setTourResult(null);
      preloadRace();
      setScreen('tourPlan');
    } catch (e) {
      showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  const submitTour = async (plan: Plan, outcome: RaceOutcome) => {
    if (!tourId) return;
    setBusy(true);
    try {
      const r = await request<TourRunResponse>('/tour/run', {
        id: tourId,
        plan,
        moves: outcome.moves,
        rivals: outcome.rivals,
      });
      patch({ profile: r.profile });
      setTourResult(r);
      setTourPlan(null);
      request<TourResponse>('/tour')
        .then((l) => setTourStops(l.stops))
        .catch(() => undefined);
      setScreen('tour');
    } catch (e) {
      showToast(message(e));
      setTourPlan(null);
      setScreen('tourPlan');
    } finally {
      setBusy(false);
    }
  };

  const profileCall = async (path: string, body: object) => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await request<ProfileResponse>(path, {
        ...body,
        journeyId: data.journeyId,
      });
      patch({ profile: res.profile });
      if (res.message) showToast(res.message);
      if (path === '/shop/buy' || path === '/pet/choose' || path === '/checkin')
        sfx.snack();
      else if (path === '/pet/care' || path === '/cheer') sfx.highFive();
      else sfx.chat();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  const vote = async (cityId: NextCityId) => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await request<VoteResponse>('/vote', {
        cityId,
        journeyId: data.journeyId,
      });
      patch({ vote: res.vote });
      showToast(res.message);
      sfx.snack();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshQuests = () => {
    if (!data || data.profile.username === 'guest') return;
    request<QuestsResponse>('/quests')
      .then((r) => patch({ quests: r.quests, profile: r.profile }))
      .catch(() => undefined);
  };

  const claimQuest = async (questId: string) => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await request<QuestsResponse>('/quest/claim', {
        questId,
        journeyId: data.journeyId,
      });
      patch({ quests: res.quests, profile: res.profile });
      if (res.message) showToast(res.message);
      sfx.snack();
    } catch (e) {
      showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  const applyFriends = (r: FriendsResponse) => {
    patch({ friends: r.friends, profile: r.profile });
    setSuggestions(r.suggestions);
    if (r.message) showToast(r.message);
  };

  const loadFriends = () => {
    if (!data || data.profile.username === 'guest') return;
    request<FriendsResponse>('/friends')
      .then(applyFriends)
      .catch(() => undefined);
  };

  const friendCall = async (path: string, username: string) => {
    if (!data) return;
    setBusy(true);
    try {
      applyFriends(
        await request<FriendsResponse>(path, {
          username,
          journeyId: data.journeyId,
        })
      );
      if (path === '/friends/add') sfx.highFive();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  const applyClub = (r: ClubResponse) => {
    patch({ club: r.club, profile: r.profile });
    setTopClubs(r.top);
    setTopRelays(r.relays);
    if (r.message) showToast(r.message);
  };

  const clubCall = async (path: string, body: object) => {
    if (!data) return;
    setBusy(true);
    try {
      applyClub(
        await request<ClubResponse>(path, {
          ...body,
          journeyId: data.journeyId,
        })
      );
      if (path !== '/club/leave') sfx.snack();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  const loadDashBoard = (game: PlayGame = playGame) =>
    (game === 'dash'
      ? request<DashBoardResponse>('/dash')
      : request<ArcadeBoardResponse>(`/arcade?game=${game}`)
    )
      .then((r) => setDashBoard(r.board))
      .catch(() => undefined);

  const submitArcade = async (
    game: ArcadeId,
    round: number,
    taps: number[]
  ) => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await request<ArcadeResponse>('/arcade', {
        game,
        round,
        taps,
        journeyId: data.journeyId,
      });
      patch({ profile: res.profile });
      setDashBoard(res.board);
      setDashLast({ score: res.score, reward: res.reward });
    } catch (e) {
      showToast(message(e));
    } finally {
      setBusy(false);
      setScreen('play');
    }
  };

  const submitDash = async (round: number, moves: DashMove[]) => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await request<DashResponse>('/dash', {
        round,
        moves,
        journeyId: data.journeyId,
      });
      patch({ profile: res.profile, quests: res.quests });
      setDashBoard(res.board);
      setDashLast({ score: res.score, reward: res.reward });
    } catch (e) {
      showToast(message(e));
    } finally {
      setBusy(false);
      setScreen('play');
    }
  };

  const share = async () => {
    if (!data?.myRun) return;
    setBusy(true);
    try {
      const res = await request<ShareResponse>('/share', {
        journeyId: data.journeyId,
      });
      if (res.commentPosted) {
        const run: RunRecord = { ...data.myRun, shared: true };
        patch({ myRun: run });
        showToast('Posted your result in the comments');
      } else {
        await navigator.clipboard?.writeText(res.text).catch(() => undefined);
        showToast('Copied your result. Paste it in the comments!');
      }
    } catch (e) {
      showToast(message(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-[22px] font-extrabold">
          The course is not loading.
        </p>
        <p className="text-[14px] text-ink-soft">{error}</p>
        <button
          type="button"
          className="chunky rounded-2xl bg-white px-4 py-2 font-extrabold"
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data || !day) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-display text-[22px] font-extrabold">Warming up…</p>
      </div>
    );
  }

  const openLocker = () => {
    setBack(screen);
    setScreen('locker');
  };

  const loadMe = () => {
    if (data.profile.username === 'guest') {
      setMeData({
        type: 'me',
        profile: data.profile,
        history: [],
        achievements: [],
        earned: [],
      });
      return;
    }
    request<MeResponse>('/me')
      .then((r) => {
        setMeData(r);
        setData((d) => (d ? { ...d, profile: r.profile } : d));
        for (const id of r.earned) {
          const a = achievementById(id);
          if (a) showToast(`🏆 ${a.name}! +${a.reward} coins`);
        }
      })
      .catch((e: unknown) => showToast(message(e)));
  };

  const goTab = (tab: Tab) => {
    if (tab === 'race') setScreen(data.myRun ? 'result' : 'plan');
    else if (tab === 'shop') openLocker();
    else if (tab === 'friends') {
      loadFriends();
      if (data.profile.username !== 'guest')
        request<ClubResponse>('/club')
          .then(applyClub)
          .catch(() => undefined);
      setScreen('friends');
    } else if (tab === 'play') {
      void loadDashBoard();
      setScreen('play');
    } else if (tab === 'quests') {
      refreshQuests();
      setScreen('quests');
    } else if (tab === 'me') {
      loadMe();
      setScreen('me');
    }
  };

  const view = (() => {
    switch (screen) {
      case 'closed':
        return (
          <div className="flex h-full flex-col gap-3 px-4 py-4 max-w-[440px] mx-auto">
            <p className="text-[13px] font-extrabold text-ink-soft">
              {day.city.flag} {day.city.name}, stage {day.stageIndex + 1}
            </p>
            <h1 className="font-display text-[28px] font-extrabold leading-tight">
              {day.stage.name} has closed.
            </h1>
            <p className="text-[14px]">
              These were the fastest runners that day. Today’s stage is open
              now.
            </p>
            {isPostId(data.todayPostId) && (
              <button
                type="button"
                onClick={() =>
                  isPostId(data.todayPostId) && navigateToPost(data.todayPostId)
                }
                className="chunky rounded-2xl bg-[var(--accent)] py-3 font-display text-[20px] font-extrabold text-white"
              >
                Go to today’s stage
              </button>
            )}
            <section className="rounded-2xl border-2 border-ink bg-white/80 p-2">
              <Leaderboard
                rows={data.leaderboard}
                me={data.profile.username}
                myRank={data.myRank}
                canCheer={false}
              />
            </section>
          </div>
        );
      case 'register':
        return (
          <RegisterScreen
            day={day}
            profile={data.profile}
            busy={busy}
            onRegister={(c) => void registerRunner(c)}
          />
        );
      case 'corral':
        return (
          <CorralScreen
            day={day}
            profile={data.profile}
            runners={data.runners}
            projected={
              livePlan
                ? simulate(
                    day.stage,
                    day.weather.id,
                    livePlan,
                    day.time,
                    isTriathlon(day)
                  ).totalSeconds
                : 0
            }
            onGo={(g) => {
              setGuess(g);
              setScreen('run');
            }}
            onBack={() => setScreen('plan')}
          />
        );
      case 'run':
        if (livePlan) {
          return (
            <RunScreen
              day={day}
              profile={data.profile}
              plan={livePlan}
              rivals={data.runners}
              mode="live"
              firstRun={data.profile.totalRuns === 0}
              clubmates={data.club?.members.map((m) => m.username) ?? []}
              quickChat={data.settings.quickChat}
              roadLife={data.settings.roadLife}
              saving={busy}
              onFinish={(outcome) => void submitRun(livePlan, outcome)}
            />
          );
        }
        return data.myRun ? (
          <RunScreen
            day={day}
            profile={data.profile}
            plan={data.myRun.plan}
            rivals={replayRivals}
            mode="replay"
            replayMoves={data.myRun.moves}
            {...(data.myRun.chat ? { replayChat: data.myRun.chat } : {})}
            firstRun={false}
            roadLife={data.settings.roadLife}
            onFinish={() => setScreen('result')}
          />
        ) : null;
      case 'result':
        return data.myRun ? (
          <ResultScreen
            day={day}
            today={data.today}
            profile={data.profile}
            run={data.myRun}
            leaderboard={data.leaderboard}
            myRank={data.myRank}
            crew={data.crew}
            cheersReceived={data.cheersReceived}
            justFinished={justFinished}
            sharing={busy}
            onShare={() => void share()}
            onLocker={openLocker}
            onReplay={() => setScreen('run')}
            onCheer={(username) => void profileCall('/cheer', { username })}
            weekly={data.weekly}
            friends={data.friends}
            vote={data.vote}
            voting={busy}
            onVote={(cityId) => void vote(cityId)}
          />
        ) : null;
      case 'locker':
        return (
          <LockerScreen
            day={day}
            today={data.today}
            profile={data.profile}
            busy={busy}
            onBack={() => setScreen(back === 'locker' ? 'plan' : back)}
            onEquip={(itemId) => void profileCall('/shop/equip', { itemId })}
            onBuy={(itemId) => void profileCall('/shop/buy', { itemId })}
            onPet={(petId: PetChoice) =>
              void profileCall('/pet/choose', { petId })
            }
            onCare={() => void profileCall('/pet/care', {})}
          />
        );
      case 'me':
        return <MeScreen me={meData} today={data.today} />;
      case 'friends':
        return (
          <FriendsScreen
            profile={data.profile}
            friends={data.friends}
            suggestions={suggestions}
            busy={busy}
            onAdd={(u) => void friendCall('/friends/add', u)}
            onRemove={(u) => void friendCall('/friends/remove', u)}
          >
            <ClubSection
              profile={data.profile}
              club={data.club}
              top={topClubs}
              relays={topRelays}
              busy={busy}
              onCreate={(adjective, noun) =>
                void clubCall('/club/create', { adjective, noun })
              }
              onJoin={(code) => void clubCall('/club/join', { code })}
              onLeave={() => void clubCall('/club/leave', {})}
            />
          </FriendsScreen>
        );
      case 'tour':
        return (
          <TourScreen
            profile={data.profile}
            stops={tourStops}
            busy={busy}
            result={tourResult}
            onUnlock={(id) => void unlockTour(id)}
            onRun={(id) => void pickTour(id)}
            onBack={() => setScreen('play')}
          />
        );
      case 'tourPlan':
        return tourDayNow && tourStopNow ? (
          <PlanScreen
            key={tourStopNow.id}
            day={tourDayNow}
            profile={data.profile}
            tour={{
              label: `${tourStopNow.flag} World Tour`,
              stopId: tourStopNow.id,
              onBack: () => setScreen('tour'),
            }}
            roadLife={data.settings.roadLife}
            starting={busy}
            onStart={(plan) => {
              if (data.profile.username === 'guest') {
                showLoginPrompt();
                return;
              }
              setTourPlan(plan);
              setScreen('tourRun');
            }}
            onLocker={openLocker}
          />
        ) : null;
      case 'tourRun':
        return tourDayNow && tourPlan ? (
          <RunScreen
            day={tourDayNow}
            profile={data.profile}
            plan={tourPlan}
            rivals={tourGhosts}
            mode="live"
            firstRun={false}
            quickChat={false}
            roadLife={data.settings.roadLife}
            saving={busy}
            onFinish={(outcome) => void submitTour(tourPlan, outcome)}
          />
        ) : null;
      case 'play':
        return (
          <PlayScreen
            today={data.today}
            profile={data.profile}
            game={playGame}
            board={dashBoard}
            last={dashLast}
            busy={busy}
            onSelect={(g) => {
              setPlayGame(g);
              setDashLast(null);
              setDashBoard(null);
              void loadDashBoard(g);
            }}
            onPlay={() => {
              setDashLast(null);
              setScreen(playGame === 'dash' ? 'dash' : 'arcade');
            }}
            onTour={openTour}
          />
        );
      case 'arcade': {
        if (playGame === 'dash') return null;
        const d = data.profile.arcade[playGame];
        const round = d && d.date === data.today ? d.plays : 0;
        return (
          <ArcadeGame
            game={playGame}
            dateKey={data.today}
            round={round}
            look={data.profile.look}
            bib={data.profile.bib}
            onDone={(taps) => void submitArcade(playGame, round, taps)}
          />
        );
      }
      case 'dash': {
        const round =
          data.profile.dash.date === data.today ? data.profile.dash.plays : 0;
        return (
          <DashGame
            dateKey={data.today}
            round={round}
            look={data.profile.look}
            bib={data.profile.bib}
            onDone={(moves) => void submitDash(round, moves)}
          />
        );
      }
      case 'quests':
        return (
          <QuestsScreen
            today={data.today}
            profile={data.profile}
            busy={busy}
            onCheckIn={() => void profileCall('/checkin', {})}
          >
            <QuestList
              quests={data.quests}
              busy={busy}
              onClaim={(id) => void claimQuest(id)}
            />
          </QuestsScreen>
        );
      case 'plan':
        return (
          <PlanScreen
            day={day}
            profile={data.profile}
            crew={data.crew}
            totalRunners={data.totalRunners}
            yesterday={data.yesterday}
            roadLife={data.settings.roadLife}
            starting={busy}
            onStart={startRun}
            onLocker={openLocker}
          />
        );
    }
  })();

  if (!HUB.includes(screen))
    return <Suspense fallback={<Warming />}>{view}</Suspense>;
  const guest = data.profile.username === 'guest';
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">{view}</div>
      <TabBar
        active={tabOf(screen)}
        tabs={SHIPPED_TABS}
        dots={{
          quests:
            !guest &&
            (data.profile.checkInDate !== data.today ||
              data.quests.some((q) => !q.claimed && q.progress >= q.goal)),
        }}
        onTab={goTab}
      />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
