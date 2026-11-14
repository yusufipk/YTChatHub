'use client';

import { BarChart3, Clapperboard, Gem, MonitorPlay, Pause, Play, Search, Unplug } from 'lucide-react';
import type { RefObject } from 'react';
import type { ConnectionStatus, GiftPricesStatus, Poll } from '@shared/chat';
import type { StreamState } from '../lib/useEvents';
import { setLang, useLang, STRINGS, type Strings } from '../lib/i18n';

type Props = {
  status: ConnectionStatus;
  stream: StreamState;
  poll: Poll | null;
  gifts: GiftPricesStatus | null;
  counts: { chat: number; super: number; members: number };
  search: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSearch: (value: string) => void;
  paused: boolean;
  onTogglePause: () => void;
  onOverlaySettings: () => void;
  onDisconnect: () => void;
};

/** Tooltip for the gift price warning: what is still in use and what to do. */
function giftTooltip(gifts: GiftPricesStatus, t: Strings): string {
  const saved = gifts.updatedAt ? t.giftSaved(gifts.count, new Date(gifts.updatedAt).toLocaleString(t.locale)) : t.giftNoneSaved;
  const cause = gifts.state === 'expired' ? t.giftExpiredCause : t.giftFailedCause(gifts.error ?? '?');
  return `${cause} ${saved}`;
}

function statusLabel(status: ConnectionStatus, stream: StreamState, t: Strings): { text: string; tone: string } {
  if (stream === 'error') return { text: t.backendUnreachable, tone: 'danger' };
  if (stream === 'connecting') return { text: t.backendConnecting, tone: 'muted' };
  switch (status.state) {
    case 'live':
      return { text: t.live, tone: 'live' };
    case 'connecting':
      return { text: t.connecting, tone: 'warn' };
    case 'reconnecting':
      return { text: t.reconnecting, tone: 'warn' };
    default:
      return { text: status.error ? t.disconnectedWith(status.error) : t.disconnected, tone: 'danger' };
  }
}

export function TopBar({ status, stream, poll, gifts, counts, search, searchRef, onSearch, paused, onTogglePause, onOverlaySettings, onDisconnect }: Props) {
  const lang = useLang();
  const t = STRINGS[lang];
  const label = statusLabel(status, stream, t);
  return (
    <header className="topbar">
      <div className="topbar__stream">
        <span className={`dot dot--${label.tone}`} />
        <span className="topbar__title" title={status.liveId ?? undefined}>{status.title || status.liveId || t.noStream}</span>
        <span className={`chip chip--${label.tone}`}>{label.text}</span>
        {(gifts?.state === 'expired' || gifts?.state === 'failed') && (
          <span className="chip chip--warn" title={giftTooltip(gifts, t)}>
            <Gem size={12} />
            {gifts.state === 'expired' ? t.giftCookieExpired : t.giftPricesFailed}
          </span>
        )}
        {poll?.active && (
          <span className="chip chip--poll" title={t.pollTitle}>
            <BarChart3 size={12} />
            {t.poll}
          </span>
        )}
      </div>

      <label className="search">
        <Search size={14} />
        <input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder={t.search} spellCheck={false} />
      </label>

      <div className="topbar__stats">
        <span title={t.statChatTitle}>{t.statChat(counts.chat)}</span>
        <span title={t.statSuperTitle}>{t.statSuper(counts.super)}</span>
        <span title={t.statMembersTitle}>{t.statMembers(counts.members)}</span>
      </div>

      <div className="topbar__actions">
        <button type="button" className={`btn btn--icon ${paused ? 'btn--active' : ''}`} onClick={onTogglePause} title={paused ? t.resume : t.pause}>
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <a className="btn" href="/show/" title={t.showTitle}>
          <Clapperboard size={15} />
          {t.show}
        </a>
        <button type="button" className="btn" onClick={onOverlaySettings} title={t.overlayTitle}>
          <MonitorPlay size={15} />
          {t.overlay}
        </button>
        <button type="button" className="btn btn--icon btn--danger" onClick={onDisconnect} title={t.disconnect}>
          <Unplug size={16} />
        </button>
        <button type="button" className="btn btn--icon" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} title={t.langToggleTitle}>
          {t.langToggle}
        </button>
      </div>
    </header>
  );
}
