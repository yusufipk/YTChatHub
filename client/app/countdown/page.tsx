'use client';

import { useEffect, useRef, useState } from 'react';
import { Tux, TUX_LINES, type TuxAction } from '../../components/Tux';
import { showText } from '../../lib/showText';
import { useEvents } from '../../lib/useEvents';
import { FONT_HREF, useNow, useOverlayParams } from '../../lib/useShowOverlay';

const DOTS = 60;
const FINAL_MS = 10_000;
// A countdown that ended longer ago than this is treated as over, so reloading the page later shows the idle card.
const LIVE_HOLD_MS = 60_000;
const SCENE_SWITCH_DELAY_MS = 1_900;
const RING_RADIUS = 440;
const ARC_RADIUS = 490;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

type Phase = 'idle' | 'running' | 'final' | 'live';

const TUX_SLOT_MS = 6_000;
const TUX_TRICKS: TuxAction[] = ['wave', 'type', 'say', 'dance', 'walk', 'laugh', 'jump', 'say'];

/** Tux grooves while the clock runs and does a trick every other slot; slots follow the server clock so every source agrees. */
function tuxAction(phase: Phase, now: number): TuxAction {
  if (phase === 'idle') return 'sleep';
  if (phase === 'final') return 'look';
  if (phase === 'live') return 'cheer';
  const slot = Math.floor(now / TUX_SLOT_MS);
  return slot % 2 === 0 ? 'groove' : TUX_TRICKS[Math.floor(slot / 2) % TUX_TRICKS.length];
}

type ObsStudio = { setCurrentScene?: (name: string) => void };

function phaseOf(remaining: number | null): Phase {
  if (remaining === null || remaining <= -LIVE_HOLD_MS) return 'idle';
  if (remaining <= 0) return 'live';
  return remaining <= FINAL_MS ? 'final' : 'running';
}

/** How lit each of the 60 dots is. The leading dot fades over its second so the ring drains smoothly. */
function dotLevels(phase: Phase, remaining: number): number[] {
  let filled: number;
  if (phase === 'running') {
    const secondsInMinute = (remaining / 1000) % 60;
    filled = secondsInMinute === 0 ? DOTS : secondsInMinute;
  } else if (phase === 'final') {
    filled = (remaining / FINAL_MS) * DOTS;
  } else {
    // At zero the ring flashes full before it collapses, so the collapse is visible against the dark ground.
    filled = DOTS;
  }
  return Array.from({ length: DOTS }, (_, i) => Math.max(0, Math.min(1, filled - i)));
}

function clockText(phase: Phase, remaining: number): string {
  const seconds = Math.ceil(remaining / 1000);
  if (phase === 'final') return String(seconds);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function CountdownPage() {
  const params = useOverlayParams();
  const { show, clockOffset } = useEvents();
  const countdown = show?.countdown;
  const endsAt = countdown?.endsAt ?? null;
  const now = useNow(clockOffset, endsAt !== null && endsAt - (Date.now() + clockOffset) > -LIVE_HOLD_MS);
  const remaining = endsAt === null ? null : endsAt - now;
  // A page that watched this countdown reach zero keeps the live card; only a later reload falls back to idle.
  const [watchedZero, setWatchedZero] = useState<number | null>(null);
  const basePhase = phaseOf(remaining);
  const phase = basePhase === 'idle' && endsAt !== null && remaining !== null && remaining <= 0 && watchedZero === endsAt ? 'live' : basePhase;
  const text = showText(params?.get('lang') ?? null);
  const scene = params?.get('scene') ?? '';

  // Switch scenes only after this page watched the countdown run out, never on a reload after the fact.
  const sawRunning = useRef(false);
  useEffect(() => {
    if (phase === 'idle') sawRunning.current = false;
    if (phase === 'running' || phase === 'final') sawRunning.current = true;
    if (phase !== 'live' || !sawRunning.current) return;
    sawRunning.current = false;
    setWatchedZero(endsAt);
    if (!scene) return;
    const timer = setTimeout(() => {
      const obs = (window as unknown as { obsstudio?: ObsStudio }).obsstudio;
      obs?.setCurrentScene?.(scene);
    }, SCENE_SWITCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, scene, endsAt]);

  const levels = dotLevels(phase, remaining ?? 0);
  const progress = phase === 'running' && countdown?.durationMs ? Math.min(1, (remaining ?? 0) / countdown.durationMs) : phase === 'final' ? 0 : 1;
  const digits = remaining !== null && (phase === 'running' || phase === 'final') ? clockText(phase, remaining) : '';
  const second = remaining !== null ? Math.ceil(remaining / 1000) : 0;
  const startsAt = endsAt !== null ? new Date(endsAt).toLocaleTimeString(text.locale, { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <main className={`cd cd--${phase}`}>
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
      <div className="cd__glow" />

      <div className="cd__clock">
        <svg className="cd__ring" viewBox="-500 -500 1000 1000" aria-hidden="true">
          <circle className="cd__track" r={ARC_RADIUS} />
          <circle
            className="cd__arc"
            r={ARC_RADIUS}
            strokeDasharray={ARC_LENGTH}
            strokeDashoffset={ARC_LENGTH * (1 - progress)}
            transform="rotate(-90)"
          />
          <g key={phase === 'final' ? `pulse-${second}` : phase} className={`cd__dots ${phase === 'final' ? 'cd__dots--pulse' : ''}`}>
            {levels.map((level, i) => {
              const angle = (i / DOTS) * 2 * Math.PI;
              return (
                <circle
                  key={i}
                  cx={Math.sin(angle) * RING_RADIUS}
                  cy={-Math.cos(angle) * RING_RADIUS}
                  r={i % 5 === 0 ? 13 : 9}
                  className="cd__dot"
                  style={{ ['--lit' as string]: level }}
                />
              );
            })}
          </g>
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} className="cd__tick" x1="0" y1={-392} x2="0" y2={-372} transform={`rotate(${i * 30})`} />
          ))}
        </svg>

        <div className="cd__digits" aria-live="off">
          {digits.split('').map((char, i) =>
            char === ':' ? (
              <span key={`colon-${i}`} className="cd__colon">:</span>
            ) : (
              <span key={`${i}-${char}`} className="cd__digit">{char}</span>
            )
          )}
        </div>
        <div className="cd__live">{text.live}</div>
      </div>

      <Tux action={tuxAction(phase, now)} line={TUX_LINES[Math.floor(now / (TUX_SLOT_MS * 2)) % TUX_LINES.length]} />

      <section className="cd__info">
        <h1 className="cd__title">{countdown?.title || text.soon}</h1>
        {countdown?.topic && <p className="cd__topic">{countdown.topic}</p>}
        {(phase === 'running' || countdown?.title) && <p className="cd__when">{phase === 'running' ? text.startsAt(startsAt) : text.soon}</p>}
      </section>
    </main>
  );
}
