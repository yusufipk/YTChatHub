'use client';

import { useEffect, useState } from 'react';

/** Marks the page as a transparent overlay and returns its query string once mounted. */
export function useOverlayParams(): URLSearchParams | null {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => {
    setParams(new URLSearchParams(window.location.search));
    document.body.classList.add('is-overlay');
    return () => document.body.classList.remove('is-overlay');
  }, []);
  return params;
}

/** Server-corrected clock that re-renders every animation frame while `active`, otherwise every `idleMs`. */
export function useNow(clockOffset: number, active = true, idleMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => setNow(Date.now() + clockOffset);
    if (active) {
      const loop = () => {
        tick();
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    } else {
      tick();
      timer = setInterval(tick, idleMs);
    }
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearInterval(timer);
    };
  }, [clockOffset, active, idleMs]);
  return now;
}

export const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Instrument+Sans:wght@400;500;600&display=block';
