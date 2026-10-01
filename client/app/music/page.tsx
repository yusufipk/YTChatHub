'use client';

import { useEffect, useRef, useState } from 'react';
import type { ShowState } from '@shared/show';
import { BACKEND_URL } from '../../lib/config';
import { useEvents } from '../../lib/useEvents';
import { FONT_HREF, useOverlayParams } from '../../lib/useShowOverlay';

const POSITIONS = ['tl', 'tr', 'bl', 'br'];
const LEAVE_MS = 600;

type Track = NonNullable<ShowState['music']>;

const coverUrl = (track: Track) => (track.coverVersion ? `${BACKEND_URL}/show/music/cover?v=${track.coverVersion}` : null);

function BlankCover({ className = '' }: { className?: string }) {
  return (
    <svg className={`mu__cover mu__cover--blank ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 17.5V6.2l10-2v11.3M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
    </svg>
  );
}

/**
 * Now playing card: cover art, title and artist of the track OBS is playing.
 * The card stays put across a track change and only its contents swap, the new cover landing on top of the old one;
 * when nothing plays it fades out with the last track still on it.
 */
export default function MusicPage() {
  const params = useOverlayParams();
  const { show } = useEvents();
  const music = show?.music ?? null;
  const pos = POSITIONS.includes(params?.get('pos') ?? '') ? params!.get('pos') : 'bl';
  const scale = Math.min(3, Math.max(0.5, Number(params?.get('scale')) || 1));

  const [track, setTrack] = useState<Track | null>(music);
  // The previous track's art: its cover URL, 'blank' for a track without one, or null for none yet.
  const [under, setUnder] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const current = useRef<Track | null>(null);

  const id = music ? `${music.since}-${music.title}` : null;
  useEffect(() => {
    if (music) {
      // The outgoing cover stays underneath until the new one has landed on it.
      if (current.current) setUnder(coverUrl(current.current) ?? 'blank');
      current.current = music;
      setTrack(music);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const timer = setTimeout(() => {
      current.current = null;
      setTrack(null);
      setUnder(null);
    }, LEAVE_MS);
    return () => clearTimeout(timer);
    // Keyed on the track identity: a new snapshot of the same track must not restart anything.
  }, [id]);

  if (!params || !track) return null;
  const cover = coverUrl(track);
  const key = `${track.since}-${track.title}`;

  return (
    <main className={`mu mu--${pos}`} style={{ ['--scale' as string]: String(scale) }}>
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
      <div className={`mu__card ${leaving ? 'mu__card--leaving' : ''}`}>
        <div className="mu__art">
          {under === 'blank' ? <BlankCover className="mu__cover--under" /> : under && <img className="mu__cover mu__cover--under" src={under} alt="" />}
          {cover ? <img key={key} className="mu__cover" src={cover} alt="" /> : <BlankCover key={key} />}
        </div>
        <div key={key} className="mu__text">
          <strong className="mu__title">{track.title}</strong>
          <span className="mu__artist">
            <span className="mu__eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="mu__name">{track.artist}</span>
          </span>
        </div>
      </div>
    </main>
  );
}
