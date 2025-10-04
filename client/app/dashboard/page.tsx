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
        <div>
          <h1>Operator Dashboard</h1>
          <p className="muted">Click a message to push it to the OBS overlay stream.</p>
        </div>
        <span className={`status status--${overlayStatus}`}>{statusHint}</span>
      </header>

      <section className="dashboard__content">
        <article className="panel">
          <header className="panel__title">Live Chat</header>
          <div className="chatList">
            {messages.map((message) => (
              <button
                key={message.id}
                className={
                  selection?.id === message.id ? 'chatItem chatItem--active' : 'chatItem'
                }
                onClick={() => handleSelect(message)}
              >
                <span className="chatItem__author">{message.author}</span>
                <span className="chatItem__text">{message.text}</span>
                <time>{new Date(message.publishedAt).toLocaleTimeString()}</time>
              </button>
            ))}
            {messages.length === 0 && <p className="muted">Waiting for chat messages…</p>}
          </div>
        </article>

        <article className="panel overlayPreview">
          <header className="panel__title">Overlay Preview</header>
          {selection ? (
            <div className="overlayPreview__card">
              <span className="overlayPreview__author">{selection.author}</span>
              <p>{selection.text}</p>
              <time>{new Date(selection.publishedAt).toLocaleTimeString()}</time>
              <button className="secondary" onClick={handleClear}>
                Clear selection
              </button>
            </div>
          ) : (
            <div className="overlayPreview__empty">
              <p>No message selected yet.</p>
              <button className="secondary" onClick={handleClear}>
                Reset
              </button>
            </div>
          )}
        </article>
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
