'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatMessage } from '@shared/chat';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';
const POLL_INTERVAL = 2500;

export default function DashboardPage() {
  const { messages, refresh, error: pollError } = useChatMessages();
  const { selection, status: overlayStatus } = useOverlaySelection();

  const handleSelect = useCallback(
    async (message: ChatMessage) => {
      try {
        await fetch(`${BACKEND_URL}/overlay/selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: message.id })
        });
      } catch (error) {
        console.error('Failed to select message', error);
      }
    },
    []
  );

  const handleClear = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/overlay/selection`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear selection', error);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [refresh]);

  const statusHint = useMemo(() => {
    if (pollError) return 'Backend unreachable';
    if (overlayStatus === 'connecting') return 'Connecting to overlay…';
    if (overlayStatus === 'error') return 'Overlay stream disconnected';
    return 'Live';
  }, [pollError, overlayStatus]);

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__title">
          <h1>🎬 Live Chat Monitor</h1>
          <p className="muted">Select a message to display on your OBS overlay</p>
        </div>
        <div className="dashboard__status">
          <span className={`status status--${overlayStatus}`}>{statusHint}</span>
          <span className="message-count">{messages.length} messages</span>
        </div>
      </header>

      <section className="dashboard__main">
        <div className="chatPanel">
          <div className="chatPanel__header">
            <h2>Live Chat Stream</h2>
            {selection && (
              <button className="btn-clear" onClick={handleClear}>
                Clear Selection
              </button>
            )}
          </div>
          <div className="chatList">
            {messages.map((message) => (
              <button
                key={message.id}
                className={
                  selection?.id === message.id ? 'chatItem chatItem--active' : 'chatItem'
                }
                onClick={() => handleSelect(message)}
              >
                <div className="chatItem__header">
                  {message.authorPhoto && (
                    <img src={message.authorPhoto} alt={message.author} className="chatItem__avatar" />
                  )}
                  <div className="chatItem__meta">
                    <div className="chatItem__authorLine">
                      <span className="chatItem__author">{message.author}</span>
                      {message.badges && message.badges.map((badge, i) => (
                        <span key={i} className={`badge badge--${badge.type}`} title={badge.label}>
                          {badge.type === 'moderator' && '🛡️'}
                          {badge.type === 'member' && '⭐'}
                          {badge.type === 'verified' && '✓'}
                        </span>
                      ))}
                    </div>
                    <time className="chatItem__time">{new Date(message.publishedAt).toLocaleTimeString()}</time>
                  </div>
                </div>
                {message.superChat && (
                  <div className="chatItem__superchat" style={{ backgroundColor: message.superChat.color }}>
                    💰 Super Chat: {message.superChat.amount}
                  </div>
                )}
                {message.membershipGift && (
                  <div className="chatItem__membership">
                    🎁 New Member!
                  </div>
                )}
                <p className="chatItem__text">{message.text}</p>
              </button>
            ))}
            {messages.length === 0 && (
              <div className="chatList__empty">
                <p>⏳ Waiting for chat messages...</p>
              </div>
            )}
          </div>
        </div>

        {selection && (
          <div className="selectedPreview">
            <h3>🎯 Selected for Overlay</h3>
            <div className="selectedPreview__card">
              <div className="selectedPreview__header">
                {selection.authorPhoto && (
                  <img src={selection.authorPhoto} alt={selection.author} className="selectedPreview__avatar" />
                )}
                <div>
                  <div className="selectedPreview__authorLine">
                    <span className="selectedPreview__author">{selection.author}</span>
                    {selection.badges && selection.badges.map((badge, i) => (
                      <span key={i} className={`badge badge--${badge.type}`} title={badge.label}>
                        {badge.type === 'moderator' && '🛡️'}
                        {badge.type === 'member' && '⭐'}
                        {badge.type === 'verified' && '✓'}
                      </span>
                    ))}
                  </div>
                  <time>{new Date(selection.publishedAt).toLocaleTimeString()}</time>
                </div>
              </div>
              {selection.superChat && (
                <div className="selectedPreview__superchat" style={{ backgroundColor: selection.superChat.color }}>
                  💰 {selection.superChat.amount}
                </div>
              )}
              <p className="selectedPreview__text">{selection.text}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/chat/messages`);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { messages, refresh, error };
}

type OverlayStatus = 'connecting' | 'live' | 'error';

type SelectionPayload = {
  message: ChatMessage | null;
};

function useOverlaySelection() {
  const [selection, setSelection] = useState<ChatMessage | null>(null);
  const [status, setStatus] = useState<OverlayStatus>('connecting');

  useEffect(() => {
    const source = new EventSource(`${BACKEND_URL}/overlay/stream`);

    const onSelection = (event: MessageEvent) => {
      try {
        const payload: SelectionPayload = JSON.parse(event.data);
        setSelection(payload.message);
        setStatus('live');
      } catch (error) {
        console.error('Failed to parse selection payload', error);
      }
    };

    source.addEventListener('selection', onSelection as EventListener);
    source.addEventListener('heartbeat', () => setStatus('live'));
    source.onerror = () => setStatus('error');

    return () => {
      source.removeEventListener('selection', onSelection as EventListener);
      source.close();
    };
  }, []);

  return { selection, status };
}
