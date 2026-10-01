'use client';

import { BACKEND_URL } from '../../lib/config';
import { useEvents } from '../../lib/useEvents';
import { FONT_HREF, useNow, useOverlayParams } from '../../lib/useShowOverlay';

const POSITIONS = ['tl', 'tr', 'bl', 'br'];

/** How long the QR code stays open from now, in ms, and the length of that showing; zero when it is closed. */
function qrWindow(sponsor: { url: string; auto: boolean; everySeconds: number; showSeconds: number; visibleUntil: number | null }, now: number) {
  if (!sponsor.url) return { left: 0, total: 1 };
  const show = sponsor.showSeconds * 1000;
  if (sponsor.visibleUntil !== null && sponsor.visibleUntil > now) {
    const left = sponsor.visibleUntil - now;
    return { left, total: Math.max(left, show) };
  }
  if (!sponsor.auto) return { left: 0, total: 1 };
  // The cycle runs off the shared server clock, so every source and a reload open the QR code at the same moment.
  const into = now % (sponsor.everySeconds * 1000);
  return { left: into < show ? show - into : 0, total: show };
}

export default function SponsorPage() {
  const params = useOverlayParams();
  const { show, clockOffset } = useEvents();
  const sponsor = show?.sponsor;
  // The timer bar animates with a 1s CSS transition, so a once-a-second clock is enough.
  const now = useNow(clockOffset, false, 1000);
  const pos = POSITIONS.includes(params?.get('pos') ?? '') ? params!.get('pos') : 'tl';
  const scale = Math.min(3, Math.max(0.5, Number(params?.get('scale')) || 1));

  if (!sponsor) return null;
  const { left, total } = qrWindow(sponsor, now);
  const open = left > 0 && sponsor.qr !== null;
  // With only a link saved there is nothing to keep on screen, but the QR code still shows on its cycle.
  if (!sponsor.logoVersion && !sponsor.name && !open) return null;

  return (
    <main className={`sp sp--${pos} ${open ? 'sp--open' : ''}`} style={{ ['--scale' as string]: String(scale) }}>
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
      <div className={`sp__card ${sponsor.logoVersion ? 'sp__card--logo' : ''}`}>
        {(sponsor.logoVersion || sponsor.name) && (
        <div className="sp__brand">
          {sponsor.logoVersion ? (
            <img className="sp__logo" src={`${BACKEND_URL}/show/sponsor/logo?v=${sponsor.logoVersion}`} alt={sponsor.name} />
          ) : (
            <strong className="sp__name">{sponsor.name}</strong>
          )}
          {sponsor.caption && <p className="sp__caption">{sponsor.caption}</p>}
        </div>
        )}
        {sponsor.qr && (
          <div className="sp__qrwrap" aria-hidden={!open}>
            <div className="sp__qrtile">
              <img className="sp__qr" src={`data:image/svg+xml;utf8,${encodeURIComponent(sponsor.qr)}`} alt="" />
              <span className="sp__timer" style={{ ['--left' as string]: String(open ? Math.min(1, left / total) : 0) }} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
