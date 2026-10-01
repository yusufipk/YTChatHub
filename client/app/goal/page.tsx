'use client';

import { useEffect, useRef, useState } from 'react';
import { formatNumber, showText } from '../../lib/showText';
import { useEvents } from '../../lib/useEvents';
import { FONT_HREF, useOverlayParams } from '../../lib/useShowOverlay';

const CELEBRATE_MS = 6_000;
const COUNT_ANIM_MS = 900;
const POSITIONS = ['tl', 'tr', 'bl', 'br'];
const HEART_TOP = 7.6;
const HEART_HEIGHT = 12.9;

/** The goal steps up by `step` each time it is reached: 243 likes with a step of 50 aims at 250. */
function nextGoal(count: number, step: number): number {
  return (Math.floor(count / step) + 1) * step;
}

/** Eases the shown number toward `target` so a jump of several likes reads as counting up. */
function useAnimatedNumber(target: number | null): number | null {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (target === null || fromRef.current === null) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const t = Math.min(1, (time - start) / COUNT_ANIM_MS);
      const next = Math.round(from + (target - from) * (1 - (1 - t) ** 3));
      fromRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

/** `?demo=1` counts up from just under a goal so the pill and the celebration can be seen without a stream. */
function useDemoCount(step: number | null): number | null {
  // Tagged with the step it was counted for, so the render where the step changes reads null instead of a stale count.
  const [value, setValue] = useState<{ step: number; n: number } | null>(null);
  useEffect(() => {
    if (step === null) {
      setValue(null);
      return;
    }
    const start = 2 * step - Math.min(6, step - 1);
    let n = start;
    setValue({ step, n });
    const timer = setInterval(() => {
      n = n >= 2 * step + 3 ? start : n + 1;
      setValue({ step, n });
    }, 1_500);
    return () => clearInterval(timer);
  }, [step]);
  return value !== null && value.step === step ? value.n : null;
}

export default function GoalPage() {
  const params = useOverlayParams();
  const { show } = useEvents();
  const text = showText(params?.get('lang') ?? null);
  const pos = POSITIONS.includes(params?.get('pos') ?? '') ? params!.get('pos') : 'tr';
  const scale = Math.min(3, Math.max(0.5, Number(params?.get('scale')) || 1));

  const step = show?.likes.step ?? 50;
  const demoMode = params?.get('demo') === '1';
  const demo = useDemoCount(demoMode && show ? step : null);
  // Before a stream is connected the pill still shows, counting from zero, so it can be placed in OBS.
  // Celebrations track the real count only: the zero shown before a connect is a placeholder, not a value to climb from.
  const measured = demoMode ? demo : (show?.likes.count ?? null);
  const count = measured ?? (show ? 0 : null);
  const shown = useAnimatedNumber(count);

  // Celebrate only a goal crossed while this page was watching, not the state found on load.
  const [reached, setReached] = useState<number | null>(null);
  const prev = useRef<number | null>(null);
  const prevStep = useRef(step);
  // Likes can dip and climb back; a goal already celebrated stays celebrated.
  const celebrated = useRef(0);
  useEffect(() => {
    const count = measured;
    const before = prev.current;
    prev.current = count;
    // A changed step moves every goal line, so the jump across it is not a goal being reached.
    const stepChanged = prevStep.current !== step;
    prevStep.current = step;
    // The demo loops back under the goal it just celebrated; let it celebrate again on the next pass.
    if (demoMode && count !== null && count < celebrated.current) celebrated.current = 0;
    // The source stays loaded between streams; the next stream's goals are new ones.
    if (count === null) celebrated.current = 0;
    if (stepChanged || before === null || count === null || count <= before) return;
    const crossed = Math.floor(count / step) * step;
    if (Math.floor(count / step) > Math.floor(before / step) && crossed > celebrated.current) {
      celebrated.current = crossed;
      setReached(crossed);
    }
  }, [measured, step, demoMode]);
  useEffect(() => {
    if (reached === null) return;
    const timer = setTimeout(() => setReached(null), CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [reached]);

  // Demo numbers wobble a little so the viewer count can be seen changing too.
  const viewers = demoMode ? (demo === null ? null : 120 + ((demo * 7) % 23)) : (show?.viewers ?? null);

  if (count === null || shown === null) return null;

  const goal = nextGoal(shown, step);
  const fill = reached !== null ? 1 : (shown - (goal - step)) / step;

  return (
    <main className={`lg lg--${pos} ${reached !== null ? 'lg--reached' : ''}`} style={{ ['--scale' as string]: String(scale) }}>
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
      <div className="lg__pill">
        <svg key={reached ?? 'steady'} className="lg__heart" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <clipPath id="lg-fill">
              {/* The heart spans y 7.6 to 20.5, so the fill rises across that band rather than the whole box. */}
              <rect x="0" y={HEART_TOP + HEART_HEIGHT * (1 - fill)} width="24" height="24" className="lg__fillrect" />
            </clipPath>
          </defs>
          <path className="lg__heart-line" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
          <path className="lg__heart-fill" clipPath="url(#lg-fill)" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
        </svg>
        {reached !== null ? (
          <span className="lg__text lg__text--thanks">{text.reached(formatNumber(reached, text))}</span>
        ) : (
          <span className="lg__text">
            <strong className="lg__count">{formatNumber(shown, text)}</strong>
            <span className="lg__goal">
              {' / '}
              {formatNumber(goal, text)} {text.likes}
            </span>
          </span>
        )}
        {viewers !== null && (
          <span className="lg__viewers">
            <span className="lg__live" aria-hidden="true" />
            <strong className="lg__viewcount">{formatNumber(viewers, text)}</strong> {text.watching}
          </span>
        )}
      </div>
    </main>
  );
}
