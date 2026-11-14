import { useEffect, useRef } from 'react';
import type { DayInfo } from '../../shared/content';
import type { Look } from '../../shared/economy';
import { loadWorld } from '../three/load';
import { tr } from '../i18n';

type Props = {
  day: DayInfo;
  look: Look;
  bib: number | null;
  /** Shows the back of the runner (the bib) now and then. */
  showBack?: boolean;
};

/** A slowly swaying 3D preview of a runner and their pet. */
export const RunnerPreview = ({ day, look, bib, showBack = false }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // three.js loads on demand, so screens without 3D open faster.
    let cancelled = false;
    let raf = 0;
    let dispose = () => undefined as void;
    void loadWorld().then(({ RunWorld }) => {
      if (cancelled) return;
      const world = new RunWorld({
        canvas,
        city: day.city,
        stage: day.stage,
        runners: [{ name: 'me', look, bib, other: false }],
        preview: true,
      });
      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      const start = performance.now();
      const loop = (now: number) => {
        const t = (now - start) / 1000;
        world.sway(t, reduce, showBack);
        world.frame(t, [{ name: 'me', km: 0, speed: 0.15 }], 'me');
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      dispose = () => world.dispose();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      dispose();
    };
  }, [day, look, bib, showBack]);
  return (
    <canvas
      ref={ref}
      className="h-full w-full"
      aria-label={tr('Your runner')}
    />
  );
};
