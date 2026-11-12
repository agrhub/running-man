import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { RunnerTrack, Profile } from '../../shared/api';
import type { DayInfo } from '../../shared/content';
import { ITEM_LABEL, courseItems, type Lane } from '../../shared/course';
import {
  RACE_DT,
  finishRace,
  laneAtTime,
  rivalKm,
  startLane,
  startRace,
  stepRace,
  type Move,
  type RaceEvent,
  type RaceSetup,
  type RaceState,
  type Rival,
} from '../../shared/race';
import {
  checkpoints,
  formatTime,
  simulate,
  type Pace,
  type Plan,
} from '../../shared/sim';
import {
  CHAT_GAP_STEPS,
  MAX_CHATS,
  QUICK_CHAT,
  REACTIONS,
  type Chat,
} from '../../shared/chat';
import { RunWorld, type Positions, type Runner } from '../three/world';

export type RaceOutcome = {
  moves: Move[];
  rivals: string[];
  seconds: number;
  chat: Chat[];
};

type Props = {
  day: DayInfo;
  profile: Profile;
  plan: Plan;
  /** Other runners on the road. */
  rivals: RunnerTrack[];
  /** Live: the player steers. Replay: the recorded lane changes drive the runner. */
  mode: 'live' | 'replay';
  replayMoves?: Move[];
  /** Your own chat lines, replayed with your run. */
  replayChat?: Chat[];
  firstRun: boolean;
  saving?: boolean;
  onFinish: (outcome: RaceOutcome) => void;
};

type Toast = { title: string; body: string; tone: 'good' | 'bad' | 'info' };

type Hud = {
  t: number;
  km: number;
  stamina: number;
  place: number;
  field: number;
  toast: Toast | null;
  countdown: number;
};

const LIVE_SECONDS = 60;
const REPLAY_SECONDS = 34;
const PACE_SPEED: Record<Pace, number> = { easy: 0.35, steady: 0.65, push: 1 };
const OFFSETS = [
  -0.45, 0.45, -0.2, 0.2, 0, -0.35, 0.35, 0.1, -0.1, 0.3, -0.3, 0.05,
];

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

const eventToast = (e: RaceEvent): Toast => {
  if (e.kind === 'bump') {
    const body = `You both fell and lose ${e.seconds}s each.`;
    return e.atFault
      ? { title: `💥 You ran into u/${e.rival}`, body, tone: 'bad' }
      : { title: `💥 u/${e.rival} ran into you`, body, tone: 'bad' };
  }
  if (
    e.kind === 'bottle' ||
    e.kind === 'soda' ||
    e.kind === 'cake' ||
    e.kind === 'candy'
  ) {
    const what = {
      bottle: '💧 Water bottle',
      soda: '🥤 Soda',
      cake: '🍰 Cake',
      candy: '🍬 Candy',
    }[e.kind];
    return {
      title: `${what}!`,
      body: `Burst of speed: ${e.seconds}s`,
      tone: 'good',
    };
  }
  if (e.kind === 'fan')
    return {
      title: '🙌 High five!',
      body: `A burst of speed: ${e.seconds}s`,
      tone: 'good',
    };
  const icon = e.kind === 'cone' ? '🚧' : e.kind === 'puddle' ? '💦' : '🥤';
  return {
    title: `${icon} ${ITEM_LABEL[e.kind]}!`,
    body: `You stumble. +${e.seconds}s`,
    tone: 'bad',
  };
};

