import type { Terrain, WeatherId } from '../../shared/content';
import { prefs } from './prefs';

/**
 * Every sound in the game is synthesised with Web Audio: nothing to download, and
 * it all stays quiet and short so it never fights with whatever else is playing.
 */

const KEY = 'ccm-sound';

const readSetting = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
};

let enabled = typeof window === 'undefined' ? false : readSetting();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const listeners = new Set<(on: boolean) => void>();

const audio = (): AudioContext | null => {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

const noise = (c: AudioContext): AudioBuffer => {
  if (noiseBuffer) return noiseBuffer;
  const len = c.sampleRate * 2;
  noiseBuffer = c.createBuffer(1, len, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
};

type ToneOpts = {
  freq: number;
  to?: number;
  type?: OscillatorType;
  start?: number;
  dur: number;
  gain: number;
  attack?: number;
};

const tone = (o: ToneOpts) => {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + (o.start ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
};

type NoiseOpts = {
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  start?: number;
  dur: number;
  gain: number;
  attack?: number;
};

const burst = (o: NoiseOpts) => {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + (o.start ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.filter;
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0, Math.random());
  src.stop(t0 + o.dur + 0.05);
};

const buzz = (ms: number | number[]) => {
  if (!enabled) return;
  try {
    if (prefs().vibration) navigator.vibrate?.(ms);
  } catch {
    // Not every webview lets a page vibrate.
  }
};

// C major, so everything that sounds "good" fits together.
const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5 };

export const sfx = {
  /** A light spring for a hurdle jump. */
  jump: () => {
    tone({ freq: 380, to: 760, dur: 0.14, gain: 0.08, type: 'triangle' });
  },
  /** The beat in Rhythm Steps. */
  tick: () => {
    tone({ freq: 1800, dur: 0.03, gain: 0.04, type: 'square' });
    burst({ filter: 'lowpass', freq: 160, q: 1, dur: 0.12, gain: 0.18 });
  },
  /** A whoosh and a rising chime when you hop on a booster. */
  boost: () => {
    burst({
      filter: 'bandpass',
      freq: 900,
      q: 0.8,
      dur: 0.4,
      gain: 0.12,
      attack: 0.05,
    });
    tone({
      freq: NOTE.C5,
      to: NOTE.C6,
      dur: 0.25,
      gain: 0.08,
      type: 'triangle',
    });
    tone({
      freq: NOTE.G5,
      start: 0.12,
      dur: 0.18,
      gain: 0.07,
      type: 'triangle',
    });
    buzz(30);
  },
  /** Whoever you ran into answers back: a horn, a siren, a bark, a cluck. */
  roadLife: (kind: string) => {
    buzz(60);
    switch (kind) {
      case 'taxi':
      case 'scooter':
      case 'cyclo':
        tone({ freq: 420, dur: 0.16, gain: 0.12, type: 'square' });
        tone({ freq: 420, start: 0.2, dur: 0.22, gain: 0.12, type: 'square' });
        break;
      case 'ambulance':
      case 'firetruck':
        for (let i = 0; i < 3; i++) {
          tone({
            freq: 700,
            to: 980,
            start: i * 0.5,
            dur: 0.25,
            gain: 0.08,
            type: 'sawtooth',
          });
          tone({
            freq: 980,
            to: 700,
            start: i * 0.5 + 0.25,
            dur: 0.25,
            gain: 0.08,
            type: 'sawtooth',
          });
        }
        break;
      case 'cyclist':
        tone({ freq: 2400, dur: 0.08, gain: 0.08 });
        tone({ freq: 2400, start: 0.12, dur: 0.12, gain: 0.08 });
        break;
      case 'dog':
        burst({ filter: 'bandpass', freq: 600, q: 2, dur: 0.12, gain: 0.25 });
        burst({
          filter: 'bandpass',
          freq: 550,
          q: 2,
          start: 0.18,
          dur: 0.12,
          gain: 0.22,
        });
        break;
      case 'cat':
        tone({ freq: 700, to: 1100, dur: 0.18, gain: 0.08, type: 'triangle' });
        tone({
          freq: 1100,
          to: 600,
          start: 0.18,
          dur: 0.25,
          gain: 0.08,
          type: 'triangle',
        });
        break;
      case 'chicken':
        for (let i = 0; i < 4; i++)
          tone({
            freq: 900 + i * 60,
            to: 1300,
            start: i * 0.09,
            dur: 0.07,
            gain: 0.07,
            type: 'square',
          });
        break;
      case 'monkey':
        for (let i = 0; i < 3; i++)
          tone({
            freq: 700,
            to: 1400,
            start: i * 0.13,
            dur: 0.1,
            gain: 0.07,
            type: 'triangle',
          });
        break;
      case 'capybara':
        tone({ freq: 420, to: 520, dur: 0.12, gain: 0.08, type: 'sine' });
        break;
      case 'pig':
        burst({ filter: 'lowpass', freq: 380, q: 6, dur: 0.22, gain: 0.3 });
        burst({
          filter: 'lowpass',
          freq: 340,
          q: 6,
          start: 0.26,
          dur: 0.18,
          gain: 0.25,
        });
        break;
      default:
        tone({ freq: 300, to: 200, dur: 0.15, gain: 0.1, type: 'triangle' });
    }
  },
  /** A rolling rumble after lightning. */
  thunder: () => {
    burst({
      filter: 'lowpass',
      freq: 140,
      q: 0.7,
      dur: 2.2,
      gain: 0.22,
      attack: 0.05,
    });
    burst({
      filter: 'lowpass',
      freq: 260,
      q: 0.5,
      start: 0.15,
      dur: 1.2,
      gain: 0.12,
      attack: 0.02,
    });
    buzz([40, 60, 40]);
  },
  countdown: () => tone({ freq: 660, dur: 0.14, gain: 0.25, type: 'triangle' }),
  go: () => {
    tone({ freq: 990, dur: 0.35, gain: 0.3, type: 'triangle' });
    burst({
      filter: 'bandpass',
      freq: 1200,
      q: 0.7,
      dur: 1.2,
      gain: 0.12,
      attack: 0.1,
    });
  },
  step: (left: boolean) =>
    burst({ filter: 'lowpass', freq: left ? 420 : 380, dur: 0.06, gain: 0.07 }),
  crash: () => {
    tone({ freq: 140, to: 45, dur: 0.32, gain: 0.5, type: 'sine' });
    burst({ filter: 'lowpass', freq: 900, dur: 0.18, gain: 0.25 });
    tone({
      freq: 420,
      to: 260,
      start: 0.06,
      dur: 0.22,
      gain: 0.12,
      type: 'square',
    });
    buzz([70, 40, 70]);
  },
  stumble: () => {
    tone({ freq: 190, to: 120, dur: 0.18, gain: 0.25, type: 'square' });
    buzz(30);
  },
  splash: () => {
    burst({ filter: 'highpass', freq: 1800, dur: 0.28, gain: 0.2 });
    buzz(25);
  },
  snack: () => {
    tone({ freq: NOTE.C6, dur: 0.12, gain: 0.18, type: 'triangle' });
    tone({
      freq: NOTE.E6,
      start: 0.08,
      dur: 0.18,
      gain: 0.18,
      type: 'triangle',
    });
  },
  highFive: () => {
    burst({ filter: 'highpass', freq: 2500, dur: 0.07, gain: 0.35 });
    tone({
      freq: NOTE.G5,
      start: 0.04,
      dur: 0.12,
      gain: 0.15,
      type: 'triangle',
    });
    tone({
      freq: NOTE.C6,
      start: 0.1,
      dur: 0.18,
      gain: 0.15,
      type: 'triangle',
    });
  },
  water: () =>
    tone({ freq: 500, to: 900, dur: 0.16, gain: 0.15, type: 'sine' }),
  chat: () => tone({ freq: 600, to: 1100, dur: 0.1, gain: 0.15, type: 'sine' }),
  gate: () => {
    tone({ freq: NOTE.E5, dur: 0.9, gain: 0.12, type: 'sine', attack: 0.01 });
    tone({ freq: NOTE.E5 * 2.01, dur: 0.5, gain: 0.04, type: 'sine' });
    burst({
      filter: 'bandpass',
      freq: 1100,
      q: 0.6,
      dur: 1.4,
      gain: 0.08,
      attack: 0.25,
    });
  },
  landmark: () => {
    tone({ freq: NOTE.G5, dur: 0.5, gain: 0.08, type: 'sine' });
    tone({ freq: NOTE.C6, start: 0.18, dur: 0.7, gain: 0.08, type: 'sine' });
  },
  finish: () => {
    const notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
    notes.forEach((f, i) =>
      tone({
        freq: f,
        start: i * 0.11,
        dur: i === 3 ? 0.7 : 0.16,
        gain: 0.2,
        type: 'triangle',
      })
    );
    burst({
      filter: 'bandpass',
      freq: 1300,
      q: 0.5,
      start: 0.2,
      dur: 2.2,
      gain: 0.16,
      attack: 0.3,
    });
    buzz(40);
  },
};

/** A quiet bed of sound for the terrain: crowd in town, waves on the beach, wind in the desert. */
export const ambience = (terrain: Terrain): (() => void) => {
  const c = audio();
  if (!c || !master) return () => undefined;
  const nodes: AudioScheduledSourceNode[] = [];
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  const shape: Record<
    Terrain,
    {
      type: BiquadFilterType;
      freq: number;
      gain: number;
      rate: number;
      depth: number;
    }
  > = {
    city: {
      type: 'bandpass',
      freq: 950,
      gain: 0.035,
      rate: 0.17,
      depth: 0.012,
    },
    park: { type: 'bandpass', freq: 700, gain: 0.02, rate: 0.12, depth: 0.008 },
    forest: {
      type: 'lowpass',
      freq: 500,
      gain: 0.03,
      rate: 0.09,
      depth: 0.015,
    },
    zoo: { type: 'bandpass', freq: 800, gain: 0.025, rate: 0.15, depth: 0.01 },
    hills: { type: 'lowpass', freq: 600, gain: 0.03, rate: 0.1, depth: 0.015 },
    beach: { type: 'lowpass', freq: 700, gain: 0.05, rate: 0.11, depth: 0.04 },
    jungle: {
      type: 'bandpass',
      freq: 2600,
      gain: 0.02,
      rate: 0.6,
      depth: 0.012,
    },
    desert: {
      type: 'bandpass',
      freq: 450,
      gain: 0.035,
      rate: 0.07,
      depth: 0.025,
    },
  };
  const s = shape[terrain];
  f.type = s.type;
  f.frequency.value = s.freq;
  f.Q.value = 0.6;
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(s.gain, c.currentTime + 1.5);
  lfo.frequency.value = s.rate;
  lfoGain.gain.value = s.depth;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(f).connect(g).connect(master);
  src.start();
  lfo.start();
  nodes.push(src, lfo);

  // Birds in the green stages, now and then.
  let chirps = 0;
  if (
    terrain === 'park' ||
    terrain === 'forest' ||
    terrain === 'hills' ||
    terrain === 'zoo' ||
    terrain === 'jungle'
  ) {
    chirps = window.setInterval(() => {
      if (Math.random() < 0.55) return;
      const base = 2200 + Math.random() * 1400;
      tone({ freq: base, to: base * 1.3, dur: 0.07, gain: 0.03, type: 'sine' });
      tone({
        freq: base * 1.1,
        to: base * 1.45,
        start: 0.1,
        dur: 0.07,
        gain: 0.025,
        type: 'sine',
      });
    }, 1300);
  }

  return () => {
    window.clearInterval(chirps);
    const t = c.currentTime;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      for (const n of nodes) n.stop(t + 0.45);
    } catch {
      // Already stopped.
    }
  };
};

/** Rain on the road and gusts of wind, layered over the terrain's sound. */
export const weatherAmbience = (weather: WeatherId): (() => void) => {
  const c = audio();
  if (!c || !master) return () => undefined;
  const wet = weather === 'rain' || weather === 'storm';
  const windy =
    weather === 'headwind' || weather === 'tailwind' || weather === 'storm';
  if (!wet && !windy) return () => undefined;
  const nodes: AudioScheduledSourceNode[] = [];
  const gains: GainNode[] = [];
  const layer = (
    type: BiquadFilterType,
    freq: number,
    gain: number,
    gust: number
  ) => {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 1.5);
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 0.13;
    depth.gain.value = gust;
    lfo.connect(depth).connect(g.gain);
    src.connect(f).connect(g).connect(master!);
    src.start(0, Math.random());
    lfo.start();
    nodes.push(src, lfo);
    gains.push(g);
  };
  if (wet) layer('highpass', 1800, weather === 'storm' ? 0.05 : 0.035, 0.006);
  if (windy) layer('lowpass', 320, weather === 'storm' ? 0.07 : 0.05, 0.035);
  return () => {
    const t = c.currentTime;
    try {
      for (const g of gains) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      }
      for (const n of nodes) n.stop(t + 0.45);
    } catch {
      // Already stopped.
    }
  };
};

export const soundOn = () => enabled;

export const setSound = (on: boolean) => {
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
  if (!on && ctx) void ctx.suspend();
  if (on) {
    audio();
    sfx.chat();
  }
  for (const l of listeners) l(on);
};

export const onSoundChange = (l: (on: boolean) => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
