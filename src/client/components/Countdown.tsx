import { useEffect, useState } from 'react';
import { tr } from '../i18n';
import { formatCountdown, secondsToNextStage } from '../lib/countdown';

/** A live "Next stage in 5:07:09" line. */
export const NextStage = ({ className = '' }: { className?: string }) => {
  const [left, setLeft] = useState(() => secondsToNextStage(Date.now()));
  useEffect(() => {
    const id = window.setInterval(
      () => setLeft(secondsToNextStage(Date.now())),
      1000
    );
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className={className} aria-live="off">
      ⏱️{' '}
      {tr('Next stage in {time}', {
        time: formatCountdown(left),
      })}
    </p>
  );
};
