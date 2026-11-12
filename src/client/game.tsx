import './index.css';

import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { navigateToPost, showLoginPrompt, showToast } from '@devvit/web/client';
import type {
  InitResponse,
  ProfileResponse,
  RunRecord,
  RunResponse,
  ShareResponse,
} from '../shared/api';
import { dayInfo } from '../shared/content';
import type { PetId } from '../shared/economy';
import type { Plan } from '../shared/sim';
import { ApiError, request } from './lib/api';
import { applyCityTheme } from './lib/theme';
import { Leaderboard } from './components/Leaderboard';
import { LockerScreen } from './screens/LockerScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ResultScreen } from './screens/ResultScreen';
import { RunScreen, type RaceOutcome } from './screens/RunScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { CorralScreen } from './screens/CorralScreen';

type Screen =
  'register' | 'plan' | 'corral' | 'run' | 'result' | 'locker' | 'closed';

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
    pet: PetId;
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
        journeyId: data.journeyId,
      });
      patch({
        myRun: res.run,
        profile: res.profile,
        leaderboard: res.leaderboard,
        crew: res.crew,
        myRank: res.run.rank,
        totalRunners: res.run.totalRunners,
      });
      setJustFinished(true);
      setLivePlan(null);
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
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) showLoginPrompt();
      else showToast(message(e));
    } finally {
      setBusy(false);
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
            These were the fastest runners that day. Today’s stage is open now.
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
          onGo={() => setScreen('run')}
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
          onPet={(petId: PetId) => void profileCall('/pet/choose', { petId })}
          onCare={() => void profileCall('/pet/care', {})}
        />
      );
    case 'plan':
      return (
        <PlanScreen
          day={day}
          profile={data.profile}
          crew={data.crew}
          totalRunners={data.totalRunners}
          starting={busy}
          onStart={startRun}
          onLocker={openLocker}
        />
      );
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
