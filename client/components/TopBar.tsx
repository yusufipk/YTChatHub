'use client';

import { BarChart3, MonitorPlay, Pause, Play, Search, Unplug } from 'lucide-react';
import type { RefObject } from 'react';
import type { ConnectionStatus, Poll } from '@shared/chat';
import type { StreamState } from '../lib/useEvents';

type Props = {
  status: ConnectionStatus;
  stream: StreamState;
  poll: Poll | null;
  counts: { chat: number; super: number; members: number };
  search: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSearch: (value: string) => void;
  paused: boolean;
  onTogglePause: () => void;
  onOverlaySettings: () => void;
  onDisconnect: () => void;
};

function statusLabel(status: ConnectionStatus, stream: StreamState): { text: string; tone: string } {
  if (stream === 'error') return { text: 'Backend unreachable', tone: 'danger' };
  if (stream === 'connecting') return { text: 'Connecting to backend', tone: 'muted' };
  switch (status.state) {
    case 'live':
      return { text: 'Live', tone: 'live' };
    case 'connecting':
      return { text: 'Connecting', tone: 'warn' };
    case 'reconnecting':
      return { text: 'Reconnecting', tone: 'warn' };
    default:
      return { text: status.error ? `Disconnected: ${status.error}` : 'Disconnected', tone: 'danger' };
  }
}

export function TopBar({ status, stream, poll, counts, search, searchRef, onSearch, paused, onTogglePause, onOverlaySettings, onDisconnect }: Props) {
  const label = statusLabel(status, stream);
  return (
    <header className="topbar">
      <div className="topbar__stream">
        <span className={`dot dot--${label.tone}`} />
        <span className="topbar__title" title={status.liveId ?? undefined}>{status.title || status.liveId || 'No stream'}</span>
        <span className={`chip chip--${label.tone}`}>{label.text}</span>
        {poll?.active && (
          <span className="chip chip--poll" title="A poll is running on YouTube">
            <BarChart3 size={12} />
            Poll
          </span>
        )}
      </div>

      <label className="search">
        <Search size={14} />
        <input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search author or text  ( / )" spellCheck={false} />
      </label>

      <div className="topbar__stats">
        <span title="Chat messages kept">{counts.chat} chat</span>
        <span title="Super Chats this session">{counts.super} super</span>
        <span title="Memberships this session">{counts.members} members</span>
      </div>

      <div className="topbar__actions">
        <button type="button" className={`btn btn--icon ${paused ? 'btn--active' : ''}`} onClick={onTogglePause} title={paused ? 'Resume chat (P)' : 'Pause chat (P)'}>
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button type="button" className="btn" onClick={onOverlaySettings} title="Overlay URL and look">
          <MonitorPlay size={15} />
          Overlay
        </button>
        <button type="button" className="btn btn--icon btn--danger" onClick={onDisconnect} title="Disconnect from this stream">
          <Unplug size={16} />
        </button>
      </div>
    </header>
  );
}
