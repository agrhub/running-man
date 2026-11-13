import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ARCADE_INFO,
  FETCH_THROWS,
  FETCH_WINDOW,
  GOOD_MS,
  HURDLE_MS,
  JUMP_MS,
  PERFECT_MS,
  RHYTHM_MS,
  fetchCourse,
  fetchDistance,
  fetchPoints,
  fetchPower,
  hurdleCourse,
  rhythmCourse,
  type ArcadeId,
} from '../../shared/arcade';
import type { Look } from '../../shared/economy';
import { sfx } from '../lib/sound';
import {
  drawPet,
  drawSideRunner,
  fitCanvas,
  popText,
  runnerPaint,
} from '../lib/sprites';

type Props = {
  game: ArcadeId;
  dateKey: string;
  round: number;
  look: Look;
  bib: number | null;
  onDone: (taps: number[]) => void;
};

const COUNTDOWN = 2400;

type Hud = { score: number; note: string; left: number; count: number };

/** The frame every mini game shares: the canvas, a score, time left and a countdown. */
const Frame = ({
  label,
  hud,
  hint,
  onTap,
  canvasRef,
  children,
}: {
  label: string;
  hud: Hud;
  hint: string;
  onTap: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  children?: ReactNode;
}) => (
  <div
    className="relative h-full w-full touch-none select-none overflow-hidden"
    onPointerDown={(e) => {
      e.preventDefault();
      onTap();
    }}
  >
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-label={label}
    />
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
      <div className="bib px-3 py-1.5">
        <p className="font-display text-[26px] font-extrabold leading-none tabular">
          {hud.score}
        </p>
        <p className="text-[12px] font-extrabold text-ink-soft">points</p>
      </div>
      <div className="bib px-3 py-1.5 text-right">
        <p className="font-display text-[26px] font-extrabold leading-none tabular">
          {hud.left}
        </p>
        <p className="text-[12px] font-extrabold text-ink-soft">{hud.note}</p>
      </div>
    </div>
    {hud.count > 0 && (
      <>
        <p
          key={hud.count}
          className="stamp pointer-events-none absolute inset-x-0 top-[34%] text-center font-display text-[84px] font-extrabold text-[var(--accent)] [text-shadow:0_4px_0_#2a2340]"
        >
          {hud.count}
        </p>
        <p className="pointer-events-none absolute inset-x-6 bottom-[110px] mx-auto max-w-[320px] rounded-xl bg-ink px-3 py-2 text-center text-[13px] font-bold text-white">
          {hint}
        </p>
      </>
    )}
    {children}
    <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-display text-[17px] font-extrabold text-ink/70">
      Tap anywhere (or press space)
    </p>
  </div>
);

