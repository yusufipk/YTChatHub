'use client';

import { Gift, MessageSquare, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@shared/chat';
import { api } from '../../lib/api';
import { useEvents } from '../../lib/useEvents';
import { ChatList } from '../../components/ChatList';
import { ConnectForm } from '../../components/ConnectForm';
import { MessageCard } from '../../components/MessageCard';
import { OnAir } from '../../components/OnAir';
import { OverlaySettings } from '../../components/OverlaySettings';
import { TopBar } from '../../components/TopBar';

type Toast = { id: number; text: string };

function matches(message: ChatMessage, needle: string): boolean {
  if (!needle) return true;
  return message.author.toLowerCase().includes(needle) || message.text.toLowerCase().includes(needle);
}

export default function DashboardPage() {
  const { stream, status, messages, selection, poll } = useEvents();
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkToOpen, setLinkToOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const shownBefore = useRef(new Set<string>());
  const searchRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text }]);
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 4000);
  }, []);

  const select = useCallback(
    async (message: ChatMessage) => {
      try {
        if (selection?.id === message.id) {
          await api.clearSelection();
        } else {
          shownBefore.current.add(message.id);
          await api.select(message.id);
        }
      } catch (error) {
        toast(`Could not update overlay: ${(error as Error).message}`);
      }
    },
    [selection, toast]
  );

  const clearSelection = useCallback(async () => {
    try {
      await api.clearSelection();
    } catch (error) {
      toast(`Could not clear overlay: ${(error as Error).message}`);
    }
  }, [toast]);

  const connect = useCallback(async (liveId: string) => {
    setBusy(true);
    setConnectError(null);
    try {
      await api.connect(liveId);
      shownBefore.current.clear();
    } catch (error) {
      setConnectError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await api.disconnect();
    } catch (error) {
      toast(`Could not disconnect: ${(error as Error).message}`);
    }
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (typing) {
        if (event.key === 'Escape') (target as HTMLElement).blur();
        return;
      }
      if (event.key === 'Escape') {
        if (linkToOpen) setLinkToOpen(null);
        else if (settingsOpen) setSettingsOpen(false);
        else if (selection) void clearSelection();
      } else if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === 'p') {
        setPaused((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, linkToOpen, settingsOpen, clearSelection]);

  const needle = search.trim().toLowerCase();
  const groups = useMemo(() => {
    const chat: ChatMessage[] = [];
    const supers: ChatMessage[] = [];
    const members: ChatMessage[] = [];
    for (const message of messages) {
      if (!matches(message, needle)) continue;
      if (message.superChat) supers.push(message);
      else if (message.membershipGift || message.membershipGiftPurchase) members.push(message);
      else chat.push(message);
    }
    return { chat, supers, members };
  }, [messages, needle]);

  const renderCard = (message: ChatMessage) => (
    <MessageCard
      key={message.id}
      message={message}
      selected={selection?.id === message.id}
      wasSelected={selection?.id !== message.id && shownBefore.current.has(message.id)}
      onSelect={select}
      onLink={setLinkToOpen}
    />
  );

  // Mock mode feeds messages while disconnected; keep the dashboard up in that case.
  const showConnect = (status.state === 'disconnected' || status.state === 'connecting') && messages.length === 0;

  return (
    <main className="dash">
      {showConnect ? (
        <ConnectForm
          busy={busy || status.state === 'connecting'}
          error={connectError ?? (stream === 'error' ? 'Backend is not reachable. Is it running?' : status.error ?? null)}
          onConnect={connect}
        />
      ) : (
        <>
          <TopBar
            status={status}
            stream={stream}
            poll={poll}
            counts={{ chat: groups.chat.length, super: groups.supers.length, members: groups.members.length }}
            search={search}
            searchRef={searchRef}
            onSearch={setSearch}
            paused={paused}
            onTogglePause={() => setPaused((value) => !value)}
            onOverlaySettings={() => setSettingsOpen(true)}
            onDisconnect={disconnect}
          />
          <OnAir selection={selection} onClear={clearSelection} />
          <section className="grid">
            <div className="panel">
              <div className="panel__head">
                <MessageSquare size={13} />
                Chat
                {needle && <span className="panel__note">filtered</span>}
              </div>
              <ChatList messages={groups.chat} paused={paused} render={renderCard} empty={needle ? 'No messages match.' : 'Waiting for messages…'} />
            </div>
            <div className="side">
              <div className="panel">
                <div className="panel__head">
                  <Sparkles size={13} />
                  Super Chats
                </div>
                <ChatList messages={groups.supers} render={renderCard} empty="No Super Chats yet." />
              </div>
              <div className="panel">
                <div className="panel__head">
                  <Gift size={13} />
                  Memberships
                </div>
                <ChatList messages={groups.members} render={renderCard} empty="No new members yet." />
              </div>
            </div>
          </section>
        </>
      )}

      {settingsOpen && <OverlaySettings onClose={() => setSettingsOpen(false)} />}

      {linkToOpen && (
        <div className="modal" onClick={() => setLinkToOpen(null)}>
          <div className="modal__card" onClick={(event) => event.stopPropagation()}>
            <h2>Open this link?</h2>
            <p className="modal__url">{linkToOpen}</p>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={() => setLinkToOpen(null)}>Cancel</button>
              <a className="btn btn--primary" href={linkToOpen} target="_blank" rel="noopener noreferrer" onClick={() => setLinkToOpen(null)}>
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((item) => (
            <div key={item.id} className="toast">{item.text}</div>
          ))}
        </div>
      )}
    </main>
  );
}