export const RunScreen = ({
  day,
  profile,
  plan,
  rivals,
  mode,
  replayMoves,
  replayChat,
  firstRun,
  saving,
  onFinish,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = mode === 'live';
  const [hud, setHud] = useState<Hud>({
    t: 0,
    km: 0,
    stamina: 100,
    place: 1,
    field: rivals.length + 1,
    toast: null,
    countdown: live ? 3 : 0,
  });
  const [fast, setFast] = useState(false);
  const [showHelp, setShowHelp] = useState(live && firstRun);
  const fastRef = useRef(false);
  const laneRef = useRef<Lane>(startLane(profile.username));
  const skipRef = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatRef = useRef<Chat[]>([]);
  const stepRef = useRef(0);
  const worldRef = useRef<RunWorld | null>(null);

  const sayLine = (line: number) => {
    setChatOpen(false);
    const step = stepRef.current;
    const last = chatRef.current.at(-1);
    if (last && step - last.step < CHAT_GAP_STEPS) return;
    if (chatRef.current.length >= MAX_CHATS) return;
    chatRef.current.push({ step, line });
    worldRef.current?.say('__me', QUICK_CHAT[line] ?? '');
  };
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    fastRef.current = fast;
  }, [fast]);
  // The steering hint goes away on the first swipe, or after a few seconds.
  useEffect(() => {
    if (!showHelp) return;
    const id = window.setTimeout(() => setShowHelp(false), 9000);
    return () => window.clearTimeout(id);
  }, [showHelp]);

  const steer = (dir: -1 | 1) => {
    if (!live) return;
    setShowHelp(false);
    const next = laneRef.current + dir;
    laneRef.current = next <= -1 ? -1 : next >= 1 ? 1 : 0;
  };
  const steerRef = useRef(steer);
  useEffect(() => {
    steerRef.current = steer;
  });

  // Keyboard: arrows or A / D
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        steerRef.current(-1);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        steerRef.current(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sim = simulate(day.stage, day.weather.id, plan);
    const rivalList: Rival[] = rivals.map((g) => ({
      username: g.username,
      marks: g.marks,
      ...(g.moves ? { moves: g.moves } : {}),
    }));
    const setup: RaceSetup = {
      base: checkpoints(sim.splits),
      items: courseItems(day.dateKey, day.stage, day.weather.id),
      rivals: rivalList,
      startLane: startLane(profile.username),
    };
    const runners: Runner[] = [
      ...rivals.map((g, i) => ({
        name: g.username,
        look: g.look,
        bib: g.bib ?? null,
        other: true,
        offset: OFFSETS[i % OFFSETS.length] ?? 0,
        labelled: i < 5,
      })),
      {
        name: '__me',
        look: profile.look,
        bib: profile.bib,
        other: false,
        labelled: true,
      },
    ];
    chatRef.current = [];
    const world = new RunWorld({
      canvas,
      city: day.city,
      stage: day.stage,
      runners,
      items: setup.items,
    });
    const state: RaceState = startRace(setup.startLane ?? 0);
    const total = setup.base[setup.base.length - 1] ?? 1;
    const timeScale = total / (live ? LIVE_SECONDS : REPLAY_SECONDS);
    const lm = day.stage.landmark;
    let lmShown = false;
    const shownDrinks = new Set<number>();

    let animT = 0;
    let last = -1;
    let budget = 0;
    let countdown = live ? 2.4 : 0;
    let finishedAt: number | null = null;
    let toast: Toast | null = null;
    let toastUntil = 0;
    let lastHud = 0;
    let gaze = 0;
    let replayIndex = 0;
    let raf = 0;
    let reported = false;
    worldRef.current = world;
    const chatIndex = new Map<string, number>();
    let myChatIndex = 0;
    const pick = (lines: readonly string[], n: number) =>
      lines[n % lines.length] ?? lines[0] ?? '';

    const show = (t: Toast, seconds: number) => {
      toast = t;
      toastUntil = animT + seconds;
    };

    const handle = (events: RaceEvent[]) => {
      for (const e of events) {
        if (e.kind === 'bump') {
          world.say(e.rival, pick(REACTIONS.bumped, e.step));
          world.fall('__me');
          world.fall(e.rival);
        } else {
          world.hitItem(e.item);
        }
        show(eventToast(e), 1.8);
      }
    };

    const loop = (now: number) => {
      if (last < 0) last = now;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      animT += dt;

      if (countdown > 0) {
        countdown -= dt;
      } else if (!state.done) {
        if (skipRef.current) {
          const before = state.events.length;
          finishRace(state, setup);
          handle(state.events.slice(before).slice(-1));
        } else {
          budget += dt * timeScale * (fastRef.current ? 3 : 1);
          let guard = 0;
          while (budget >= RACE_DT && !state.done && guard++ < 60) {
            budget -= RACE_DT;
            let lane: Lane | undefined;
            if (live) lane = laneRef.current;
            else if (replayMoves) {
              while (
                replayIndex < replayMoves.length &&
                (replayMoves[replayIndex]?.step ?? Infinity) <= state.step
              ) {
                lane = replayMoves[replayIndex]?.lane;
                replayIndex += 1;
              }
            }
            handle(stepRace(state, setup, lane));
          }
        }
      }

      const kmIndex = Math.min(5, Math.floor(state.km));
      const split = sim.splits[kmIndex];
      const limping = state.debt > 0;
      const mySpeed = state.done
        ? 0
        : limping
          ? 0.2
          : split
            ? PACE_SPEED[split.pace] * (state.debt < 0 ? 1.2 : 1)
            : 0.6;
      const positions: Positions = [
        {
          name: '__me',
          km: state.km,
          speed: countdown > 0 ? 0 : mySpeed,
          lane: state.lane,
          limp: limping,
        },
      ];
      let ahead = 0;
      for (const r of rivalList) {
        const km = rivalKm(state, r);
        const gi = Math.min(5, Math.floor(km));
        const gs = (r.marks[gi + 1] ?? 0) - (r.marks[gi] ?? 0);
        const fallen = (state.rivalDebt[r.username] ?? 0) > 0;
        const speed =
          km >= 6 || countdown > 0
            ? 0
            : fallen
              ? 0.2
              : Math.max(0.2, Math.min(1, (372 - gs) / 100 + 0.3));
        positions.push({
          name: r.username,
          km,
          speed,
          lane: laneAtTime(r.moves, state.t, startLane(r.username)),
          limp: fallen,
        });
        if (km > state.km) ahead++;
      }

      const lmLeft = lm.km - state.km;
      const raw =
        lmLeft > 0.75 || lmLeft < -0.05
          ? 0
          : lmLeft > 0.45
            ? (0.75 - lmLeft) / 0.3
            : lmLeft > 0.12
              ? 1
              : (lmLeft + 0.05) / 0.17;
      gaze += (Math.max(0, Math.min(1, raw)) - gaze) * Math.min(1, dt * 3);
      world.frame(
        animT,
        positions,
        '__me',
        state.done,
        fastRef.current ? 0 : gaze
      );

      if (!lmShown && state.km >= lm.km - 0.55) {
        lmShown = true;
        show({ title: `📍 ${lm.name}`, body: lm.blurb, tone: 'info' }, 4.5);
      }
      for (const s of sim.splits) {
        if (s.drank && state.km >= s.km && !shownDrinks.has(s.km)) {
          shownDrinks.add(s.km);
          if (!toast || toast.tone === 'info')
            show(
              { title: '💧 Water!', body: 'Stamina topped up.', tone: 'good' },
              1.6
            );
        }
      }
      if (toast && animT > toastUntil) toast = null;

      // Lines other runners said at this point of their race, and your own lines in a replay
      stepRef.current = state.step;
      for (const r of rivals) {
        if (!r.chat || r.chat.length === 0) continue;
        const i = chatIndex.get(r.username) ?? 0;
        const c = r.chat[i];
        if (c && state.t >= c.step * RACE_DT) {
          world.say(r.username, QUICK_CHAT[c.line] ?? '');
          chatIndex.set(r.username, i + 1);
        }
      }
      if (!live && replayChat) {
        const c = replayChat[myChatIndex];
        if (c && state.step >= c.step) {
          world.say('__me', QUICK_CHAT[c.line] ?? '');
          myChatIndex += 1;
        }
      }

      if (now - lastHud > 90 || state.done) {
        lastHud = now;
        const prev =
          kmIndex === 0 ? 100 : (sim.splits[kmIndex - 1]?.stamina ?? 100);
        const end = split?.stamina ?? 0;
        const frac = state.km - kmIndex;
        setHud({
          t: state.done ? state.finalSeconds : state.t,
          km: Math.min(6, state.km),
          stamina: state.done ? end : prev + (end - prev) * frac,
          place: ahead + 1,
          field: rivalList.length + 1,
          toast,
          countdown: Math.ceil(Math.max(0, countdown) / 0.8),
        });
      }

      if (state.done && finishedAt === null) finishedAt = animT;
      if (finishedAt !== null && animT - finishedAt > 1.8 && !reported) {
        reported = true;
        finishRef.current({
          moves: state.moves,
          rivals: rivalList.map((r) => r.username),
          seconds: state.finalSeconds,
          chat: chatRef.current,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      worldRef.current = null;
      world.dispose();
    };
  }, [
    day,
    profile.look,
    profile.bib,
    profile.username,
    plan,
    rivals,
    live,
    replayMoves,
    replayChat,
  ]);

  // Swipe to change lanes
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(e.clientY - start.y))
      steer(dx < 0 ? -1 : 1);
  };

  const finished = hud.km >= 6;

  return (
    <div
      className="relative h-full w-full overflow-hidden touch-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Race"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="bib px-3 py-1.5">
          <p className="font-display text-[26px] font-extrabold leading-none tabular">
            {formatTime(hud.t)}
          </p>
          <p className="text-[12px] font-extrabold text-ink-soft tabular">
            {hud.km.toFixed(2)} of 6 km
          </p>
        </div>
        <div className="bib px-3 py-1.5 text-right">
          <p className="font-display text-[26px] font-extrabold leading-none">
            {ordinal(hud.place)}
          </p>
          <p className="text-[12px] font-extrabold text-ink-soft">
            of {hud.field} on the road
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute left-3 right-3 top-[86px]">
        <div
          className="h-3 rounded-full border-2 border-ink bg-white overflow-hidden"
          role="meter"
          aria-label="Stamina"
          aria-valuenow={Math.round(hud.stamina)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${Math.max(0, hud.stamina)}%`,
              background:
                hud.stamina < 25 ? 'var(--color-push)' : 'var(--color-gold)',
            }}
          />
        </div>
      </div>
      {hud.toast && (
        <div
          key={hud.toast.title}
          className={`pop-in pointer-events-none absolute left-3 right-3 top-[110px] mx-auto max-w-[360px] bib px-3 py-2 ${hud.toast.tone === 'bad' ? 'bg-[#fff1ee]' : ''}`}
        >
          <p className="font-display text-[17px] font-extrabold leading-tight">
            {hud.toast.title}
          </p>
          <p className="text-[13px] leading-snug">{hud.toast.body}</p>
        </div>
      )}
      {hud.countdown > 0 && (
        <p
          key={hud.countdown}
          className="stamp pointer-events-none absolute inset-x-0 top-[38%] text-center font-display text-[84px] font-extrabold text-[var(--accent)] [text-shadow:0_4px_0_#2a2340]"
        >
          {hud.countdown}
        </p>
      )}
      {chatOpen && live && !finished && (
        <div
          className="pop-in absolute inset-x-3 bottom-[148px] mx-auto grid max-w-[380px] grid-cols-2 gap-1.5 rounded-2xl border-2 border-ink bg-white/95 p-2"
          role="menu"
          aria-label="Quick chat lines"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {QUICK_CHAT.map((line, i) => (
            <button
              key={line}
              type="button"
              role="menuitem"
              onClick={() => sayLine(i)}
              className="rounded-xl bg-[var(--sky)] px-2 py-1.5 text-left text-[13px] font-extrabold"
            >
              {line}
            </button>
          ))}
        </div>
      )}
      {showHelp && !finished && (
        <div className="pop-in pointer-events-none absolute inset-x-6 bottom-[104px] mx-auto max-w-[340px] rounded-xl bg-ink px-3 py-2 text-center text-[13px] font-bold text-white">
          Swipe or tap ◀ ▶ to change lanes. Dodge cones, high-five fans, and
          overtake other runners in a free lane: run into someone and you both
          fall.
        </div>
      )}
      {finished && (
        <p className="stamp pointer-events-none absolute inset-x-0 top-[42%] text-center font-display text-[56px] font-extrabold text-[var(--accent)] [text-shadow:0_3px_0_#2a2340]">
          {saving ? 'Saving…' : 'Finished!'}
        </p>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        {live ? (
          <>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                steer(-1);
              }}
              className="chunky h-16 w-20 rounded-2xl bg-white font-display text-[30px] font-extrabold"
              aria-label="Move left"
            >
              ◀
            </button>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setShowHelp(false);
                  setChatOpen((o) => !o);
                }}
                className="chunky h-12 w-12 rounded-full bg-gold text-[22px]"
                aria-label="Quick chat"
                aria-expanded={chatOpen}
                disabled={finished || hud.countdown > 0}
              >
                💬
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => (skipRef.current = true)}
                className="chunky rounded-full bg-white px-3 py-1.5 text-[13px] font-extrabold"
                disabled={finished}
              >
                Finish without steering
              </button>
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                steer(1);
              }}
              className="chunky h-16 w-20 rounded-2xl bg-white font-display text-[30px] font-extrabold"
              aria-label="Move right"
            >
              ▶
            </button>
          </>
        ) : (
          <div className="flex w-full justify-center gap-2">
            <button
              type="button"
              onClick={() => setFast((f) => !f)}
              className="chunky rounded-full bg-white px-4 py-1.5 text-[14px] font-extrabold"
              aria-pressed={fast}
            >
              {fast ? 'Normal speed' : 'Fast-forward'}
            </button>
            <button
              type="button"
              onClick={() => (skipRef.current = true)}
              className="chunky rounded-full bg-white px-4 py-1.5 text-[14px] font-extrabold"
            >
              Skip to results
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