/** Runs a game loop on rAF with the time since the countdown ended (ms, may be negative). */
const useLoop = (
  draw: (ms: number, dt: number) => boolean,
  deps: unknown[]
) => {
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    let raf = 0;
    let start = -1;
    let last = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const dt = last < 0 ? 0 : Math.min(100, now - last);
      last = now;
      if (drawRef.current(now - start - COUNTDOWN, dt)) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

const useSpace = (onTap: () => void) => {
  const ref = useRef(onTap);
  useEffect(() => {
    ref.current = onTap;
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
};

const countOf = (ms: number) => (ms < 0 ? Math.ceil(-ms / 800) : 0);

// -------------------------------------------------------------- Hurdle Hop

const HurdleHop = ({ dateKey, round, look, bib, onDone }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taps = useRef<number[]>([]);
  const clock = useRef(-COUNTDOWN);
  const [hud, setHud] = useState<Hud>({
    score: 0,
    note: 'round ' + (round + 1),
    left: 20,
    count: 3,
  });
  const tap = () => {
    const ms = Math.round(clock.current);
    if (ms < 0 || ms > HURDLE_MS) return;
    const lastJump = taps.current.at(-1);
    taps.current.push(ms);
    if (lastJump === undefined || ms - lastJump >= JUMP_MS) sfx.jump();
  };
  useSpace(tap);
  const course = useRef(hurdleCourse(dateKey, round));
  const state = useRef({
    score: 0,
    combo: 0,
    judged: 0,
    pops: [] as { text: string; color: string; born: number; x: number }[],
    tripAt: -9999,
    lastCount: 0,
  });
  const paint = runnerPaint(look, bib);

  useLoop(
    (ms) => {
      clock.current = ms;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return false;
      const { w, h } = fitCanvas(canvas, ctx);
      const s = state.current;
      const ground = h * 0.7;
      const rx = w * 0.28;
      const speed = w / 1500; // px per ms: a hurdle crosses the screen in about 1.5 s
      const jumps: number[] = [];
      for (const t of taps.current)
        if (jumps.length === 0 || t - (jumps.at(-1) ?? 0) >= JUMP_MS)
          jumps.push(t);
      const lastJump = jumps.filter((j) => j <= ms).at(-1);
      const air =
        lastJump !== undefined && ms - lastJump < JUMP_MS
          ? (ms - lastJump) / JUMP_MS
          : -1;
      const lift = air >= 0 ? Math.sin(air * Math.PI) * h * 0.16 : 0;

      // Judge hurdles as they reach the runner, by the same rule as the server.
      const hs = course.current;
      while (s.judged < hs.length && (hs[s.judged] ?? 0) <= ms) {
        const hT = hs[s.judged] ?? 0;
        const ok = jumps.some((j) => hT - j >= 90 && hT - j <= 510);
        if (ok) {
          s.combo += 1;
          const pts = 10 * (s.combo >= 10 ? 3 : s.combo >= 5 ? 2 : 1);
          s.score += pts;
          s.pops.push({ text: `+${pts}`, color: '#1f8f7f', born: ms, x: rx });
          sfx.snack();
        } else {
          s.combo = 0;
          s.tripAt = ms;
          s.pops.push({ text: 'Trip!', color: '#e63946', born: ms, x: rx });
          sfx.stumble();
        }
        s.judged += 1;
      }

      // Sky, stands and track
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, '#bfe6ff');
      sky.addColorStop(1, '#fff1df');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const scroll = (Math.max(0, ms) * speed) % 60;
      ctx.fillStyle = '#ffd0dc';
      ctx.fillRect(0, ground - h * 0.32, w, h * 0.14);
      for (let x = -scroll; x < w; x += 22) {
        ctx.fillStyle = ['#ff8fab', '#7ec8e3', '#ffd166', '#95d5b2'][
          Math.abs(Math.round(x + scroll * 7)) % 4
        ]!;
        ctx.beginPath();
        ctx.arc(
          x,
          ground - h * 0.26 + Math.sin((x + ms / 90) / 9) * 2,
          6,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.fillStyle = '#d9534f';
      ctx.fillRect(0, ground, w, h - ground);
      ctx.fillStyle = '#ffffff';
      for (let x = -((Math.max(0, ms) * speed) % 80); x < w; x += 80)
        ctx.fillRect(x, ground + 24, 44, 4);

      // Hurdles
      for (let i = 0; i < hs.length; i++) {
        const x = rx + ((hs[i] ?? 0) - ms) * speed;
        if (x < -40 || x > w + 40) continue;
        const knocked =
          i < s.judged &&
          s.tripAt >= (hs[i] ?? 0) - 1 &&
          s.tripAt <= (hs[i] ?? 0) + 1;
        ctx.save();
        ctx.translate(x, ground);
        if (knocked) ctx.rotate(0.9);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2a2340';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-14, -46, 4, 46);
        ctx.strokeRect(-14, -46, 4, 46);
        ctx.fillRect(10, -46, 4, 46);
        ctx.strokeRect(10, -46, 4, 46);
        ctx.fillStyle = '#ffc23d';
        ctx.fillRect(-18, -50, 36, 9);
        ctx.strokeRect(-18, -50, 36, 9);
        ctx.restore();
      }

      const tripping = ms - s.tripAt < 350;
      drawSideRunner(
        ctx,
        rx,
        ground - lift,
        paint,
        Math.max(0, ms) / 70,
        tripping ? 'trip' : air >= 0 ? 'jump' : ms < 0 ? 'stand' : 'run'
      );
      for (const p of s.pops)
        popText(ctx, p.text, p.x, ground - 130, p.color, (ms - p.born) / 1000);

      const count = countOf(ms);
      if (count !== s.lastCount) {
        if (count > 0) sfx.countdown();
        else sfx.go();
        s.lastCount = count;
      }
      const left = Math.max(0, Math.ceil((HURDLE_MS - Math.max(0, ms)) / 1000));
      setHud((o) =>
        o.score === s.score &&
        o.left === left &&
        o.count === count &&
        o.note === (s.combo > 1 ? `streak ${s.combo}` : 'round ' + (round + 1))
          ? o
          : {
              score: s.score,
              left,
              count,
              note: s.combo > 1 ? `streak ${s.combo}` : 'round ' + (round + 1),
            }
      );
      if (ms > HURDLE_MS + 400) {
        onDone(taps.current);
        return true;
      }
      return false;
    },
    [dateKey, round]
  );
  return (
    <Frame
      label={ARCADE_INFO.hurdle.name}
      hud={hud}
      onTap={tap}
      canvasRef={canvasRef}
      hint="Tap to jump each hurdle as it reaches you. Not too early!"
    />
  );
};

// ------------------------------------------------------------ Rhythm Steps

const RhythmSteps = ({ dateKey, round, look, bib, onDone }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taps = useRef<number[]>([]);
  const clock = useRef(-COUNTDOWN);
  const notes = useRef(rhythmCourse(dateKey, round));
  const state = useRef({
    score: 0,
    combo: 0,
    used: new Set<number>(),
    passed: 0,
    pops: [] as { text: string; color: string; born: number }[],
    lastCount: 0,
    beat: 0,
  });
  const [hud, setHud] = useState<Hud>({
    score: 0,
    note: 'round ' + (round + 1),
    left: 22,
    count: 3,
  });
  const paint = runnerPaint(look, bib);
  const tap = () => {
    const ms = Math.round(clock.current);
    if (ms < 0 || ms > RHYTHM_MS) return;
    taps.current.push(ms);
    const s = state.current;
    let bestI = -1;
    let bestD = Infinity;
    notes.current.forEach((n, i) => {
      if (s.used.has(i)) return;
      const d = Math.abs(n - ms);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI >= 0 && bestD <= GOOD_MS) {
      s.used.add(bestI);
      s.combo += 1;
      const base = bestD <= PERFECT_MS ? 20 : 10;
      const pts = base * (s.combo >= 10 ? 3 : s.combo >= 5 ? 2 : 1);
      s.score += pts;
      s.pops.push({
        text: bestD <= PERFECT_MS ? 'Perfect!' : 'Good',
        color: bestD <= PERFECT_MS ? '#1f8f7f' : '#3a7bd5',
        born: ms,
      });
      sfx.step(s.combo % 2 === 0);
    } else {
      s.combo = 0;
      s.score = Math.max(0, s.score - 5);
      s.pops.push({ text: 'Off beat', color: '#e63946', born: ms });
    }
  };
  useSpace(tap);

  useLoop(
    (ms) => {
      clock.current = ms;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return false;
      const { w, h } = fitCanvas(canvas, ctx);
      const s = state.current;
      const lineY = h * 0.72;
      const speed = h / 2400; // a footprint falls from the top in about 1.7 s
      const ns = notes.current;
      // Notes that pass the line untouched break the combo; a soft tick keeps the beat.
      while (s.passed < ns.length && (ns[s.passed] ?? 0) + GOOD_MS < ms) {
        if (!s.used.has(s.passed)) {
          s.combo = 0;
          s.pops.push({ text: 'Miss', color: '#9b8fb0', born: ms });
        }
        s.passed += 1;
      }
      while (s.beat < ns.length && (ns[s.beat] ?? 0) <= ms) {
        sfx.tick();
        s.beat += 1;
      }
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#2b2d5c');
      bg.addColorStop(1, '#6c4fd8');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(cx - 60, 0, 120, h);
      // pulse on the line
      const near = ns.reduce((d, n) => Math.min(d, Math.abs(n - ms)), Infinity);
      ctx.strokeStyle = near < PERFECT_MS ? '#ffd447' : '#ffffff';
      ctx.lineWidth = near < PERFECT_MS ? 8 : 5;
      ctx.beginPath();
      ctx.moveTo(cx - 80, lineY);
      ctx.lineTo(cx + 80, lineY);
      ctx.stroke();
      ns.forEach((n, i) => {
        if (s.used.has(i)) return;
        const y = lineY - (n - ms) * speed;
        if (y < -40 || y > h + 40) return;
        ctx.font =
          '40px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Colour emoji need an opaque fill to draw at full strength.
        ctx.fillStyle = '#000000';
        ctx.globalAlpha = n + GOOD_MS < ms ? 0.3 : 1;
        ctx.fillText(i % 2 ? '👟' : '👣', cx, y);
        ctx.globalAlpha = 1;
      });
      drawSideRunner(
        ctx,
        w * 0.2,
        h * 0.94,
        paint,
        Math.max(0, ms) / 90,
        ms < 0 ? 'stand' : 'run',
        0.9
      );
      for (const p of s.pops)
        popText(ctx, p.text, cx, lineY - 70, p.color, (ms - p.born) / 1000);
      const count = countOf(ms);
      if (count !== s.lastCount) {
        if (count > 0) sfx.countdown();
        else sfx.go();
        s.lastCount = count;
      }
      const left = Math.max(0, Math.ceil((RHYTHM_MS - Math.max(0, ms)) / 1000));
      const note = s.combo > 1 ? `combo ${s.combo}` : 'round ' + (round + 1);
      setHud((o) =>
        o.score === s.score &&
        o.left === left &&
        o.count === count &&
        o.note === note
          ? o
          : { score: s.score, left, count, note }
      );
      if (ms > RHYTHM_MS + 300) {
        onDone(taps.current);
        return true;
      }
      return false;
    },
    [dateKey, round]
  );
  return (
    <Frame
      label={ARCADE_INFO.rhythm.name}
      hud={hud}
      onTap={tap}
      canvasRef={canvasRef}
      hint="Tap as each footprint reaches the white line. Keep the beat!"
    />
  );
};

// ---------------------------------------------------------------- Pet Fetch

const PetFetch = ({ dateKey, round, look, bib, onDone }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const course = useRef(fetchCourse(dateKey, round));
  const paint = runnerPaint(look, bib);
  // Each throw: the bar sweeps from `barAt`; a tap (or the time limit) throws.
  const st = useRef({
    i: 0,
    barAt: 0,
    thrownAt: -1,
    taps: [] as number[],
    score: 0,
    last: null as null | { distance: number; points: number },
    lastCount: 0,
    done: false,
  });
  const clock = useRef(-COUNTDOWN);
  const [hud, setHud] = useState<Hud>({
    score: 0,
    note: `throw 1 of ${FETCH_THROWS}`,
    left: FETCH_THROWS,
    count: 3,
  });
  const throwNow = (ms: number) => {
    const s = st.current;
    const th = course.current[s.i];
    if (!th || s.thrownAt >= 0) return;
    const held = Math.min(FETCH_WINDOW, Math.max(0, Math.round(ms - s.barAt)));
    s.taps.push(held);
    const distance = fetchDistance(held, th);
    const points = fetchPoints(distance, th.target);
    s.last = { distance, points };
    s.thrownAt = ms;
    sfx.highFive();
  };
  const tap = () => {
    if (clock.current >= 0) throwNow(clock.current);
  };
  useSpace(tap);

  useLoop(
    (ms) => {
      clock.current = ms;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return false;
      const { w, h } = fitCanvas(canvas, ctx);
      const s = st.current;
      const th = course.current[s.i];
      if (ms >= 0 && th && s.thrownAt < 0 && ms - s.barAt >= FETCH_WINDOW)
        throwNow(ms);
      // After a throw: the ball flies, the pet fetches it, then the next throw.
      const since = s.thrownAt >= 0 ? ms - s.thrownAt : -1;
      if (since > 2600 && s.last) {
        s.score += s.last.points;
        s.i += 1;
        s.thrownAt = -1;
        s.barAt = ms;
        s.last = null;
        if (s.i >= FETCH_THROWS && !s.done) {
          s.done = true;
          onDone(s.taps);
          return true;
        }
      }
      const ground = h * 0.74;
      const px0 = w * 0.14;
      const perM = (w * 0.8) / 40;
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, '#9fd3ff');
      sky.addColorStop(1, '#e8f7ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8fd17a';
      ctx.fillRect(0, ground, w, h - ground);
      for (let m = 0; m <= 40; m += 10) {
        ctx.fillStyle = 'rgba(42,35,64,0.35)';
        ctx.fillRect(px0 + m * perM, ground + 4, 2, 10);
        ctx.font = '700 11px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${m} m`, px0 + m * perM, ground + 26);
      }
      if (th) {
        // the target ring
        const tx = px0 + th.target * perM;
        ctx.strokeStyle = '#ff4f81';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(tx, ground + 2, 28, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,79,129,0.25)';
        ctx.fill();
        // wind
        ctx.fillStyle = '#2a2340';
        ctx.font = '800 15px "Baloo 2", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          th.wind === 0
            ? 'No wind'
            : `Wind ${th.wind > 0 ? '→' : '←'} ${Math.abs(th.wind).toFixed(1)} m`,
          w - 14,
          116
        );
      }
      // ball and pet
      let ballX = px0 + 18;
      let ballY = ground - 60;
      let petX = px0 + 40;
      let petFace: 1 | -1 = 1;
      if (since >= 0 && s.last) {
        const land = px0 + s.last.distance * perM;
        const k = Math.min(1, since / 900);
        ballX = px0 + 18 + (land - px0 - 18) * k;
        ballY = ground - 60 + (60 - 6) * k - Math.sin(k * Math.PI) * h * 0.28;
        const run = Math.min(1, Math.max(0, (since - 200) / 900));
        const back = Math.min(1, Math.max(0, (since - 1400) / 1000));
        petX = px0 + 40 + (land - px0 - 40) * run - (land - px0 - 40) * back;
        petFace = back > 0 ? -1 : 1;
        if (back > 0) {
          ballX = petX + 18 * petFace;
          ballY = ground - 26;
        }
      }
      drawSideRunner(
        ctx,
        px0,
        ground,
        paint,
        0,
        since >= 0 && since < 300 ? 'throw' : 'stand'
      );
      drawPet(ctx, petX, ground, look.pet, since >= 0 ? ms / 60 : 0, petFace);
      ctx.fillStyle = '#d4ff3a';
      ctx.strokeStyle = '#2a2340';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (since >= 900 && s.last)
        popText(
          ctx,
          s.last.points >= 90
            ? `Bullseye! +${s.last.points}`
            : `+${s.last.points}`,
          px0 + s.last.distance * perM,
          ground - 60,
          s.last.points >= 70 ? '#1f8f7f' : '#e07a00',
          (since - 900) / 1300
        );
      // power bar
      if (th && s.thrownAt < 0 && ms >= 0) {
        const p = fetchPower(ms - s.barAt, th.period);
        const bx = w * 0.12;
        const bw = w * 0.76;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2a2340';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(bx, h * 0.2, bw, 20, 10);
        ctx.fill();
        ctx.stroke();
        const ideal = Math.max(0, Math.min(1, (th.target - th.wind) / 36));
        ctx.fillStyle = 'rgba(255,79,129,0.3)';
        ctx.fillRect(bx + bw * ideal - 8, h * 0.2, 16, 20);
        ctx.fillStyle = '#ffc23d';
        ctx.beginPath();
        ctx.roundRect(bx + 3, h * 0.2 + 3, Math.max(4, (bw - 6) * p), 14, 7);
        ctx.fill();
      }
      const count = countOf(ms);
      if (count !== s.lastCount) {
        if (count > 0) sfx.countdown();
        else sfx.go();
        s.lastCount = count;
      }
      const shown = s.score + (since >= 900 && s.last ? s.last.points : 0);
      const note = `throw ${Math.min(FETCH_THROWS, s.i + 1)} of ${FETCH_THROWS}`;
      const left = FETCH_THROWS - s.i;
      setHud((o) =>
        o.score === shown &&
        o.note === note &&
        o.count === count &&
        o.left === left
          ? o
          : { score: shown, note, left, count }
      );
      if (ms < 0) s.barAt = 0;
      return false;
    },
    [dateKey, round]
  );
  return (
    <Frame
      label={ARCADE_INFO.fetch.name}
      hud={hud}
      onTap={tap}
      canvasRef={canvasRef}
      hint="Tap when the power bar reaches the pink mark. Mind the wind!"
    />
  );
};

/** One round of Hurdle Hop, Rhythm Steps or Pet Fetch. */
export const ArcadeGame = (p: Props) =>
  p.game === 'hurdle' ? (
    <HurdleHop {...p} />
  ) : p.game === 'rhythm' ? (
    <RhythmSteps {...p} />
  ) : (
    <PetFetch {...p} />
  );
