import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type TuxAction = 'groove' | 'wave' | 'jump' | 'dance' | 'walk' | 'laugh' | 'type' | 'say' | 'look' | 'cheer' | 'sleep';

/** Things Tux says in the speech bubble; the caller picks one per showing. */
export const TUX_LINES = ['I use Arch btw', 'sudo !!', ':wq', 'make install', 'merhaba!', 'git push -f?'];

const BLEND_MS = 450;
// Every part an action moves with a transform; these are blended when the action changes.
const PARTS = '.tux__svg, .tux__all, .tux__flipper, .tux__foot, .tux__eyes';

/**
 * A home-drawn Tux. Each action is a CSS animation on the parts below (see show.css).
 * Swapping the class would snap every part from wherever the old animation left it to the
 * new one's first frame, so on a change each part eases from its old pose to the new start
 * while the new CSS animations are held at their first frame.
 */
export function Tux({ action, line = TUX_LINES[0], className = '' }: { action: TuxAction; line?: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(action);
  const poses = useRef<Map<Element, string> | null>(null);

  // Read the old pose while the old class is still on, then switch.
  useEffect(() => {
    if (action === shown) return;
    const parts = root.current ? Array.from(root.current.querySelectorAll(PARTS)) : [];
    poses.current = new Map(parts.map((part) => [part, getComputedStyle(part).transform]));
    setShown(action);
  }, [action, shown]);

  useLayoutEffect(() => {
    const from = poses.current;
    poses.current = null;
    const el = root.current;
    if (!from || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Hold the new CSS animations on their first frame through the class (see .tux--blending), not with
    // Animation.pause(): Chromium stops cancelling a CSS animation once script has paused and played it.
    el.classList.add('tux--blending');
    const blends: Animation[] = [];
    for (const [part, pose] of from) {
      const start = getComputedStyle(part).transform;
      if (pose !== start) blends.push(part.animate([{ transform: pose }, { transform: start }], { duration: BLEND_MS, easing: 'ease-in-out' }));
    }
    const timer = setTimeout(() => el.classList.remove('tux--blending'), BLEND_MS);
    return () => {
      clearTimeout(timer);
      blends.forEach((blend) => blend.cancel());
      el.classList.remove('tux--blending');
    };
  }, [shown]);

  return (
    <div ref={root} className={`tux tux--${shown} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 200 250" className="tux__svg">
        <ellipse className="tux__shadow" cx="100" cy="236" rx="62" ry="7" />
        <g className="tux__all">
          <g className="tux__foot tux__foot--l">
            <ellipse cx="74" cy="224" rx="27" ry="11" />
          </g>
          <g className="tux__foot tux__foot--r">
            <ellipse cx="126" cy="224" rx="27" ry="11" />
          </g>
          <ellipse className="tux__dark" cx="100" cy="152" rx="64" ry="72" />
          <circle className="tux__dark" cx="100" cy="72" r="45" />
          <ellipse className="tux__belly" cx="100" cy="162" rx="44" ry="56" />
          <g className="tux__eyes">
            <ellipse className="tux__white" cx="85" cy="66" rx="13" ry="17" />
            <ellipse className="tux__white" cx="115" cy="66" rx="13" ry="17" />
            <g className="tux__pupils">
              <circle cx="88" cy="70" r="6" />
              <circle cx="112" cy="70" r="6" />
            </g>
          </g>
          <path className="tux__lids" d="M73 70 Q85 77 97 70 M103 70 Q115 77 127 70" />
          <path className="tux__happy" d="M74 70 Q85 56 96 70 M104 70 Q115 56 126 70" />
          <ellipse className="tux__mouth" cx="100" cy="95" rx="11" ry="0" />
          <path className="tux__beak" d="M82 88 Q100 75 118 88 Q100 103 82 88 Z" />
          <g className="tux__laptop">
            <rect x="58" y="150" width="84" height="54" rx="5" />
            <circle cx="100" cy="177" r="7" />
            <rect className="tux__laptop-base" x="48" y="202" width="104" height="8" rx="3" />
          </g>
          <g className="tux__flipper tux__flipper--l">
            <ellipse cx="44" cy="150" rx="14" ry="44" transform="rotate(14 44 150)" />
          </g>
          <g className="tux__flipper tux__flipper--r">
            <ellipse cx="156" cy="150" rx="14" ry="44" transform="rotate(-14 156 150)" />
          </g>
        </g>
        <g className="tux__zs">
          <text x="150" y="40">z</text>
          <text x="166" y="20">z</text>
        </g>
        <g className="tux__haha">
          <text x="150" y="30">ha</text>
          <text x="20" y="22">ha</text>
        </g>
        <g className="tux__bubble">
          <rect x="-10" y="-58" width="220" height="44" rx="14" />
          <path d="M88 -15 L100 2 L112 -15 Z" />
          <text x="100" y="-35">{line}</text>
        </g>
      </svg>
    </div>
  );
}
