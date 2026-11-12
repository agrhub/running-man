import { useEffect, useRef, useState } from 'react';
import type { GhostRun, Profile, RunRecord } from '../../shared/api';
import type { DayInfo } from '../../shared/content';
import {
  checkpoints,
  distanceAt,
  formatTime,
  type Pace,
} from '../../shared/sim';
import { RunWorld, type Positions, type Runner } from '../three/world';

type Props = {
  day: DayInfo;
  profile: Profile;
  run: RunRecord;
  ghosts: GhostRun[];
  onFinish: () => void;
};

type Hud = {
  simT: number;
  km: number;
  stamina: number;
  place: number;
  field: number;
  toast: { title: string; body: string } | null;
};

const REAL_SECONDS = 34;
const GHOST_LANES = [-0.75, 0.75, -0.4, 0.4, -1, 1, -0.55, 0.55];
const PACE_SPEED: Record<Pace, number> = { easy: 0.35, steady: 0.65, push: 1 };

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export const RunScreen = ({ day, profile, run, ghosts, onFinish }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<Hud>({
    simT: 0,
    km: 0,
    stamina: 100,
    place: 1,
    field: ghosts.length + 1,
    toast: null,
  });
  const [fast, setFast] = useState(false);
  const fastRef = useRef(false);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    fastRef.current = fast;
  }, [fast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runners: Runner[] = [
      ...ghosts.map((g, i) => ({
        name: g.username,
        look: g.look,
        ghost: true,
        lane: GHOST_LANES[i % GHOST_LANES.length] ?? 0.5,
        labelled: i < 3,
      })),
      {
        name: '__me',
        look: profile.look,
        ghost: false,
        lane: 0,
        labelled: true,
      },
    ];
    const world = new RunWorld({
      canvas,
      city: day.city,
      stage: day.stage,
      runners,
    });
    const myMarks = checkpoints(run.splits);
    const timeScale = run.seconds / REAL_SECONDS;
    const toasts: { at: number; title: string; body: string }[] = [
      {
        at: day.stage.landmark.km - 0.55,
        title: `📍 ${day.stage.landmark.name}`,
        body: day.stage.landmark.blurb,
      },
      ...run.splits
        .filter((s) => s.drank)
        .map((s) => ({
          at: s.km - 0.02,
          title: '💧 Water!',
          body: 'Stamina topped up.',
        })),
      ...run.splits
        .filter((s) => s.walked > 0)
        .slice(0, 1)
        .map((s) => ({
          at: s.km - 1 + (1 - s.walked),
          title: '😮‍💨 Out of gas',
          body: 'Walking until the legs come back.',
        })),
    ].sort((a, b) => a.at - b.at);

    let simT = 0;
    let animT = 0;
    let last = performance.now();
    let finishedAt: number | null = null;
    let toastUntil = 0;
    let toastIndex = 0;
    let lastHud = 0;
    let currentToast: Hud['toast'] = null;
    let gaze = 0;
    let raf = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      animT += dt;
      // Slow motion while passing the landmark, so it can actually be seen.
      const toLandmark = day.stage.landmark.km - distanceAt(myMarks, simT);
      const nearLandmark = toLandmark < 0.6 && toLandmark > 0.05;
      const speedUp = fastRef.current ? 3 : nearLandmark ? 0.3 : 1;
      simT = Math.min(run.seconds + 4, simT + dt * timeScale * speedUp);

      const myKm = distanceAt(myMarks, simT);
      const kmIndex = Math.min(5, Math.floor(myKm));
      const split = run.splits[kmIndex];
      const done = simT >= run.seconds;
      let mySpeed = 0;
      if (!done && split) {
        const intoKm = myKm - kmIndex;
        mySpeed =
          split.walked > 0 && intoKm > 1 - split.walked
            ? 0.12
            : PACE_SPEED[split.pace];
      }
      const positions: Positions = [{ name: '__me', km: myKm, speed: mySpeed }];
      let ahead = 0;
      for (const g of ghosts) {
        const km = distanceAt(g.marks, simT);
        const gi = Math.min(5, Math.floor(km));
        const gs = (g.marks[gi + 1] ?? 0) - (g.marks[gi] ?? 0);
        const speed =
          km >= 6 ? 0 : Math.max(0.2, Math.min(1, (372 - gs) / 100 + 0.3));
        positions.push({ name: g.username, km, speed });
        if (km > myKm || (km >= 6 && g.seconds < run.seconds)) ahead++;
      }
      // Look towards the landmark on the approach: ease in from 0.75 km out, ease out as the runner reaches it.
      const lmLeft = day.stage.landmark.km - myKm;
      const raw =
        lmLeft > 0.75 || lmLeft < -0.05
          ? 0
          : lmLeft > 0.45
            ? (0.75 - lmLeft) / 0.3
            : lmLeft > 0.12
              ? 1
              : (lmLeft + 0.05) / 0.17;
      gaze += (Math.max(0, Math.min(1, raw)) - gaze) * Math.min(1, dt * 3);
      world.frame(animT, positions, '__me', done, fastRef.current ? 0 : gaze);

      const next = toasts[toastIndex];
      if (next && myKm >= next.at) {
        currentToast = { title: next.title, body: next.body };
        toastUntil = animT + (next.title.startsWith('📍') ? 4.5 : 1.8);
        toastIndex++;
      }
      if (currentToast && animT > toastUntil) currentToast = null;

      if (now - lastHud > 90 || done) {
        lastHud = now;
        const prev =
          kmIndex === 0 ? 100 : (run.splits[kmIndex - 1]?.stamina ?? 100);
        const end = split?.stamina ?? 0;
        const frac = myKm - kmIndex;
        setHud({
          simT: Math.min(simT, run.seconds),
          km: Math.min(6, myKm),
          stamina: done ? end : prev + (end - prev) * frac,
          place: ahead + 1,
          field: ghosts.length + 1,
          toast: currentToast,
        });
      }

      if (done && finishedAt === null) finishedAt = animT;
      if (finishedAt !== null && animT - finishedAt > 1.6) {
        finishRef.current();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      world.dispose();
    };
  }, [day, profile.look, run, ghosts]);

  const finished = hud.km >= 6;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Race animation"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="bib px-3 py-1.5">
          <p className="font-display text-[26px] font-extrabold leading-none tabular">
            {formatTime(hud.simT)}
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
            of {hud.field} on screen
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
          className="pop-in pointer-events-none absolute left-3 right-3 top-[110px] mx-auto max-w-[360px] bib px-3 py-2"
        >
          <p className="font-display text-[17px] font-extrabold leading-tight">
            {hud.toast.title}
          </p>
          <p className="text-[13px] leading-snug">{hud.toast.body}</p>
        </div>
      )}
      {finished && (
        <p className="stamp pointer-events-none absolute inset-x-0 top-[42%] text-center font-display text-[56px] font-extrabold text-[var(--accent)] [text-shadow:0_3px_0_#2a2340]">
          Finished!
        </p>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 p-3">
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
          onClick={onFinish}
          className="chunky rounded-full bg-white px-4 py-1.5 text-[14px] font-extrabold"
        >
          Skip to results
        </button>
      </div>
    </div>
  );
};
